import type { Question, TeacherQuiz } from '@/lib/types'
import { TIPOS_MOODLE_TEXTOS } from '@/lib/textos'
import { fraccionesVariasCorrectas } from '@/lib/tipos-moodle'
import { sanitizeSubjectSegment as sanitizePathSegment, slugifySubject as toSlug } from '@/lib/subject-slug'
import { esFactorizacion, factorizar } from '@/lib/factorizacion'

const MAX_CATEGORY_TOPICS = 5

export function normalizeMathJaxDelimiters(text: string): string {
  let normalized = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr) => `\\[${expr}\\]`)

  normalized = normalized.replace(/(^|[^\\])\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_match, prefix, expr) => {
    return `${prefix}\\(${expr}\\)`
  })

  return normalized
}

export function normalizeLogicalNotation(text: string): string {
  return text
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\wedge/g, '∧')
    .replace(/\\vee/g, '∨')
    .replace(/\\neg\s*/g, '¬')
    // Recover already-corrupted tokens like "egp" or "eg(q∨r)".
    .replace(/(^|[\s(])eg(?=[a-zA-Z(])/gi, '$1¬')
}

/** Los caracteres que GIFT lee como estructura (y que `\` vuelve literales). */
const GIFT_ESPECIALES = '~=#{}:'

/**
 * M5 · Lo que va DENTRO de `\( … \)` o `\[ … \]`.
 *
 * El lector de Moodle resuelve primero `\\` (→ `\`) y después `\{`, `\}`,
 * `\:`, `\#`, `\=`, `\~` y `\n` (→ el carácter, o un salto de línea). En
 * LaTeX eso rompe tres cosas que el escape de antes no veía:
 *
 *  - `\{1, 2\}` (las llaves de un conjunto) llegaba como `{1, 2}`: LaTeX las
 *    toma como agrupación y el alumno veía "1, 2" sin llaves. Ahora sale
 *    `\\\{` (el `\\` deja una barra, el `\{` deja la llave): llega `\{`.
 *  - un comando que empieza con `n` (`\neq`, `\notin`, `\nabla`) llegaba como
 *    salto de línea + "eq". Ahora sale `\\neq`: llega `\neq`.
 *  - `\\` (salto de línea de LaTeX) llegaba como una sola barra.
 *
 * Las llaves de agrupación (`\frac{a}{b}`, `\mathbb{N}`) siguen con un solo
 * escape, como siempre: `\frac\{a\}\{b\}` llega `\frac{a}{b}`.
 */
function escapeLatexForGift(expr: string): string {
  let out = ''
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i]
    if (c === '\\') {
      const next = expr[i + 1]
      if (next !== undefined && GIFT_ESPECIALES.includes(next)) {
        out += `\\\\\\${next}`
        i += 1
      } else if (next === '\\') {
        out += '\\\\\\\\'
        i += 1
      } else if (next === 'n') {
        out += '\\\\n'
        i += 1
      } else {
        out += c
      }
    } else if (GIFT_ESPECIALES.includes(c)) {
      out += `\\${c}`
    } else {
      out += c
    }
  }
  return out
}

/** Texto común (fuera de LaTeX): se escapa lo que GIFT lee como estructura. */
function escapePlainForGift(text: string): string {
  return text.replace(/(?<!\\)([~=#{}:])/g, '\\$1')
}

const SEGMENTO_LATEX = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/

function escapeGiftText(text: string): string {
  const normalizado = normalizeMathJaxDelimiters(normalizeLogicalNotation(text))
    .replace(/\r\n/g, '\n')
    // Una línea en blanco termina la pregunta en GIFT: se juntan.
    .replace(/\n\s*\n+/g, '\n')
  return normalizado
    .split(SEGMENTO_LATEX)
    .map((parte, i) => {
      if (i % 2 === 0) return escapePlainForGift(parte)
      const abre = parte.slice(0, 2)
      const cierra = parte.slice(-2)
      return `${abre}${escapeLatexForGift(parte.slice(2, -2))}${cierra}`
    })
    .join('')
    .trim()
}

export function extractTopicNames(quiz: TeacherQuiz): string[] {
  const selected = Array.isArray(quiz.selectedTopics)
    ? quiz.selectedTopics.map((topic) => sanitizePathSegment(topic.name)).filter(Boolean)
    : []

  if (selected.length > 0) {
    return Array.from(new Set(selected)).slice(0, MAX_CATEGORY_TOPICS)
  }

  const fromQuestions = quiz.questions
    .map((question) => sanitizePathSegment(question.topicName || question.topic))
    .filter(Boolean)

  return Array.from(new Set(fromQuestions)).slice(0, MAX_CATEGORY_TOPICS)
}

/** Moodle admite 255 por tramo; se deja margen para lo que agrega al importar. */
export const MAX_TRAMO_DE_CATEGORIA = 120

/** Corta en palabra, sin pasarse del máximo. */
function recortarEnPalabra(texto: string, maximo = MAX_TRAMO_DE_CATEGORIA): string {
  if (texto.length <= maximo) return texto
  const corte = texto.slice(0, maximo + 1)
  const espacio = Math.max(corte.lastIndexOf(' '), corte.lastIndexOf('-'))
  return (espacio > maximo / 2 ? corte.slice(0, espacio) : texto.slice(0, maximo)).replace(/[\s-]+$/, '')
}

/**
 * M5: cada tramo, hasta 120 caracteres. El 20/11 un cuestionario de
 * Matemática 1 con cinco temas largos dio un tramo de 300 y Moodle (que admite
 * 255) lo rechazó. Si los temas no entran, el tramo es "Varios temas".
 */
export function buildCategoryPath(quiz: TeacherQuiz): string {
  const subject = recortarEnPalabra(sanitizePathSegment(quiz.subjectName) || 'Materia')
  const topicNames = extractTopicNames(quiz)

  if (topicNames.length === 0) {
    return `$course$/${subject}`
  }

  const temas = topicNames.join('-')
  const tramo = temas.length <= MAX_TRAMO_DE_CATEGORIA ? temas : topicNames.length === 1 ? recortarEnPalabra(temas) : 'Varios temas'
  return `$course$/${subject}/${tramo}`
}

/**
 * La retroalimentación general, `####texto`, va ADENTRO de las llaves, al
 * final de las respuestas: `{TRUE####texto}`, `{#4####texto}`,
 * `{=a=b####texto}`. M5: en verdadero o falso, numéricas, respuesta corta y
 * factorización iba DESPUÉS de `}`, y Moodle toma lo que sigue a la llave como
 * enunciado: el alumno veía "#### …" y no había retroalimentación.
 */
function buildFeedback(question: Question): string {
  return question.explanation.trim().length > 0 ? `####${escapeGiftText(question.explanation)}` : ''
}

function buildMultipleChoiceBlock(questionTitle: string, questionText: string, question: Extract<Question, { type: 'multiple_choice' }>, index: number): string {
  const correctIndex = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1

  if (correctIndex < 0 || correctIndex >= question.options.length) {
    throw new Error(`La pregunta ${index + 1} no tiene una respuesta correcta valida.`)
  }

  const options = question.options.map((option, optionIndex) => {
    const prefix = optionIndex === correctIndex ? '=' : '~'
    return `${prefix}${escapeGiftText(option)}`
  })

  const feedback = buildFeedback(question)
  return `::${questionTitle}::${questionText} {\n${options.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`
}

function buildQuestionBlock(question: Question, index: number): string {
  const questionTitle = `Q${index + 1}`
  const questionText = escapeGiftText(question.question)

  switch (question.type) {
    case 'multiple_choice':
      return buildMultipleChoiceBlock(questionTitle, questionText, question, index)
    case 'true_false':
      return `::${questionTitle}::${questionText} {${question.correctAnswer ? 'TRUE' : 'FALSE'}${buildFeedback(question)}}`
    case 'numeric': {
      // K1: acá NO va `formatearNumero`. GIFT exige punto decimal en la
      // respuesta numérica (`{#0.75:0.01}`); Moodle muestra el número en el
      // idioma del curso. El enunciado sí lleva lo que escribió la IA.
      // K2: GIFT no tiene fracciones. Una que no da decimal exacto (11/12) se
      // exporta redondeada a cuatro decimales con ese margen, para que en
      // Moodle se pueda acertar escribiendo el decimal.
      // L3: GIFT no corrige factorizaciones. Va como respuesta corta con las
      // formas más comunes del producto de primos ordenado (2^2*3*5, 2^2·3·5,
      // 2*2*3*5, 2x2x3x5); con el número a secas en Moodle se acertaría sin factorizar.
      if (esFactorizacion(question)) {
        const factores = factorizar(Number(question.correctAnswer))
        const potencias = (sep: string) => factores.map((p) => (p.exponente === 1 ? `${p.base}` : `${p.base}^${p.exponente}`)).join(sep)
        const sueltos = (sep: string) => factores.flatMap((p) => Array(p.exponente).fill(String(p.base))).join(sep)
        const formas = [...new Set([potencias('*'), potencias('·'), sueltos('*'), sueltos('x')])]
        return `::${questionTitle}::${questionText} {${formas.map((f) => `=${escapeGiftText(f)}`).join('')}${buildFeedback(question)}}`
      }
      const valor = Number(question.correctAnswer)
      const periodica = Boolean(question.fraccion) && !question.tolerance && Math.abs(valor * 1e4 - Math.round(valor * 1e4)) > 1e-6
      const numero = periodica ? Number(valor.toFixed(4)) : question.correctAnswer
      const margen = question.tolerance || (periodica ? 0.0001 : 0)
      const tolerance = margen ? `:${margen}` : ''
      return `::${questionTitle}::${questionText} {#${numero}${tolerance}${buildFeedback(question)}}`
    }
    case 'multiple_response': {
      // F2: varias correctas. Cada correcta suma su parte y cada incorrecta resta.
      const fracciones = fraccionesVariasCorrectas(question.options.length, question.correctAnswers)
      const opciones = question.options.map((o, i) => `~%${fracciones[i]}%${escapeGiftText(o)}`)
      const feedback = buildFeedback(question)
      return `::${questionTitle}::${questionText} {\n${opciones.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`
    }
    case 'matching': {
      // F3: GIFT no tiene distractores en el emparejamiento: van sólo los pares.
      const pares = question.pairs.map((p) => `=${escapeGiftText(p.left)} -> ${escapeGiftText(p.right)}`)
      const feedback = buildFeedback(question)
      return `::${questionTitle}::${questionText} {\n${pares.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`
    }
    case 'ordering': {
      // F4: GIFT no tiene ordenamiento. Va como emparejamiento de cada lugar
      // con su elemento ("Lugar 1 -> …"), que se corrige igual.
      const pares = question.items.map((item, i) => `=${escapeGiftText(TIPOS_MOODLE_TEXTOS.ordenamiento.lugar(i + 1))} -> ${escapeGiftText(item)}`)
      const feedback = buildFeedback(question)
      return `::${questionTitle}::${questionText} {\n${pares.join('\n')}${feedback ? `\n${feedback}` : ''}\n}`
    }
    case 'short_answer': {
      if (question.acceptedAnswers.length === 0) {
        throw new Error(`La pregunta ${index + 1} no tiene respuestas aceptadas validas.`)
      }
      const alternates = question.acceptedAnswers.map((answer) => `=${escapeGiftText(answer)}`).join('')
      return `::${questionTitle}::${questionText} {${alternates}${buildFeedback(question)}}`
    }
  }
}

export function convertQuizToGift(quiz: TeacherQuiz): string {
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('El cuestionario no tiene preguntas para exportar.')
  }

  const categoryLine = `$CATEGORY: ${buildCategoryPath(quiz)}`
  const questionBlocks = quiz.questions.map((question, index) => buildQuestionBlock(question, index))

  return [categoryLine, '', questionBlocks.join('\n\n'), ''].join('\n')
}

export function buildMoodleFileName(quiz: TeacherQuiz): string {
  const subjectSlug = toSlug(quiz.subjectName || quiz.title)
  const topicSlugs = extractTopicNames(quiz).map(toSlug).filter(Boolean)
  const topicPart = topicSlugs.length > 0 ? topicSlugs.join('-') : 'general'

  return `${subjectSlug}_${topicPart}.txt`
}

export function downloadGiftFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportQuizToMoodleGift(quiz: TeacherQuiz): string {
  const giftContent = convertQuizToGift(quiz)
  const fileName = buildMoodleFileName(quiz)
  downloadGiftFile(giftContent, fileName)
  return fileName
}


