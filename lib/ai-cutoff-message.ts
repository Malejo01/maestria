/**
 * El mensaje que escribió el guard de IA (lib/ai-guard.ts) cuando cortó una
 * llamada: límite por usuario, sub-tope de invitados o presupuesto global.
 *
 * Esos cortes vienen con un `error` redactado para quien lo lee ("ingresá con
 * tu cuenta de Google para seguir", "volvé en 12 minutos"). Varios clientes lo
 * tiraban y mostraban un genérico, o directamente nada — el invitado sin
 * presupuesto veía un modal en blanco o un botón que no hacía nada, que es un
 * corte disfrazado de "no anda".
 *
 * Sólo se confía en `error` para 429 y 503, que son los status del guard. Los
 * demás errores de las rutas no están escritos para el alumno.
 */
export async function aiCutoffMessage(response: Response): Promise<string | null> {
  if (response.status !== 429 && response.status !== 503) return null

  try {
    const data = await response.clone().json()
    return typeof data?.error === 'string' && data.error.trim() ? data.error : null
  } catch {
    return null
  }
}
