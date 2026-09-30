/**
 * Destino post-login leído de `?callbackUrl=`, que llega por la URL y por lo
 * tanto lo puede escribir cualquiera.
 *
 * Auth.js ya descarta por su cuenta los destinos de otro origen, pero lo hace
 * mandando a la raíz sin avisar. Filtrar acá deja la regla a la vista y
 * testeada: sólo se aceptan rutas relativas al propio sitio. `//evil.com` y
 * `/\evil.com` empiezan con barra pero el navegador los resuelve como otro
 * host, así que no alcanza con mirar el primer carácter.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback: string = '/'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // Tabs y saltos de línea se descartan al parsear una URL: `/\t/evil.com`
  // termina siendo `//evil.com`.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback
  // No tiene sentido volver a la pantalla de login después de loguearse.
  if (raw === '/sign-in' || raw.startsWith('/sign-in/') || raw.startsWith('/sign-in?')) return fallback
  return raw
}
