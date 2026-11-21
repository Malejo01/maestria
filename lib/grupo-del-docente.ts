/**
 * M3: las pestañas de la página de un grupo (`/teacher/grupos/[id]`). Van en la
 * URL (`?pestaña=alumnos|tareas|temas|diagnosticos`) para que volver atrás,
 * recargar o compartir el link deje al docente donde estaba.
 */
export const PESTANAS_DEL_GRUPO = ['alumnos', 'tareas', 'temas', 'diagnosticos'] as const
export type PestanaDelGrupo = (typeof PESTANAS_DEL_GRUPO)[number]

/** Lo que llega por la URL, a una pestaña válida (por defecto, Alumnos). */
export function pestanaDeLaUrl(valor: unknown): PestanaDelGrupo {
  const texto = Array.isArray(valor) ? valor[0] : valor
  return PESTANAS_DEL_GRUPO.includes(texto as PestanaDelGrupo) ? (texto as PestanaDelGrupo) : 'alumnos'
}

/** El link de una pestaña, conservando el resto de la consulta (orden, filtro de M4). */
export function rutaDePestana(grupoId: number, pestana: PestanaDelGrupo, consulta?: URLSearchParams): string {
  const params = new URLSearchParams(consulta)
  params.delete('pestana')
  params.delete('nuevo')
  if (pestana === 'alumnos') params.delete('pestaña')
  else params.set('pestaña', pestana)
  const texto = params.toString()
  return `/teacher/grupos/${grupoId}${texto ? `?${texto}` : ''}`
}
