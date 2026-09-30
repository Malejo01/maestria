import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { getEducationContext } from '@/lib/education-context'
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

  let nivel = rawNivel
  let grado = rawGrado

  if (typeof pedagogyContext === 'string') {
    if (!nivel) {
      const matchNivel = pedagogyContext.match(/Nivel:\s*([a-zA-Záéíóúñ]+)/i)
      if (matchNivel && matchNivel[1]) nivel = matchNivel[1]
    }
    if (!grado) {
      const matchGrado = pedagogyContext.match(/Grado(?:\/Año)?:\s*([^\s|]+(?:\s+[^\s|]+)*)/i)
      if (matchGrado && matchGrado[1]) grado = matchGrado[1]
    }
  }

  const guard = await guardAiCall({ bucket: 'feedback', nivel })
  if (!guard.ok) return guard.response

  const eduCtx = getEducationContext(nivel, grado, subject || 'la materia')
  const subjectContext = `\n${eduCtx.estrategiaMateria}`

  const pedagogySection = typeof pedagogyContext === 'string' && pedagogyContext.trim().length > 0
    ? `\nREFERENCIAS PEDAGÓGICAS ADICIONALES:\n${pedagogyContext}\n`
    : ''

  // `.catch` en vez de try/catch para no reindentar el prompt entero: sólo
  // hace falta marcar la fila como fallida y dejar que el error siga su curso.
  const generation = await generateText({
    model: google(AI_MODEL),
    messages: [
      {
        role: 'user',
        content: `ROL E IDENTIDAD:
${eduCtx.rolDocente}.

OBJETIVO:
Un estudiante de ${eduCtx.grado} (${eduCtx.nivel === 'Superior' ? 'Educación Superior' : `edad ${eduCtx.edadMin}-${eduCtx.edadMax} años`}) respondió incorrectamente la siguiente pregunta. Tu tarea es explicarle el error con empatía, calidez y un lenguaje perfectamente adaptado a su edad y nivel educativo.

${eduCtx.registroLinguistico}
${eduCtx.instruccionesExplicacion}

${subjectContext}
TEMA: ${topic}
MATERIA: ${subject || 'General'}
${pedagogySection}

PREGUNTA:
${question}

RESPUESTA DEL ESTUDIANTE: ${selectedText}
RESPUESTA CORRECTA: ${correctText}

Explica de forma muy visual, cercana y estructurada usando EXACTAMENTE este formato de 4 secciones:

## 1. 🧠 ¿Por qué elegiste esta opción? (Diagnóstico de tu respuesta)
Analiza específicamente lo que respondió el estudiante ("${selectedText}"). Explícale de forma empática por qué es muy común cometer esa confusión a su edad. Marca el detalle con calidez ("¡Atención!", "¡Casi!", "Es muy normal confundirse aquí porque..."). NUNCA lo felicites por haberse equivocado (no digas "¡Excelente!" ni "¡Lo hiciste genial!").

## 2. 💡 Explicación paso a paso
Muestra cómo llegar a la respuesta correcta ("${correctText}") con un ejemplo claro y elementos visuales/emojis (🌱, ☀️, 💧, 🔢 según la materia). Sé conciso e ilustrativo.

## 3. 📌 ¿Por qué la respuesta correcta es la única válida?
Resume en 1 o 2 frases el concepto clave.

## 4. ⭐ Tip o consejo para recordar
Un tip práctico, regla mnemotécnica o truco amigable para no volver a tener esa confusión en el futuro.

REGLAS CRÍTICAS:
- Si es Nivel Primario o Inicial, usa emojis sutiles (🌱, ☀️, 💧, 🐥, 🔢) para hacer la lectura súper cálida y visual.
- Usa notación LaTeX solo si hay fórmulas ($x^2$, $\\frac{a}{b}$).
- NUNCA agregues notas ni aclaraciones entre paréntesis sobre LaTeX (ej: NO escribas "(Nota: En este caso no aplica notación LaTeX)").
- Sé muy ágil y directo al punto.`
      }
    ],
    maxOutputTokens: 4000,
    temperature: 0.5,
  }).catch(async (error) => {
    await guard.fail()
    throw error
  })

  const text = generation.text
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

