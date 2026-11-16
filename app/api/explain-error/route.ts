import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import {
  buildExplainErrorPrompt,
  getEducationContext,
  quitarEmojis,
  resolverNivelYGrado,
} from '@/lib/education-context'
import { getSession } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { AI_MODEL } from '@/lib/ai-model'

export async function POST(req: Request) {
  const {
    question,
    questionType,
    selectedText,
    correctText,
    topic,
    subject,
    pedagogyContext,
    nivel: rawNivel,
    grado: rawGrado,
  } = await req.json()

  if (questionType === 'short_answer') {
    return Response.json({ error: 'explain-error no soporta preguntas de tipo short_answer todavia.' }, { status: 400 })
  }

  if (typeof selectedText !== 'string' || typeof correctText !== 'string') {
    return Response.json({ error: 'Faltan selectedText/correctText.' }, { status: 400 })
  }

  // De dónde sale el nivel, en orden: lo que manda el cuestionario (el grupo),
  // el contexto del programa, y recién al final el perfil del alumno. Mi
  // progreso no manda ninguno de los dos primeros: sin el perfil, todo lo que
  // se explicaba desde ahí salía con el nivel por defecto.
  const session = await getSession()
  const { nivel, grado } = resolverNivelYGrado({
    nivel: rawNivel,
    grado: rawGrado,
    pedagogyContext,
    perfil: session?.user ? { nivel: session.user.nivel, grado: session.user.grado } : null,
  })

  const guard = await guardAiCall({ bucket: 'feedback', nivel })
  if (!guard.ok) return guard.response

  const eduCtx = getEducationContext(nivel, grado, subject || 'la materia')

  // `.catch` en vez de try/catch: sólo hace falta marcar la fila como fallida
  // y dejar que el error siga su curso.
  const generation = await generateText({
    model: google(AI_MODEL),
    messages: [
      {
        role: 'user',
        content: buildExplainErrorPrompt({
          ctx: eduCtx,
          question,
          selectedText,
          correctText,
          topic,
          subject,
          pedagogyContext,
        }),
      },
    ],
    maxOutputTokens: 4000,
    temperature: 0.5,
  }).catch(async (error) => {
    await guard.fail()
    throw error
  })

  // El prompt ya pide que no haya emojis fuera de Primario; esto lo garantiza
  // aunque el modelo no obedezca.
  const text = eduCtx.permiteEmojis ? generation.text : quitarEmojis(generation.text)
  await guard.finish(generation.usage)

  // Extraer sección 1 y sección 4 para guardar apunte / diagnóstico
  let misconceptionType = 'Confusión conceptual'
  let tipText = ''

  const sec1Match = text.match(/## 1\.[^\n]*\n([\s\S]*?)(?=## 2\.|$)/i)
  if (sec1Match && sec1Match[1]) {
    const rawLines = sec1Match[1].split('\n').map(l => l.trim()).filter(Boolean)
    if (rawLines.length > 0) {
      misconceptionType = rawLines[0].replace(/^[-*•\s]+/, '').substring(0, 110)
    }
  }

  const sec4Match = text.match(/## 4\.[^\n]*\n([\s\S]*?)$/i)
  if (sec4Match && sec4Match[1]) {
    tipText = sec4Match[1].trim()
  }

  return Response.json({
    explanation: text,
    misconceptionType,
    tipText: tipText || text.substring(0, 200),
  })
}

