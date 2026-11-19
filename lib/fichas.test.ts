import { describe, expect, it } from 'vitest'
import {
  avisoDeExamen,
  diasHastaExamen,
  esMenor,
  fechaComoTexto,
  fichaDesdeContexto,
  fichaDesdeFila,
  fichaSchema,
  normalizarFicha,
  FICHA_VACIA,
} from './fichas'

const HOY = new Date(2026, 10, 19, 15, 0) // 19/11/2026, hora local

describe('avisoDeExamen — "Rinde en 12 días" sólo cuando faltan 21 o menos', () => {
  it('a 12 días', () => {
    expect(avisoDeExamen('2026-12-01', HOY)).toBe('Rinde en 12 días')
  })
  it('el borde: 21 sí, 22 no', () => {
    expect(avisoDeExamen('2026-12-10', HOY)).toBe('Rinde en 21 días')
    expect(avisoDeExamen('2026-12-11', HOY)).toBeNull()
  })
  it('hoy y mañana se dicen con palabras', () => {
    expect(avisoDeExamen('2026-11-19', HOY)).toBe('Rinde hoy')
    expect(avisoDeExamen('2026-11-20', HOY)).toBe('Rinde mañana')
  })
  it('una fecha que ya pasó no es una urgencia', () => {
    expect(avisoDeExamen('2026-11-18', HOY)).toBeNull()
  })
  it('sin fecha, nada', () => {
    expect(avisoDeExamen(null, HOY)).toBeNull()
  })
  it('cuenta días calendario, no horas: a las 23:59 sigue siendo el mismo día', () => {
    expect(diasHastaExamen('2026-11-20', new Date(2026, 10, 19, 23, 59))).toBe(1)
  })
})

describe('la migración del contexto (J2)', () => {
  it('lo que el docente había escrito en "Qué prepara" aparece en Observaciones', () => {
    expect(fichaDesdeContexto('  Análisis I · rinde el 12/12 ')).toEqual({
      ...FICHA_VACIA,
      observaciones: 'Análisis I · rinde el 12/12',
    })
  })
  it('sin contexto, ficha vacía', () => {
    expect(fichaDesdeContexto(null)).toEqual(FICHA_VACIA)
  })
})

describe('normalizarFicha', () => {
  const base = fichaSchema.parse({ nombre: 'Sofía' })

  it('todo es opcional salvo el nombre', () => {
    expect(fichaSchema.safeParse({ nombre: '' }).success).toBe(false)
    expect(fichaSchema.safeParse({ nombre: 'Sofía' }).success).toBe(true)
  })

  it('el responsable de un mayor no se guarda', () => {
    expect(normalizarFicha({ ...base, edad: 19, responsable: 'Mamá' }).responsable).toBe('')
    expect(normalizarFicha({ ...base, edad: 15, responsable: 'Mamá' }).responsable).toBe('Mamá')
  })

  it('sin materia no hay temas que le cuesten; con materia, sin repetidos', () => {
    expect(normalizarFicha({ ...base, temasDificiles: ['t1'] }).temasDificiles).toEqual([])
    expect(normalizarFicha({ ...base, materiaId: 3, temasDificiles: ['t1', 't1', 't2'] }).temasDificiles).toEqual(['t1', 't2'])
  })

  it('esMenor: sin edad no se sabe', () => {
    expect(esMenor(null)).toBe(false)
    expect(esMenor(17)).toBe(true)
    expect(esMenor(18)).toBe(false)
  })
})

describe('fichaDesdeFila', () => {
  it('lee cada columna, y la fecha sin correrse por la zona horaria', () => {
    const ficha = fichaDesdeFila({
      edad: 16,
      anio_cursa: '3er año',
      institucion: 'Colegio X',
      orientacion: 'Técnica',
      materia_id: 4,
      fecha_examen: new Date('2026-12-12T00:00:00Z'),
      como_evalua: '4 ejercicios',
      temas_dificiles: ['a', 'b'],
      observaciones: 'Obs',
      contacto: '387',
      responsable: 'Mamá',
    })
    expect(ficha).toEqual({
      edad: 16,
      anioCursa: '3er año',
      institucion: 'Colegio X',
      orientacion: 'Técnica',
      materiaId: 4,
      fechaExamen: '2026-12-12',
      comoEvalua: '4 ejercicios',
      temasDificiles: ['a', 'b'],
      observaciones: 'Obs',
      contacto: '387',
      responsable: 'Mamá',
    })
  })

  it('fechaComoTexto acepta texto y Date, y descarta basura', () => {
    expect(fechaComoTexto('2026-12-12')).toBe('2026-12-12')
    expect(fechaComoTexto(null)).toBeNull()
    expect(fechaComoTexto('mañana')).toBeNull()
  })
})
