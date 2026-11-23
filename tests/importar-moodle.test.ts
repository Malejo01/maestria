import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aNotacionDeLaApp, htmlATexto, importarDeMoodle, importarGift, importarMoodleXml } from '@/lib/importar-moodle'
import { convertQuizToGift } from '@/lib/moodle-export'
import { convertQuizToMoodleXml } from '@/lib/moodle-xml'
import { problemaDeTipoMoodle } from '@/lib/tipos-moodle'
import type { Question, TeacherQuiz } from '@/lib/types'
import { PREGUNTAS_CON_CARACTERES_DIFICILES, PREGUNTAS_CON_LATEX } from '../scripts/qa/fixtures/moodle-dificiles'

/**
 * Ronda W · W3 — Importar desde Moodle, con los archivos de muestra: el de
 * M5 (GIFT, lo que rompió el 20/11), el de U5 (Moodle XML, 33 preguntas con
 * LaTeX y caracteres difíciles) y lo que exporta MaestrIA, de ida y vuelta.
 */
const leer = (...ruta: string[]) => readFileSync(join(process.cwd(), ...ruta), 'utf8')
const quiz = (preguntas: Question[]) => ({ id: 0, title: 'x', subjectName: 'Muestra', selectedTopics: [{ id: 't', name: 'Tema' }], questions: preguntas }) as unknown as TeacherQuiz
const tipos = (ps: { type: string }[]) => ps.map((p) => p.type).sort()

describe('el archivo de muestra de Moodle XML (U5): 33 preguntas', () => {
  const r = importarMoodleXml(leer('docs', 'moodle', 'muestra-ronda-t.xml'))
  it('se importan todas, con su tipo', () => {
    expect(r.salteadas).toEqual([])
    expect(r.preguntas).toHaveLength(33)
    const cuenta = (t: string) => r.preguntas.filter((p) => p.type === t).length
    for (const t of ['multiple_choice', 'true_false', 'numeric', 'short_answer', 'multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'calculated']) {
      expect(cuenta(t), t).toBe(3)
    }
  })
  it('cada una queda bien armada para la app', () => {
    for (const p of r.preguntas) expect(problemaDeTipoMoodle(p as unknown as Record<string, unknown>), p.question).toBeNull()
  })
  it('el LaTeX vuelve a $…$ y los caracteres difíciles llegan tal cual', () => {
    const textos = r.preguntas.map((p) => p.question).join('\n')
    expect(textos).toContain('$\\frac{3}{4} + \\frac{1}{8}$')
    expect(textos).toContain('En C, ¿qué devuelve "a && b" si a = 1 y b = 0?')
    const huecos = r.preguntas.find((p) => p.type === 'gapselect' && 'choices' in p && p.choices.includes('&amp;'))
    expect(huecos).toBeTruthy()
  })
  it('la calculada trae su fórmula, sus comodines y valores sorteados', () => {
    const c = r.preguntas.find((p) => p.type === 'calculated') as unknown as { formula: string; variables: unknown[]; valores: Record<string, number>; correctAnswer: number }
    expect(c.formula).toContain('{p}')
    expect(c.variables.length).toBe(2)
    expect(Number.isFinite(c.correctAnswer)).toBe(true)
  })
})

describe('de ida y vuelta: lo que exporta MaestrIA se vuelve a importar', () => {
  it.each([
    ['con LaTeX', PREGUNTAS_CON_LATEX],
    ['con caracteres difíciles', PREGUNTAS_CON_CARACTERES_DIFICILES],
  ])('Moodle XML (%s): los 11 tipos, con las mismas respuestas', (_, preguntas) => {
    const r = importarMoodleXml(convertQuizToMoodleXml(quiz(preguntas)))
    expect(r.salteadas).toEqual([])
    expect(tipos(r.preguntas)).toEqual(tipos(preguntas))
    const mc = r.preguntas.find((p) => p.type === 'multiple_choice')!
    const original = preguntas.find((p) => p.type === 'multiple_choice')!
    expect(mc).toMatchObject({ question: original.question, correctAnswer: (original as { correctAnswer: number }).correctAnswer })
  })

  it.each([
    ['con LaTeX', PREGUNTAS_CON_LATEX],
    ['con caracteres difíciles', PREGUNTAS_CON_CARACTERES_DIFICILES],
  ])('GIFT (%s): ninguna se pierde (los tipos que GIFT no tiene vuelven como los exporta)', (_, preguntas) => {
    const r = importarGift(convertQuizToGift(quiz(preguntas)))
    expect(r.salteadas).toEqual([])
    expect(r.preguntas).toHaveLength(preguntas.length)
    expect(r.preguntas.find((p) => p.type === 'true_false')).toBeTruthy()
    expect(r.preguntas.find((p) => p.type === 'missing_word')).toBeTruthy()
    expect(r.preguntas.find((p) => p.type === 'multiple_response')).toBeTruthy()
  })
})

describe('la muestra de M5 (GIFT, lo que rompió el 20/11)', () => {
  const r = importarGift(leer('docs', 'capturas', 'm5-moodle', 'muestra-m5.gift.txt'))
  it('se importan todas', () => {
    expect(r.salteadas).toEqual([])
    expect(r.preguntas.length).toBeGreaterThanOrEqual(6)
    expect(r.categoria).toBe('Varios temas')
  })
  it('las llaves de conjunto y la retroalimentación llegan bien', () => {
    const conjunto = r.preguntas.find((p) => p.question.includes('x^2'))!
    expect(conjunto.type).toBe('multiple_choice')
    expect((conjunto as { options: string[] }).options).toContain('$\\{-4, 4\\}$')
    expect(conjunto.explanation).toContain('Las dos raíces:')
    const vf = r.preguntas.find((p) => p.type === 'true_false')!
    expect(vf).toMatchObject({ correctAnswer: true })
    expect(r.preguntas.find((p) => p.type === 'numeric')).toMatchObject({ correctAnswer: 4 })
  })
})

describe('lo que no se puede traer se informa y se saltea, nunca rompe', () => {
  it('Moodle XML: ensayo, Cloze, descripción y un tipo desconocido', () => {
    const xml = `<?xml version="1.0"?><quiz>
      <question type="essay"><name><text>E1</text></name><questiontext format="html"><text>Explicá</text></questiontext></question>
      <question type="multianswer"><name><text>C1</text></name><questiontext format="html"><text>{1:SA:=x}</text></questiontext></question>
      <question type="description"><name><text>D1</text></name><questiontext format="html"><text>Hola</text></questiontext></question>
      <question type="randomsamatch"><name><text>R1</text></name></question>
      <question type="truefalse"><name><text>V1</text></name><questiontext format="html"><text>&lt;p&gt;El sol es una estrella.&lt;/p&gt;</text></questiontext>
        <answer fraction="100"><text>true</text></answer><answer fraction="0"><text>false</text></answer></question>
    </quiz>`
    const r = importarMoodleXml(xml)
    expect(r.preguntas).toHaveLength(1)
    expect(r.preguntas[0]).toMatchObject({ type: 'true_false', question: 'El sol es una estrella.', correctAnswer: true })
    expect(r.salteadas.map((s) => s.donde)).toEqual(['E1', 'C1', 'D1', 'R1'])
    expect(r.salteadas[3].motivo).toContain('randomsamatch')
  })
  it('GIFT: un ensayo, una descripción y una opción múltiple sin correcta', () => {
    const r = importarGift('::E1:: Explicá la fotosíntesis. {}\n\nSólo un texto.\n\n::M1:: ¿Cuál? {~a ~b}\n\n::OK:: ¿Dos más dos? {#4}')
    expect(r.preguntas).toHaveLength(1)
    expect(r.salteadas.map((s) => s.donde)).toEqual(['E1', 'Q2', 'M1'])
  })
  it('un archivo que no es Moodle no rompe', () => {
    expect(importarDeMoodle('<html><body>hola</body></html>').preguntas).toEqual([])
    expect(importarDeMoodle('').preguntas).toEqual([])
  })
})

describe('utilidades', () => {
  it('la notación y el HTML', () => {
    expect(aNotacionDeLaApp('Sea \\( x^2 \\) y \\[ y \\]')).toBe('Sea $x^2$ y $$y$$')
    expect(htmlATexto('<p>A &amp; B</p><p>C &lt; D</p>')).toBe('A & B\nC < D')
  })
})

describe('W5: el ensayo va y vuelve con su rúbrica', () => {
  const ensayo = {
    id: 'q1',
    type: 'essay',
    question: 'Explicá con tus palabras qué es la fotosíntesis y por qué importa.',
    rubrica: [{ criterio: 'Define el proceso' }, { criterio: 'Nombra lo que entra y lo que sale' }, { criterio: 'Da un ejemplo propio' }],
    explanation: 'Luz, agua y dióxido de carbono; sale glucosa y oxígeno.',
    topic: 't',
    topicName: 'Tema',
  } as unknown as Question
  it('GIFT', () => {
    const r = importarGift(convertQuizToGift(quiz([ensayo])))
    expect(r.salteadas).toEqual([])
    expect(r.preguntas[0]).toMatchObject({ type: 'essay', rubrica: (ensayo as { rubrica: unknown }).rubrica })
    expect(r.preguntas[0].explanation).not.toMatch(/criterios/i)
  })
  it('Moodle XML', () => {
    const r = importarMoodleXml(convertQuizToMoodleXml(quiz([ensayo])))
    expect(r.salteadas).toEqual([])
    expect(r.preguntas[0]).toMatchObject({ type: 'essay', question: ensayo.question, rubrica: (ensayo as { rubrica: unknown }).rubrica })
  })
  it('sin 3 criterios se saltea con el motivo', () => {
    const r = importarGift('::E1:: Explicá la fotosíntesis con detalle. {####Criterios: define; ejemplo}')
    expect(r.preguntas).toEqual([])
    expect(r.salteadas[0].motivo).toContain('3 criterios')
  })
})

describe('X3: el gráfico va y vuelve', () => {
  const conGrafico = {
    id: 'q1',
    type: 'numeric',
    question: 'Observá el gráfico: ¿cuál es la raíz positiva de f?',
    correctAnswer: 2,
    explanation: 'Corta al eje x en 2.',
    topic: 't',
    topicName: 'Funciones',
    grafico: { expresiones: ['x^2 - 4'], dominio: [-4, 4], puntos: [{ x: 0, y: -4, etiqueta: 'B' }] },
  } as unknown as Question
  it('Moodle XML: imagen SVG en base64 dentro del enunciado, válida para Moodle, y vuelve con su gráfico', () => {
    const xml = convertQuizToMoodleXml(quiz([conGrafico]))
    expect(xml).toContain('<img src="@@PLUGINFILE@@/grafico-1.svg"')
    expect(xml).toMatch(/<file name="grafico-1.svg" path="\/" encoding="base64">[A-Za-z0-9+/=]+<\/file><\/questiontext>/)
    const b64 = /encoding="base64">([^<]+)</.exec(xml)![1]
    expect(Buffer.from(b64, 'base64').toString('utf8')).toMatch(/^<svg xmlns=/)
    const r = importarMoodleXml(xml)
    expect(r.salteadas).toEqual([])
    expect(r.preguntas[0]).toMatchObject({ type: 'numeric', question: conGrafico.question, grafico: { expresiones: ['x^2 - 4'], dominio: [-4, 4] } })
  })
  it('GIFT: el gráfico va descripto en texto', () => {
    const gift = convertQuizToGift(quiz([conGrafico]))
    expect(gift).toContain('[Gráfico de y \\= x^2 - 4, con x entre -4 y 4')
  })
})
