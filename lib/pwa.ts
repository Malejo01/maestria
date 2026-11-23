/**
 * Ronda X · X4 — MaestrIA instalable (PWA). Puro: qué guarda el service
 * worker y cuándo se ofrece instalar.
 *
 * El service worker (public/sw.js) guarda SÓLO la cáscara y lo estático: los
 * archivos de `/_next/static/` (con hash, no cambian), los íconos y la página
 * "sin conexión". Nunca una respuesta de `/api/`, nunca una página (traen datos
 * del alumno) y nunca nada de otro origen. `debeGuardarse` es esa regla, con
 * tests; public/sw.js la repite tal cual porque no puede importar módulos.
 */
export const RUTA_SIN_CONEXION = '/sin-conexion'
export const VERSION_DEL_CACHE = 'maestria-cascara-v1'

export function debeGuardarse(url: { origin: string; pathname: string }, origen: string, metodo = 'GET'): boolean {
  if (metodo !== 'GET' || url.origin !== origen) return false
  const p = url.pathname
  if (p.startsWith('/api/') || p.startsWith('/monitoring')) return false
  if (p.startsWith('/_next/static/')) return true
  if (p.startsWith('/icono-pwa/') || p === '/icon.svg' || p === '/icon-32x32.png' || p === '/apple-icon.png' || p === '/favicon.ico') return true
  if (p === '/manifest.webmanifest' || p === RUTA_SIN_CONEXION) return true
  return false
}

/** "Instalá MaestrIA": una sola vez, después de la segunda práctica, y sólo si el navegador lo permite. */
export const PRACTICAS_PARA_OFRECER = 2

export function debeOfrecerInstalar(e: { practicas: number; yaOfrecido: boolean; instalable: boolean; instalada: boolean }): boolean {
  return e.instalable && !e.instalada && !e.yaOfrecido && e.practicas >= PRACTICAS_PARA_OFRECER
}
