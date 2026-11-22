import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { AI_MODEL } from '@/lib/ai-model'
import type { AiSdkUsage } from '@/lib/ai-usage'
import { divisionFiel } from '@/lib/temas-granulares'

/**
 * D1 · La IA divide un párrafo que no se pudo partir con certeza en los
 * conceptos que enumera, copiando sus palabras. Se acepta sólo si la división
 * sale del párrafo (`divisionFiel`); si no, o si falla, el tema queda como
 * vino. A lo sumo 5 párrafos por programa.
 */
const divisionSchema = z.object({ temas: z.array(z.string().min(2)).min(2).max(15) })

export async function dividirParrafosConIA(parrafos: string[]): Promise<{ divisiones: Map<string, string[]>; usos: (AiSdkUsage | undefined)[] }> {
  const divisiones = new Map<string, string[]>()
  const usos: (AiSdkUsage | undefined)[] = []
  for (const parrafo of parrafos.slice(0, 5)) {
    try {
      const { object, usage } = await generateObject({
        model: google(AI_MODEL),
        schema: divisionSchema,
        schemaName: 'division',
        system: 'Divides un parrafo de un programa de materia en los conceptos que enumera. No resumes ni agregas nada.',
        prompt: `Dividi este parrafo en los temas que enumera, cada uno de hasta 90 caracteres, copiando las palabras del parrafo (sin agregar conceptos):

${parrafo}`,
        temperature: 0,
        maxOutputTokens: 800,
        abortSignal: AbortSignal.timeout(20_000),
      })
      usos.push(usage)
      const temas = object.temas.map((t) => t.trim()).filter(Boolean)
      if (divisionFiel(parrafo, temas)) divisiones.set(parrafo.replace(/\s+/g, ' ').trim(), temas)
    } catch {
      // Sin división: el tema queda como vino (el docente lo puede separar a mano, D2).
    }
  }
  return { divisiones, usos }
}

