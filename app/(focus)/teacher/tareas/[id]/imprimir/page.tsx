import { notFound } from 'next/navigation'
import { getTeacherViewer } from '@/lib/auth-session'
import { sql } from '@/lib/db'
import { versionDelExamen } from '@/lib/examen-ab'
import { ExamenImpreso } from '@/components/docente/examen-impreso'

export const dynamic = 'force-dynamic'

/**
 * Ronda W · W4 — Una tarea impresa en temas A y B, con la hoja de respuestas.
 * Va en (focus): sin la barra de la app, que no tiene que salir en el papel.
 */
export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) notFound()
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const [q] = (await sql`
    SELECT id, title, subject_name, questions FROM teacher_quizzes WHERE id = ${id} AND user_id = ${teacher.id}
  `) as { id: number; title: string; subject_name: string; questions: unknown }[]
  if (!q || !Array.isArray(q.questions) || q.questions.length === 0) notFound()
  const preguntas = q.questions as Record<string, unknown>[]
  const semilla = `tarea-${q.id}`
  return (
    <ExamenImpreso
      titulo={q.title}
      materia={q.subject_name}
      temas={[
        { tema: 'A', preguntas: versionDelExamen(preguntas, 'A', semilla) },
        { tema: 'B', preguntas: versionDelExamen(preguntas, 'B', semilla) },
      ]}
    />
  )
}
