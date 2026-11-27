/**
 * Tanda AB · AB9 — Pasa cada programa de una carpeta por la extracción de
 * programas (`POST /api/teacher/programs/extract`, la misma que usa el wizard)
 * y escribe una tabla: archivo, páginas, unidades, temas, errores, tiempo y
 * costo estimado (de `ai_usage_log`).
 *
 * Uso (sólo staging, con `npm run dev:staging` corriendo):
 *   npx tsx scripts/probar-extraccion.ts --env=staging --carpeta "C:\ruta\a\programas"
 *     [--usuario=stg-user-0009] [--todos] [--filtro=escaneado] [--json=carpeta] [--base=http://localhost:3000] [--salida=archivo.md]
 *
 * El docente de prueba tiene el tope de IA de cualquier docente (8 lecturas por
 * ventana): para más archivos, otro `--usuario` o `--filtro`.
 *
 * Por defecto sólo los PDF; `--todos` suma .docx, .doc y fotos. Entra con el
 * ingreso de desarrollo (sólo existe contra una base marcada staging), como un
 * docente de prueba. LLAMA A LA IA: cada archivo es una llamada de lectura
 * (≈ USD 0,003 por PDF de texto). No guarda materias: la extracción sólo lee.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDbTarget } from './lib/db-target'

const arg = (n: string) => {
  const igual = process.argv.find((a) => a.startsWith(`--${n}=`))
  if (igual) return igual.slice(n.length + 3)
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined
}

if (!process.argv.includes('--env=staging')) {
  console.error('Sólo corre contra staging: agregá --env=staging.')
  process.exit(1)
}
const CARPETA = arg('carpeta')
if (!CARPETA) {
  console.error('Falta --carpeta <ruta>.')
  process.exit(1)
}
const BASE = arg('base') ?? 'http://localhost:3000'
const USUARIO = arg('usuario') ?? 'stg-user-0009'
const TODOS = process.argv.includes('--todos')
const FILTRO = arg('filtro')
/** Carpeta donde guardar lo que devolvió cada lectura (un .json por archivo), para mirarlo a mano. */
const JSON_DIR = arg('json')

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/** Páginas de un PDF sin dependencias: los objetos `/Type /Page` (no `/Pages`). Aproximado, alcanza para la tabla. */
export function paginasDePdf(datos: Buffer): number | null {
  const texto = datos.toString('latin1')
  const n = (texto.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
  return n > 0 ? n : null
}

interface Fila {
  archivo: string
  paginas: number | null
  unidades: number
  temas: number
  metodo: string
  error: string
  segundos: number
  costoUsd: number | null
  nivel: string
}

async function main() {
  const target = await resolveDbTarget({ action: 'prueba de extracción de programas (sólo lee la base)', destructive: false })
  if (target.environment !== 'staging') throw new Error(`La base no es staging (${target.environment}). Abortado.`)

  // Ingreso de desarrollo: csrf + callback del proveedor 'dev'.
  const cookies = new Map<string, string>()
  const guardar = (res: Response) => {
    for (const linea of res.headers.getSetCookie?.() ?? []) {
      const [par] = linea.split(';')
      const i = par.indexOf('=')
      cookies.set(par.slice(0, i), par.slice(i + 1))
    }
  }
  const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  let res = await fetch(`${BASE}/api/auth/csrf`)
  guardar(res)
  const { csrfToken } = (await res.json()) as { csrfToken: string }
  res = await fetch(`${BASE}/api/auth/callback/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie() },
    body: new URLSearchParams({ csrfToken, userId: USUARIO, callbackUrl: '/' }),
    redirect: 'manual',
  })
  guardar(res)
  if (![...cookies.keys()].some((k) => k.includes('session-token'))) {
    throw new Error(`No entró con el ingreso de desarrollo (HTTP ${res.status}). ¿Está corriendo npm run dev:staging?`)
  }

  const extensiones = TODOS ? Object.keys(MIME) : ['pdf']
  const archivos = readdirSync(CARPETA)
    .filter((n) => extensiones.includes(n.split('.').pop()!.toLowerCase()))
    .filter((n) => !FILTRO || n.includes(FILTRO))
    .sort()
  const filas: Fila[] = []

  for (const nombre of archivos) {
    const ext = nombre.split('.').pop()!.toLowerCase()
    const datos = readFileSync(join(CARPETA, nombre))
    const form = new FormData()
    form.append('file', new File([new Uint8Array(datos)], nombre, { type: MIME[ext] }))
    const desde = new Date()
    const inicio = Date.now()
    let fila: Fila
    try {
      const r = await fetch(`${BASE}/api/teacher/programs/extract`, { method: 'POST', body: form, headers: { Cookie: cookie() } })
      const cuerpo = (await r.json().catch(() => ({}))) as {
        units?: { name: string; topics?: { name: string }[] }[]
        extractionMethod?: string
        error?: string
        nivelSugerido?: { nivel?: string; grado?: string }
      }
      const unidades = cuerpo.units ?? []
      if (JSON_DIR) writeFileSync(join(JSON_DIR, `${nombre}.json`), JSON.stringify(cuerpo, null, 1))
      fila = {
        archivo: nombre,
        paginas: ext === 'pdf' ? paginasDePdf(datos) : null,
        unidades: unidades.length,
        temas: unidades.reduce((t, u) => t + (u.topics?.length ?? 0), 0),
        metodo: cuerpo.extractionMethod ?? '—',
        error: r.ok ? (cuerpo.error ?? '') : `HTTP ${r.status}${cuerpo.error ? `: ${cuerpo.error}` : ''}`,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        costoUsd: null,
        nivel: cuerpo.nivelSugerido ? `${cuerpo.nivelSugerido.nivel ?? ''} ${cuerpo.nivelSugerido.grado ?? ''}`.trim() : '',
      }
    } catch (error) {
      fila = { archivo: nombre, paginas: null, unidades: 0, temas: 0, metodo: '—', error: String(error), segundos: Math.round((Date.now() - inicio) / 100) / 10, costoUsd: null, nivel: '' }
    }
    // El costo de esta lectura: lo que anotó la ruta en ai_usage_log para este docente desde que se mandó.
    const [costo] = (await target.sql`
      SELECT COALESCE(SUM(estimated_cost_usd), 0)::float AS usd, COUNT(*)::int AS llamadas
      FROM ai_usage_log WHERE user_id = ${USUARIO} AND created_at >= ${desde.toISOString()}
    `) as unknown as { usd: number; llamadas: number }[]
    fila.costoUsd = costo?.llamadas ? Number(costo.usd) : 0
    filas.push(fila)
    console.log(JSON.stringify(fila))
  }

  const total = filas.reduce((t, f) => t + (f.costoUsd ?? 0), 0)
  const tabla = [
    '| Archivo | Páginas | Unidades | Temas | Método | Nivel leído | Error | Tiempo (s) | Costo (USD) |',
    '|---|---:|---:|---:|---|---|---|---:|---:|',
    ...filas.map(
      (f) =>
        `| ${f.archivo} | ${f.paginas ?? '—'} | ${f.unidades} | ${f.temas} | ${f.metodo} | ${f.nivel || '—'} | ${f.error || '—'} | ${f.segundos} | ${(f.costoUsd ?? 0).toFixed(4)} |`,
    ),
    '',
    `Total: ${filas.length} archivos, USD ${total.toFixed(4)}.`,
  ].join('\n')
  console.log(`\n${tabla}`)
  const salida = arg('salida')
  if (salida) writeFileSync(salida, `${tabla}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
