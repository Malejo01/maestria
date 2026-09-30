import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure, captureFileParsingFailure, captureRouteFailure } from '@/lib/observability'
import { z } from 'zod'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { sql } from '@/lib/db'
import { AI_MODEL } from '@/lib/ai-model'

export const runtime = 'nodejs'

const parsedProgramSchema = z.object({
  units: z.array(
    z.object({
      name: z.string().min(1),
      topics: z.array(
        z.object({
          name: z.string().min(1),
        })
      ).min(1),
    })
  ).min(1),
})

type ParsedProgram = z.infer<typeof parsedProgramSchema>

function normalizeLine(line: string): string {
  return line
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function extractCurriculumSection(rawText: string): string {
  const lines = rawText.split(/\r?\n/).map(normalizeLine)

  const startMatchers = [
    /contenidos?\s+de\s+la\s+materia/i,
    /contenidos?\s+del\s+programa/i,
    /contenidos?\s+m[ií]nimos/i,
    /programa\s+anal[ií]tico/i,
    /programa\s+anal[ií]tico\s+de\s+contenidos?/i,
    /estructura\s+curricular/i,
    /unidades?\s+did[aá]cticas?/i,
    /organizaci[oó]n\s+de\s+los\s+contenidos?\s+anuales?/i,
    /ejes?\s+tem[aá]ticos?\s+organizadores?/i,
    /bloques?\s+tem[aá]ticos?/i,
    /secuenciaci[oó]n\s+de\s+contenidos?/i,
    /saberes?\s+prioritarios/i,
    /ejes?\s+de\s+aprendizaje/i,
    /unidades?\s+de\s+aprendizaje\s+integradas?/i,
    /nodos?\s+tem[aá]ticos?/i,
    /temario/i,
    /unidades?\s+tem[aá]ticas?/i,
    /^contenidos?$/i,
  ]

  const endMatchers = [
    /^bibliograf[ií]a/i,
    /^evaluaci[oó]n/i,
    /^metodolog[ií]a/i,
    /^cronograma/i,
    /^objetivos?/i,
    /^correlativas?/i,
    /^fundamentaci[oó]n/i,
    /^propuesta\s+metodol[oó]gica/i,
    /^criterios?\s+de\s+evaluaci[oó]n/i,
  ]

  let startIndex = lines.findIndex((line) => startMatchers.some((matcher) => matcher.test(line)))
  if (startIndex < 0) {
    startIndex = 0
  }

  let endIndex = lines.length
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (endMatchers.some((matcher) => matcher.test(lines[i]))) {
      endIndex = i
      break
    }
  }

  const section = lines.slice(startIndex, endIndex).join('\n').trim()
  return section.length > 0 ? section : rawText.slice(0, 12000)
}

function isLikelyUnitLine(line: string): boolean {
  return /^(unidad|unit|m[oó]dulo|modulo|eje|bloque)\s*\d*/i.test(line)
}

function splitTopicsFromLine(line: string): string[] {
  const cleaned = line.replace(/^[\-•*\d\.\)\s]+/, '').trim()
  if (cleaned.length === 0) {
    return ['Tema principal']
  }

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length <= 1) {
    return [cleaned]
  }

  return parts
}

function parseHeuristicProgram(rawText: string): ParsedProgram {
  const section = extractCurriculumSection(rawText)
  const lines = section
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 2)
    .slice(0, 220)

  const units: ParsedProgram['units'] = []
  let currentUnit: ParsedProgram['units'][number] | null = null

  for (const line of lines) {
    if (isLikelyUnitLine(line)) {
      currentUnit = {
        name: line.replace(/[:\-\s]+$/, '').trim(),
        topics: [],
      }
      units.push(currentUnit)
      continue
    }

    if (!currentUnit) {
      currentUnit = {
        name: 'Unidad 1',
        topics: [],
      }
      units.push(currentUnit)
    }

    const topics = splitTopicsFromLine(line)
    for (const topic of topics) {
      currentUnit.topics.push({ name: topic })
    }
  }

  const sanitizedUnits = units
    .map((unit, index) => ({
      name: unit.name || `Unidad ${index + 1}`,
      topics: unit.topics.filter((topic) => topic.name.trim().length > 0),
    }))
    .filter((unit) => unit.topics.length > 0)

  if (sanitizedUnits.length > 0) {
    return { units: sanitizedUnits }
  }

  const cleaned = Array.from(new Set(lines)).slice(0, 20)

  const topics = cleaned
    .slice(0, 20)
    .map((line) => line.replace(/^[\-*\d\.\)\s]+/, '').trim())
    .filter((line) => line.length > 0)

  return {
    units: [
      {
        name: 'Unidad 1',
        topics: topics.length > 0 ? topics.map((name) => ({ name })) : [{ name: 'Temas extraidos del programa' }],
      },
    ],
  }
}

function normalizeDocMimeType(file: File): string {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.doc') || file.type === 'application/msword') {
    return 'application/msword'
  }
  if (lowerName.endsWith('.png') || file.type === 'image/png') {
    return 'image/png'
  }
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || file.type === 'image/jpeg') {
    return 'image/jpeg'
  }
  if (lowerName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf'
  }

  return file.type
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfModule = await import('pdf-parse')
  const legacyParse = (pdfModule as unknown as { default?: (data: Buffer) => Promise<{ text?: string }> }).default

  // Backward compatibility for older pdf-parse versions that export a function.
  if (typeof legacyParse === 'function') {
    const parsed = await legacyParse(buffer)
    return (parsed?.text || '').trim()
  }

  const PDFParseClass = (pdfModule as unknown as { PDFParse?: new (params: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> } }).PDFParse

  if (typeof PDFParseClass !== 'function') {
    throw new Error('PDF parser no disponible: exportacion invalida de pdf-parse')
  }

  const parserWithWorker = pdfModule as unknown as {
    PDFParse?: {
      new (params: { data: Buffer }): { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> }
      setWorker?: (workerSrc?: string) => string
    }
  }

  if (typeof parserWithWorker.PDFParse?.setWorker === 'function') {
    parserWithWorker.PDFParse.setWorker('pdfjs-dist/legacy/build/pdf.worker.mjs')
  }

  const parser = new PDFParseClass({ data: buffer })
  try {
    const parsed = await parser.getText()
    return (parsed?.text || '').trim()
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy()
    }
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return (result.value || '').trim()
}

async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  const wordExtractorModule = await import('word-extractor')
  const WordExtractor = wordExtractorModule.default
  const extractor = new WordExtractor()
  const document = await extractor.extract(buffer)
  return String(document.getBody() || '').trim()
}

async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const tesseract = await import('tesseract.js')
  const result = await tesseract.recognize(buffer, 'spa+eng')
  return String(result?.data?.text || '').trim()
}

function estimateConfidence(parsed: ParsedProgram, extractionMethod: 'ai' | 'heuristic') {
  const unitCount = parsed.units.length
  const topicCount = parsed.units.reduce((acc, unit) => acc + unit.topics.length, 0)
  const genericTopicCount = parsed.units.reduce(
    (acc, unit) =>
      acc +
      unit.topics.filter((topic) => /^(tema|contenido|unidad)\s*(principal|\d+)?$/i.test(topic.name.trim())).length,
    0
  )

  let score = extractionMethod === 'ai' ? 0.86 : 0.62
  if (unitCount >= 2) score += 0.05
  if (topicCount >= 8) score += 0.05
  if (genericTopicCount > 0) score -= Math.min(0.18, genericTopicCount * 0.03)

  const confidence = Math.max(0.3, Math.min(0.98, score))
  return {
    confidence,
    lowConfidence: confidence < 0.82,
    unitCount,
    topicCount,
  }
}

async function requireTeacher(userId: string) {
  const rows = await sql`
    SELECT COALESCE(role, 'ALUMNO') AS role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 && rows[0].role === 'DOCENTE'
}

function normalizeUnits(parsed: ParsedProgram) {
  return parsed.units.map((unit, unitIndex) => ({
    id: `tp-u-${unitIndex + 1}`,
    name: unit.name,
    topics: unit.topics.map((topic, topicIndex) => ({
      id: `tp-u-${unitIndex + 1}-t-${topicIndex + 1}`,
      name: topic.name,
    })),
  }))
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden subir programas' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Debes subir un archivo' }, { status: 400 })
    }

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/png',
      'image/jpeg',
    ]

    const normalizedMimeType = normalizeDocMimeType(file)

    if (!validTypes.includes(normalizedMimeType)) {
      return NextResponse.json({ error: 'Solo se aceptan PDF, DOCX, DOC, PNG y JPG' }, { status: 400 })
    }

    const maxSizeBytes = 5 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'El archivo supera el limite de 5MB' }, { status: 400 })
    }

    // Tipo y tamaño ya validados: un archivo rechazado no consume cupo. El rol
    // va explícito porque requireTeacher acaba de leerlo de la base, y el JWT
    // podría estar desactualizado si el docente cambió de rol recién.
    const guard = await guardAiCall({ bucket: 'program_extraction', actor: 'docente' })
    if (!guard.ok) return guard.response

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Cada formato trae su propia librería y sus propias formas de romperse (un
    // PDF escaneado, un .doc de Word 97, un OCR que no encuentra nada). El tag
    // por parser es lo que después permite ver si falla un formato puntual en
    // vez de mirar un montón de errores genéricos de "no se pudo procesar".
    const parser = normalizedMimeType === 'application/pdf'
      ? 'pdf-parse'
      : normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? 'mammoth'
        : normalizedMimeType === 'application/msword'
          ? 'word-extractor'
          : 'tesseract'

    let extractedText = ''
    try {
      if (parser === 'pdf-parse') {
        extractedText = await extractTextFromPdf(fileBuffer)
      } else if (parser === 'mammoth') {
        extractedText = await extractTextFromDocx(fileBuffer)
      } else if (parser === 'word-extractor') {
        extractedText = await extractTextFromDoc(fileBuffer)
      } else {
        extractedText = await extractTextFromImage(fileBuffer)
      }
    } catch (parsingError) {
      captureFileParsingFailure(parsingError, {
        parser,
        mimeType: normalizedMimeType,
        sizeBytes: file.size,
      })
      await guard.fail()
      return NextResponse.json(
        { error: 'No se pudo leer el archivo. Probá con otro formato o volvé a exportarlo.' },
        { status: 422 }
      )
    }

    if (!extractedText || extractedText.length < 100) {
      await guard.fail()
      return NextResponse.json(
        { error: 'No se pudo extraer contenido util del archivo. Intenta con otro documento.' },
        { status: 422 }
      )
    }

    const curriculumSection = extractCurriculumSection(extractedText)
    const clippedText = extractedText.slice(0, 25000)
    const clippedSection = curriculumSection.slice(0, 15000)

    let parsedProgram: ParsedProgram
    let extractionMethod: 'ai' | 'heuristic' = 'ai'

    try {
      const { object, usage } = await generateObject({
        model: google(AI_MODEL),
        schema: parsedProgramSchema,
        schemaName: 'programStructure',
        schemaDescription: 'Estructura curricular con unidades y temas',
        system: 'Eres un asistente academico. Extrae una estructura curricular jerarquica precisa.',
        prompt: `Analiza el programa y devuelve la estructura curricular en este orden de prioridad:
1) Unidades
2) Temas dentro de cada unidad

Busca primero la seccion equivalente a: "Programa Analitico de Contenidos", "Estructura Curricular", "Contenidos del Programa", "Temario", "Unidades Didacticas", "Ejes de Aprendizaje", "Saberes Prioritarios" o "Bloques Tematicos".
Normaliza cualquier nombre de agrupador (eje, bloque, modulo, nodo) como "Unidad".
Si hay conflicto entre secciones, prioriza la seccion de contenidos.
No inventes unidades ni temas que no aparezcan en el documento.

Seccion prioritaria detectada:
${clippedSection}

Documento completo (respaldo):
${clippedText}`,
        temperature: 0.2,
        maxOutputTokens: 2500,
      })

      parsedProgram = parsedProgramSchema.parse(object)
      await guard.finish(usage)
    } catch (schemaError) {
      // Silencioso para el docente: cae al heurístico y ve un resultado peor
      // sin ningún aviso. Por eso se reporta.
      captureAiSchemaFailure(schemaError, {
        endpoint: '/api/teacher/programs/extract',
        fallback: 'heuristic',
      })
      // El heurístico no llama al modelo; el intento fallido igual se facturó.
      await guard.fail()
      parsedProgram = parseHeuristicProgram(clippedText)
      extractionMethod = 'heuristic'
    }

    try {
      await sql`
        INSERT INTO teacher_program_uploads (
          user_id,
          file_name,
          mime_type,
          file_size_bytes,
          file_data,
          created_at,
          expires_at
        )
        VALUES (
          ${userId},
          ${file.name},
          ${file.type},
          ${file.size},
          ${fileBuffer},
          NOW(),
          NOW() + INTERVAL '24 hours'
        )
      `
    } catch (uploadError) {
      console.error('No se pudo persistir temporalmente el archivo del programa', uploadError)
    }

    const normalizedUnits = normalizeUnits(parsedProgram)
    const quality = estimateConfidence(parsedProgram, extractionMethod)

    return NextResponse.json({
      sourceFileName: file.name,
      sourceMimeType: normalizedMimeType,
      sourceFileSizeBytes: file.size,
      units: normalizedUnits,
      extractionMethod,
      extractionConfidence: quality.confidence,
      lowConfidence: quality.lowConfidence,
      summary: {
        unitCount: quality.unitCount,
        topicCount: quality.topicCount,
      },
    })
  } catch (error) {
    captureRouteFailure(error, {
      endpoint: '/api/teacher/programs/extract',
      status: 500,
      operation: 'extract_program',
    })
    return NextResponse.json(
      {
        error: 'No se pudo procesar el archivo',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
