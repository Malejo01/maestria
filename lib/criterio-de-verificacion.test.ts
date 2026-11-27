import { describe, expect, it } from 'vitest'
import { campanaDe, contarCriterio, estaActivado, resumenDeMeta, type DocenteParaElCriterio } from './criterio-de-verificacion'

const REGISTRO = '2026-11-20T12:00:00Z'
const dia = (n: number) => new Date(new Date(REGISTRO).getTime() + n * 86_400_000).toISOString()
const docente = (parcial: Partial<DocenteParaElCriterio> = {}): DocenteParaElCriterio => ({
  origen: null,
  origenRef: null,
  registro: REGISTRO,
  tieneMateria: true,
  primerasPracticas: [],
  alumnos: 0,
  pagando: false,
  ...parcial,
})

describe('estaActivado (AA2)', () => {
  it('materia + 2 alumnos que practicaron en los primeros 7 días: activado', () => {
    expect(estaActivado(docente({ primerasPracticas: [dia(1), dia(6.9)] }))).toBe(true)
  })

  it('el borde: el día 7 exacto cuenta; después, no', () => {
    expect(estaActivado(docente({ primerasPracticas: [dia(0), dia(7)] }))).toBe(true)
    expect(estaActivado(docente({ primerasPracticas: [dia(0), dia(7.01)] }))).toBe(false)
  })

  it('con un solo alumno no alcanza', () => {
    expect(estaActivado(docente({ primerasPracticas: [dia(1)] }))).toBe(false)
  })

  it('sin materia propia no está activado, aunque practiquen', () => {
    expect(estaActivado(docente({ tieneMateria: false, primerasPracticas: [dia(1), dia(2)] }))).toBe(false)
  })

  it('una práctica de antes del registro o una fecha rota no cuentan', () => {
    expect(estaActivado(docente({ primerasPracticas: [dia(-1), dia(2)] }))).toBe(false)
    expect(estaActivado(docente({ primerasPracticas: ['basura', dia(2)] }))).toBe(false)
    expect(estaActivado(docente({ registro: null, primerasPracticas: [dia(1), dia(2)] }))).toBe(false)
  })
})

describe('contarCriterio', () => {
  it('cuenta docentes, con alumno, activados, con 3.er alumno y pagando', () => {
    const c = contarCriterio([
      docente({ primerasPracticas: [dia(1), dia(2)], alumnos: 3, pagando: true }),
      docente({ primerasPracticas: [dia(1)], alumnos: 1 }),
      docente({ tieneMateria: false }),
    ])
    expect(c).toEqual({ docentes: 3, conAlumno: 2, activados: 1, conTercerAlumno: 1, pagando: 1 })
  })
})

describe('resumenDeMeta', () => {
  it('suma los de origen=meta y los separa por anuncio; los demás canales no entran', () => {
    const { total, porCampana } = resumenDeMeta([
      docente({ origen: 'meta', origenRef: 'AD-REEL', alumnos: 1 }),
      docente({ origen: 'meta', origenRef: 'AD-REEL', pagando: true }),
      docente({ origen: 'meta', origenRef: 'AD-CARRUSEL' }),
      docente({ origen: 'meta' }),
      docente({ origen: 'ig', origenRef: 'SILVINA-AB12', alumnos: 4 }),
    ])
    expect(total).toMatchObject({ docentes: 4, conAlumno: 1, pagando: 1 })
    expect(porCampana.map((f) => [f.campana, f.docentes])).toEqual([
      ['AD-CARRUSEL', 1],
      ['AD-REEL', 2],
      [null, 1],
    ])
  })

  it('un referido nunca se lee como anuncio', () => {
    expect(campanaDe({ origenRef: 'SILVINA-AB12' })).toBeNull()
    expect(campanaDe({ origenRef: 'ad-reel' })).toBe('AD-REEL')
  })
})
