import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { AI_MODEL } from '@/lib/ai-model'
import type { AiSdkUsage } from '@/lib/ai-usage'
import {
  afirmacionSchema,
  correccionPorRegla,
  objetivoDe,
  opcionMultipleSchema,
  preguntasMarcadas,
  promptDeReescritura,
  verificarReescritura,
  type Objetivo,
  type PropuestaDeCorreccion,
} from '@/lib/corregir-tipos'
import type { Question } from '@/lib/types'
import type { AreaId } from '@/lib/areas'

/**
 * N2 · La parte que llama al modelo. Lo usan el endpoint
 * `POST /api/teacher/quizzes/[id]/corregir-tipos` y el script de lote
 * `scripts/qa/corregir-tipos.ts`. No escribe nada: devuelve propuestas.
 */

/** Pide al modelo UNA reescritura. Inyectable para los tests (modelo simulado). */
export type GenerarReescritura = (objetivo: Objetivo, prompt: string) => Promise<{ object: unknown; usage?: AiSdkUsage }>

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

/** El mismo modelo del generador, con `generateObject` + Zod. */
export const generarConGemini: GenerarReescritura = async (objetivo, prompt) => {
  const { object, usage } = await generateObject({
    model: google(AI_MODEL),
    schema: objetivo === 'afirmacion' ? afirmacionSchema : opcionMultipleSchema,
    schemaName: objetivo === 'afirmacion' ? 'afirmacion' : 'opcionMultiple',
    prompt,
    maxOutputTokens: 1200,
    temperature: 0.2,
  })
  return { object, usage }
}

/**
 * Una propuesta por pregunta marcada: primero la regla (sin IA), después el
 * modelo. Las llamadas al modelo van de a una (son pocas: 18 en todo
 * producción) para no disparar el límite por minuto del proveedor.
 */
export async function proponerCorrecciones(
  preguntas: readonly Question[],
  generar: GenerarReescritura,
  onUsage?: (usage: AiSdkUsage | undefined) => void,
  /** Ronda T · A4: el área de la materia (sin LaTeX ni cálculo en lo conceptual). */
  area?: AreaId | null,
): Promise<PropuestaDeCorreccion[]> {
  const propuestas: PropuestaDeCorreccion[] = []
  for (const { indice, problema } of preguntasMarcadas(preguntas)) {
    const antes = preguntas[indice]
    const porRegla = correccionPorRegla(antes)
    if (porRegla) {
      propuestas.push({ indice, problema, antes, despues: porRegla, via: 'regla' })
      continue
    }
    const objetivo = objetivoDe(problema)
    if (!objetivo) {
      propuestas.push({ indice, problema, antes, despues: null, via: null, motivo: 'No hay una corrección automática para este caso.' })
      continue
    }
    try {
      const { object, usage } = await generar(objetivo, promptDeReescritura(antes, objetivo, area))
      onUsage?.(usage)
      const verificada = verificarReescritura(antes, objetivo, object)
      propuestas.push(
        verificada.ok
          ? { indice, problema, antes, despues: verificada.pregunta, via: 'ia' }
          : { indice, problema, antes, despues: null, via: 'ia', motivo: verificada.motivo },
      )
    } catch (error) {
      console.warn('[corregir-tipos] la IA falló en la pregunta', indice + 1, error instanceof Error ? error.message : error)
      propuestas.push({ indice, problema, antes, despues: null, via: 'ia', motivo: 'La IA no respondió. Probá de nuevo más tarde.' })
    }
  }
  return propuestas
}
