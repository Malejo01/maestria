import { describe, expect, it } from 'vitest'
import { descripcionDelEstado, tareasParaImprimir, temasParaImprimir } from './informe-para-imprimir'
import { ESTADO_INICIAL } from './planilla-grupo'

describe('O9 · el informe del grupo para imprimir', () => {
  it('el orden y el filtro de la planilla, en palabras (sin nada, nada)', () => {
    expect(descripcionDelEstado(ESTADO_INICIAL)).toBeNull()
    expect(descripcionDelEstado({ orden: 'promedio', dir: 'desc', filtro: 'debajo', busqueda: ' perez ' })).toBe(
      'Ordenada por promedio, de mayor a menor · Sólo los que están debajo de 6 · Buscando «perez»',
    )
  })

  it('los temas flojos, del más flojo al menos', () => {
    expect(
      temasParaImprimir([
        { topicName: 'Fracciones', accuracy: 0.55, studentCount: 10 },
        { topicName: 'Inecuaciones', accuracy: 0.312, studentCount: 7 },
      ]),
    ).toEqual([
      ['Inecuaciones', '31 %', '7'],
      ['Fracciones', '55 %', '10'],
    ])
  })

  it('las tareas del grupo con cuántos las hicieron; las individuales no van', () => {
    expect(
      tareasParaImprimir(
        [
          { title: 'Práctica 1', submittedCount: 18 },
          { title: 'Diagnóstico de Ana', submittedCount: 1, individual: true },
        ],
        25,
      ),
    ).toEqual([['Práctica 1', '18 de 25']])
  })
})
