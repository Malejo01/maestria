import { sql } from '@/lib/db'
import {
  DIAGNOSTIC_DATE,
  RELIABLE_QUESTION_TYPES,
  type Dispersion,
  type ReliableQuestionType,
  type TypeTally,
  programLinkFor,
  suggestStrategy,
  summarizeDispersion,
  type ProgramLink,
  type TeachingStrategy,
} from '@/lib/diagnostic-report'

/**
 * Prefijo `WITH` que deja disponible la CTE `atribuibles` (attempt_id, user_id,
 * curr_id). `$1` es siempre la fecha del diagnóstico; los parámetros propios de
 * cada consulta empiezan en `$2`.
 *
 * Va como texto y no como tagged template porque el driver de Neon interpola
 * los `${}` como PARÁMETROS, no como SQL: anidar un template dentro de otro
 * mandaría el objeto de query como si fuera un valor. De ahí `sql.query(...)`
 * con placeholders posicionales.
 *
 * Cómo se decide a qué unidad pertenece cada respuesta:
 *
 * NO se usa `quiz_answers.topic_name`. Ese campo lo escribe la IA por pregunta
 * y es texto libre: 358 valores distintos sobre 1.680 respuestas, y coincide
 * con el tema que el alumno eligió sólo 22 veces. Agrupar por ahí daría 358
 * "unidades" de una respuesta cada una.
 *
 * La clave real es `quiz_attempts.topics` —lo que el alumno efectivamente
 * eligió— resuelto contra `curriculum.temas`. Los 398 pares (intento, tema) del
 * 10/08 matchean todos.
 *
 * Dos sutilezas que resuelve el HAVING:
 *
 * 1. Cinco de los 46 temas viven en más de una fila de `curriculum` (el seeder
 *    repitió temas entre 4to y 5to año). Por eso el lookup se ancla a Secundario
 *    4to Matemática, que es lo que realmente se sirvió: sin ese ancla un mismo
 *    intento aparece en dos ejes y todos los totales salen duplicados.
 *
 * 2. Un intento cuyos temas cruzan varias unidades no se puede atribuir: las
 *    respuestas no guardan a cuál de los temas elegidos corresponden. Se
 *    excluyen del corte por unidad en vez de repartirse a ojo. Son 7 de 84; los
 *    77 restantes cubren 1.540 de las 1.680 respuestas.
 */
const WITH_ATTRIBUTABLE = `
  WITH at_topics AS (
    SELECT at.id AS attempt_id, at.user_id, t AS tema
    FROM quiz_attempts at, UNNEST(at.topics) AS t
    WHERE at.completed_at::date = $1::date
  ),
  canon AS (
    SELECT DISTINCT
      a.attempt_id,
      a.user_id,
      (SELECT MIN(c.id) FROM curriculum c
        WHERE c.temas ? a.tema
          AND c.nivel = 'Secundario' AND c.grado = '4to Año' AND c.materia = 'Matemática'
      ) AS curr_id
    FROM at_topics a
  ),
  atribuibles AS (
    SELECT attempt_id, user_id, MIN(curr_id) AS curr_id
    FROM canon
    GROUP BY attempt_id, user_id
    HAVING COUNT(DISTINCT curr_id) = 1 AND BOOL_AND(curr_id IS NOT NULL)
  )
`

interface TallyRow {
  unit: string
  question_type: string
  total: number
  correct: number
}

function emptyTallies(): Record<ReliableQuestionType, TypeTally> {
  return {
    multiple_choice: { total: 0, correct: 0 },
    true_false: { total: 0, correct: 0 },
    numeric: { total: 0, correct: 0 },
  }
}

function isReliable(type: string): type is ReliableQuestionType {
  return (RELIABLE_QUESTION_TYPES as string[]).includes(type)
}

export interface UnitReport {
  unit: string
  byType: Record<ReliableQuestionType, TypeTally>
  /** `short_answer` descartadas en esta unidad. Se informa, no se esconde. */
  excludedShortAnswers: number
  programLink: ProgramLink
}

function foldRows(rows: TallyRow[]): UnitReport[] {
  const byUnit = new Map<string, UnitReport>()

  for (const row of rows) {
    const unit = String(row.unit)
    const current =
      byUnit.get(unit) ??
      { unit, byType: emptyTallies(), excludedShortAnswers: 0, programLink: programLinkFor(unit) }

    const total = Number(row.total)
    const correct = Number(row.correct)

    if (isReliable(row.question_type)) {
      current.byType[row.question_type] = { total, correct }
    } else if (row.question_type === 'short_answer') {
      current.excludedShortAnswers += total
    }

    byUnit.set(unit, current)
  }

  // Lo que entra al programa primero: es lo que el alumno tiene que estudiar y
  // lo que el docente tiene que nivelar.
  return [...byUnit.values()].sort((a, b) => {
    const aInProgram = a.programLink.programUnit ? 0 : 1
    const bInProgram = b.programLink.programUnit ? 0 : 1
    return aInProgram - bInProgram || a.unit.localeCompare(b.unit)
  })
}

const UNIT_TALLY_SELECT = `
  SELECT cu.eje                                      AS unit,
         ans.question_type,
         COUNT(*)::int                               AS total,
         COUNT(*) FILTER (WHERE ans.is_correct)::int AS correct
  FROM atribuibles a
  JOIN quiz_answers ans ON ans.quiz_attempt_id = a.attempt_id
  JOIN curriculum cu ON cu.id = a.curr_id
`

export interface StudentDiagnostic {
  date: string
  attempts: number
  units: UnitReport[]
  /** Respuestas de intentos que cruzaban varias unidades y no se pudieron ubicar. */
  unattributedAnswers: number
  /** Total de `short_answer` del alumno, atribuidas o no. */
  shortAnswerTotal: number
}

export async function loadStudentDiagnostic(userId: string): Promise<StudentDiagnostic | null> {
  const [tallyRows, totals] = await Promise.all([
    sql.query(
      `${WITH_ATTRIBUTABLE} ${UNIT_TALLY_SELECT}
       WHERE a.user_id = $2
       GROUP BY cu.eje, ans.question_type`,
      [DIAGNOSTIC_DATE, userId],
    ),
    sql.query(
      `${WITH_ATTRIBUTABLE}
       SELECT COUNT(DISTINCT at.id)::int AS attempts,
              COUNT(ans.id) FILTER (WHERE ans.question_type = 'short_answer')::int AS short_answers,
              COUNT(ans.id) FILTER (
                WHERE NOT EXISTS (SELECT 1 FROM atribuibles a WHERE a.attempt_id = at.id)
              )::int AS unattributed
       FROM quiz_attempts at
       LEFT JOIN quiz_answers ans ON ans.quiz_attempt_id = at.id
       WHERE at.user_id = $2 AND at.completed_at::date = $1::date`,
      [DIAGNOSTIC_DATE, userId],
    ),
  ])

  const summary = (totals as unknown as Record<string, unknown>[])[0]
  const attempts = Number(summary?.attempts ?? 0)
  if (attempts === 0) return null

  return {
    date: DIAGNOSTIC_DATE,
    attempts,
    units: foldRows(tallyRows as unknown as TallyRow[]),
    unattributedAnswers: Number(summary?.unattributed ?? 0),
    shortAnswerTotal: Number(summary?.short_answers ?? 0),
  }
}

export interface CourseUnitReport extends UnitReport {
  students: number
  dispersion: Dispersion | null
  strategy: TeachingStrategy
}

export interface CourseDiagnostic {
  date: string
  students: number
  attempts: number
  units: CourseUnitReport[]
  unattributedAttempts: number
  shortAnswerTotal: number
  shortAnswerMarkedWrong: number
}

/**
 * Mínimo de respuestas confiables para que el porcentaje de un alumno en una
 * unidad entre al cálculo de dispersión. Con menos, el número dice más sobre
 * cuántas preguntas le tocaron que sobre lo que sabe.
 */
const MIN_ANSWERS_FOR_DISPERSION = 5

export async function loadCourseDiagnostic(): Promise<CourseDiagnostic> {
  const [tallyRows, perStudentRows, totals] = await Promise.all([
    sql.query(`${WITH_ATTRIBUTABLE} ${UNIT_TALLY_SELECT} GROUP BY cu.eje, ans.question_type`, [
      DIAGNOSTIC_DATE,
    ]),
    // Un porcentaje por alumno y unidad. El agregado sale de acá y no de las
    // filas sueltas: así un alumno que rindió cuatro veces no pesa cuatro veces
    // en la dispersión del curso.
    sql.query(
      `${WITH_ATTRIBUTABLE}
       SELECT cu.eje AS unit,
              a.user_id,
              COUNT(*)::int                               AS total,
              COUNT(*) FILTER (WHERE ans.is_correct)::int AS correct
       FROM atribuibles a
       JOIN quiz_answers ans ON ans.quiz_attempt_id = a.attempt_id
       JOIN curriculum cu ON cu.id = a.curr_id
       WHERE ans.question_type IN ('multiple_choice', 'true_false', 'numeric')
       GROUP BY cu.eje, a.user_id
       HAVING COUNT(*) >= $2`,
      [DIAGNOSTIC_DATE, MIN_ANSWERS_FOR_DISPERSION],
    ),
    sql.query(
      `${WITH_ATTRIBUTABLE}
       SELECT COUNT(DISTINCT at.user_id)::int AS students,
              COUNT(DISTINCT at.id)::int      AS attempts,
              COUNT(DISTINCT at.id) FILTER (
                WHERE NOT EXISTS (SELECT 1 FROM atribuibles a WHERE a.attempt_id = at.id)
              )::int AS unattributed_attempts,
              (SELECT COUNT(*)::int FROM quiz_answers ans2
                JOIN quiz_attempts at2 ON at2.id = ans2.quiz_attempt_id
               WHERE at2.completed_at::date = $1::date
                 AND ans2.question_type = 'short_answer') AS short_answers,
              (SELECT COUNT(*)::int FROM quiz_answers ans3
                JOIN quiz_attempts at3 ON at3.id = ans3.quiz_attempt_id
               WHERE at3.completed_at::date = $1::date
                 AND ans3.question_type = 'short_answer'
                 AND ans3.is_correct IS FALSE) AS short_answers_wrong
       FROM quiz_attempts at
       WHERE at.completed_at::date = $1::date`,
      [DIAGNOSTIC_DATE],
    ),
  ])

  const scoresByUnit = new Map<string, number[]>()
  const studentsByUnit = new Map<string, Set<string>>()

  for (const row of perStudentRows as unknown as Record<string, unknown>[]) {
    const unit = String(row.unit)
    const total = Number(row.total)
    const correct = Number(row.correct)

    const scores = scoresByUnit.get(unit) ?? []
    scores.push(correct / total)
    scoresByUnit.set(unit, scores)

    const students = studentsByUnit.get(unit) ?? new Set<string>()
    students.add(String(row.user_id))
    studentsByUnit.set(unit, students)
  }

  const units: CourseUnitReport[] = foldRows(tallyRows as unknown as TallyRow[]).map((unit) => {
    const dispersion = summarizeDispersion(scoresByUnit.get(unit.unit) ?? [])
    return {
      ...unit,
      students: studentsByUnit.get(unit.unit)?.size ?? 0,
      dispersion,
      strategy: suggestStrategy(dispersion),
    }
  })

  const summary = (totals as unknown as Record<string, unknown>[])[0]

  return {
    date: DIAGNOSTIC_DATE,
    students: Number(summary?.students ?? 0),
    attempts: Number(summary?.attempts ?? 0),
    units,
    unattributedAttempts: Number(summary?.unattributed_attempts ?? 0),
    shortAnswerTotal: Number(summary?.short_answers ?? 0),
    shortAnswerMarkedWrong: Number(summary?.short_answers_wrong ?? 0),
  }
}
