import { describe, expect, it } from 'vitest'
import { UNIDADES } from './curriculum-superior-sistemas'
import {
  distributeQuestionCounts,
  mergeQuestionTypeMixes,
  parseQuestionTypeMix,
  productionShare,
} from '../../lib/question-mix'

/**
 * Lo que se protege acá no es el texto del programa sino la decisión pedagógica
 * que las proporciones codifican.
 *
 * Diagnóstico del 2026-08-10 en producción, 31 alumnos de la carrera:
 *   true_false       79,4% de acierto en Probabilidad, 62-69% en el resto,
 *                    sobre un piso de 50% por azar.
 *   multiple_choice  35,2% global, sobre un piso de 25% (4 opciones).
 *   numeric          8,7% / 16,7% / 23,9% según la unidad, sin piso.
 *
 * Reconocen y no producen; y la rúbrica de la cátedra —formular, modelar y
 * resolver, interpretar y comunicar, evaluar y validar— no evalúa reconocer
 * entre opciones. Si alguien devuelve la mayoría del cuestionario a los tipos
 * con opciones, tiene que fallar un test, no descubrirse en el próximo parcial.
 */
const PISO_PRODUCCION = 0.7

describe('programa de Matemática · Tecnicatura Superior en Análisis de Sistemas', () => {
  it('carga las 7 unidades del programa', () => {
    expect(UNIDADES).toHaveLength(7)
  })

  it.each(UNIDADES.map((u) => [u.eje, u] as const))(
    '%s declara una mezcla válida y sesgada a producir la respuesta',
    (_eje, unidad) => {
      // Válida contra el mismo parser que corre sobre el JSONB: si el seeder
      // escribe algo que parseQuestionTypeMix descarta, la columna queda cargada
      // y sin efecto, que es el peor de los dos fracasos posibles.
      expect(parseQuestionTypeMix(unidad.tiposPregunta)).toEqual(unidad.tiposPregunta)
      expect(productionShare(unidad.tiposPregunta)).toBeGreaterThanOrEqual(PISO_PRODUCCION)
    }
  )

  it('no lleva a cero los tipos de reconocimiento', () => {
    // El objetivo es reducirlos, no eliminarlos: la opción múltiple con
    // distractores diagnósticos sigue detectando confusiones puntuales, y V/F
    // sirve para validar una afirmación. Un cero acá sería otra decisión.
    for (const unidad of UNIDADES) {
      expect(unidad.tiposPregunta.multiple_choice ?? 0).toBeGreaterThan(0)
      expect(unidad.tiposPregunta.true_false ?? 0).toBeGreaterThan(0)
    }
  })

  it('pondera lo simbólico en Lógica y lo numérico en Derivadas', () => {
    // La mezcla no puede ser una constante del programa: una pregunta numérica
    // sobre tablas de verdad es forzada, y una de respuesta corta sobre el
    // cálculo de una derivada desperdicia la corrección exacta.
    const logica = UNIDADES.find((u) => u.eje.startsWith('Unidad 1'))!
    const derivadas = UNIDADES.find((u) => u.eje.startsWith('Unidad 7'))!

    expect(logica.tiposPregunta.short_answer!).toBeGreaterThan(logica.tiposPregunta.numeric!)
    expect(derivadas.tiposPregunta.numeric!).toBeGreaterThan(derivadas.tiposPregunta.short_answer!)
  })

  it('mantiene el sesgo en un cuestionario que cruza todas las unidades', () => {
    // El caso real de un repaso integrador: la suma de las 7 mezclas tiene que
    // seguir dando mayoría de producción, no promediarse hacia el medio.
    const mezcla = mergeQuestionTypeMixes(UNIDADES.map((u) => u.tiposPregunta))!
    const quotas = distributeQuestionCounts(mezcla, 20)
    const produccion = quotas
      .filter((q) => q.type === 'numeric' || q.type === 'short_answer')
      .reduce((sum, q) => sum + q.count, 0)

    expect(quotas.reduce((sum, q) => sum + q.count, 0)).toBe(20)
    expect(produccion).toBeGreaterThanOrEqual(14)
  })
})
