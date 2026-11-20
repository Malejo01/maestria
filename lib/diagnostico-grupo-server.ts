import { sql } from '@/lib/db'
import { getOwnedClassroom } from '@/lib/classrooms-server'
import { cargarGrupo, type GrupoDelDiagnostico } from '@/lib/diagnostico-server'
import { destinatarioDisponible } from '@/lib/destinatario-server'
import {
  marcasDeLaApp,
  preguntasDelCuestionario,
  resultadoPorTema,
  sumarPorGrupo,
  type ResultadoDeTema,
  type TemaDelGrupo,
} from '@/lib/diagnostico-resultados'
import type { ModoDiagnostico } from '@/lib/diagnostico'

/**
 * L4: el diagnóstico (o la práctica) de un GRUPO entero: destinatario NULL,
 * asignado al grupo. Armarlo es el mismo `ArmarDiagnostico` con destino
 * `{ grupo }`; esto es el lado del servidor: de qué grupo, y el seguimiento
 * (cuántos lo hicieron y la lectura por tema sumada por grupo).
 */

type Fila = Record<string, unknown>

/** El grupo con su materia, sólo si es de ese docente. */
export async function grupoPropio(teacherId: string, classroomId: number): Promise<GrupoDelDiagnostico | null> {
  const aula = await getOwnedClassroom(classroomId, teacherId)
  if (!aula) return null
  return cargarGrupo(teacherId, classroomId, Number(aula.teacher_program_id))
}

export interface CuestionarioDelGrupo {
  id: number
  titulo: string
  preguntas: number
  /** Alumnos que lo hicieron (al menos un intento en la app). */
  hicieron: number
  /** Alumnos activos del grupo. */
  total: number
}

export interface DiagnosticoDelGrupo {
  id: number
  modo: ModoDiagnostico
  creadoEl: string
  cuestionarios: CuestionarioDelGrupo[]
  temas: TemaDelGrupo[]
}

/**
 * Los diagnósticos y prácticas del grupo (los individuales no: esos van en la
 * ficha de cada alumno, L0), con el seguimiento. Sin la 028 no hay forma de
 * distinguirlos y se muestran todos los del grupo, como antes.
 */
export async function leerSeguimientoDelGrupo(teacherId: string, grupo: GrupoDelDiagnostico): Promise<DiagnosticoDelGrupo[]> {
  const conDestinatario = await destinatarioDisponible()
  const todos = (await sql`
    SELECT id, modo, created_at,
           to_jsonb(d) ->> 'user_id' AS user_id, to_jsonb(d) ->> 'invitation_id' AS invitation_id
    FROM diagnosticos d
    WHERE teacher_id = ${teacherId} AND classroom_id = ${grupo.classroomId}
    ORDER BY created_at DESC, id DESC
  `) as Fila[]
  const diagnosticos = conDestinatario ? todos.filter((d) => !d.user_id && !d.invitation_id) : todos
  if (diagnosticos.length === 0) return []
  const ids = diagnosticos.map((d) => Number(d.id))

  const [cuestionarios, miembros] = await Promise.all([
    sql`
      SELECT q.id, q.title, q.questions, q.selected_topics, q.diagnostico_id, a.id AS assignment_id
      FROM teacher_quizzes q
      LEFT JOIN classroom_assignments a ON a.teacher_quiz_id = q.id AND a.classroom_id = ${grupo.classroomId}
      WHERE q.diagnostico_id = ANY(${ids}) AND q.user_id = ${teacherId}
      ORDER BY q.id ASC
    ` as unknown as Promise<Fila[]>,
    sql`
      SELECT COUNT(*)::int AS total FROM classroom_members
      WHERE classroom_id = ${grupo.classroomId} AND status = 'active' AND user_id <> ${teacherId}
    ` as unknown as Promise<Fila[]>,
  ])
  const total = Number(miembros[0]?.total ?? 0)
  const asignaciones = cuestionarios.map((q) => q.assignment_id).filter((a) => a !== null && a !== undefined).map(Number)

  // El último intento de cada alumno en cada asignación.
  const intentos = asignaciones.length
    ? ((await sql`
        SELECT DISTINCT ON (assignment_id, user_id) id, assignment_id, user_id
        FROM quiz_attempts
        WHERE assignment_id = ANY(${asignaciones})
        ORDER BY assignment_id, user_id, completed_at DESC
      `) as Fila[])
    : []
  const intentoIds = intentos.map((i) => Number(i.id))
  const respuestas = intentoIds.length
    ? ((await sql`
        SELECT quiz_attempt_id, question_index, question_id, is_correct
        FROM quiz_answers WHERE quiz_attempt_id = ANY(${intentoIds})
      `) as Fila[])
    : []

  const unidadDeTema = (temaId: string) => grupo.unidades.find((u) => u.topics.some((t) => t.id === temaId))?.id ?? null

  return diagnosticos
    .map((d) => {
      const propios = cuestionarios.filter((q) => Number(q.diagnostico_id) === Number(d.id))
      // Por alumno, lo que resultó en cada tema de todos los cuestionarios del diagnóstico.
      const porAlumno = new Map<string, ResultadoDeTema[]>()
      const lista: CuestionarioDelGrupo[] = propios.map((q) => {
        const temasDelQuiz = (Array.isArray(q.selected_topics) ? q.selected_topics : []) as { id: string; name: string }[]
        const preguntas = preguntasDelCuestionario(Array.isArray(q.questions) ? q.questions : [], temasDelQuiz)
        const deEsta = intentos.filter((i) => Number(i.assignment_id) === Number(q.assignment_id))
        for (const intento of deEsta) {
          const marcas = marcasDeLaApp(
            preguntas,
            respuestas
              .filter((r) => Number(r.quiz_attempt_id) === Number(intento.id))
              .map((r) => ({
                questionId: String(r.question_id ?? ''),
                questionIndex: Number(r.question_index),
                isCorrect: r.is_correct === null ? null : Boolean(r.is_correct),
              })),
          )
          const userId = String(intento.user_id)
          porAlumno.set(userId, [...(porAlumno.get(userId) ?? []), ...resultadoPorTema(preguntas, marcas, unidadDeTema)])
        }
        return { id: Number(q.id), titulo: String(q.title), preguntas: preguntas.length, hicieron: deEsta.length, total }
      })
      return {
        id: Number(d.id),
        modo: (d.modo === 'integral' ? 'integral' : 'por_unidad') as ModoDiagnostico,
        creadoEl: new Date(d.created_at as string).toISOString(),
        cuestionarios: lista,
        temas: sumarPorGrupo([...porAlumno.values()]),
      }
    })
    .filter((d) => d.cuestionarios.length > 0)
}
