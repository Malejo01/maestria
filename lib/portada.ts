/**
 * Ronda V · V5 — La portada pública (`/`) para los tres públicos.
 *
 * Los lugares del video de demo y de los testimonios están reservados y
 * ocultos hasta que haya contenido:
 *   - el video: `NEXT_PUBLIC_VIDEO_DEMO_URL` (un link de YouTube o Vimeo);
 *   - los testimonios: `content/portada/testimonios.json` (una lista; vacía = no se muestra).
 *
 * Todo esto es puro.
 */

export const CAMINOS_DE_LA_PORTADA = ['particulares', 'curso', 'examen'] as const
export type CaminoDeLaPortada = (typeof CAMINOS_DE_LA_PORTADA)[number]

/** Adónde lleva el botón de cada camino. */
export const DESTINO_DEL_CAMINO: Record<CaminoDeLaPortada, string> = {
  particulares: '/sign-in?rol=docente',
  curso: '/sign-in?rol=docente',
  // El modo autodidacta se elige desde Practicar, ya con cuenta.
  examen: '/sign-in?rol=alumno&callbackUrl=%2Fautodidacta',
}

/** La captura de la app (con la materia de ejemplo, V2) de cada camino. */
export const CAPTURA_DEL_CAMINO: Record<CaminoDeLaPortada, string> = {
  particulares: '/portada/particulares.png',
  curso: '/portada/curso.png',
  examen: '/portada/examen.png',
}

/**
 * El link de embebido del video, si el que se cargó es de YouTube o Vimeo; si
 * no, null (y el lugar no se muestra). Nunca se embebe otra cosa.
 */
export function videoDeDemo(url: string | undefined | null): string | null {
  const v = url?.trim()
  if (!v) return null
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '')
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : null)
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const yt = id(u.searchParams.get('v')) ?? id(u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
    return yt ? `https://www.youtube-nocookie.com/embed/${yt}` : null
  }
  if (host === 'youtu.be') {
    const yt = id(u.pathname.slice(1))
    return yt ? `https://www.youtube-nocookie.com/embed/${yt}` : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vi = u.pathname.match(/(\d{6,12})/)?.[1]
    return vi ? `https://player.vimeo.com/video/${vi}` : null
  }
  return null
}

export interface Testimonio {
  texto: string
  nombre: string
  /** "Profesora de Antropología", "Profe particular de Matemática"… */
  rol: string
}

/** Los testimonios que se pueden mostrar (con texto, nombre y rol, cortos). Lo demás se ignora. */
export function testimoniosValidos(crudos: unknown): Testimonio[] {
  if (!Array.isArray(crudos)) return []
  return crudos
    .filter(
      (t): t is Testimonio =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as Testimonio).texto === 'string' &&
        typeof (t as Testimonio).nombre === 'string' &&
        typeof (t as Testimonio).rol === 'string',
    )
    .map((t) => ({ texto: t.texto.trim().slice(0, 400), nombre: t.nombre.trim().slice(0, 80), rol: t.rol.trim().slice(0, 80) }))
    .filter((t) => t.texto && t.nombre)
    .slice(0, 6)
}
