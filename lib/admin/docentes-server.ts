import { sql } from '@/lib/db'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import { estadoDe } from '@/lib/admin/portada'
import type { EstadoPlan } from '@/lib/planes'

/**
 * P1 · /admin/docentes: lo que Mauro miraba con SQL. Sólo lectura.
 *
 * Privacidad: de los alumnos salen CANTIDADES, nunca nombres, emails ni notas.
 * Las consultas de acá no seleccionan ninguna columna de un alumno.
 */

export interface DocenteEnLista {
  id: string
  nombre: string
  email: string | null
  altaEl: string | null
  plan: EstadoPlan
  materias: number
  grupos: number
  alumnos: number
  ultimaActividad: string | null
  /** B2: docente fundadora (la marca del admin). */
  fundadora: boolean
}

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null)

/**
 * Todos los docentes. "Última actividad" es la última vez que dejó rastro: IA,
 * cuestionario, materia, tarea mandada o un intento en uno de sus grupos.
 */
export async function listarDocentes(ahora = new Date()): Promise<DocenteEnLista[]> {
  const filas = (await sql`
    SELECT u.id, u.name, u.email, u.created_at,
      to_jsonb(u) ->> 'plan_nivel' AS plan_nivel,
      to_jsonb(u) ->> 'plan_vence_el' AS plan_vence_el,
      to_jsonb(u) ->> 'prueba_iniciada_el' AS prueba_iniciada_el,
      to_jsonb(u) ->> 'fundadora_desde' AS fundadora_desde,
      (SELECT COUNT(*) FROM teacher_programs p WHERE p.user_id = u.id AND p.status = 'active')::int AS materias,
      (SELECT COUNT(*) FROM classrooms c WHERE c.teacher_id = u.id AND c.status = 'open')::int AS grupos,
      (SELECT COUNT(DISTINCT m.user_id) FROM classroom_members m JOIN classrooms c ON c.id = m.classroom_id
        WHERE c.teacher_id = u.id AND m.status = 'active' AND m.user_id <> u.id)::int AS alumnos,
      GREATEST(
        (SELECT MAX(l.created_at) FROM ai_usage_log l WHERE l.user_id = u.id),
        (SELECT MAX(q.updated_at) FROM teacher_quizzes q WHERE q.user_id = u.id),
        (SELECT MAX(p.updated_at) FROM teacher_programs p WHERE p.user_id = u.id),
        (SELECT MAX(a.created_at) FROM classroom_assignments a JOIN classrooms c ON c.id = a.classroom_id WHERE c.teacher_id = u.id),
        (SELECT MAX(att.completed_at) FROM quiz_attempts att JOIN classrooms c ON c.id = att.classroom_id WHERE c.teacher_id = u.id)
      ) AS ultima
    FROM users u
    WHERE u.role = 'DOCENTE' AND COALESCE(u.is_guest, false) = false
    ORDER BY ultima DESC NULLS LAST, u.created_at DESC
  `) as {
    id: string
    name: string | null
    email: string | null
    created_at: string | Date | null
    plan_nivel: string | null
    plan_vence_el: string | null
    prueba_iniciada_el: string | null
    fundadora_desde: string | null
    materias: number
    grupos: number
    alumnos: number
    ultima: string | Date | null
  }[]

  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.name ?? ''),
    email: f.email,
    altaEl: iso(f.created_at),
    plan: estadoDe(
      {
        email: f.email,
        nivel: f.plan_nivel === null ? null : Number(f.plan_nivel),
        venceEl: f.plan_vence_el,
        pruebaIniciadaEl: f.prueba_iniciada_el,
        alumnos: Number(f.alumnos ?? 0),
      },
      isAdminEmail(f.email),
      ahora,
    ),
    materias: Number(f.materias ?? 0),
    grupos: Number(f.grupos ?? 0),
    alumnos: Number(f.alumnos ?? 0),
    ultimaActividad: iso(f.ultima),
    fundadora: Boolean(f.fundadora_desde),
  }))
}

export interface MateriaDelDocente {
  id: number
  nombre: string
  archivada: boolean
  unidades: number
  creadaEl: string | null
}

export interface GrupoDelDocente {
  id: number
  nombre: string
  materia: string
  cerrado: boolean
  alumnos: number
  tareas: number
  creadoEl: string | null
}

export interface FichaDeDocente {
  docente: DocenteEnLista
  materias: MateriaDelDocente[]
  grupos: GrupoDelDocente[]
}

/** Un docente con sus materias y grupos. null si el id no es de un docente. */
export async function fichaDeDocente(id: string, ahora = new Date()): Promise<FichaDeDocente | null> {
  const todos = await listarDocentes(ahora)
  const docente = todos.find((d) => d.id === id)
  if (!docente) return null

  const [materias, grupos] = await Promise.all([
    sql`
      SELECT id, subject_name, status, created_at,
        CASE WHEN jsonb_typeof(units) = 'array' THEN jsonb_array_length(units) ELSE 0 END AS unidades
      FROM teacher_programs
      WHERE user_id = ${id}
      ORDER BY status ASC, created_at DESC
    ` as unknown as Promise<{ id: number; subject_name: string; status: string; created_at: string | Date | null; unidades: number }[]>,
    sql`
      SELECT c.id, c.name, c.status, c.created_at, p.subject_name,
        (SELECT COUNT(*) FROM classroom_members m WHERE m.classroom_id = c.id AND m.status = 'active' AND m.user_id <> c.teacher_id)::int AS alumnos,
        (SELECT COUNT(*) FROM classroom_assignments a WHERE a.classroom_id = c.id)::int AS tareas
      FROM classrooms c
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      WHERE c.teacher_id = ${id}
      ORDER BY c.status DESC, c.created_at DESC
    ` as unknown as Promise<{ id: number; name: string; status: string; created_at: string | Date | null; subject_name: string; alumnos: number; tareas: number }[]>,
  ])

  return {
    docente,
    materias: materias.map((m) => ({
      id: Number(m.id),
      nombre: m.subject_name,
      archivada: m.status === 'archived',
      unidades: Number(m.unidades ?? 0),
      creadaEl: iso(m.created_at),
    })),
    grupos: grupos.map((g) => ({
      id: Number(g.id),
      nombre: g.name,
      materia: g.subject_name,
      cerrado: g.status === 'closed',
      alumnos: Number(g.alumnos ?? 0),
      tareas: Number(g.tareas ?? 0),
      creadoEl: iso(g.created_at),
    })),
  }
}
