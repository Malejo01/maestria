/**
 * POST /api/curriculum/parse-program
 *
 * Lean endpoint for the "Superior/Terciario" curriculum selector flow.
 * Any authenticated user can upload a PDF/DOCX and get back the parsed
 * units+topics structure — WITHOUT saving anything to the database.
 *
 * Reuses the same extraction pipeline as /api/teacher/programs/extract
 * but skips the DOCENTE role check and DB persistence.
 */
import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { auth } from '@/auth'
import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure, captureFileParsingFailure, captureRouteFailure } from '@/lib/observability'
import { AI_MODEL } from '@/lib/ai-model'

export const runtime = 'nodejs'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

// ── Zod schema ────────────────────────────────────────────────────────────────

const parsedSchema = z.object({
  units: z.array(
    z.object({
      name: z.string().min(1),
      topics: z.array(z.object({ name: z.string().min(1) })).min(1),
    })
  ).min(1),
})

// ── Text extraction helpers ───────────────────────────────────────────────────

function normalizeLine(line: string): string {
  return line.replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function isLikelyUnitLine(line: string): boolean {
  return /^(unidad|unit|m[oó]dulo|eje|bloque)\s*\d*/i.test(line)
}

function splitTopics(line: string): string[] {
  const cleaned = line.replace(/^[\-•*\d\.\)\s]+/, '').trim()
  if (!cleaned) return ['Tema principal']
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts : [cleaned]
}

function parseHeuristic(text: string): z.infer<typeof parsedSchema> {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter((l) => l.length > 2).slice(0, 220)
  const units: z.infer<typeof parsedSchema>['units'] = []
  let cur: (typeof units)[number] | null = null

  for (const line of lines) {
    if (isLikelyUnitLine(line)) {
      cur = { name: line.replace(/[:\-\s]+$/, '').trim(), topics: [] }
      units.push(cur)
      continue
    }
    if (!cur) { cur = { name: 'Unidad 1', topics: [] }; units.push(cur) }
    splitTopics(line).forEach((t) => cur!.topics.push({ name: t }))
  }

  const sanitized = units
    .map((u, i) => ({ name: u.name || `Unidad ${i + 1}`, topics: u.topics.filter((t) => t.name.trim()) }))
    .filter((u) => u.topics.length > 0)

  return sanitized.length > 0 ? { units: sanitized } : { units: [{ name: 'Unidad 1', topics: [{ name: 'Temas del programa' }] }] }
}

async function extractText(file: File, buffer: Buffer, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    const mod = await import('pdf-parse')
    const fn = (mod as unknown as { default?: (b: Buffer) => Promise<{ text?: string }> }).default
    if (typeof fn === 'function') return (await fn(buffer))?.text?.trim() ?? ''
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const m = await import('mammoth')
    return (await m.extractRawText({ buffer })).value.trim()
  }
  if (mime === 'application/msword') {
    const m = await import('word-extractor')
    const extractor = new m.default()
    return String((await extractor.extract(buffer)).getBody() ?? '').trim()
  }
  return ''
}

function resolveMime(file: File): string {
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.doc')) return 'application/msword'
  return file.type
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const mime = resolveMime(file)
  const validMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]
  if (!validMimes.includes(mime)) {
    return NextResponse.json({ error: 'Solo se aceptan PDF, DOCX y DOC' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo supera el límite de 5 MB' }, { status: 400 })
  }

  // Después de validar tipo y tamaño: rebotar un archivo inválido no debería
  // gastar cupo. Antes de extraer texto, que en un PDF escaneado significa OCR.
  const guard = await guardAiCall({ bucket: 'program_upload' })
  if (!guard.ok) return guard.response

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractText(file, buffer, mime).catch((parsingError) => {
      captureFileParsingFailure(parsingError, {
        parser:
          mime === 'application/pdf'
            ? 'pdf-parse'
            : mime === 'application/msword'
              ? 'word-extractor'
              : 'mammoth',
        mimeType: mime,
        sizeBytes: file.size,
      })
      // Cae en el 422 de abajo, que ya le dice al alumno qué hacer.
      return ''
    })

    if (!text || text.length < 80) {
      await guard.fail()
      return NextResponse.json({ error: 'No se pudo extraer contenido útil del archivo.' }, { status: 422 })
    }

    let parsed: z.infer<typeof parsedSchema>
    let method: 'ai' | 'heuristic' = 'ai'

    try {
      const { object, usage } = await generateObject({
        model: google(AI_MODEL),
        schema: parsedSchema,
        schemaName: 'programStructure',
        schemaDescription: 'Estructura curricular con unidades y temas',
        system: 'Eres un asistente académico. Extrae la estructura curricular jerárquica del programa.',
        prompt: `Extrae las Unidades y sus Temas del siguiente programa de materia.
Normaliza ejes, bloques o módulos como "Unidad".
No inventes contenido que no esté en el documento.

PROGRAMA:
${text.slice(0, 20000)}`,
        temperature: 0.2,
        maxOutputTokens: 2500,
      })
      parsed = parsedSchema.parse(object)
      await guard.finish(usage)
    } catch (schemaError) {
      captureAiSchemaFailure(schemaError, {
        endpoint: '/api/curriculum/parse-program',
        fallback: 'heuristic',
      })
      // El fallback heurístico no llama al modelo, pero el intento que falló sí
      // se facturó: la fila queda como error y sigue contando.
      await guard.fail()
      parsed = parseHeuristic(text)
      method = 'heuristic'
    }

    // Normalize IDs for frontend use
    const units = parsed.units.map((unit, ui) => ({
      id: `u-${ui + 1}`,
      name: unit.name,
      topics: unit.topics.map((topic, ti) => ({
        id: `u-${ui + 1}-t-${ti + 1}`,
        name: topic.name,
      })),
    }))

    return NextResponse.json({
      units,
      extractionMethod: method,
      topicCount: units.reduce((s, u) => s + u.topics.length, 0),
    })
  } catch (error) {
    captureRouteFailure(error, {
      endpoint: '/api/curriculum/parse-program',
      status: 500,
      operation: 'parse_program',
    })
    return NextResponse.json(
      { error: 'Error al procesar el archivo', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
