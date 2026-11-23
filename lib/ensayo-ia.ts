import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { AI_MODEL } from '@/lib/ai-model'
import type { AiSdkUsage } from '@/lib/ai-usage'
import { limpiarRubrica, NIVELES, sugerenciaValida, type CriterioDeRubrica, type Correccion } from '@/lib/ensayo'

/**
 * Ronda W · W5 — Las dos llamadas a la IA del ensayo: proponer la rúbrica y
 * sugerir la corrección. Ninguna decide nada: el docente edita la rúbrica y
 * confirma (o cambia) la corrección. Sin razonamiento previo y con techo
 * holgado, como la corrección de la respuesta corta.
 */
const OPCIONES = { google: { thinkingConfig: { thinkingBudget: 0 } } }

const esquemaDeSugerencia = z.object({
  criterios: z.array(z.object({ nivel: z.enum(NIVELES), devolucion: z.string() })),
  nota: z.number(),
  devolucion: z.string(),
})

export async function sugerirCorreccion(params: {
  materia: string
  consigna: string
  guia: string
  rubrica: CriterioDeRubrica[]
  respuesta: string
  onUsage?: (u: AiSdkUsage | undefined) => void
}): Promise<Correccion | null> {
  const { object, usage } = await generateObject({
    model: google(AI_MODEL),
    schema: esquemaDeSugerencia,
    temperature: 0.2,
    maxOutputTokens: 3000,
    providerOptions: OPCIONES,
    system: `Sos docente de ${params.materia} y corregís respuestas largas de tus alumnos con una rúbrica. Escribís en castellano rioplatense, con voseo, sin signos de exclamación de apertura y sin emojis. Sos justo y concreto: cada devolución dice qué está bien y qué falta, en una o dos oraciones, hablándole al alumno.`,
    prompt: `CONSIGNA:
${params.consigna}

LO QUE TENDRÍA UNA RESPUESTA COMPLETA (guía del docente):
${params.guia || '(sin guía)'}

RÚBRICA (en este orden; un resultado por criterio, en el mismo orden):
${params.rubrica.map((c, i) => `${i + 1}. ${c.criterio}`).join('\n')}

RESPUESTA DEL ALUMNO:
"""
${params.respuesta}
"""

Para cada criterio, elegí un nivel: "logrado", "parcial" o "no_logrado", con su devolución. Después, una nota de 0 a 10 coherente con los niveles (logrado vale 1, parcial ½, no logrado 0, todos los criterios pesan igual) y una devolución general corta. Si la respuesta está vacía o no tiene que ver con la consigna, todo "no_logrado". No inventes lo que el alumno no escribió.`,
  })
  params.onUsage?.(usage)
  return sugerenciaValida(object, params.rubrica)
}

const esquemaDeRubrica = z.object({ criterios: z.array(z.string()) })

export async function proponerRubrica(params: { materia: string; consigna: string; guia: string; onUsage?: (u: AiSdkUsage | undefined) => void }): Promise<CriterioDeRubrica[]> {
  const { object, usage } = await generateObject({
    model: google(AI_MODEL),
    schema: esquemaDeRubrica,
    temperature: 0.3,
    maxOutputTokens: 1500,
    providerOptions: OPCIONES,
    system: `Sos docente de ${params.materia}. Escribís en castellano rioplatense, sin signos de exclamación de apertura y sin emojis.`,
    prompt: `Proponé de 3 a 5 criterios para corregir esta consigna de respuesta larga. Cada criterio es lo que tiene que tener una buena respuesta, observable y distinto de los otros, en una frase corta ("Define el concepto con sus palabras", "Da un ejemplo propio").

CONSIGNA:
${params.consigna}

GUÍA DEL DOCENTE:
${params.guia || '(sin guía)'}`,
  })
  params.onUsage?.(usage)
  return limpiarRubrica(object.criterios)
}
