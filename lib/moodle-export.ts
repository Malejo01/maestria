import type { Question, TeacherQuiz } from '@/lib/types'
import { sanitizeSubjectSegment as sanitizePathSegment, slugifySubject as toSlug } from '@/lib/subject-slug'
import { esFactorizacion, factorizar } from '@/lib/factorizacion'

const MAX_CATEGORY_TOPICS = 5

function normalizeMathJaxDelimiters(text: string): string {
  let normalized = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr) => `\\[${expr}\\]`)

  normalized = normalized.replace(/(^|[^\\])\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_match, prefix, expr) => {
    return `${prefix}\\(${expr}\\)`
  })

  return normalized
}

function normalizeLogicalNotation(text: string): string {
  return text
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\wedge/g, '∧')
    .replace(/\\vee/g, '∨')
    .replace(/\\neg\s*/g, '¬')
    // Recover already-corrupted tokens like "egp" or "eg(q∨r)".
    .replace(/(^|[\s(])eg(?=[a-zA-Z(])/gi, '$1¬')
}

function escapeGiftText(text: string): string {
  return normalizeMathJaxDelimiters(normalizeLogicalNotation(text))
    .replace(/\r\n/g, '\n')
    .replace(/(?<!\\)([~=#{}:])/g, '\\$1')
    .trim()
}

function extractTopicNames(quiz: TeacherQuiz): string[] {
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

function buildCategoryPath(quiz: TeacherQuiz): string {
  const subject = sanitizePathSegment(quiz.subjectName) || 'Materia'
  const topicNames = extractTopicNames(quiz)

  if (topicNames.length === 0) {
    return `$course$/${subject}`
  }

  return `$course$/${subject}/${topicNames.join('-')}`
}

function buildFeedback(question: Question): string {
  return question.explanation.trim().length > 0
    ? `\n#### ${escapeGiftText(question.explanation)}`
    : ''
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

  return `::${questionTitle}::${questionText} {\n${options.join('\n')}${buildFeedback(question)}\n}`
}

function buildQuestionBlock(question: Question, index: number): string {
  const questionTitle = `Q${index + 1}`
  const questionText = escapeGiftText(question.question)

  switch (question.type) {
    case 'multiple_choice':
      return buildMultipleChoiceBlock(questionTitle, questionText, question, index)
    case 'true_false':
      return `::${questionTitle}::${questionText} {${question.correctAnswer ? 'TRUE' : 'FALSE'}}${buildFeedback(question)}`
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
        return `::${questionTitle}::${questionText} {${formas.map((f) => `=${escapeGiftText(f)}`).join('')}}${buildFeedback(question)}`
      }
      const valor = Number(question.correctAnswer)
      const periodica = Boolean(question.fraccion) && !question.tolerance && Math.abs(valor * 1e4 - Math.round(valor * 1e4)) > 1e-6
      const numero = periodica ? Number(valor.toFixed(4)) : question.correctAnswer
      const margen = question.tolerance || (periodica ? 0.0001 : 0)
      const tolerance = margen ? `:${margen}` : ''
      return `::${questionTitle}::${questionText} {#${numero}${tolerance}}${buildFeedback(question)}`
    }
    case 'short_answer': {
      if (question.acceptedAnswers.length === 0) {
        throw new Error(`La pregunta ${index + 1} no tiene respuestas aceptadas validas.`)
      }
      const alternates = question.acceptedAnswers.map((answer) => `=${escapeGiftText(answer)}`).join('')
      return `::${questionTitle}::${questionText} {${alternates}}${buildFeedback(question)}`
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


