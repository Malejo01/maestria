/**
 * Levanta `next dev` contra la base de STAGING en vez de la de producción.
 *
 *   npm run dev:staging
 *
 * `next dev` siempre carga `.env.local`, que es producción. Pero Next no pisa
 * una variable que ya está en el entorno, así que alcanza con cargar antes
 * `.env.staging.local`: `DATABASE_URL` y `AUTH_SECRET` salen de staging, y lo
 * que staging no define (la key de Gemini, por ejemplo) sigue saliendo de
 * `.env.local`.
 *
 * Se niega a arrancar si `.env.staging.local` no existe o si su base es la
 * misma que la de `.env.local`: el punto entero de este script es no escribir
 * en producción desde una máquina de desarrollo.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

function leer(archivo) {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((linea) => linea.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, clave, valor]) => [clave, valor.replace(/^["']|["']$/g, '')]),
  )
}

const hostDe = (url) => {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

const staging = leer('.env.staging.local')
const local = leer('.env.local')

if (!staging.DATABASE_URL) {
  console.error('Falta .env.staging.local con DATABASE_URL. Ver docs/staging.md §2.')
  process.exit(1)
}

const hostStaging = hostDe(staging.DATABASE_URL)
if (!hostStaging || hostStaging === hostDe(local.DATABASE_URL)) {
  console.error('La DATABASE_URL de .env.staging.local apunta a la misma base que .env.local. No arranco.')
  process.exit(1)
}

console.log(`→ next dev contra STAGING · ${hostStaging}`)

const hijo = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...staging },
})
hijo.on('exit', (codigo) => process.exit(codigo ?? 0))
