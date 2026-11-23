import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getEducationContext } from '@/lib/education-context'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { AI_MODEL } from '@/lib/ai-model'
import { NOTACION_DEL_ALUMNO } from '@/lib/notacion-matematica'
import { correctaEnTexto } from '@/lib/tipos-moodle'
import { limpiarPista, pistaRevelaLaRespuesta } from '@/lib/pista'
import type { Question } from '@/lib/types'

/**
 * Ronda X · X1 — Pensar la pista con la IA. Se mira antes de devolverla: si
 * dice la respuesta, se pide otra una vez; si la segunda también la dice,
 * `null` (no hay pista). La usan la ruta y scripts/qa/medir-pistas.ts.
 */
const esquema = z.object({ pista: z.string() })
const OPCIONES = { google: { thinkingConfig: { thinkingBudget: 0 } } }

function laRespuesta(q: Question): string {
  switch (q.type) {
    case 'multiple_choice':
      return q.options[q.correctAnswer] ?? ''
    case 'true_false':
      return q.correctAnswer ? 'Verdadero' : 'Falso'
    case 'numeric':
      return String(q.correctAnswer)
    case 'short_answer':
      return q.acceptedAnswers.join(' / ')
    default:
      return correctaEnTexto(q) ?? ''
  }
}

function opcionesEnTexto(q: Question): string {
  if ('options' in q && Array.isArray(q.options)) return `\nOPCIONES: ${q.options.join(' | ')}`
  return ''
}

export async function pensarPista(params: {
  question: Question
  nivel?: string
  grado?: string
  materia?: string
  onUsage?: (u: AiSdkUsage | undefined) => void
}): Promise<string | null> {
  const q = params.question
  const edu = getEducationContext(params.nivel, params.grado, params.materia || 'la materia')
  const pedir = (masEstricta: boolean) =>
    generateObject({
      model: google(AI_MODEL),
      schema: esquema,
      temperature: 0.4,
      maxOutputTokens: 800,
      providerOptions: OPCIONES,
      system: `${edu.rolDocente}.
Le das a un alumno UNA pista para una pregunta que todavía no respondió. La pista orienta: recuerda el concepto que hace falta, sugiere el primer paso o una pregunta que se puede hacer. NUNCA dice la respuesta, NUNCA descarta ni señala opciones, NUNCA da el resultado de una cuenta. Una o dos oraciones cortas, en castellano rioplatense con voseo, sin signos de exclamación de apertura y sin emojis.
${edu.registroLinguistico}

${NOTACION_DEL_ALUMNO}`,
      prompt: `PREGUNTA: ${q.question}${opcionesEnTexto(q)}

LA RESPUESTA (sólo para que sepas qué NO decir): ${laRespuesta(q)}
${masEstricta ? '\nLa pista anterior decía la respuesta. Esta vez no la menciones de ninguna forma: ni la palabra, ni el número, ni un sinónimo directo.' : ''}
Escribí la pista.`,
    })

  let usage: AiSdkUsage | undefined
  try {
    const primera = await pedir(false)
    usage = primera.usage
    let pista = limpiarPista(primera.object.pista)
    if (pistaRevelaLaRespuesta(pista, q)) {
      const segunda = await pedir(true)
      usage = sumUsage(usage, segunda.usage)
      pista = limpiarPista(segunda.object.pista)
    }
    return pista && !pistaRevelaLaRespuesta(pista, q) ? pista : null
  } finally {
    params.onUsage?.(usage)
  }
}
