import type { Question, TeacherQuiz } from '@/lib/types'
import { fraccionesVariasCorrectas } from '@/lib/tipos-moodle'
import { slugifySubject as toSlug } from '@/lib/subject-slug'
import { esFactorizacion, factorizar } from '@/lib/factorizacion'
import { buildCategoryPath, exportQuizToMoodleGift, extractTopicNames, normalizeLogicalNotation, normalizeMathJaxDelimiters } from '@/lib/moodle-export'
import { validarMoodleXml } from '@/lib/moodle-xml-validar'

/**
 * Ronda T · F1 — Exportar a Moodle XML (el formato de importación completo de
 * Moodle: `Banco de preguntas > Importar > Formato Moodle XML`).
 *
 * GIFT (lib/moodle-export.ts) sigue igual. XML hace falta porque GIFT no tiene
 * ordenamiento, arrastrar y soltar, seleccionar la palabra faltante ni
 * calculadas (F4–F7), y porque en XML el texto va como HTML: no hay que
 * escapar `~=#{}:` ni pelear con las líneas en blanco.
 *
 * El texto de cada pregunta va en HTML dentro de CDATA. La matemática viaja
 * como `\( … \)` / `\[ … \]` para el filtro MathJax de Moodle, igual que en
 * GIFT. Todo lo que arma este módulo pasa por `validarMoodleXml`
 * (lib/moodle-xml-validar.ts) en los tests.
 */

/** Escapa para XML (atributos y texto fuera de CDATA). */
export function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** CDATA que no se rompe si el texto trae `]]>`. */
function cdata(texto: string): string {
  return `<![CDATA[${texto.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

/**
 * El texto de la pregunta, de una opción o de la retroalimentación, como HTML:
 * la notación lógica y los `$…$` normalizados (igual que GIFT), `<`, `>` y `&`
 * escapados (un "x < 3" no es una etiqueta) y los saltos de línea como `<br>`.
 */
export function textoHtml(texto: string): string {
  const normal = normalizeMathJaxDelimiters(normalizeLogicalNotation(texto)).replace(/\r\n/g, '\n').trim()
  return escaparXml(normal).replace(/\n/g, '<br>')
}

const bloqueHtml = (etiqueta: string, texto: string) =>
  `<${etiqueta} format="html"><text>${texto ? cdata(`<p>${textoHtml(texto)}</p>`) : ''}</text></${etiqueta}>`

/** El nombre en el banco: número y el comienzo del enunciado, sin LaTeX ni saltos. */
function nombreDe(question: Question, index: number): string {
  const plano = question.question
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const corto = plano.length > 60 ? `${plano.slice(0, 57).trimEnd()}…` : plano
  return `${index + 1}. ${corto}`
}

/** Lo común a toda pregunta: nombre, enunciado, retroalimentación general y puntaje. */
function cabecera(question: Question, index: number): string {
  return [
    `<name><text>${escaparXml(nombreDe(question, index))}</text></name>`,
    bloqueHtml('questiontext', question.question),
    bloqueHtml('generalfeedback', question.explanation ?? ''),
    '<defaultgrade>1</defaultgrade>',
    '<penalty>0.3333333</penalty>',
    '<hidden>0</hidden>',
    '<idnumber></idnumber>',
  ].join('\n    ')
}

const respuestaHtml = (fraccion: number | string, texto: string) =>
  `<answer fraction="${fraccion}" format="html"><text>${cdata(`<p>${textoHtml(texto)}</p>`)}</text><feedback format="html"><text></text></feedback></answer>`

const respuestaPlana = (fraccion: number | string, texto: string, extra = '') =>
  `<answer fraction="${fraccion}" format="moodle_auto_format"><text>${escaparXml(texto)}</text><feedback format="html"><text></text></feedback>${extra}</answer>`

function pregunta(tipo: string, cuerpo: string[]): string {
  return `  <question type="${tipo}">\n    ${cuerpo.join('\n    ')}\n  </question>`
}

function preguntaXml(question: Question, index: number): string {
  const comun = cabecera(question, index)
  switch (question.type) {
    case 'multiple_choice': {
      const correcta = Number.isInteger(question.correctAnswer) ? question.correctAnswer : -1
      if (correcta < 0 || correcta >= question.options.length) {
        throw new Error(`La pregunta ${index + 1} no tiene una respuesta correcta valida.`)
      }
      return pregunta('multichoice', [
        comun,
        '<single>true</single>',
        '<shuffleanswers>true</shuffleanswers>',
        '<answernumbering>abc</answernumbering>',
        '<showstandardinstruction>0</showstandardinstruction>',
        ...question.options.map((opcion, i) => respuestaHtml(i === correcta ? 100 : 0, opcion)),
      ])
    }
    case 'true_false':
      return pregunta('truefalse', [comun, respuestaPlana(question.correctAnswer ? 100 : 0, 'true'), respuestaPlana(question.correctAnswer ? 0 : 100, 'false')])
    case 'numeric': {
      // L3: una factorización no se corrige como número: respuesta corta con las formas comunes.
      if (esFactorizacion(question)) {
        const factores = factorizar(Number(question.correctAnswer))
        const potencias = (sep: string) => factores.map((p) => (p.exponente === 1 ? `${p.base}` : `${p.base}^${p.exponente}`)).join(sep)
        const sueltos = (sep: string) => factores.flatMap((p) => Array(p.exponente).fill(String(p.base))).join(sep)
        const formas = [...new Set([potencias('*'), potencias('·'), sueltos('*'), sueltos('x')])]
        return pregunta('shortanswer', [comun, '<usecase>0</usecase>', ...formas.map((f) => respuestaPlana(100, f))])
      }
      // K1/K2: punto decimal; una fracción periódica va con cuatro decimales y ese margen.
      const valor = Number(question.correctAnswer)
      const periodica = Boolean(question.fraccion) && !question.tolerance && Math.abs(valor * 1e4 - Math.round(valor * 1e4)) > 1e-6
      const numero = periodica ? Number(valor.toFixed(4)) : valor
      const margen = question.tolerance || (periodica ? 0.0001 : 0)
      return pregunta('numerical', [
        comun,
        respuestaPlana(100, String(numero), `<tolerance>${margen}</tolerance>`),
        '<unitgradingtype>0</unitgradingtype>',
        '<unitpenalty>0.1000000</unitpenalty>',
        '<showunits>3</showunits>',
        '<unitsleft>0</unitsleft>',
      ])
    }
    case 'multiple_response': {
      // F2: multichoice con single = false; las correctas suman 100.
      const fracciones = fraccionesVariasCorrectas(question.options.length, question.correctAnswers)
      return pregunta('multichoice', [
        comun,
        '<single>false</single>',
        '<shuffleanswers>true</shuffleanswers>',
        '<answernumbering>abc</answernumbering>',
        '<showstandardinstruction>1</showstandardinstruction>',
        ...question.options.map((opcion, i) => respuestaHtml(fracciones[i], opcion)),
      ])
    }
    case 'matching': {
      // F3: cada par es un subquestion (el texto en HTML, la respuesta en texto
      // plano: Moodle la muestra en una lista); un distractor es un subquestion
      // sin texto.
      const par = (izquierda: string, derecha: string) =>
        `<subquestion format="html"><text>${izquierda ? cdata(`<p>${textoHtml(izquierda)}</p>`) : ''}</text><answer><text>${escaparXml(derecha)}</text></answer></subquestion>`
      return pregunta('matching', [
        comun,
        '<shuffleanswers>true</shuffleanswers>',
        ...question.pairs.map((p) => par(p.left, p.right)),
        ...(question.distractors ?? []).map((d) => par('', d)),
      ])
    }
    case 'ordering':
      // F4: el tipo `ordering` de Moodle (estándar desde Moodle 4.4). Cada
      // elemento va en el orden correcto: la fracción es su lugar.
      return pregunta('ordering', [
        comun,
        '<layouttype>VERTICAL</layouttype>',
        '<selecttype>ALL</selecttype>',
        '<selectcount>0</selectcount>',
        '<gradingtype>ABSOLUTE_POSITION</gradingtype>',
        '<showgrading>SHOW</showgrading>',
        '<numberingstyle>none</numberingstyle>',
        ...question.items.map((item, i) => respuestaHtml(`${i + 1}.0000000`, item)),
      ])
    case 'short_answer': {
      if (question.acceptedAnswers.length === 0) {
        throw new Error(`La pregunta ${index + 1} no tiene respuestas aceptadas validas.`)
      }
      return pregunta('shortanswer', [comun, '<usecase>0</usecase>', ...question.acceptedAnswers.map((a) => respuestaPlana(100, a))])
    }
  }
}

/** El archivo Moodle XML del cuestionario: la categoría (igual que GIFT) y cada pregunta. */
export function convertQuizToMoodleXml(quiz: TeacherQuiz): string {
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('El cuestionario no tiene preguntas para exportar.')
  }
  const categoria = `  <question type="category">\n    <category><text>${escaparXml(buildCategoryPath(quiz))}</text></category>\n  </question>`
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>', categoria, ...quiz.questions.map(preguntaXml), '</quiz>', ''].join('\n')
}

export function buildMoodleXmlFileName(quiz: TeacherQuiz): string {
  const subjectSlug = toSlug(quiz.subjectName || quiz.title)
  const topicSlugs = extractTopicNames(quiz).map(toSlug).filter(Boolean)
  return `${subjectSlug}_${topicSlugs.length > 0 ? topicSlugs.join('-') : 'general'}.xml`
}

export type FormatoMoodle = 'xml' | 'gift'

function descargar(contenido: string, nombre: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * F1 · Baja el cuestionario para Moodle en el formato elegido. El XML se valida
 * antes de bajarlo: si Moodle no lo importaría, no se baja y se dice por qué.
 * Devuelve el nombre del archivo.
 */
export function exportarParaMoodle(quiz: TeacherQuiz, formato: FormatoMoodle): string {
  if (formato === 'gift') return exportQuizToMoodleGift(quiz)
  const xml = convertQuizToMoodleXml(quiz)
  const problemas = validarMoodleXml(xml)
  if (problemas.length > 0) throw new Error(`Moodle no lo importaría: ${problemas[0]}`)
  const nombre = buildMoodleXmlFileName(quiz)
  descargar(xml, nombre, 'application/xml')
  return nombre
}
