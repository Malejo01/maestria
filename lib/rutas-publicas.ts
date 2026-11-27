/**
 * Las rutas que el middleware (proxy.ts) deja pasar sin sesión. "Pública" acá
 * significa "el middleware no rebota al ingreso": cada ruta decide por su
 * cuenta qué muestra (un invitado con cookie no es una sesión de NextAuth).
 *
 * Vive fuera de proxy.ts para poder testearla sin levantar Auth.js.
 */
export const RUTAS_PUBLICAS = [
  '/',
  '/sign-in',
  '/sign-up',
  '/precios',             // G5: lo que Mauro le manda a un cliente por WhatsApp
  '/profes',              // AA3: la página del anuncio de Meta
  '/terminos',            // Legales: los linkea la pantalla de ingreso, y Google
  '/privacidad',          //   pide la política de privacidad pública
  '/api/auth',            // NextAuth's own routes
  '/api/generate-quiz',   // Guests generate inside an aula
  '/api/explain-error',   // Explicación del error tras responder mal
  '/aula',                // Join-by-code page
  '/aulas',               // "Mis aulas"
  '/api/classrooms',      // Join endpoint
  '/api/student',         // Student-side aula endpoints
  '/api/quiz/save-result',      // Guests submit attempts too
  '/api/quiz/grade-short-answer',
  '/api/quiz/revancha',   // Se dispara desde la pantalla de resultados
  '/api/feedback',        // Reportar un problema (el invitado también reporta)
  '/api/avisos',          // P3: la campanita del alumno (el invitado también la tiene)
  '/reportes',            // P3: "Tu reporte se resolvió" (también para el invitado)
  '/monitoring',          // Túnel de Sentry (tunnelRoute en next.config.mjs)
  '/api/pagos/mercadopago', // C2: el webhook de Mercado Pago (valida la firma él mismo)
  '/informe',             // V4: el informe del alumno para la familia (sólo lectura, con el token del link)
  '/sitemap.xml',         // V5: para los buscadores
  '/robots.txt',
  '/opengraph-image',     // V5: la imagen para compartir el link
  '/ayuda',               // V6: el centro de ayuda (sirve antes de registrarse)
  '/sin-conexion',        // X4: la página que muestra el service worker sin internet
  '/icono-pwa',           // X4: los íconos de la app instalada
  '/api/cron',            // Y2: el cron de Vercel (cada ruta exige su secreto)
  '/novedades',           // Y3: lo nuevo de MaestrIA (sirve antes de registrarse)
] as const

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((ruta) => pathname === ruta || pathname.startsWith(ruta + '/'))
}
