/**
 * Tandas AA3 + AB2 · /profes: lo que se decide sin pantalla.
 *
 * El botón «Empezar gratis» lleva al ingreso del docente y vuelve a su panel,
 * conservando de dónde vino (`origen` y `ref`, que en el anuncio de Meta es la
 * campaña `AD-…`). El middleware ya guardó eso en la cookie en la primera
 * visita; repetirlo en la URL es por si la cookie no se pudo escribir.
 */
import { normalizarRef } from '@/lib/origen'

export const DESTINO_DEL_DOCENTE = '/teacher'

/** `/sign-in?rol=docente&callbackUrl=/teacher` más el `origen` y el `ref` que traía la página, ya limpios. */
export function linkParaEmpezar(params: URLSearchParams | null | undefined): string {
  const destino = new URLSearchParams({ rol: 'docente', callbackUrl: DESTINO_DEL_DOCENTE })
  // El canal se pasa tal cual si tiene forma de canal (`meta`, `ig`…): quien lo
  // valida contra la lista es el middleware al guardar la cookie (lib/origen.ts).
  const origen = params?.get('origen')?.trim().toLowerCase() ?? ''
  if (/^[a-z]{2,12}$/.test(origen)) destino.set('origen', origen)
  const ref = params ? normalizarRef(params.get('ref')) : null
  if (ref) destino.set('ref', ref)
  return `/sign-in?${destino.toString()}`
}
