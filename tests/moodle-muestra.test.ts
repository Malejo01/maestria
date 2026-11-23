import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leerXml, validarMoodleXml, type NodoXml } from '@/lib/moodle-xml-validar'
import { convertQuizToMoodleXml, unirMoodleXml } from '@/lib/moodle-xml'
import { convertQuizToGift } from '@/lib/moodle-export'
import { validarGift } from '@/lib/gift-validar'
import type { Question, TeacherQuiz } from '@/lib/types'
import { PREGUNTAS_CON_CARACTERES_DIFICILES, PREGUNTAS_CON_LATEX } from '../scripts/qa/fixtures/moodle-dificiles'

/**
 * Ronda U · U5 — El archivo de muestra de Moodle XML, ampliado con una versión
 * con LaTeX y otra con los caracteres que rompieron el GIFT del 20/11. El
 * validador de F1 lo cubre, y el texto tiene que llegar a Moodle tal cual.
 */
const ARCHIVO = join(process.cwd(), 'docs', 'moodle', 'muestra-ronda-t.xml')
const xml = readFileSync(ARCHIVO, 'utf8')

const quiz = (tema: string, preguntas: Question[]): TeacherQuiz =>
  ({
    id: 0,
    userId: 'muestra',
    teacherProgramId: 0,
    title: `Muestra · ${tema}`,
    subjectName: 'Muestra MaestrIA',
    mode: 'mixto',
    status: 'saved',
    selectedTopics: [{ id: 'muestra', name: tema }],
    questionCount: preguntas.length,
    questions: preguntas,
    createdAt: '2026-11-23T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
  }) as TeacherQuiz

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
/** Lo que ve el alumno en Moodle: el HTML sin etiquetas y con las entidades resueltas. */
const comoLoVe = (html: string) =>
  html
    .replace(/<\/p><p>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTIDADES[e])
    .trim()

function preguntasDe(raiz: NodoXml | null): NodoXml[] {
  const quizNodo = raiz?.nombre === 'quiz' ? raiz : raiz?.hijos.find((h) => h.nombre === 'quiz')
  return quizNodo?.hijos.filter((h) => h.nombre === 'question') ?? []
}
const texto = (q: NodoXml, etiqueta: string) => q.hijos.find((h) => h.nombre === etiqueta)?.hijos.find((h) => h.nombre === 'text')?.texto ?? ''

describe('docs/moodle/muestra-ronda-t.xml (U5)', () => {
  it('pasa el validador: 33 preguntas en 3 categorías', () => {
    expect(validarMoodleXml(xml)).toEqual([])
    const tipos = [...xml.matchAll(/<question type="(\w+)">/g)].map((m) => m[1])
    expect(tipos.filter((t) => t === 'category')).toHaveLength(3)
    expect(tipos.filter((t) => t !== 'category')).toHaveLength(33)
    expect(xml).toContain('<text>$course$/Muestra MaestrIA/Con LaTeX</text>')
    expect(xml).toContain('<text>$course$/Muestra MaestrIA/Caracteres dificiles</text>')
  })

  it('los caracteres difíciles llegan al alumno tal cual', () => {
    const { raiz, problemas } = leerXml(xml)
    expect(problemas).toEqual([])
    const enunciados = preguntasDe(raiz).filter((q) => q.atributos.type !== 'category').map((q) => comoLoVe(texto(q, 'questiontext')))
    for (const p of PREGUNTAS_CON_CARACTERES_DIFICILES) {
      if (p.type === 'calculated') continue // va con los valores sorteados
      expect(enunciados.some((e) => e.startsWith(p.question))).toBe(true)
    }
    // Las opciones de seleccionar, literales: "&amp;" se ve como "&amp;".
    expect(xml).toContain('<selectoption><text>&amp;amp;</text><group>1</group></selectoption>')
  })

  it('el LaTeX viaja como \\( … \\) para MathJax, con las llaves de conjunto escapadas', () => {
    const { raiz } = leerXml(xml)
    const conLatex = preguntasDe(raiz).filter((q) => texto(q, 'questiontext').includes('\\('))
    expect(conLatex.length).toBeGreaterThanOrEqual(8)
    const todo = conLatex.map((q) => texto(q, 'questiontext')).join('\n')
    expect(todo).toContain('\\frac{3}{4}')
    expect(todo).toContain('\\sqrt{49}')
    expect(todo).toContain('\\{x \\in \\mathbb{Z} : x^2 &lt; 5\\}')
    // Ningún $ suelto en el texto de las preguntas: todo pasó a \( … \).
    expect(conLatex.every((q) => !/\$/.test(texto(q, 'questiontext').replace(/\$course\$/g, '')))).toBe(true)
  })

  it('unirMoodleXml deja un solo <quiz> y cada categoría antes de sus preguntas', () => {
    const unido = unirMoodleXml([quiz('Uno', PREGUNTAS_CON_LATEX.slice(0, 2)), quiz('Dos', PREGUNTAS_CON_LATEX.slice(2, 3))])
    expect(unido.match(/<quiz>/g)).toHaveLength(1)
    expect(unido.match(/<\?xml/g)).toHaveLength(1)
    expect(validarMoodleXml(unido)).toEqual([])
    expect(unido.indexOf('Muestra MaestrIA/Dos')).toBeGreaterThan(unido.lastIndexOf('<question type="truefalse">'))
  })
})

describe('las mismas preguntas difíciles, sueltas', () => {
  it.each([
    ['con LaTeX', PREGUNTAS_CON_LATEX],
    ['con caracteres difíciles', PREGUNTAS_CON_CARACTERES_DIFICILES],
  ])('en Moodle XML pasan el validador (%s)', (_, preguntas) => {
    expect(validarMoodleXml(convertQuizToMoodleXml(quiz('Prueba', preguntas)))).toEqual([])
  })

  it.each([
    ['con LaTeX', PREGUNTAS_CON_LATEX],
    ['con caracteres difíciles', PREGUNTAS_CON_CARACTERES_DIFICILES],
  ])('en GIFT pasan el validador que lee como Moodle (%s)', (_, preguntas) => {
    expect(validarGift(convertQuizToGift(quiz('Prueba', preguntas)))).toEqual([])
  })
})
