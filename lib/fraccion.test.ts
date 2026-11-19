import { describe, expect, it } from 'vitest'
import {
  corregirNumerica,
  fraccionDeDecimal,
  fraccionEnLatex,
  leerRespuesta,
  normalizarFraccionGenerada,
  textoDelMotivo,
} from './fraccion'
import { isCorrectNumeric } from './answer-grading'
import { respuestaEscrita, respuestaNumerica } from './numeros'
import { convertQuizToGift } from './moodle-export'
import type { NumericQuestion } from './types'

const base: NumericQuestion = {
  id: 'q1',
  type: 'numeric',
  topic: 't',
  topicName: 'Fracciones',
  question: 'Calculá 1/2 + 1/4',
  explanation: '',
  correctAnswer: 0.75,
}
const tresCuartos: NumericQuestion = { ...base, fraccion: { numerador: 3, denominador: 4 } }
const irreducible: NumericQuestion = {
  ...base,
  question: 'Simplifique la fracción 42/56 hasta su expresión irreducible.',
  fraccion: { numerador: 3, denominador: 4 },
  exigeIrreducible: true,
}

/** Corrige como lo hace el motor: el número que leyó el campo y el texto tal cual. */
function corregir(pregunta: NumericQuestion, texto: string) {
  const lectura = leerRespuesta(texto, { admiteMixto: pregunta.admiteMixto })
  return lectura ? corregirNumerica(pregunta, lectura.valor, texto) : { correcta: false }
}

describe('K2 · corrección con fracción', () => {
  it('sin exigeIrreducible: 3/4, cualquier equivalente y el decimal exacto', () => {
    expect(corregir(tresCuartos, '3/4').correcta).toBe(true)
    expect(corregir(tresCuartos, '6/8').correcta).toBe(true)
    expect(corregir(tresCuartos, ' 6 / 8 ').correcta).toBe(true)
    expect(corregir(tresCuartos, '0,75').correcta).toBe(true)
    expect(corregir(tresCuartos, '0.75').correcta).toBe(true)
    expect(corregir(tresCuartos, '\\frac{3}{4}').correcta).toBe(true)
    expect(corregir(tresCuartos, '2/3').correcta).toBe(false)
  })

  it('con exigeIrreducible: sólo 3/4; 6/8 está mal porque no la simplificó', () => {
    expect(corregir(irreducible, '3/4')).toEqual({ correcta: true })
    expect(corregir(irreducible, '6/8')).toEqual({ correcta: false, motivo: 'sin_simplificar' })
    expect(corregir(irreducible, '0,75')).toEqual({ correcta: false, motivo: 'no_es_fraccion' })
    expect(corregir(irreducible, '5/8')).toEqual({ correcta: false })
    expect(textoDelMotivo('sin_simplificar', irreducible.fraccion!)).toContain('no la simplificaste del todo')
  })

  it('el signo negativo adelante', () => {
    const negativa = { ...irreducible, fraccion: { numerador: -3, denominador: 4 }, correctAnswer: -0.75 }
    expect(corregir(negativa, '-3/4').correcta).toBe(true)
    expect(corregir(negativa, '- 3/4').correcta).toBe(true)
    expect(corregir(negativa, '3/-4').correcta).toBe(true)
    expect(corregir(negativa, '3/4').correcta).toBe(false)
  })

  it('el número mixto sólo si el enunciado lo admite', () => {
    const tresMedios: NumericQuestion = { ...base, correctAnswer: 1.5, fraccion: { numerador: 3, denominador: 2 } }
    expect(leerRespuesta('1 1/2')).toBeNull()
    expect(corregir(tresMedios, '1 1/2').correcta).toBe(false)
    const conMixto = { ...tresMedios, admiteMixto: true, exigeIrreducible: true }
    expect(corregir(conMixto, '1 1/2').correcta).toBe(true)
    expect(corregir(conMixto, '3/2').correcta).toBe(true)
    expect(corregir(conMixto, '1 2/4')).toEqual({ correcta: false, motivo: 'sin_simplificar' })
    expect(corregir({ ...conMixto, fraccion: { numerador: -3, denominador: 2 }, correctAnswer: -1.5 }, '-1 1/2').correcta).toBe(true)
  })

  it('un decimal que sólo se acerca no es la fracción: 0,9167 no es 11/12', () => {
    const once: NumericQuestion = { ...base, correctAnswer: 11 / 12, fraccion: { numerador: 11, denominador: 12 } }
    expect(corregir(once, '11/12').correcta).toBe(true)
    expect(corregir(once, '0,9167').correcta).toBe(false)
  })

  it('si la fracción es un entero, el entero es su forma irreducible', () => {
    const dos: NumericQuestion = { ...irreducible, correctAnswer: 2, fraccion: { numerador: 8, denominador: 4 } }
    expect(corregir(dos, '2').correcta).toBe(true)
    expect(corregir(dos, '4/2').motivo).toBe('sin_simplificar')
  })
})

describe('K2 · compatibilidad: una pregunta vieja sin `fraccion`', () => {
  const vieja: NumericQuestion = { ...base, correctAnswer: 0.9166666666666666 }
  it('se corrige igual que antes, con la tolerancia por defecto', () => {
    // Antes de K2, `isCorrectNumeric` era `isNumericallyEquivalent(valor, correctAnswer, tolerance)`.
    expect(isCorrectNumeric(vieja, 0.92)).toBe(true)
    expect(isCorrectNumeric(vieja, 11 / 12, '11/12')).toBe(true)
    expect(isCorrectNumeric(vieja, 0.9)).toBe(false)
    expect(isCorrectNumeric({ ...base, correctAnswer: 12 }, 12, '12')).toBe(true)
    expect(isCorrectNumeric({ ...base, correctAnswer: 12 }, 12.004)).toBe(false)
    // Sin `exigeIrreducible` no hay motivo de forma: 6/8 vale por 0,75.
    expect(isCorrectNumeric(base, 0.75, '6/8')).toBe(true)
  })
  it('y se sigue mostrando como número', () => {
    expect(respuestaNumerica(vieja.correctAnswer, vieja.tolerance, vieja.fraccion)).toBe('0,9167')
  })
})

describe('K2 · cómo se muestra', () => {
  it('la correcta con KaTeX', () => {
    expect(respuestaNumerica(0.75, undefined, { numerador: 3, denominador: 4 })).toBe('$\\frac{3}{4}$')
    expect(fraccionEnLatex({ numerador: -3, denominador: 4 })).toBe('$-\\frac{3}{4}$')
    expect(fraccionEnLatex({ numerador: 2, denominador: 1 })).toBe('$2$')
  })
  it('lo que escribió el alumno, como lo escribió', () => {
    expect(respuestaEscrita(0.75, '6/8')).toBe('$\\frac{6}{8}$')
    expect(respuestaEscrita(1.5, '1  1/2')).toBe('1 1/2')
    expect(respuestaEscrita(0.75, '0.75')).toBe('0,75')
    expect(respuestaEscrita(0.75)).toBe('0,75')
  })
  it('Moodle: la fracción periódica va redondeada con margen', () => {
    const gift = convertQuizToGift({
      title: 'Prueba',
      subjectName: 'Matemática',
      selectedTopics: [],
      questions: [{ ...base, correctAnswer: 11 / 12, fraccion: { numerador: 11, denominador: 12 } }],
    } as never)
    expect(gift).toContain('{#0.9167:0.0001}')
  })
})

describe('K2 · normalización de lo generado', () => {
  it('la fracción manda sobre correctAnswer y se guarda simplificada', () => {
    const q = normalizarFraccionGenerada({ ...base, correctAnswer: 0.7, fraccion: { numerador: 6, denominador: -8 } })
    expect(q.fraccion).toEqual({ numerador: -3, denominador: 4 })
    expect(q.correctAnswer).toBe(-0.75)
  })
  it('si la consigna pide la irreducible y vino sólo el decimal, la recupera y la exige', () => {
    const q = normalizarFraccionGenerada({ ...irreducible, fraccion: undefined, exigeIrreducible: undefined })
    expect(q.fraccion).toEqual({ numerador: 3, denominador: 4 })
    expect(q.exigeIrreducible).toBe(true)
  })
  it('2/3 + 1/4 → 11/12 cuando el tema es de fracciones', () => {
    const q = normalizarFraccionGenerada({ ...base, question: 'Calculá 2/3 + 1/4', correctAnswer: 0.9166666666666666 })
    expect(q.fraccion).toEqual({ numerador: 11, denominador: 12 })
    expect(q.exigeIrreducible).toBe(false)
  })
  it('no inventa una fracción donde no la piden', () => {
    const q = normalizarFraccionGenerada({ ...base, topicName: 'Estadística', question: 'Calculá la media de 2, 3 y 5', correctAnswer: 10 / 3 })
    expect(q.fraccion).toBeUndefined()
    expect(fraccionDeDecimal(Math.PI)).toBeNull()
  })
})
