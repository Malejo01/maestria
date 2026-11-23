/**
 * La URL pública del sitio, para los links absolutos (los de difusión de V1,
 * los metadatos y el sitemap de V5). Cambiar al dominio propio es cargar
 * `NEXT_PUBLIC_SITE_URL` en Vercel; el valor de abajo es sólo el de siempre.
 */
export const URL_DEL_SITIO_POR_DEFECTO = 'https://maestria-edu.vercel.app'

export function urlDelSitio(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const valor = env && /^https?:\/\//.test(env) ? env : URL_DEL_SITIO_POR_DEFECTO
  return valor.replace(/\/+$/, '')
}
