/**
 * Ronda Y · Y2 — Restaurar un respaldo diario (JSON comprimido de
 * /api/cron/respaldo, lib/respaldo.ts). NUNCA sobre producción.
 *
 * De dónde sale el respaldo (uno):
 *   --archivo=ruta/maestria-2026-11-23.json.gz   un archivo ya bajado
 *   --blob=respaldos-json/maestria-2026-11-23.json.gz   de Vercel Blob (BLOB_READ_WRITE_TOKEN)
 *   --ultimo                                     el más nuevo de Vercel Blob
 *
 * Adónde (uno):
 *   --env=staging       la branch de staging (marcada staging). Se ANONIMIZA
 *                       antes de insertar: staging nunca tiene datos reales.
 *   --destino=<url>     una base NUEVA (vacía, con el schema ya creado; por
 *                       ejemplo, una branch de Neon "sólo schema"). Se niega si
 *                       es producción o si las tablas tienen datos.
 *
 * Cómo:
 *   (sin flag)          sólo muestra qué haría.
 *   --ensayo            lo hace entero dentro de una transacción y la deshace
 *                       (ROLLBACK): prueba que el respaldo entra, sin dejar nada.
 *   --aplicar           lo hace de verdad. En staging, con tablas con datos,
 *                       además hace falta --reemplazar y confirmar escribiendo
 *                       REEMPLAZAR.
 *
 *   npx tsx scripts/restaurar-respaldo.ts --ultimo --env=staging --ensayo
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createInterface } from 'node:readline/promises'
import { Pool } from '@neondatabase/serverless'
import { anonimizarRespaldo, PREFIJO_RESPALDO, respaldoValido, resumenDelRespaldo, TABLAS_CRITICAS, type Respaldo } from '../lib/respaldo'
import { normalizeNeonHost } from './lib/db-target'

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const flag = (n: string) => process.argv.includes(`--${n}`)

function leerEnv(archivo: string): Record<string, string> {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  )
}

const host = (url: string) => {
  try {
    return normalizeNeonHost(new URL(url).host)
  } catch {
    return ''
  }
}

async function bajarRespaldo(): Promise<Buffer> {
  const archivo = arg('archivo')
  if (archivo) return readFileSync(archivo)
  const token = process.env.BLOB_READ_WRITE_TOKEN || leerEnv('.env.local').BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('Para bajarlo de Vercel Blob hace falta BLOB_READ_WRITE_TOKEN (o --archivo=).')
  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: PREFIJO_RESPALDO, token })
  const pedido = arg('blob')
  const elegido = pedido ? blobs.find((b) => b.pathname === pedido) : [...blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
  if (!elegido) throw new Error(pedido ? `No está ${pedido}` : 'No hay respaldos en Vercel Blob.')
  console.log(`Bajando ${elegido.pathname} (${elegido.uploadedAt})…`)
  const res = await fetch(elegido.downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`No se pudo bajar: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** La base de destino, con sus controles. Devuelve la URL y si es staging. */
async function destino(): Promise<{ url: string; esStaging: boolean }> {
  const produccion = host(leerEnv('.env.local').DATABASE_URL ?? '')
  const url = flag('env=staging') || process.argv.includes('--env=staging') ? leerEnv('.env.staging.local').DATABASE_URL : arg('destino')
  if (!url) throw new Error('Falta el destino: --env=staging o --destino=<url de una base nueva>.')
  if (produccion && host(url) === produccion) throw new Error('El destino es la base de PRODUCCIÓN. No se restaura sobre producción.')
  const pool = new Pool({ connectionString: url })
  try {
    const marca = await pool
      .query('SELECT environment, origin_host FROM deployment_env LIMIT 1')
      .then((r) => r.rows[0] as { environment: string; origin_host: string | null } | undefined)
      .catch(() => undefined)
    const esStaging = process.argv.includes('--env=staging')
    if (esStaging && marca?.environment !== 'staging') throw new Error('La base de .env.staging.local no está marcada staging (migración 017). No sigo.')
    if (!esStaging && marca?.environment === 'production') throw new Error('El destino está marcado production. Una base nueva no tiene esa marca: no sigo.')
    return { url, esStaging }
  } finally {
    await pool.end()
  }
}

async function main() {
  const crudo = JSON.parse(gunzipSync(await bajarRespaldo()).toString('utf8'))
  if (!respaldoValido(crudo)) throw new Error('El archivo no es un respaldo de MaestrIA (versión o forma distinta).')
  const { url, esStaging } = await destino()
  const respaldo: Respaldo = esStaging ? anonimizarRespaldo(crudo) : crudo
  console.log(`\nRespaldo del ${respaldo.creadoEl} (de ${respaldo.origen || 'origen desconocido'})${esStaging ? ', anonimizado para staging' : ''}:`)
  for (const { tabla, filas } of resumenDelRespaldo(respaldo)) console.log(`  ${tabla.padEnd(32)} ${filas}`)

  const modo = flag('aplicar') ? 'aplicar' : flag('ensayo') ? 'ensayo' : 'mostrar'
  if (modo === 'mostrar') {
    console.log('\nNo se escribió nada. Para probarlo sin dejar nada: --ensayo. Para hacerlo: --aplicar.')
    return
  }

  const pool = new Pool({ connectionString: url })
  const cliente = await pool.connect()
  try {
    const existen = new Set(
      (await cliente.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).rows.map(
        (r: { table_name: string }) => r.table_name,
      ),
    )
    const tablas = TABLAS_CRITICAS.filter((t) => t in respaldo.tablas && existen.has(t))
    const faltan = TABLAS_CRITICAS.filter((t) => t in respaldo.tablas && !existen.has(t))
    if (faltan.length) console.log(`\nEn el destino no existen (falta su migración; se saltean): ${faltan.join(', ')}`)

    const conDatos: string[] = []
    for (const t of tablas) if ((await cliente.query(`SELECT 1 FROM "${t}" LIMIT 1`)).rowCount) conDatos.push(t)

    await cliente.query('BEGIN')
    if (conDatos.length) {
      if (!esStaging) throw new Error(`El destino no está vacío (${conDatos.join(', ')}): una base nueva tiene que estar vacía.`)
      if (modo === 'aplicar') {
        if (!flag('reemplazar')) throw new Error(`Staging tiene datos en ${conDatos.length} tablas. Para vaciarlas y restaurar: --reemplazar.`)
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        const ok = (await rl.question(`Se van a VACIAR ${conDatos.length} tablas de staging. Escribí REEMPLAZAR para seguir: `)).trim() === 'REEMPLAZAR'
        rl.close()
        if (!ok) throw new Error('Cancelado.')
      }
      await cliente.query(`TRUNCATE ${tablas.map((t) => `"${t}"`).join(', ')} CASCADE`)
    }

    // Por tandas; lo que choca con una clave de otra tabla (o de sí misma, como users → users) se reintenta después.
    let pendientes: { tabla: string; filas: Record<string, unknown>[] }[] = tablas.map((t) => ({ tabla: t, filas: respaldo.tablas[t] }))
    for (let vuelta = 1; vuelta <= 6 && pendientes.length; vuelta++) {
      const siguen: typeof pendientes = []
      for (const { tabla, filas } of pendientes) {
        const quedan: Record<string, unknown>[] = []
        for (let i = 0; i < filas.length; i += 500) {
          const tanda = filas.slice(i, i + 500)
          await cliente.query('SAVEPOINT tanda')
          try {
            await cliente.query(`INSERT INTO "${tabla}" SELECT * FROM json_populate_recordset(NULL::"${tabla}", $1::json) ON CONFLICT DO NOTHING`, [JSON.stringify(tanda)])
            await cliente.query('RELEASE SAVEPOINT tanda')
          } catch (error) {
            await cliente.query('ROLLBACK TO SAVEPOINT tanda')
            if ((error as { code?: string }).code !== '23503') throw error
            // Fila por fila: las que todavía no tienen su madre, para la próxima vuelta.
            for (const fila of tanda) {
              await cliente.query('SAVEPOINT fila')
              try {
                await cliente.query(`INSERT INTO "${tabla}" SELECT * FROM json_populate_recordset(NULL::"${tabla}", $1::json) ON CONFLICT DO NOTHING`, [JSON.stringify([fila])])
                await cliente.query('RELEASE SAVEPOINT fila')
              } catch (e) {
                await cliente.query('ROLLBACK TO SAVEPOINT fila')
                if ((e as { code?: string }).code !== '23503') throw e
                quedan.push(fila)
              }
            }
          }
        }
        if (quedan.length) siguen.push({ tabla, filas: quedan })
      }
      pendientes = siguen
    }
    if (pendientes.length) throw new Error(`Quedaron filas sin poder insertar: ${pendientes.map((p) => `${p.tabla} (${p.filas.length})`).join(', ')}`)

    // Las secuencias, al máximo de cada id (sólo las tablas que tienen una columna `id`).
    const conId = new Set(
      (await cliente.query(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id'`)).rows.map(
        (r: { table_name: string }) => r.table_name,
      ),
    )
    for (const t of tablas.filter((x) => conId.has(x))) {
      const seq = (await cliente.query(`SELECT pg_get_serial_sequence('"${t}"', 'id') AS s`)).rows[0]?.s
      if (seq) await cliente.query(`SELECT setval('${seq}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${t}"), 1))`)
    }

    console.log('\nEn el destino quedaron:')
    let todoBien = true
    for (const t of tablas) {
      const n = Number((await cliente.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)).rows[0].n)
      const esperado = respaldo.tablas[t].length
      if (n !== esperado) todoBien = false
      console.log(`  ${t.padEnd(32)} ${n}${n === esperado ? '' : `  (el respaldo trae ${esperado})`}`)
    }
    if (esStaging) {
      const { rows } = await cliente.query(`SELECT COUNT(*)::int AS n FROM users WHERE email IS NOT NULL AND email NOT LIKE '%@staging.invalid'`)
      if (Number(rows[0].n) > 0) throw new Error(`Hay ${rows[0].n} emails sin anonimizar: no se deja así en staging.`)
    }

    if (modo === 'ensayo') {
      await cliente.query('ROLLBACK')
      console.log(`\n${todoBien ? 'Ensayo OK' : 'Ensayo con diferencias (ver arriba)'}: todo se deshizo (ROLLBACK). No quedó nada escrito.`)
    } else {
      await cliente.query('COMMIT')
      console.log('\n✅ Restaurado.')
    }
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    cliente.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
