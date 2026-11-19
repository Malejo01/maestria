import { sql } from '@/lib/db'
import { invitacionDe } from '@/lib/alumnos-docente'
import { leerInvitaciones, leerMiembros } from '@/lib/alumnos-docente-server'
import { fichaDesdeFila } from '@/lib/fichas'
import { faltaLa027, perfilSinRomper, type Destino } from '@/lib/fichas-server'
import { pedagogyProfileToContext, normalizeUnits } from '@/lib/teacher-programs'
import type { CuestionarioPlaneado, ModoDiagnostico } from '@/lib/diagnostico'
import type { QuizRequestParams } from '@/lib/quiz-generation'
import type { PedagogyProfile, ProgramUnit, QuestionType } from '@/lib/types'

/**
 * El diagnóstico inicial en el servidor (J4): de qué grupo, crearlo, y armar
 * cada cuestionario. El reparto de preguntas es lib/diagnostico.ts.
 *
 * Un diagnóstico es de un GRUPO (un alumno particular, o hasta 3 del mismo
 * curso): una fila de `diagnosticos` y N `teacher_quizzes` con
 * tipo = 'diagnostico', cada uno asignado al grupo con un intento.
 *
 * LA VÁLVULA: sin las tablas de la 027, `estadoDelDiagnostico` dice
 * `disponible: false` y la ficha no ofrece "Armar diagnóstico".
 */

type Fila = Record<string, unknown>

export interface GrupoDelDiagnostico {
  classroomId: number
  materiaId: number
  materia: string
  unidades: ProgramUnit[]
  nivel: string | null
  grado: string | null
  carrera: string
  pedagogia: string
}

/**
 * El grupo de un alumno para armarle el diagnóstico: el de la materia que dice
 * su ficha si está en ese grupo; si no, el primero. Para una invitación, su
 * grupo.
 */
export async function grupoDe(teacherId: string, destino: Destino, materiaDeLaFicha: number | null): Promise<GrupoDelDiagnostico | null> {
  let candidatos: { grupoId: number; materiaId: number }[]
  if ('invitacionId' in destino) {
    const invitacion = (await leerInvitaciones(teacherId)).find((i) => i.id === destino.invitacionId)
    candidatos = invitacion ? [{ grupoId: invitacion.grupoId, materiaId: invitacion.materiaId }] : []
  } else {
    candidatos = (await leerMiembros(teacherId))
      .filter((m) => m.userId === destino.userId)
      .map((m) => ({ grupoId: m.grupoId, materiaId: m.materiaId }))
  }
  const elegido = candidatos.find((c) => c.materiaId === materiaDeLaFicha) ?? candidatos[0]
  if (!elegido) return null

  return cargarGrupo(teacherId, elegido.grupoId, elegido.materiaId)
}

/** Los temas que le cuestan, de la ficha (propia o de su invitación), si es de esa materia. */
export async function temasDificilesDe(teacherId: string, destino: Destino): Promise<{ temas: string[]; materiaId: number | null }> {
  try {
    let filas: Fila[] = []
    if ('userId' in destino) {
      filas = (await sql`SELECT * FROM fichas_alumno WHERE teacher_id = ${teacherId} AND user_id = ${destino.userId} LIMIT 1`) as Fila[]
      if (!filas[0]) {
        const membresias = (await leerMiembros(teacherId)).filter((m) => m.userId === destino.userId)
        const suya = invitacionDe(membresias, await leerInvitaciones(teacherId))
        if (suya) {
          filas = (await sql`SELECT * FROM fichas_alumno WHERE teacher_id = ${teacherId} AND invitation_id = ${suya.id} LIMIT 1`) as Fila[]
        }
      }
    } else {
      filas = (await sql`SELECT * FROM fichas_alumno WHERE teacher_id = ${teacherId} AND invitation_id = ${destino.invitacionId} LIMIT 1`) as Fila[]
    }
    const ficha = filas[0] ? fichaDesdeFila(filas[0]) : null
    return { temas: ficha?.temasDificiles ?? [], materiaId: ficha?.materiaId ?? null }
  } catch (error) {
    if (faltaLa027(error)) return { temas: [], materiaId: null }
    throw error
  }
}

/** ¿Están las tablas del diagnóstico? (la 027) */
export async function diagnosticoDisponible(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM diagnosticos LIMIT 0`
    await sql`SELECT tipo, diagnostico_id, unidad_id FROM teacher_quizzes LIMIT 0`
    return true
  } catch (error) {
    if (faltaLa027(error)) return false
    throw error
  }
}

/** Crea la fila del diagnóstico de un grupo. */
export async function crearDiagnostico(params: {
  teacherId: string
  classroomId: number
  materiaId: number
  modo: ModoDiagnostico
}): Promise<number> {
  const filas = (await sql`
    INSERT INTO diagnosticos (teacher_id, classroom_id, teacher_program_id, modo)
    VALUES (${params.teacherId}, ${params.classroomId}, ${params.materiaId}, ${params.modo})
    RETURNING id
  `) as Fila[]
  return Number(filas[0].id)
}

export interface DiagnosticoGuardado {
  id: number
  classroomId: number
  materiaId: number
  modo: ModoDiagnostico
}

/** La fila del diagnóstico, si es de ese docente. */
export async function leerDiagnostico(teacherId: string, diagnosticoId: number): Promise<DiagnosticoGuardado | null> {
  const filas = (await sql`
    SELECT id, classroom_id, teacher_program_id, modo FROM diagnosticos
    WHERE id = ${diagnosticoId} AND teacher_id = ${teacherId} LIMIT 1
  `) as Fila[]
  const fila = filas[0]
  if (!fila) return null
  return {
    id: Number(fila.id),
    classroomId: Number(fila.classroom_id),
    materiaId: Number(fila.teacher_program_id),
    modo: fila.modo === 'integral' ? 'integral' : 'por_unidad',
  }
}

/** Sobre todo opción múltiple y numérica: se corrigen solas y los distractores son errores típicos. */
export const TIPOS_DIAGNOSTICO: QuestionType[] = ['multiple_choice', 'numeric']

/**
 * Lo que el diagnóstico le dice a la IA, además del prompt de siempre: cuántas
 * preguntas de cada tema, dificultad pareja, sin pistas, distractores con los
 * errores típicos. Va como preferencia del docente (pedagogyContext).
 */
export function notaDeDiagnostico(cuestionario: CuestionarioPlaneado): string {
  const reparto = cuestionario.temas.map((t) => `- ${t.nombre}: ${t.preguntas} ${t.preguntas === 1 ? 'pregunta' : 'preguntas'}`).join('\n')
  return `ESTE CUESTIONARIO ES UN DIAGNÓSTICO INICIAL, no una práctica.
Sirve para saber dónde está el alumno antes de empezar las clases, no para enseñarle.
- Repartí las preguntas EXACTAMENTE así, una o dos por tema, sin saltear ninguno:
${reparto}
- Cada pregunta lleva en "topic" el tema que evalúa, con el nombre tal cual figura arriba.
- Dificultad intermedia y PAREJA en todo el cuestionario: ni regalos ni trampas.
- Sin pistas en el enunciado: nada de "recordá que…", ni la fórmula dada, ni el primer paso hecho.
- Los distractores son los errores típicos de ese tema: son lo que diagnostica.`
}

/** Los parámetros de generación de un cuestionario del diagnóstico. */
export async function parametrosDeGeneracion(
  teacherId: string,
  grupo: Pick<GrupoDelDiagnostico, 'materia' | 'unidades' | 'nivel' | 'grado' | 'carrera' | 'pedagogia' | 'materiaId'>,
  cuestionario: CuestionarioPlaneado,
): Promise<QuizRequestParams> {
  return {
    subject: grupo.materia,
    subjectUnits: grupo.unidades,
    topics: cuestionario.temas.map((t) => ({ id: t.id, name: t.nombre })),
    mode: 'practico',
    previousQuestions: [],
    pedagogyContext: [grupo.pedagogia, notaDeDiagnostico(cuestionario)].filter(Boolean).join('\n\n'),
    questionCount: cuestionario.total,
    nivel: grupo.nivel ?? undefined,
    grado: grupo.grado ?? undefined,
    carrera: grupo.carrera,
    difficulty: 'intermedio',
    explicitQuestionTypes: TIPOS_DIAGNOSTICO,
    perfilAlumnos: await perfilSinRomper(teacherId, grupo.materiaId),
  }
}

/** El título de cada cuestionario: "Diagnóstico · Unidad II · Ecuaciones" o "Diagnóstico integral · Matemática". */
export function tituloDeCuestionario(materia: string, cuestionario: CuestionarioPlaneado): string {
  return cuestionario.unidadId ? `Diagnóstico · ${cuestionario.titulo}` : `Diagnóstico integral · ${materia}`
}

/**
 * Guarda el cuestionario generado como `teacher_quizzes` tipo diagnóstico y lo
 * asigna al grupo con un intento. Devuelve el id del cuestionario.
 */
export async function guardarYAsignar(params: {
  teacherId: string
  diagnostico: DiagnosticoGuardado
  materia: string
  cuestionario: CuestionarioPlaneado
  preguntas: unknown[]
}): Promise<number> {
  const { teacherId, diagnostico, materia, cuestionario, preguntas } = params
  const temas = cuestionario.temas.map((t) => ({ id: t.id, name: t.nombre }))
  const filas = (await sql`
    INSERT INTO teacher_quizzes (
      user_id, teacher_program_id, title, subject_name, mode, status, selected_topics,
      question_count, questions, pedagogy_context, tipo, diagnostico_id, unidad_id, created_at, updated_at
    ) VALUES (
      ${teacherId}, ${diagnostico.materiaId}, ${tituloDeCuestionario(materia, cuestionario)}, ${materia}, 'practico', 'saved',
      ${JSON.stringify(temas)}, ${preguntas.length}, ${JSON.stringify(preguntas)}, NULL,
      'diagnostico', ${diagnostico.id}, ${cuestionario.unidadId}, NOW(), NOW()
    )
    RETURNING id
  `) as Fila[]
  const quizId = Number(filas[0].id)
  await sql`
    INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at, updated_at)
    VALUES (${diagnostico.classroomId}, ${quizId}, NULL, NULL, 1, NOW(), NOW())
  `
  return quizId
}

export interface CuestionarioDeDiagnostico {
  id: number
  titulo: string
  unidadId: string | null
  preguntas: number
}

export interface DiagnosticoListado {
  id: number
  modo: ModoDiagnostico
  creadoEl: string
  cuestionarios: CuestionarioDeDiagnostico[]
}

/** Los diagnósticos del grupo, del más nuevo al más viejo, con sus cuestionarios. */
export async function listarDiagnosticos(teacherId: string, classroomId: number): Promise<DiagnosticoListado[]> {
  const filas = (await sql`
    SELECT d.id, d.modo, d.created_at, q.id AS quiz_id, q.title, q.unidad_id, q.question_count
    FROM diagnosticos d
    LEFT JOIN teacher_quizzes q ON q.diagnostico_id = d.id
    WHERE d.teacher_id = ${teacherId} AND d.classroom_id = ${classroomId}
    ORDER BY d.created_at DESC, d.id DESC, q.id ASC
  `) as Fila[]
  const porId = new Map<number, DiagnosticoListado>()
  for (const fila of filas) {
    const id = Number(fila.id)
    if (!porId.has(id)) {
      porId.set(id, {
        id,
        modo: fila.modo === 'integral' ? 'integral' : 'por_unidad',
        creadoEl: new Date(fila.created_at as string).toISOString(),
        cuestionarios: [],
      })
    }
    if (fila.quiz_id !== null && fila.quiz_id !== undefined) {
      porId.get(id)!.cuestionarios.push({
        id: Number(fila.quiz_id),
        titulo: String(fila.title),
        unidadId: typeof fila.unidad_id === 'string' ? fila.unidad_id : null,
        preguntas: Number(fila.question_count),
      })
    }
  }
  // Un diagnóstico sin cuestionarios es uno cuya generación falló entera: no se muestra.
  return [...porId.values()].filter((d) => d.cuestionarios.length > 0)
}

/** El grupo (con su materia) de un diagnóstico ya creado. */
export function grupoDelDiagnostico(teacherId: string, diagnostico: DiagnosticoGuardado): Promise<GrupoDelDiagnostico | null> {
  return cargarGrupo(teacherId, diagnostico.classroomId, diagnostico.materiaId)
}

async function cargarGrupo(teacherId: string, classroomId: number, materiaId: number): Promise<GrupoDelDiagnostico | null> {
  const filas = (await sql`
    SELECT id, subject_name, units, nivel, grado, pedagogy_profile
    FROM teacher_programs WHERE id = ${materiaId} AND user_id = ${teacherId} LIMIT 1
  `) as Fila[]
  const programa = filas[0]
  if (!programa) return null
  const perfil = (programa.pedagogy_profile ?? {}) as PedagogyProfile
  return {
    classroomId,
    materiaId,
    materia: String(programa.subject_name),
    unidades: normalizeUnits(programa.units),
    nivel: typeof programa.nivel === 'string' ? programa.nivel : null,
    grado: typeof programa.grado === 'string' ? programa.grado : null,
    carrera: typeof perfil?.degree === 'string' ? perfil.degree : '',
    pedagogia: pedagogyProfileToContext(perfil),
  }
}
