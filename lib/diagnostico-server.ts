import { sql } from '@/lib/db'
import { preguntasAEvitar } from '@/lib/valoraciones-server'
import { etiquetaDeMateriaDe } from '@/lib/etiqueta-materia-server'
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
 * Un diagnóstico vive en un GRUPO: una fila de `diagnosticos` y N
 * `teacher_quizzes` con tipo = 'diagnostico', cada uno asignado con un intento.
 *
 * L0: el que se arma desde la ficha de un alumno (o de una invitación) es SÓLO
 * para esa persona: `diagnosticos.user_id`/`invitation_id` y, en cada
 * asignación, `solo_user_id`/`solo_invitacion_id`. El grupo entero de un
 * profesorado no ve el diagnóstico de un alumno particular que comparte la
 * materia. Con destinatario null es del grupo (L4). Sin la 028 no se puede
 * guardar un destinatario: el individual responde 409 (lo decide la ruta).
 *
 * LA VÁLVULA: sin las tablas de la 027, `estadoDelDiagnostico` dice
 * `disponible: false` y la ficha no ofrece "Armar diagnóstico".
 */

type Fila = Record<string, unknown>

export interface GrupoDelDiagnostico {
  classroomId: number
  materiaId: number
  materia: string
  /** K6: "Matemática · 3.º Sec." si el docente tiene otra materia que se llama igual. Sólo para mostrar. */
  etiqueta: string
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

/** A quién va un diagnóstico: un alumno, una invitación, o (null) el grupo entero. */
export type DestinatarioDiagnostico = Destino | null

/**
 * Crea la fila del diagnóstico. Con destinatario, necesita la 028: la ruta
 * mira antes `destinatarioDisponible()` y responde 409 si falta.
 */
export async function crearDiagnostico(params: {
  teacherId: string
  classroomId: number
  materiaId: number
  modo: ModoDiagnostico
  destinatario: DestinatarioDiagnostico
}): Promise<number> {
  const { teacherId, classroomId, materiaId, modo, destinatario } = params
  const filas = (destinatario === null
    ? await sql`
        INSERT INTO diagnosticos (teacher_id, classroom_id, teacher_program_id, modo)
        VALUES (${teacherId}, ${classroomId}, ${materiaId}, ${modo})
        RETURNING id
      `
    : await sql`
        INSERT INTO diagnosticos (teacher_id, classroom_id, teacher_program_id, modo, user_id, invitation_id)
        VALUES (${teacherId}, ${classroomId}, ${materiaId}, ${modo},
                ${'userId' in destinatario ? destinatario.userId : null},
                ${'invitacionId' in destinatario ? destinatario.invitacionId : null})
        RETURNING id
      `) as Fila[]
  return Number(filas[0].id)
}

export interface DiagnosticoGuardado {
  id: number
  classroomId: number
  materiaId: number
  modo: ModoDiagnostico
  /** L0: null si es del grupo (o si falta la 028, que es lo mismo que hasta ahora). */
  destinatario: DestinatarioDiagnostico
}

/** El destinatario de una fila de `diagnosticos` leída con to_jsonb (sin la 028, las claves no están). */
export function destinatarioDeDiagnostico(fila: Fila): DestinatarioDiagnostico {
  if (typeof fila.user_id === 'string' && fila.user_id !== '') return { userId: fila.user_id }
  if (fila.invitation_id !== null && fila.invitation_id !== undefined && fila.invitation_id !== '') {
    return { invitacionId: Number(fila.invitation_id) }
  }
  return null
}

/** La fila del diagnóstico, si es de ese docente. */
export async function leerDiagnostico(teacherId: string, diagnosticoId: number): Promise<DiagnosticoGuardado | null> {
  const filas = (await sql`
    SELECT id, classroom_id, teacher_program_id, modo,
           to_jsonb(d) ->> 'user_id' AS user_id, to_jsonb(d) ->> 'invitation_id' AS invitation_id
    FROM diagnosticos d
    WHERE id = ${diagnosticoId} AND teacher_id = ${teacherId} LIMIT 1
  `) as Fila[]
  const fila = filas[0]
  if (!fila) return null
  return {
    id: Number(fila.id),
    classroomId: Number(fila.classroom_id),
    materiaId: Number(fila.teacher_program_id),
    modo: fila.modo === 'integral' ? 'integral' : 'por_unidad',
    destinatario: destinatarioDeDiagnostico(fila),
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
    // Ronda T · A4: el área y el carácter de las unidades salen del programa;
    // los tipos del diagnóstico son un valor del código, no una elección: en
    // lo conceptual no habilitan la numérica.
    teacherProgramId: grupo.materiaId,
    tiposPorDefecto: true,
    perfilAlumnos: await perfilSinRomper(teacherId, grupo.materiaId),
    // O8: "Evitá esto", con los pulgares abajo de esta materia.
    evitar: await preguntasAEvitar(grupo.materiaId),
  }
}

/**
 * El título de cada cuestionario: "Diagnóstico · Unidad II · Ecuaciones" o
 * "Diagnóstico integral · Matemática". L4: con un título propio del docente
 * ("Práctica parcial"), "Práctica parcial · Unidad III" o "Práctica parcial ·
 * Matemática".
 */
export function tituloDeCuestionario(materia: string, cuestionario: CuestionarioPlaneado, propio?: string): string {
  const base = propio?.trim()
  if (base) return cuestionario.unidadId ? `${base} · ${cuestionario.titulo}` : `${base} · ${materia}`
  return cuestionario.unidadId ? `Diagnóstico · ${cuestionario.titulo}` : `Diagnóstico integral · ${materia}`
}

/**
 * Guarda el cuestionario generado como `teacher_quizzes` tipo diagnóstico y lo
 * asigna con un intento: al grupo, o sólo al destinatario del diagnóstico (L0).
 * Devuelve el id del cuestionario.
 */
export async function guardarYAsignar(params: {
  teacherId: string
  diagnostico: DiagnosticoGuardado
  materia: string
  /** K6: la etiqueta de la materia, para el título ("Diagnóstico integral · Matemática · 3.º Sec."). */
  etiqueta?: string
  cuestionario: CuestionarioPlaneado
  preguntas: unknown[]
  /** L4: el título que eligió el docente antes de generar. */
  titulo?: string
}): Promise<number> {
  const { teacherId, diagnostico, materia, etiqueta, cuestionario, preguntas, titulo } = params
  const temas = cuestionario.temas.map((t) => ({ id: t.id, name: t.nombre }))
  const filas = (await sql`
    INSERT INTO teacher_quizzes (
      user_id, teacher_program_id, title, subject_name, mode, status, selected_topics,
      question_count, questions, pedagogy_context, tipo, diagnostico_id, unidad_id, created_at, updated_at
    ) VALUES (
      ${teacherId}, ${diagnostico.materiaId}, ${tituloDeCuestionario(etiqueta ?? materia, cuestionario, titulo)}, ${materia}, 'practico', 'saved',
      ${JSON.stringify(temas)}, ${preguntas.length}, ${JSON.stringify(preguntas)}, NULL,
      'diagnostico', ${diagnostico.id}, ${cuestionario.unidadId}, NOW(), NOW()
    )
    RETURNING id
  `) as Fila[]
  const quizId = Number(filas[0].id)
  const destinatario = diagnostico.destinatario
  if (destinatario === null) {
    await sql`
      INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at, updated_at)
      VALUES (${diagnostico.classroomId}, ${quizId}, NULL, NULL, 1, NOW(), NOW())
    `
  } else {
    await sql`
      INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts,
                                         solo_user_id, solo_invitacion_id, created_at, updated_at)
      VALUES (${diagnostico.classroomId}, ${quizId}, NULL, NULL, 1,
              ${'userId' in destinatario ? destinatario.userId : null},
              ${'invitacionId' in destinatario ? destinatario.invitacionId : null}, NOW(), NOW())
    `
  }
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

/** El grupo (con su materia) de un diagnóstico ya creado. */
export function grupoDelDiagnostico(teacherId: string, diagnostico: DiagnosticoGuardado): Promise<GrupoDelDiagnostico | null> {
  return cargarGrupo(teacherId, diagnostico.classroomId, diagnostico.materiaId)
}

export async function cargarGrupo(teacherId: string, classroomId: number, materiaId: number): Promise<GrupoDelDiagnostico | null> {
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
    etiqueta: await etiquetaDeMateriaDe(teacherId, materiaId, String(programa.subject_name)),
    unidades: normalizeUnits(programa.units),
    nivel: typeof programa.nivel === 'string' ? programa.nivel : null,
    grado: typeof programa.grado === 'string' ? programa.grado : null,
    carrera: typeof perfil?.degree === 'string' ? perfil.degree : '',
    pedagogia: pedagogyProfileToContext(perfil),
  }
}
