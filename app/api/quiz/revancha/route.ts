import { generateObject, generateText, type RepairTextFunction } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { buildEducationSystemPrompt } from '@/lib/education-context'
import { guardAiCall } from '@/lib/ai-guard'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { captureAiSchemaFailure, captureRouteFailure } from '@/lib/observability'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

const singleQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  explanation: z.string(),
})

const repairJson: RepairTextFunction = async ({ text }) => {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

export async function POST(req: Request) {
  // El catch de abajo también atrapa errores previos al guard (body inválido),
  // cuando todavía no hay fila que marcar — de ahí la referencia opcional.
  let markFailed: (() => Promise<void>) | null = null

  try {
    const {
      question: originalQuestion,
      selectedAnswer,
      correctAnswer,
      options,
      topic,
      topicName,
      subject,
      nivel,
      grado,
      misconceptionText,
    } = await req.json()

    const guard = await guardAiCall({ bucket: 'feedback', nivel })
    if (!guard.ok) return guard.response
    markFailed = guard.fail

    // El camino de fallback vuelve a llamar al modelo, así que el costo son las
    // dos llamadas aunque el límite cuente una sola revancha.
    const usageParts: (AiSdkUsage | undefined)[] = []

    const educationPrompt = buildEducationSystemPrompt({
      nivel,
      grado,
      materia: subject || 'la materia',
      difficulty: 'intermedio',
    })

    const selectedText = Array.isArray(options) && selectedAnswer !== undefined ? options[selectedAnswer] : ''
    const correctText = Array.isArray(options) && correctAnswer !== undefined ? options[correctAnswer] : ''

    const systemPrompt = `${educationPrompt}

MODO REVANCHA (DESAFÍO ÚNICO E INMEDIATO):
Tu tarea es generar EXACTAMENTE 1 pregunta de revancha sobre el tema "${topicName || subject}".

CONTEXTO DE LA CONFUSIÓN PREVIA DEL ESTUDIANTE:
- Pregunta anterior: "${originalQuestion || ''}"
- Opción que eligió por error: "${selectedText}"
- Respuesta correcta: "${correctText}"
${misconceptionText ? `- Diagnóstico de la duda: ${misconceptionText}` : ''}

OBJETIVO PEDAGÓGICO:
1. Diseña la nueva pregunta sobre el MISMO concepto pedagógico pero AMBIENTADA EN UN ESCENARIO COMPLETAMENTE DISTINTO (ej: cambiar los objetos, la historia o la situación práctica).
2. La pregunta debe verificar de forma directa si el estudiante superó esa confusión específica.
3. Responde SOLO con un objeto JSON válido con las claves: "question", "options" (exactamente 4 opciones), "correctAnswer" (índice 0-3), "explanation" (explicación breve, cálida y festiva).`

    const userPrompt = `Genera 1 pregunta de revancha para ${subject || 'la materia'} - Tema: ${topicName || topic || 'General'}.`

    try {
      const { object, usage } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: singleQuestionSchema,
        schemaName: 'revanchaQuestion',
        schemaDescription: 'Una única pregunta de revancha con question, options (4), correctAnswer (0-based) y explanation.',
        experimental_repairText: repairJson,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2000,
        temperature: 0.4,
      })
      usageParts.push(usage)
      await guard.finish(sumUsage(...usageParts))

      return Response.json({
        question: {
          id: `revancha-${Date.now()}`,
          type: 'multiple_choice',
          topic: topic || 'revancha',
          topicName: topicName || subject || 'Revancha',
          question: object.question,
          options: object.options,
          correctAnswer: object.correctAnswer,
          explanation: object.explanation,
        }
      })
    } catch (primaryErr) {
      captureAiSchemaFailure(primaryErr, {
        endpoint: '/api/quiz/revancha',
        fallback: 'generateText',
        nivel,
        subject,
      })
      console.warn('[revancha] Primary parse failed, using generateText fallback:', primaryErr)
      // Los tokens de la llamada que falló se pierden (el SDK lanza sin
      // devolver usage), así que el costo de este camino queda subestimado.
      const { text, usage } = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2000,
        temperature: 0.3,
      })
      usageParts.push(usage)

      const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No se pudo estructurar la pregunta de revancha.')

      const parsed = JSON.parse(match[0])
      await guard.finish(sumUsage(...usageParts))
      return Response.json({
        question: {
          id: `revancha-${Date.now()}`,
          type: 'multiple_choice',
          topic: topic || 'revancha',
          topicName: topicName || subject || 'Revancha',
          question: parsed.question,
          options: parsed.options,
          correctAnswer: Number(parsed.correctAnswer),
          explanation: parsed.explanation,
        }
      })
    }
  } catch (error) {
    await markFailed?.()
    captureRouteFailure(error, {
      endpoint: '/api/quiz/revancha',
      status: 500,
      operation: 'generate_revancha',
    })
    console.error('[POST /api/quiz/revancha] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message || 'Error al generar pregunta de revancha' }, { status: 500 })
  }
}
