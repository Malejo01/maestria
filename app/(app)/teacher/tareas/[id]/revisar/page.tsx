import { RevisarTarea } from '@/components/docente/revisar-tarea'
import { destinoDeVuelta } from '@/lib/tarea-docente'

/**
 * L1: revisar y editar una tarea fuera de *Mis tareas* (desde la ficha o desde
 * el final de "Armar diagnóstico"). Monta el mismo TeacherQuizReview y vuelve
 * a `?volver=` (sólo a una pantalla del docente).
 */
export default async function RevisarTareaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ volver?: string }>
}) {
  const { id } = await params
  const { volver } = await searchParams
  return <RevisarTarea quizId={Number(id)} volver={destinoDeVuelta(volver)} />
}
