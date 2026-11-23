/*
 * Ronda X · X4 — El service worker de MaestrIA.
 *
 * Guarda SÓLO la cáscara y lo estático (la regla, con tests, está en
 * lib/pwa.ts `debeGuardarse`; acá se repite porque un service worker no
 * importa módulos de la app):
 *   - `/_next/static/` (archivos con hash: primero el caché),
 *   - los íconos y el manifiesto,
 *   - la página "sin conexión", que se muestra si una navegación falla.
 * Nunca una respuesta de `/api/`, nunca una página con datos del alumno,
 * nunca otro origen. Todo lo demás va directo a la red, como si no existiera.
 */
const CACHE = 'maestria-cascara-v1'
const SIN_CONEXION = '/sin-conexion'

function debeGuardarse(url) {
  if (url.origin !== self.location.origin) return false
  const p = url.pathname
  if (p.startsWith('/api/') || p.startsWith('/monitoring')) return false
  if (p.startsWith('/_next/static/')) return true
  if (p.startsWith('/icono-pwa/') || p === '/icon.svg' || p === '/icon-32x32.png' || p === '/apple-icon.png' || p === '/favicon.ico') return true
  if (p === '/manifest.webmanifest' || p === SIN_CONEXION) return true
  return false
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // La página sin conexión y lo estático que usa (sus estilos y scripts).
      const res = await fetch(SIN_CONEXION, { cache: 'reload' })
      if (res.ok) {
        const html = await res.clone().text()
        await cache.put(SIN_CONEXION, res)
        const estaticos = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+/g)].map((m) => m[0]))]
        await Promise.all(estaticos.map((e) => cache.add(e).catch(() => {})))
      }
      await cache.addAll(['/icon.svg', '/manifest.webmanifest']).catch(() => {})
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Una navegación va siempre a la red (trae datos del alumno: no se guarda).
  // Sólo si la red falla, la página sin conexión.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match(SIN_CONEXION)) || Response.error()))
    return
  }

  if (!debeGuardarse(url)) return

  // Lo estático: primero el caché; si no está, la red, y se guarda.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const guardado = await cache.match(req)
      if (guardado) return guardado
      const res = await fetch(req)
      if (res.ok && res.type === 'basic') cache.put(req, res.clone())
      return res
    })(),
  )
})
