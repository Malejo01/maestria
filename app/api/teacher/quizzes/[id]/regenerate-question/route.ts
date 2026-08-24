import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { captureRouteFailure } from '@/lib/observability'
import { generateQuiz, type QuizRequestParams } from '@/lib/quiz-generation'
import type { Question, QuestionType } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/teacher/quizzes/[id]/regenerate-question
 *
 * Reemplaza UNA pregunta del cuestionario, sin tocar las demás.
 *
 * ─── Por qué existe como ruta y no llamando a /api/generate-quiz ────────────
 *
 * El núcleo ya soporta todo lo necesario: `questionCount` admite 1, y
 * `previousQuestions` es la lista que el prompt marca como "no repitas". Lo que
 * el cliente NO tiene es el contexto: nivel, grado, carrera y las unidades del
 * programa viven en `teacher_programs`, no en el cuestionario. Mandarlos desde
 * el browser significaría confiar en que el cliente los arme bien, y además
 * dejaría al alcance de cualquiera generar con los parámetros que quiera a
 * nombre de un programa ajeno.
 *
 * Acá el servidor los lee de la base, con el cuestionario ya verificado como
 * propio del docente.
 *
 * ─── Costo ──────────────────────────────────────────────────────────────────
 *
 * Medido sobre 128 generaciones reales: un cuestionario de ~20 preguntas sale
 * $0,0115 USD promedio (8.767 tokens de salida). Regenerar una sola cae cerca
 * del piso observado, ~$0,002 — entre 5 y 6 veces más barato, NO veinte: el
 * prompt de entrada (currículum, contexto profesional, reglas) no se achica, y
 * con `previousQuestions` incluso crece. Lo que baja es la salida.
 *
 * Cuenta como una llamada del bucket `quiz_generation`, igual que cualquier
 * otra: el límite protege del volumen, no del tamaño.
 */

interface ProgramRow {
  id: number
  units: { name?: unknown; topics?: { name?: unknown }[] }[]
  nivel: string | null
  grado: string | null
  pedagogy_profile: Record<string, unknown> | null
}

interface QuizRow {
  id: number
  teacher_program_id: number
  subject_name: string
  mode: string
  questions: Question[]
  pedagogy_context: string | null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden regenerar preguntas' }, { status: 403 })
  }

  const { id } = await params
  const quizId = Number(id)
  if (!Number.isFinite(quizId) || quizId <= 0) {
    return NextResponse.json({ error: 'Id de cuestionario inválido' }, { status: 400 })
  }

  let markFailed: (() => Promise<void>) | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const questionIndex = Number(body?.questionIndex)
    const rejectionNote = typeof body?.rejectionNote === 'string' ? body.rejectionNote.trim() : ''

    const quizRows = (await sql`
      SELECT id, teacher_program_id, subject_name, mode, questions, pedagogy_context
      FROM teacher_quizzes
      WHERE id = ${quizId} AND user_id = ${teacher.id}
      LIMIT 1
    `) as QuizRow[]

    const quiz = quizRows[0]
    if (!quiz) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= questions.length) {
      return NextResponse.json(
        { error: `La pregunta ${questionIndex} no existe en este cuestionario` },
        { status: 400 },
      )
    }

    const objetivo = questions[questionIndex]

    const programRows = (await sql`
      SELECT id, units, nivel, grado, pedagogy_profile
      FROM teacher_programs
      WHERE id = ${quiz.teacher_program_id} AND user_id = ${teacher.id}
      LIMIT 1
    `) as ProgramRow[]

    const program = programRows[0]
    if (!program) {
      return NextResponse.json({ error: 'La materia del cuestionario ya no existe' }, { status: 404 })
    }

    // La carrera vive en `pedagogy_profile.degree` — `teacher_programs` no tiene
    // columna propia (la migración 022 la agregó sólo a `curriculum`). Es el
    // mismo lugar del que la lee `pedagogyProfileToContext`.
    const carrera =
      typeof program.pedagogy_profile?.degree === 'string' ? (program.pedagogy_profile.degree as string) : ''

    const params_: QuizRequestParams = {
      subject: quiz.subject_name,
      subjectUnits: Array.isArray(program.units) ? program.units : [],
      // Mismo tema y mismo tipo que la que se reemplaza: el docente pidió otra
      // pregunta, no otra cosa.
      topics: [{ id: objetivo.topic, name: objetivo.topicName }],
      mode: quiz.mode,
      previousQuestions: questions
        .filter((_, index) => index !== questionIndex)
        .map((question) => ({ question: question.question })),
      pedagogyContext: quiz.pedagogy_context ?? undefined,
      questionCount: 1,
      nivel: program.nivel ?? undefined,
      grado: program.grado ?? undefined,
      carrera,
      difficulty: 'intermedio',
      explicitQuestionTypes: [objetivo.type as QuestionType],
      rejectionNote: rejectionNote || undefined,
    }

    const guard = await guardAiCall({
      bucket: 'quiz_generation',
      nivel: program.nivel ?? undefined,
      errorBody: () => ({ question: null }),
    })
    if (!guard.ok) return guard.response
    markFailed = guard.fail

    const usageParts: (AiSdkUsage | undefined)[] = []
    const result = await generateQuiz(params_, (usage) => usageParts.push(usage))

    await guard.finish(sumUsage(...usageParts))

    if (!result.ok || result.questions.length === 0) {
      return NextResponse.json(
        { question: null, error: result.ok ? 'La IA no devolvió ninguna pregunta.' : result.message },
        { status: 409 },
      )
    }

    // Se conserva el id de la pregunta vieja a propósito: el cuestionario no se
    // reordena ni se renumera por reemplazar una, y cualquier cosa que apunte a
    // esa posición sigue apuntando a lo mismo.
    const nueva = {
      ...result.questions[0],
      id: objetivo.id,
      origin: 'ai_regenerada' as const,
      ...(rejectionNote ? { rejectionNote } : {}),
    }

    // NO se guarda acá. El docente tiene que poder mirar la pregunta nueva y
    // decidir: si esta ruta escribiera, rechazar la regeneración sería otro
    // pedido a Gemini. El guardado pasa por el PATCH del cuestionario, que es
    // el único camino de escritura.
    return NextResponse.json({ question: nueva })
  } catch (error) {
    if (markFailed) await markFailed()

    captureRouteFailure(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/teacher/quizzes/[id]/regenerate-question',
      operation: 'POST',
    })

    return NextResponse.json(
      {
        question: null,
        error: 'No pudimos regenerar la pregunta. Volvé a intentarlo en unos instantes.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    )
  }
}
