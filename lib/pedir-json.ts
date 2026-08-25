/**
 * Un fetch de JSON que NO confunde "falló" con "vino vacío".
 *
 * Nació como helper local de `curriculum-selector.tsx` después del incidente
 * del 15-24/08: los cuatro pasos de la cascada consumían el body sin mirar
 * `res.ok`, así que el 500 de la migración 023 ausente se pintó nueve días como
 * "no hay temas cargados". El inventario de deuda-tecnica.md §6a cuenta el
 * mismo patrón en otros 15 call sites — este módulo existe para que el arreglo
 * sea importar, no volver a escribir el chequeo (y para que un `fetch` nuevo
 * que lo esquive se note en code review).
 *
 * El `details` del body viaja en el error a propósito: es el mensaje real del
 * servidor, y perderlo es volver a no saber qué pasó.
 */
export async function pedirJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data: T } | { error: string }> {
  try {
    const res = await fetch(url, init)
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)

    if (!res.ok) {
      const detalle =
        typeof body?.details === 'string' && body.details
          ? body.details
          : typeof body?.error === 'string' && body.error
            ? body.error
            : `HTTP ${res.status}`
      return { error: detalle }
    }

    return { data: body as T }
  } catch (err) {
    // Red caída o respuesta ilegible.
    return { error: err instanceof Error ? err.message : 'No se pudo conectar' }
  }
}
