import { describe, expect, it } from 'vitest'
import { armarInforme, limpiarProximosPasos, linkVigente, nombreCorto, tokenConForma } from './informe-familia'

const ahora = new Date('2026-11-23T12:00:00Z')

describe('el informe para la familia (V4)', () => {
  it('arma lo que practicó, lo que domina, lo que tiene que reforzar y los próximos pasos', () => {
    const informe = armarInforme(
      {
        nombre: 'Camila  Ríos',
        materias: ['Matemática I'],
        temas: [
          { tema: 'Fracciones', correctas: 6, calificadas: 6, estado: 'dominado' },
          { tema: 'Ecuaciones', correctas: 1, calificadas: 5, estado: 'flojo' },
          { tema: 'Potencias', correctas: 2, calificadas: 2, estado: 'sin_datos' },
          { tema: 'Sistemas', correctas: 0, calificadas: 0, estado: 'sin_datos' },
        ],
        intentos: [
          { completadoEl: '2026-11-20T10:00:00Z', correctas: 6, calificadas: 8 },
          { completadoEl: '2026-11-22T10:00:00Z', correctas: 7, calificadas: 8 },
          { completadoEl: '2026-09-01T10:00:00Z', correctas: 1, calificadas: 8 },
        ],
      },
      '  Repasar ecuaciones antes del parcial.\r\n\r\n\r\n\r\nPracticar 10 minutos por día.  ',
      ahora,
    )
    expect(informe).toEqual({
      nombre: 'Camila R.',
      materias: ['Matemática I'],
      cuestionarios: 3,
      ultimaVez: '2026-11-22T10:00:00Z',
      aciertosDelMes: 81,
      dominados: ['Fracciones'],
      aReforzar: ['Ecuaciones'],
      enCamino: ['Potencias'],
      proximosPasos: 'Repasar ecuaciones antes del parcial.\n\nPracticar 10 minutos por día.',
    })
  })

  it('sin práctica en el mes, sin porcentaje', () => {
    expect(armarInforme({ nombre: 'Tomás', materias: [], temas: [], intentos: [] }, '', ahora)).toMatchObject({
      nombre: 'Tomás',
      cuestionarios: 0,
      ultimaVez: null,
      aciertosDelMes: null,
    })
  })

  it('el nombre corto no deja el apellido completo', () => {
    expect(nombreCorto('María José López Ruiz')).toBe('María R.')
    expect(nombreCorto('')).toBe('')
  })

  it('los próximos pasos tienen tope', () => {
    expect(limpiarProximosPasos('a'.repeat(2000))).toHaveLength(800)
    expect(limpiarProximosPasos(null)).toBe('')
  })

  it('el link: vigente hasta que vence o se revoca', () => {
    expect(linkVigente({ venceEl: '2026-12-01T00:00:00Z', revocadoEl: null }, ahora)).toBe(true)
    expect(linkVigente({ venceEl: '2026-11-01T00:00:00Z', revocadoEl: null }, ahora)).toBe(false)
    expect(linkVigente({ venceEl: '2026-12-01T00:00:00Z', revocadoEl: '2026-11-22T00:00:00Z' }, ahora)).toBe(false)
  })

  it('sólo se buscan tokens con la forma de los generados', () => {
    expect(tokenConForma('a'.repeat(43))).toBe(true)
    expect(tokenConForma('a'.repeat(42))).toBe(false)
    expect(tokenConForma("x' OR 1=1 --")).toBe(false)
  })
})
