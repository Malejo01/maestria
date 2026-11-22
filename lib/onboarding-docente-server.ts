import { sql } from '@/lib/db'
import { createUniqueJoinCode } from '@/lib/classrooms-server'
import {
  calcularOnboarding,
  contarTemas,
  type DatosOnboarding,
  type EstadoOnboarding,
} from '@/lib/onboarding-docente'

/** La materia y el grupo sobre los que trabaja el paso siguiente del onboarding. */
export interface ContextoOnboarding {
  /** La primera materia que creó, que es con la que está arrancando. */
  materia: { id: number; nombre: string } | null
  /** El grupo de esa materia, si ya existe. */
  grupo: { id: number; nombre: string; codigo: string } | null
  /**
   * Mandó su primera tarea hace poco. El aviso de "¡Listo!" se muestra sólo en
   * esa ventana: se calcula acá, con el reloj del servidor, para que el
   * componente no dependa de la hora al dibujar.
   */
  recienTerminado: boolean
  /**
   * P5 (O13, propuesta 4): cuántos intentos de alumnos hay en sus tareas. Con
   * uno o más, el "¡Listo!" deja de decir "cuando tus alumnos la resuelvan".
   */
  intentosDeAlumnos: number
}

/** Cuánto dura a la vista el "¡Listo!" después de mandar la primera tarea. */
const HORAS_DE_FESTEJO = 48

export interface OnboardingDocente extends EstadoOnboarding, ContextoOnboarding {}

/**
 * Lee de la base todo lo que hace falta para deducir el onboarding de un
 * docente. Son lecturas chicas sobre índices que ya existen (por docente y por
 * grupo); no escribe nada.
 */
export async function leerOnboardingDocente(teacherId: string): Promise<OnboardingDocente> {
  const [programas, grupos, tareas] = await Promise.all([
    sql`
      SELECT id, subject_name, units
      FROM teacher_programs
      WHERE user_id = ${teacherId} AND status = 'active'
        -- E1: la materia personal (autodidacta) no cuenta como materia del docente.
        AND COALESCE((to_jsonb(teacher_programs) ->> 'personal')::boolean, false) = false
      ORDER BY created_at ASC, id ASC
    ` as unknown as Promise<{ id: number; subject_name: string; units: unknown }[]>,
    sql`
      SELECT c.id, c.name, c.join_code, c.teacher_program_id,
             (SELECT COUNT(*)::int FROM classroom_members m
               WHERE m.classroom_id = c.id AND m.status = 'active' AND m.user_id <> ${teacherId}) AS alumnos,
             -- L0: cuentan también las individuales (un diagnóstico armado para
             -- un alumno): para el hito "mandaste tu primera tarea" da lo mismo
             -- a quién fue. Ningún alumno ve nada desde acá.
             (SELECT COUNT(*)::int FROM classroom_assignments a WHERE a.classroom_id = c.id) AS tareas_mandadas,
             (SELECT MIN(a.created_at) FROM classroom_assignments a WHERE a.classroom_id = c.id) AS primera_tarea,
             (SELECT COUNT(*)::int FROM quiz_attempts att
               WHERE att.classroom_id = c.id AND att.assignment_id IS NOT NULL AND att.user_id <> ${teacherId}) AS intentos
      FROM classrooms c
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open'
      ORDER BY c.created_at ASC, c.id ASC
    ` as unknown as Promise<
      {
        id: number
        name: string
        join_code: string
        teacher_program_id: number
        alumnos: number
        tareas_mandadas: number
        primera_tarea: string | Date | null
        intentos: number
      }[]
    >,
    sql`
      SELECT COUNT(*)::int AS total FROM teacher_quizzes WHERE user_id = ${teacherId}
    ` as unknown as Promise<{ total: number }[]>,
  ])

  const datos: DatosOnboarding = {
    materias: programas.length,
    temas: programas.reduce((total, programa) => total + contarTemas(programa.units), 0),
    alumnos: grupos.reduce((total, grupo) => total + Number(grupo.alumnos), 0),
    tareasArmadas: Number(tareas[0]?.total ?? 0),
    tareasMandadas: grupos.reduce((total, grupo) => total + Number(grupo.tareas_mandadas), 0),
  }

  const materia = programas[0] ?? null
  const grupo = materia ? (grupos.find((g) => Number(g.teacher_program_id) === Number(materia.id)) ?? null) : null
  const primeras = grupos
    .map((g) => g.primera_tarea)
    .filter((fecha): fecha is string | Date => fecha !== null)
    .map((fecha) => new Date(fecha).getTime())
    .sort((a, b) => a - b)
  const estado = calcularOnboarding(datos)

  return {
    ...estado,
    materia: materia ? { id: Number(materia.id), nombre: materia.subject_name } : null,
    grupo: grupo ? { id: Number(grupo.id), nombre: grupo.name, codigo: grupo.join_code } : null,
    recienTerminado:
      estado.completo && primeras[0] !== undefined && Date.now() - primeras[0] < HORAS_DE_FESTEJO * 3_600_000,
    intentosDeAlumnos: grupos.reduce((total, g) => total + Number(g.intentos ?? 0), 0),
  }
}

/**
 * El grupo automático: el docente nunca ve un botón "crear aula". Cuando va a
 * sumar a su primer alumno, el grupo de esa materia aparece detrás.
 *
 * Idempotente: si la materia ya tiene un grupo abierto, devuelve ése. El grupo
 * se llama como la materia; el docente puede renombrarlo después.
 *
 * Devuelve null si la materia no es de ese docente.
 */
export async function asegurarGrupoDe(
  teacherId: string,
  teacherProgramId: number,
): Promise<{ id: number; nombre: string; codigo: string } | null> {
  const programas = (await sql`
    SELECT id, subject_name
    FROM teacher_programs
    WHERE id = ${teacherProgramId} AND user_id = ${teacherId} AND status = 'active'
    LIMIT 1
  `) as { id: number; subject_name: string }[]

  const programa = programas[0]
  if (!programa) return null

  const existentes = (await sql`
    SELECT id, name, join_code
    FROM classrooms
    WHERE teacher_id = ${teacherId} AND teacher_program_id = ${teacherProgramId} AND status = 'open'
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  `) as { id: number; name: string; join_code: string }[]

  if (existentes[0]) {
    return { id: Number(existentes[0].id), nombre: existentes[0].name, codigo: existentes[0].join_code }
  }

  const codigo = await createUniqueJoinCode()
  const creados = (await sql`
    INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status, created_at, updated_at)
    VALUES (${teacherId}, ${teacherProgramId}, ${programa.subject_name}, ${codigo}, 'open', NOW(), NOW())
    RETURNING id, name, join_code
  `) as { id: number; name: string; join_code: string }[]

  return { id: Number(creados[0].id), nombre: creados[0].name, codigo: creados[0].join_code }
}
