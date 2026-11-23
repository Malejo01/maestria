import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ordenarNovedades, parsearNovedad, type Novedad } from '@/lib/novedades'

/** Ronda Y · Y3 — Lee content/novedades (una mal armada no rompe la lista). */
const CARPETA = () => join(process.cwd(), 'content', 'novedades')

export async function leerNovedades(): Promise<Novedad[]> {
  try {
    const archivos = (await readdir(CARPETA())).filter((f) => f.endsWith('.md'))
    return ordenarNovedades(
      await Promise.all(archivos.map(async (f) => parsearNovedad(await readFile(join(CARPETA(), f), 'utf8'), f.replace(/\.md$/, '')))),
    )
  } catch {
    return []
  }
}

export async function leerNovedad(slug: string): Promise<Novedad | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  try {
    return parsearNovedad(await readFile(join(CARPETA(), `${slug}.md`), 'utf8'), slug)
  } catch {
    return null
  }
}
