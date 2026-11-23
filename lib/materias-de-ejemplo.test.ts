import { describe, expect, it } from 'vitest'
import { aciertaEjemplo, ALUMNOS_DE_EJEMPLO, AREAS_DE_EJEMPLO, MATERIAS_DE_EJEMPLO, preguntasDeEjemplo, respuestaDeEjemplo, unidadesDeEjemplo } from './materias-de-ejemplo'
import { esAreaId } from './areas'
import { problemaDeTipo } from './validar-tipo-de-pregunta'

describe('las materias de ejemplo (V2)', () => {
  it.each(AREAS_DE_EJEMPLO)('%s: área válida, 2 unidades, 8 preguntas, cada tema con dos', (area) => {
    const m = MATERIAS_DE_EJEMPLO[area]
    expect(esAreaId(m.area)).toBe(true)
    expect(m.nombre).toMatch(/\(ejemplo\)$/)
    const temas = m.unidades.flatMap((u) => u.temas)
    expect(m.preguntas).toHaveLength(8)
    for (const t of temas) expect(m.preguntas.filter((p) => p.tema === t)).toHaveLength(2)
    for (const p of preguntasDeEjemplo(m)) {
      expect(problemaDeTipo(p as never)).toBeNull()
      if (p.type === 'multiple_choice') expect(p.options).toHaveLength(4)
    }
    expect(unidadesDeEjemplo(m).flatMap((u) => u.topics.map((t) => t.id))).toEqual(['ej-u1-t1', 'ej-u1-t2', 'ej-u2-t1', 'ej-u2-t2'])
  })

  it('los resultados son siempre los mismos y variados: hay quien domina y quien tiene que reforzar', () => {
    for (const area of AREAS_DE_EJEMPLO) {
      const notas = ALUMNOS_DE_EJEMPLO.map((_, a) => MATERIAS_DE_EJEMPLO[area].preguntas.filter((_, q) => aciertaEjemplo(a, q, area)).length)
      expect(notas).toEqual(ALUMNOS_DE_EJEMPLO.map((_, a) => MATERIAS_DE_EJEMPLO[area].preguntas.filter((_, q) => aciertaEjemplo(a, q, area)).length))
      expect(Math.max(...notas)).toBeGreaterThanOrEqual(6)
      expect(Math.min(...notas)).toBeLessThanOrEqual(4)
    }
  })

  it('una respuesta incorrecta es distinta de la correcta', () => {
    for (const p of MATERIAS_DE_EJEMPLO.economia.preguntas) {
      expect(respuestaDeEjemplo(p, true)).toEqual(p.correctAnswer)
      expect(respuestaDeEjemplo(p, false)).not.toEqual(p.correctAnswer)
    }
  })
})
