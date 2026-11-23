import { gzipSync } from 'node:zlib'
import { del, list, put } from '@vercel/blob'
import { sql } from '@/lib/db'
import { faltaParaRespaldar, nombreDelRespaldo, PREFIJO_RESPALDO, respaldosABorrar, TABLAS_CRITICAS, VERSION_DEL_RESPALDO, type Respaldo } from '@/lib/respaldo'

/**
 * Ronda Y · Y2 — Armar, subir y mirar el respaldo diario (lib/respaldo.ts).
 * Sólo lee la base. Los nombres de tabla salen de TABLAS_CRITICAS (constante),
 * nunca de afuera: por eso pueden ir en el texto de la consulta.
 */
const POR_PAGINA = 5000

async function tablasQueExisten(): Promise<Set<string>> {
  const filas = (await sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `) as { table_name: string }[]
  return new Set(filas.map((f) => f.table_name))
}

/** Todas las filas de las tablas críticas que existen en esta base (las de una migración que no corrió, no). */
export async function armarRespaldo(ahora = new Date()): Promise<Respaldo> {
  const existen = await tablasQueExisten()
  const tablas: Record<string, Record<string, unknown>[]> = {}
  for (const tabla of TABLAS_CRITICAS) {
    if (!existen.has(tabla)) continue
    const filas: Record<string, unknown>[] = []
    for (let desde = 0; ; desde += POR_PAGINA) {
      const pagina = (await sql.query(`SELECT row_to_json(t) AS fila FROM "${tabla}" t ORDER BY t.ctid LIMIT ${POR_PAGINA} OFFSET ${desde}`)) as { fila: Record<string, unknown> }[]
      filas.push(...pagina.map((p) => p.fila))
      if (pagina.length < POR_PAGINA) break
    }
    tablas[tabla] = filas
  }
  let origen = ''
  try {
    origen = new URL(process.env.DATABASE_URL ?? '').host
  } catch {
    // Sin URL legible: el respaldo igual sirve.
  }
  return { version: VERSION_DEL_RESPALDO, creadoEl: ahora.toISOString(), origen, tablas }
}

export function comprimir(r: Respaldo): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(r), 'utf8'))
}

/** Arma, sube (privado) y borra los de más de 14 días. */
export async function hacerRespaldo(ahora = new Date()): Promise<{ archivo: string; bytes: number; filas: number; borrados: number }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!.trim()
  const respaldo = await armarRespaldo(ahora)
  const datos = comprimir(respaldo)
  const blob = await put(nombreDelRespaldo(ahora), datos, {
    access: 'private',
    token,
    contentType: 'application/gzip',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  const { blobs } = await list({ prefix: PREFIJO_RESPALDO, token })
  const viejos = respaldosABorrar(blobs, ahora)
  if (viejos.length > 0) await del(viejos.map((b) => b.url), { token })
  return { archivo: blob.pathname, bytes: datos.length, filas: Object.values(respaldo.tablas).reduce((s, f) => s + f.length, 0), borrados: viejos.length }
}

export interface EstadoDelRespaldo {
  faltan: string[]
  ultimo: { archivo: string; fecha: string; bytes: number } | null
  cantidad: number
}

/** Para /admin/salud: si está configurado y cuál es el último. Nunca rompe la página. */
export async function estadoDelRespaldo(): Promise<EstadoDelRespaldo> {
  const faltan = faltaParaRespaldar(process.env)
  if (faltan.length > 0) return { faltan, ultimo: null, cantidad: 0 }
  try {
    const { blobs } = await list({ prefix: PREFIJO_RESPALDO, token: process.env.BLOB_READ_WRITE_TOKEN!.trim() })
    const [u] = [...blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    return { faltan, cantidad: blobs.length, ultimo: u ? { archivo: u.pathname, fecha: new Date(u.uploadedAt).toISOString(), bytes: u.size } : null }
  } catch {
    return { faltan, ultimo: null, cantidad: 0 }
  }
}
