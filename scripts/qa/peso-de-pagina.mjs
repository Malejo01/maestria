// O18 · Suma el JS de cliente que puede cargar una página, según su client-reference-manifest.
// Correr después de `npm run build`:  node scripts/qa/peso-de-pagina.mjs "(app)/aulas" "(app)/teacher"
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import vm from 'node:vm'
const rutas = process.argv.slice(2)
for (const ruta of rutas) {
  const archivo = `.next/server/app/${ruta}/page_client-reference-manifest.js`
  const ctx = { globalThis: {} }; ctx.self = ctx.globalThis
  vm.runInNewContext(readFileSync(archivo, 'utf8'), ctx)
  const m = Object.values(ctx.globalThis.__RSC_MANIFEST)[0]
  const archivos = new Set()
  for (const lista of Object.values(m.entryJSFiles ?? {})) for (const f of lista) archivos.add(f)
  for (const mod of Object.values(m.clientModules ?? {})) for (const c of mod.chunks ?? []) if (String(c).endsWith('.js')) archivos.add(c)
  let crudo = 0, gz = 0, katex = 0
  for (const f of archivos) {
    const p = `.next/${f.replace(/^\/?_next\//, '')}`
    if (!existsSync(p)) continue
    const b = readFileSync(p); crudo += b.length; const g = gzipSync(b).length; gz += g
    if (b.includes('katex-mathml') || b.includes('KaTeX parse error')) katex += g
  }
  console.log(`${ruta}: ${archivos.size} archivos, ${(crudo/1024).toFixed(0)} KB, ${(gz/1024).toFixed(0)} KB gzip (con KaTeX: ${(katex/1024).toFixed(0)} KB gzip)`)
}
