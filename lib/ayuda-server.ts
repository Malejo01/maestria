import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GUIAS, ordenarGuias, parsearGuia, type Guia, type GuiaLeida } from '@/lib/ayuda'

/** Ronda V · V6 — Lee las guías de content/ayuda (una que falta o está mal armada no rompe el índice). */
export async function leerGuia(slug: Guia): Promise<GuiaLeida | null> {
  try {
    return parsearGuia(await readFile(join(process.cwd(), 'content', 'ayuda', `${slug}.md`), 'utf8'), slug)
  } catch {
    return null
  }
}

export async function leerGuias(): Promise<GuiaLeida[]> {
  return ordenarGuias(await Promise.all(GUIAS.map(leerGuia)))
}
