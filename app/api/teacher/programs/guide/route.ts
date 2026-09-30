import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { sql } from '@/lib/db'
import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure, captureFileParsingFailure, captureRouteFailure } from '@/lib/observability'
import { AI_MODEL } from '@/lib/ai-model'

export const runtime = 'nodejs'

const continuationSchema = z.object({
  units: z.array(
    z.object({
      name: z.string().min(1),
      topics: z.array(z.object({ name: z.string().min(1) })).min(1),
    })
  ).min(1),
})

const guideRequestSchema = z.object({
  sourceFileName: z.string().min(1),
  seedUnitName: z.string().min(1),
  seedTopics: z.array(z.string().min(1)).min(2),
  anchorUnitName: z.string().optional(),
  rejectedUnitNames: z.array(z.string().min(1)).optional(),
  rejectedTopicNames: z.array(z.string().min(1)).optional(),
  guidanceNote: z.string().max(1000).optional(),
  retryCount: z.number().int().min(0).max(12).optional(),
})

type ParsedProgram = z.infer<typeof continuationSchema>

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
  return section.length > 0 ? section : rawText.slice(0, 18000)
}

function normalizeStoredMimeType(fileName: string, mimeType: string): string {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.doc') || mimeType === 'application/msword') {
    return 'application/msword'
  }
  if (lowerName.endsWith('.png') || mimeType === 'image/png') {
    return 'image/png'
  }
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || mimeType === 'image/jpeg') {
    return 'image/jpeg'
  }
  if (lowerName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf'
  }

  return mimeType
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfModule = await import('pdf-parse')
  const legacyParse = (pdfModule as unknown as { default?: (data: Buffer) => Promise<{ text?: string }> }).default

  if (typeof legacyParse === 'function') {
    const parsed = await legacyParse(buffer)
    return (parsed?.text || '').trim()
  }

  const PDFParseClass = (pdfModule as unknown as {
    PDFParse?: new (params: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>
      destroy?: () => Promise<void>
    }
  }).PDFParse

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

/** Qué librería atiende cada formato, para etiquetar el error en Sentry. */
function parserForMime(mimeType: string): 'pdf-parse' | 'mammoth' | 'word-extractor' | 'tesseract' {
  if (mimeType === 'application/pdf') return 'pdf-parse'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'mammoth'
  if (mimeType === 'application/msword') return 'word-extractor'
  return 'tesseract'
}

async function extractTextByMime(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer)
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer)
  }
  if (mimeType === 'application/msword') {
    return extractTextFromDoc(buffer)
  }
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
    return extractTextFromImage(buffer)
  }

  throw new Error('Tipo de archivo no soportado para guiado')
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function lineScore(line: string, seeds: string[]): number {
  const lineTokens = new Set(tokenize(line))
  if (lineTokens.size === 0) return 0

  const seedTokens = new Set(seeds.flatMap((seed) => tokenize(seed)))
  if (seedTokens.size === 0) return 0

  let overlap = 0
  for (const token of seedTokens) {
    if (lineTokens.has(token)) {
      overlap += 1
    }
  }

  const overlapScore = overlap / Math.max(seedTokens.size, 1)
  const numberingBonus = /\b(unidad|u\.|bloque|eje|modulo|m[oó]dulo)\b\s*[0-9ivx]+/i.test(line) ? 0.12 : 0
  return overlapScore + numberingBonus
}

function findAnchorIndex(lines: string[], seeds: string[]): { index: number; score: number } {
  let bestIndex = 0
  let bestScore = 0

  for (let i = 0; i < lines.length; i += 1) {
    const score = lineScore(lines[i], seeds)
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return { index: bestIndex, score: bestScore }
}

function isLikelyUnitLine(line: string): boolean {
  return /^(unidad|unit|m[oó]dulo|modulo|eje|bloque)\s*\d*/i.test(line)
}

function splitTopicsFromLine(line: string): string[] {
  const cleaned = line.replace(/^[\-•*\d\.\)\s]+/, '').trim()
  if (cleaned.length === 0) return []

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  return parts.length > 1 ? parts : [cleaned]
}

function parseHeuristicProgram(rawText: string): ParsedProgram {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 2)
    .slice(0, 320)

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

  return {
    units:
      sanitizedUnits.length > 0
        ? sanitizedUnits
        : [
            {
              name: 'Unidad 1',
              topics: [{ name: 'Temas sugeridos desde guia' }],
            },
          ],
  }
}

function normalizeUnits(parsed: ParsedProgram) {
  return parsed.units.map((unit, unitIndex) => ({
    id: `gp-u-${unitIndex + 1}`,
    name: unit.name,
    topics: unit.topics.map((topic, topicIndex) => ({
      id: `gp-u-${unitIndex + 1}-t-${topicIndex + 1}`,
      name: topic.name,
    })),
  }))
}

function sanitizeContinuation(parsed: ParsedProgram, seedUnitName: string): ParsedProgram {
  const normalizedSeed = seedUnitName.trim().toLowerCase()
  const units = parsed.units.filter((unit, index) => {
    if (index > 0) return true
    const current = unit.name.trim().toLowerCase()
    return current !== normalizedSeed
  })

  return {
    units: units.length > 0 ? units : parsed.units,
  }
}

function filterRejectedContent(
  parsed: ParsedProgram,
  rejectedUnitNames: string[],
  rejectedTopicNames: string[]
): ParsedProgram {
  const rejectedUnits = new Set(rejectedUnitNames.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
  const rejectedTopics = new Set(rejectedTopicNames.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))

  const units = parsed.units
    .filter((unit) => !rejectedUnits.has(unit.name.trim().toLowerCase()))
    .map((unit) => ({
      ...unit,
      topics: unit.topics.filter((topic) => !rejectedTopics.has(topic.name.trim().toLowerCase())),
    }))
    .filter((unit) => unit.topics.length > 0)

  if (units.length === 0) {
    return parsed
  }

  return { units }
}

function estimateGuideConfidence(
  parsed: ParsedProgram,
  method: 'ai' | 'heuristic',
  anchorScore: number,
  strategy: 'semantic' | 'numbering' | 'hybrid'
) {
  const unitCount = parsed.units.length
  const topicCount = parsed.units.reduce((acc, unit) => acc + unit.topics.length, 0)

  let score = method === 'ai' ? 0.82 : 0.6
  score += Math.min(0.12, anchorScore * 0.18)
  if (strategy === 'hybrid') score += 0.05
  if (unitCount >= 2) score += 0.05
  if (topicCount >= 6) score += 0.05

  const confidence = Math.max(0.3, Math.min(0.98, score))
  return {
    confidence,
    lowConfidence: confidence < 0.82,
    unitCount,
    topicCount,
  }
}

function buildPatternSignature(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 0)
    .slice(0, 500)

  const hasRoman = lines.some((line) => /\b[ivxlcdm]+\b/i.test(line))
  const hasDecimal = lines.some((line) => /\b\d+(\.\d+)+\b/.test(line))
  const hasBullets = lines.some((line) => /^[\-•*]/.test(line))
  const hasUnitLabels = lines.some((line) => /\b(unidad|eje|bloque|modulo|m[oó]dulo)\b/i.test(line))

  const headings = lines
    .filter((line) => line.length <= 120)
    .filter((line) => /^[A-ZÁÉÍÓÚÑ0-9\s\-:]+$/.test(line) || /(contenidos?|temario|estructura|unidades?|saberes?)/i.test(line))
    .slice(0, 16)

  return {
    hasRoman,
    hasDecimal,
    hasBullets,
    hasUnitLabels,
    headings,
    avgLineLength: lines.length > 0 ? Math.round(lines.reduce((acc, line) => acc + line.length, 0) / lines.length) : 0,
  }
}

async function saveGlobalPattern(signature: unknown, confidence: number) {
  const signatureJson = JSON.stringify(signature)
  const hash = createHash('sha256').update(signatureJson).digest('hex')

  try {
    await sql`
      INSERT INTO curriculum_structure_patterns (
        pattern_hash,
        language,
        source_kind,
        signature,
        use_count,
        quality_score,
        created_at,
        last_seen_at
      )
      VALUES (
        ${hash},
        'es',
        'teacher_program',
        ${signatureJson},
        1,
        ${confidence},
        NOW(),
        NOW()
      )
      ON CONFLICT (pattern_hash)
      DO UPDATE SET
        use_count = curriculum_structure_patterns.use_count + 1,
        last_seen_at = NOW(),
        quality_score = ROUND((((curriculum_structure_patterns.quality_score * curriculum_structure_patterns.use_count) + ${confidence}) / (curriculum_structure_patterns.use_count + 1))::numeric, 4)
    `
  } catch (error) {
    console.error('No se pudo guardar patron estructural global', error)
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

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden usar guiado' }, { status: 403 })
    }

    const body = await req.json()
    const payload = guideRequestSchema.parse(body)
    const rejectedUnitNames = Array.isArray(payload.rejectedUnitNames) ? payload.rejectedUnitNames : []
    const rejectedTopicNames = Array.isArray(payload.rejectedTopicNames) ? payload.rejectedTopicNames : []
    const guidanceNote = payload.guidanceNote?.trim() || ''
    const retryCount = payload.retryCount ?? 0

    const uploads = await sql`
      SELECT file_name, mime_type, file_data
      FROM teacher_program_uploads
      WHERE user_id = ${userId}
        AND file_name = ${payload.sourceFileName}
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (uploads.length === 0) {
      return NextResponse.json(
        {
          error: 'No se encontro el archivo temporal para guiado',
          details: 'Vuelve a cargar el archivo y reintenta el autocompletado.',
        },
        { status: 404 }
      )
    }

    // Con el archivo temporal ya localizado: si no existe, la request murió
    // antes de costar nada y no tiene por qué consumir cupo.
    const guard = await guardAiCall({ bucket: 'program_extraction', actor: 'docente' })
    if (!guard.ok) return guard.response

    const upload = uploads[0] as { file_name: string; mime_type: string; file_data: Buffer | Uint8Array }
    const mimeType = normalizeStoredMimeType(upload.file_name, upload.mime_type)
    const fileBuffer = Buffer.isBuffer(upload.file_data) ? upload.file_data : Buffer.from(upload.file_data)

    const extractedText = await extractTextByMime(fileBuffer, mimeType).catch((parsingError) => {
      captureFileParsingFailure(parsingError, {
        parser: parserForMime(mimeType),
        mimeType,
        sizeBytes: fileBuffer.length,
      })
      // Devolver vacío deja que el chequeo de abajo responda el 422 de siempre,
      // en vez de que el error caiga en el catch genérico como un 500.
      return ''
    })

    if (!extractedText || extractedText.length < 100) {
      await guard.fail()
      return NextResponse.json(
        { error: 'No se pudo extraer suficiente texto para guiado' },
        { status: 422 }
      )
    }

    const section = extractCurriculumSection(extractedText)
    const lines = section
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter((line) => line.length > 2)

    const anchorSearch = [payload.seedUnitName, ...payload.seedTopics, payload.anchorUnitName || '']
    const { index: anchorIndex, score: semanticScore } = findAnchorIndex(lines, anchorSearch)

    const beforeWindow = retryCount > 0 ? 60 : 20
    const afterWindow = retryCount > 0 ? 620 : 420
    const aroundAnchor = lines.slice(Math.max(0, anchorIndex - beforeWindow), Math.min(lines.length, anchorIndex + afterWindow)).join('\n')
    const numericAnchorHit = /\b(unidad|u\.|bloque|eje|modulo|m[oó]dulo)\b\s*[0-9ivx]+/i.test(lines[anchorIndex] || '')

    const strategy: 'semantic' | 'numbering' | 'hybrid' = numericAnchorHit
      ? semanticScore >= 0.2
        ? 'hybrid'
        : 'numbering'
      : 'semantic'

    let parsed: ParsedProgram
    let extractionMethod: 'ai' | 'heuristic' = 'ai'

    try {
      const { object, usage } = await generateObject({
        model: google(AI_MODEL),
        schema: continuationSchema,
        schemaName: 'guidedProgramContinuation',
        schemaDescription: 'Continuacion curricular en formato unidades y temas',
        system: 'Eres un asistente academico experto en programas anuales en espanol. Continua estructuras sin inventar.',
        prompt: `Tomando como ancla esta unidad validada por docente:
Unidad: ${payload.seedUnitName}
Temas verificados: ${payload.seedTopics.join('; ')}

Tu tarea es continuar el programa con las unidades y temas siguientes, sin repetir el ancla.
Prioriza coincidencias por numeracion (Unidad 2, 3...) y similitud textual.
Devuelve solo estructura Unidad -> Temas.
      ${rejectedUnitNames.length > 0 ? `No repitas ni propongas estas unidades marcadas como incorrectas: ${rejectedUnitNames.join('; ')}` : ''}
      ${rejectedTopicNames.length > 0 ? `No repitas ni propongas estos temas marcados como incorrectos: ${rejectedTopicNames.join('; ')}` : ''}
      ${guidanceNote ? `Correccion adicional del docente: ${guidanceNote}` : ''}
      ${retryCount > 0 ? `Este es un reintento numero ${retryCount + 1}. Debes variar estrategia y proponer alternativa distinta a la previa.` : ''}

Fragmento del documento alrededor del ancla:
${aroundAnchor.slice(0, 18000)}

Contexto de seccion curricular:
${section.slice(0, 12000)}`,
        temperature: 0.2,
        maxOutputTokens: 2200,
      })

      parsed = continuationSchema.parse(object)
      await guard.finish(usage)
    } catch (schemaError) {
      captureAiSchemaFailure(schemaError, {
        endpoint: '/api/teacher/programs/guide',
        fallback: 'heuristic',
      })
      // El heurístico no llama al modelo; el intento fallido igual se facturó.
      await guard.fail()
      parsed = parseHeuristicProgram(aroundAnchor)
      extractionMethod = 'heuristic'
    }

    const sanitized = sanitizeContinuation(parsed, payload.seedUnitName)
    const filtered = filterRejectedContent(sanitized, rejectedUnitNames, rejectedTopicNames)
    const normalized = normalizeUnits(filtered)
    const quality = estimateGuideConfidence(filtered, extractionMethod, semanticScore, strategy)

    const signature = buildPatternSignature(section)
    await saveGlobalPattern(signature, quality.confidence)

    return NextResponse.json({
      previewUnits: normalized,
      extractionMethod,
      strategy,
      guideConfidence: quality.confidence,
      lowConfidence: quality.lowConfidence,
      summary: {
        unitCount: quality.unitCount,
        topicCount: quality.topicCount,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Body mal formado: es culpa del cliente, no un incidente. No se reporta.
      return NextResponse.json({ error: 'Parametros de guiado invalidos', details: error.flatten() }, { status: 400 })
    }

    captureRouteFailure(error, {
      endpoint: '/api/teacher/programs/guide',
      status: 500,
      operation: 'guide_program',
    })
    return NextResponse.json(
      {
        error: 'No se pudo generar la guia de autocompletado',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
