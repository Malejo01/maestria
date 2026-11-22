import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure, captureFileParsingFailure, captureRouteFailure } from '@/lib/observability'
import { z } from 'zod'
import { generateObject } from 'ai'
import { TIPO_DE_PROGRESO, leerNivelSugerido, type EventoDeLectura } from '@/lib/wizard-temario'
import { google } from '@ai-sdk/google'
import { sql } from '@/lib/db'
import { AI_MODEL } from '@/lib/ai-model'
import { bloqueoParaGenerar } from '@/lib/planes-server'
import {
  NO_SE_PUDO_LEER,
  PESO_MAXIMO_BYTES,
  TIEMPO_MAXIMO_DEL_MODELO_MS,
  comoLeerPrograma,
  elModeloLoLee,
  esTiempoAgotado,
  mensajeDePesoExcedido,
} from '@/lib/lectura-programa'
import {
  extraerTextoDePrograma,
  normalizarMimeDePrograma,
  parserPara,
  parteDelArchivo,
} from '@/lib/lectura-programa-server'
import { REGLAS_DE_TEMAS, granularizarUnidades } from '@/lib/temas-granulares'
import { normalizarNombreDeUnidad, separarTituloDeUnidad } from '@/lib/nombre-de-unidad'

export const runtime = 'nodejs'
// Un escaneo o una foto van enteros al modelo, que tiene 60 s
// (TIEMPO_MAXIMO_DEL_MODELO_MS). Ninguna petición vuelve a llegar a los 300 s
// del 504 de la foto de celular (I1).
export const maxDuration = 90

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
  // Opcionales y sólo si el documento los dice de forma explícita. Son una
  // sugerencia para que el docente confirme (lib/wizard-temario.ts).
  nivel: z.string().nullable().optional(),
  grado: z.string().nullable().optional(),
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
      // O11: si la línea trae los temas después del título, se separan (si no,
      // la unidad quedaba sin temas y se descartaba).
      const separada = separarTituloDeUnidad(line.replace(/[:\-\s]+$/, '').trim(), [])
      currentUnit = {
        name: separada.nombre,
        topics: separada.temas.map((name) => ({ name })),
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
  return parsed.units.map((unit, unitIndex) => {
    // O11: "Unidad 2: Funciones. Dominio, imagen" → título "Funciones" y sus temas.
    const separada = separarTituloDeUnidad(unit.name, unit.topics.map((topic) => topic.name))
    return {
      id: `tp-u-${unitIndex + 1}`,
      // I3: "1" → "Unidad 1"; "UNIDAD I: LÓGICA" → "Unidad I: Lógica". El resto, tal cual.
      name: normalizarNombreDeUnidad(separada.nombre),
      topics: separada.temas.map((name, topicIndex) => ({
        id: `tp-u-${unitIndex + 1}-t-${topicIndex + 1}`,
        name,
      })),
    }
  })
}

type Resultado = { status: number; body: Record<string, unknown> }

/** Lo que se le pide al modelo, venga el programa como texto o como archivo. */
function instruccionesDeExtraccion(): string {
  return `Analiza el programa y devuelve la estructura curricular en este orden de prioridad:
1) Unidades
2) Temas dentro de cada unidad

Busca primero la seccion equivalente a: "Programa Analitico de Contenidos", "Estructura Curricular", "Contenidos del Programa", "Temario", "Unidades Didacticas", "Ejes de Aprendizaje", "Saberes Prioritarios" o "Bloques Tematicos".
Normaliza cualquier nombre de agrupador (eje, bloque, modulo, nodo) como "Unidad".
Nombra cada unidad como aparece en el documento, con su numero y su titulo si los tiene (por ejemplo "Unidad 1: Algebra"). Si el documento no le da titulo, usa solo el numero ("Unidad 2"). No inventes titulos.
Las tablas llegan como lineas "celda | celda | celda": la primera fila suele decir que es cada columna.
Si hay conflicto entre secciones, prioriza la seccion de contenidos.
No inventes unidades ni temas que no aparezcan en el documento.

${REGLAS_DE_TEMAS}

Aparte: si el documento dice de forma explicita el nivel educativo (Primario, Secundario o Superior) y el año o grado de la materia, devolvelos en "nivel" y "grado". Si no lo dice, dejalos en null. No los deduzcas por la dificultad de los contenidos.`
}

/**
 * Lee el archivo y arma la estructura de unidades y temas, avisando en qué
 * etapa está. Es el cuerpo de la ruta, separado para poder responder de dos
 * formas con el mismo trabajo: de una vez (JSON) o contando el progreso
 * mientras ocurre (una línea JSON por etapa).
 */
async function procesarArchivo({
  file,
  normalizedMimeType,
  userId,
  guard,
  avisar,
}: {
  file: File
  normalizedMimeType: string
  userId: string
  guard: Extract<Awaited<ReturnType<typeof guardAiCall>>, { ok: true }>
  avisar: (evento: EventoDeLectura) => void
}): Promise<Resultado> {
    avisar({ etapa: 'leyendo' })
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Cada formato trae su propia librería y sus propias formas de romperse (un
    // .doc de Word 97, un PDF dañado). El tag por parser es lo que después
    // permite ver si falla un formato puntual.
    const parser = parserPara(normalizedMimeType)

    let extractedText = ''
    let paginas = 0
    try {
      ;({ texto: extractedText, paginas } = await extraerTextoDePrograma(fileBuffer, normalizedMimeType))
    } catch (parsingError) {
      captureFileParsingFailure(parsingError, {
        parser,
        mimeType: normalizedMimeType,
        sizeBytes: file.size,
      })
      // Un PDF que pdf-parse no puede abrir todavía lo puede leer el modelo.
      // Un Word roto, no: el modelo no recibe .docx.
      if (!elModeloLoLee(normalizedMimeType)) {
        await guard.fail()
        return { status: 422, body: { error: NO_SE_PUDO_LEER } }
      }
    }

    // Una imagen, o un PDF sin capa de texto (un escaneo), va entero al
    // modelo. Antes la foto pasaba por tesseract y el escaneo cortaba acá.
    const modo = comoLeerPrograma({ mimeType: normalizedMimeType, texto: extractedText, paginas })

    if (modo === 'texto' && (!extractedText || extractedText.length < 100)) {
      await guard.fail()
      return { status: 422, body: { error: NO_SE_PUDO_LEER } }
    }

    const curriculumSection = modo === 'texto' ? extractCurriculumSection(extractedText) : ''
    const clippedText = extractedText.slice(0, 25000)

    avisar(modo === 'archivo' ? { etapa: 'leyendo-con-ia' } : { etapa: 'leido' })
    avisar({ etapa: 'ordenando' })
    const clippedSection = curriculumSection.slice(0, 15000)

    const instrucciones = instruccionesDeExtraccion()
    const entrada =
      modo === 'archivo'
        ? {
            messages: [
              {
                role: 'user' as const,
                content: [
                  { type: 'text' as const, text: `${instrucciones}\n\nEl programa va adjunto (es una imagen o un escaneo).` },
                  parteDelArchivo(fileBuffer, normalizedMimeType),
                ],
              },
            ],
          }
        : {
            prompt: `${instrucciones}

Seccion prioritaria detectada:
${clippedSection}

Documento completo (respaldo):
${clippedText}`,
          }

    let parsedProgram: ParsedProgram
    let extractionMethod: 'ai' | 'heuristic' = 'ai'

    try {
      const { object, usage, finishReason } = await generateObject({
        model: google(AI_MODEL),
        schema: parsedProgramSchema,
        schemaName: 'programStructure',
        schemaDescription: 'Estructura curricular con unidades y temas',
        system: 'Eres un asistente academico. Extrae una estructura curricular jerarquica precisa.',
        ...entrada,
        temperature: 0.2,
        // I2: con temas más finos la respuesta crece (la 05 y la 14 ya tienen
        // 57 y 58). Con 2.500 se cortaba, el esquema fallaba y caía EN
        // SILENCIO al heurístico.
        maxOutputTokens: 8000,
        abortSignal: AbortSignal.timeout(TIEMPO_MAXIMO_DEL_MODELO_MS),
      })

      if (finishReason === 'length') {
        // Pasó el esquema pero el modelo se quedó sin lugar: puede faltar el
        // final del programa. Se reporta como una falla de esquema.
        captureAiSchemaFailure(new Error('La extracción del programa se cortó por largo (finishReason: length)'), {
          endpoint: '/api/teacher/programs/extract',
          fallback: 'none',
          finishReason,
        })
      }
      parsedProgram = parsedProgramSchema.parse(object)
      // La red de abajo: un tema que igual vino como párrafo se parte (I2).
      parsedProgram = { ...parsedProgram, units: granularizarUnidades(parsedProgram.units) }
      await guard.finish(usage)
    } catch (schemaError) {
      if (esTiempoAgotado(schemaError)) {
        captureRouteFailure(schemaError, {
          endpoint: '/api/teacher/programs/extract',
          status: 504,
          operation: modo === 'archivo' ? 'extract_program_file_timeout' : 'extract_program_timeout',
        })
      } else {
        // Silencioso para el docente cuando cae al heurístico: ve un resultado
        // peor sin ningún aviso. Por eso se reporta.
        captureAiSchemaFailure(schemaError, {
          endpoint: '/api/teacher/programs/extract',
          fallback: modo === 'archivo' ? 'none' : 'heuristic',
          finishReason: (schemaError as { finishReason?: string } | null)?.finishReason,
        })
      }
      // El intento fallido igual se facturó.
      await guard.fail()
      // Sin texto no hay heurístico posible: la imagen o el escaneo sólo los
      // lee el modelo.
      if (modo === 'archivo') {
        return { status: 422, body: { error: NO_SE_PUDO_LEER } }
      }
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

    return {
      status: 200,
      body: {
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
      // Sólo si salió de la IA: el heurístico no lee nivel ni año.
      nivelSugerido:
        extractionMethod === 'ai' ? leerNivelSugerido({ nivel: parsedProgram.nivel, grado: parsedProgram.grado }) : null,
      },
    }
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

    // Plan vencido: modo solo lectura (lib/planes.ts).
    const bloqueo = await bloqueoParaGenerar(userId, session?.user?.email ?? null)
    if (bloqueo) return bloqueo

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Falta subir un archivo' }, { status: 400 })
    }

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/png',
      'image/jpeg',
    ]

    const normalizedMimeType = normalizarMimeDePrograma(file.name, file.type)

    if (!validTypes.includes(normalizedMimeType)) {
      return NextResponse.json({ error: 'Solo se aceptan PDF, DOCX, DOC, PNG y JPG' }, { status: 400 })
    }

    if (file.size > PESO_MAXIMO_BYTES) {
      return NextResponse.json({ error: mensajeDePesoExcedido(file.size) }, { status: 400 })
    }

    // Tipo y tamaño ya validados: un archivo rechazado no consume cupo. El rol
    // va explícito porque requireTeacher acaba de leerlo de la base, y el JWT
    // podría estar desactualizado si el docente cambió de rol recién.
    const guard = await guardAiCall({ bucket: 'program_extraction', actor: 'docente' })
    if (!guard.ok) return guard.response

    // Con `Accept: application/x-ndjson` la respuesta va contando las etapas
    // mientras ocurren: el spinner mudo es donde más docentes abandonan. Sin
    // ese encabezado responde como siempre, de una vez.
    if (req.headers.get('accept')?.includes(TIPO_DE_PROGRESO)) {
      const codificador = new TextEncoder()
      const flujo = new ReadableStream<Uint8Array>({
        async start(controlador) {
          const avisar = (evento: EventoDeLectura) =>
            controlador.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`))
          try {
            const resultado = await procesarArchivo({ file, normalizedMimeType, userId, guard, avisar })
            if (resultado.status === 200) {
              avisar({ etapa: 'listo', resultado: resultado.body })
            } else {
              avisar({ etapa: 'error', error: String(resultado.body.error), status: resultado.status })
            }
          } catch (error) {
            captureRouteFailure(error, {
              endpoint: '/api/teacher/programs/extract',
              status: 500,
              operation: 'extract_program',
            })
            avisar({ etapa: 'error', error: 'No se pudo procesar el archivo', status: 500 })
          } finally {
            controlador.close()
          }
        },
      })
      return new Response(flujo, {
        headers: { 'Content-Type': `${TIPO_DE_PROGRESO}; charset=utf-8`, 'Cache-Control': 'no-store' },
      })
    }

    const resultado = await procesarArchivo({ file, normalizedMimeType, userId, guard, avisar: () => {} })
    return NextResponse.json(resultado.body, { status: resultado.status })
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
