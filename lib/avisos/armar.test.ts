import { describe, expect, it } from 'vitest'
import { agruparPorDia, horaRelativa, ordenarAvisos } from './armar'
import { crearAviso, type Aviso } from './tipos'

/** P2 · El armado común: orden, Hoy / Ayer / Antes (días de Argentina) y hora relativa. */
// 22/11/2026 15:00 en Buenos Aires (UTC-3).
const AHORA = new Date('2026-11-22T18:00:00.000Z')
const LEER = { vistoEl: null, puedeMarcar: true }
const aviso = (clave: string, fecha: string): Aviso =>
  crearAviso('tareaTerminada', { clave, titulo: clave, detalle: '', href: '/', fecha }, LEER)

describe('agruparPorDia', () => {
  it('Hoy / Ayer / Antes con el día de Argentina, sin grupos vacíos', () => {
    const avisos = ordenarAvisos([
      aviso('hoy-temprano', '2026-11-22T03:30:00.000Z'), // 0:30 del 22 en Argentina
      aviso('ayer-tarde', '2026-11-22T02:30:00.000Z'), // 23:30 del 21 en Argentina (en UTC ya es 22)
      aviso('hace-una-semana', '2026-11-15T15:00:00.000Z'),
      aviso('recien', '2026-11-22T17:59:00.000Z'),
    ])
    expect(agruparPorDia(avisos, AHORA).map((g) => [g.titulo, g.avisos.map((a) => a.clave)])).toEqual([
      ['Hoy', ['recien', 'hoy-temprano']],
      ['Ayer', ['ayer-tarde']],
      ['Antes', ['hace-una-semana']],
    ])
  })

  it('sin avisos de hoy, no hay grupo Hoy', () => {
    expect(agruparPorDia([aviso('a', '2026-11-20T12:00:00.000Z')], AHORA).map((g) => g.grupo)).toEqual(['antes'])
  })
})

describe('horaRelativa', () => {
  it.each([
    ['2026-11-22T17:59:40.000Z', 'hace un momento'],
    ['2026-11-22T17:55:00.000Z', 'hace 5 min'],
    ['2026-11-22T16:00:00.000Z', 'hace 2 h'],
    ['2026-11-22T02:30:00.000Z', 'ayer'],
    ['2026-11-19T15:00:00.000Z', 'hace 3 días'],
    ['2026-11-14T15:00:00.000Z', '14/11'],
  ])('%s → %s', (fecha, texto) => {
    expect(horaRelativa(fecha, AHORA)).toBe(texto)
  })

  it('a las 0:30, lo de las 23:00 es ayer y no "hace 1 h"', () => {
    const medianoche = new Date('2026-11-22T03:30:00.000Z') // 0:30 del 22
    expect(horaRelativa('2026-11-22T02:00:00.000Z', medianoche)).toBe('ayer')
  })
})

describe('el nombre del botón de la campanita', () => {
  it('con más de 9 dice "9+", como el globo (axe: label-in-name)', async () => {
    const { AVISOS } = await import('@/lib/textos')
    expect(AVISOS.boton(0)).toBe('Avisos')
    expect(AVISOS.boton(3)).toBe('Avisos: 3 sin leer')
    expect(AVISOS.boton(10)).toBe('Avisos: 9+ sin leer')
  })
})
