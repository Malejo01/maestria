import { getTeacherViewer } from '@/lib/auth-session'
import { getOwnedClassroom, type OwnedClassroomRow } from '@/lib/classrooms-server'

/**
 * M3: el grupo de la página `/teacher/grupos/[id]`, sólo si es del docente que
 * mira. Otro docente, un alumno o un id que no existe reciben lo mismo —`null`,
 * y la página responde 404—: la página no confirma que el grupo existe.
 */
export async function grupoDelDocente(idCrudo: string): Promise<OwnedClassroomRow | null> {
  const id = Number(idCrudo)
  if (!Number.isInteger(id) || id <= 0) return null
  const docente = await getTeacherViewer()
  if (!docente) return null
  return getOwnedClassroom(id, docente.id)
}
