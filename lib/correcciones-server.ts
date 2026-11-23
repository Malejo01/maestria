import { sql } from '@/lib/db'
import { aprueba, scoreOutOfTen } from '@/lib/answer-grading'
import { limpiarRubrica, rubricaValida, type CriterioDeRubrica, type Correccion } from '@/lib/ensayo'

/**
 * Ronda W · W5 — La corrección de los ensayos: la cola del docente, la
 * sugerencia guardada y la confirmación, que recién ahí cambia la respuesta
 * (`is_correct`, la corrección en `answer_payload`) y la nota del intento.
 *
 * Válvula: sin la 048 (la tabla), `disponible: false` y no se guarda nada.
 */
const faltaLaMigracion = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

export interface EnsayoParaCorregir {
  respuestaId: number
  intentoId: number
  alumno: string
  grupo: string
  tarea: string
  consigna: string
  guia: string
  rubrica: CriterioDeRubrica[]
  respuesta: string
  materia: string
  sugerencia: Correccion | null
  respondidaEl: string
}

type Fila = Record<string, unknown>

/** Las filas de ensayo del docente (todas, o una), sin confirmar. */
async function filasDeEnsayos(teacherId: string, respuestaId?: number): Promise<Fila[]> {
  return (await sql`
    SELECT a.id AS respuesta_id, a.question_index, a.question_text, a.answer_payload, a.created_at,
           att.id AS intento_id, att.user_id,
           COALESCE(m.display_name, u.name, 'Alumno') AS alumno, c.name AS grupo,
           q.title, q.questions, q.subject_name,
           ce.sugerencia
    FROM quiz_answers a
    JOIN quiz_attempts att ON att.id = a.quiz_attempt_id
    JOIN classrooms c ON c.id = att.classroom_id AND c.teacher_id = ${teacherId}
    JOIN classroom_assignments asg ON asg.id = att.assignment_id
    JOIN teacher_quizzes q ON q.id = asg.teacher_quiz_id
    LEFT JOIN classroom_members m ON m.classroom_id = c.id AND m.user_id = att.user_id
    LEFT JOIN users u ON u.id = att.user_id
    LEFT JOIN correcciones_ensayo ce ON ce.quiz_answer_id = a.id
    WHERE (a.question_type = 'essay' OR a.answer_payload ->> 'tipo' = 'essay')
      AND a.is_correct IS NULL
      AND ce.confirmada_el IS NULL
      AND (${respuestaId ?? null}::int IS NULL OR a.id = ${respuestaId ?? null}::int)
    ORDER BY a.created_at ASC
    LIMIT 200
  `) as Fila[]
}

function armar(f: Fila): EnsayoParaCorregir {
  const payload = (f.answer_payload ?? {}) as { selectedText?: string; rubrica?: unknown }
  const preguntas = Array.isArray(f.questions) ? (f.questions as Record<string, unknown>[]) : []
  const pregunta = preguntas[Number(f.question_index)] ?? {}
  const rubrica = limpiarRubrica(rubricaValida(payload.rubrica) ? payload.rubrica : pregunta.rubrica)
  return {
    respuestaId: Number(f.respuesta_id),
    intentoId: Number(f.intento_id),
    alumno: String(f.alumno),
    grupo: String(f.grupo),
    tarea: String(f.title),
    consigna: String(f.question_text ?? pregunta.question ?? ''),
    guia: String(pregunta.explanation ?? ''),
    rubrica,
    respuesta: String(payload.selectedText ?? ''),
    materia: String(f.subject_name ?? ''),
    sugerencia: (f.sugerencia as Correccion | null) ?? null,
    respondidaEl: new Date(f.created_at as string).toISOString(),
  }
}

export async function ensayosParaCorregir(teacherId: string): Promise<{ disponible: boolean; ensayos: EnsayoParaCorregir[] }> {
  try {
    return { disponible: true, ensayos: (await filasDeEnsayos(teacherId)).map(armar) }
  } catch (error) {
    if (faltaLaMigracion(error)) return { disponible: false, ensayos: [] }
    throw error
  }
}

/** Uno, sólo si es de un grupo del docente y sigue sin confirmar. */
export async function ensayoDelDocente(teacherId: string, respuestaId: number): Promise<EnsayoParaCorregir | null> {
  const [f] = await filasDeEnsayos(teacherId, respuestaId)
  return f ? armar(f) : null
}

export async function guardarSugerencia(teacherId: string, respuestaId: number, sugerencia: Correccion): Promise<void> {
  await sql`
    INSERT INTO correcciones_ensayo (quiz_answer_id, teacher_id, sugerencia, sugerida_el)
    VALUES (${respuestaId}, ${teacherId}, ${JSON.stringify(sugerencia)}, NOW())
    ON CONFLICT (quiz_answer_id) DO UPDATE SET sugerencia = EXCLUDED.sugerencia, sugerida_el = NOW()
  `
}

/**
 * Confirma la corrección: la guarda, marca la respuesta (aprobada si la nota
 * aprueba, igual que un intento) con la corrección en el payload, y vuelve a
 * calcular el intento (las sin calificar no cuentan, como siempre).
 */
export async function confirmarCorreccion(teacherId: string, ensayo: EnsayoParaCorregir, correccion: Correccion): Promise<void> {
  const aprobada = aprueba(correccion.nota)
  const enPayload = { estadoDeCorreccion: 'corregida', correccion }
  await sql.transaction([
    sql`
      INSERT INTO correcciones_ensayo (quiz_answer_id, teacher_id, correccion, nota, confirmada_el)
      VALUES (${ensayo.respuestaId}, ${teacherId}, ${JSON.stringify(correccion)}, ${correccion.nota}, NOW())
      ON CONFLICT (quiz_answer_id) DO UPDATE SET correccion = EXCLUDED.correccion, nota = EXCLUDED.nota, confirmada_el = NOW()
    `,
    sql`
      UPDATE quiz_answers
      SET is_correct = ${aprobada}, answer_payload = COALESCE(answer_payload, '{}'::jsonb) || ${JSON.stringify(enPayload)}::jsonb
      WHERE id = ${ensayo.respuestaId}
    `,
  ])
  // El intento, con lo que ya está corregido.
  const [c] = (await sql`
    SELECT COUNT(*) FILTER (WHERE is_correct)::int AS bien, COUNT(*) FILTER (WHERE is_correct = false)::int AS mal, COUNT(*) FILTER (WHERE is_correct IS NULL)::int AS sin
    FROM quiz_answers WHERE quiz_attempt_id = ${ensayo.intentoId}
  `) as { bien: number; mal: number; sin: number }[]
  const nota = scoreOutOfTen({ correct: c.bien, incorrect: c.mal, ungraded: c.sin, graded: c.bien + c.mal }) ?? 0
  await sql`
    UPDATE quiz_attempts
    SET correct_answers = ${c.bien}, incorrect_answers = ${c.mal}, ungraded_answers = ${c.sin}, score = ${nota}, passed = ${aprueba(nota)}
    WHERE id = ${ensayo.intentoId}
  `
}

/** Cuántos ensayos esperan corrección (0 sin la 048). */
export async function cuantosParaCorregir(teacherId: string): Promise<number> {
  try {
    return (await filasDeEnsayos(teacherId)).length
  } catch (error) {
    if (faltaLaMigracion(error)) return 0
    throw error
  }
}
