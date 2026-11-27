import { describe, expect, it } from 'vitest'
import { decidirIngresoPorCodigo } from './planes'
import { entraOtroParticular, normalizarModalidad, tipoDeLugar, usaCursos } from './modalidad'

describe('tipoDeLugar (AC1)', () => {
  it('particular: todos cuentan como particulares, también los del link', () => {
    expect(tipoDeLugar('particular', 'invitacion')).toBe('particular')
    expect(tipoDeLugar('particular', 'codigo')).toBe('particular')
    expect(usaCursos('particular')).toBe(false)
  })
  it('curso: la regla B1 (el que sumó el docente es particular; el del link, de curso)', () => {
    expect(tipoDeLugar('curso', 'invitacion')).toBe('particular')
    expect(tipoDeLugar('curso', 'codigo')).toBe('curso')
    expect(usaCursos('curso')).toBe(true)
  })
  it('sin dato (null): igual que curso, la regla de siempre', () => {
    expect(tipoDeLugar(null, 'invitacion')).toBe('particular')
    expect(tipoDeLugar(null, 'codigo')).toBe('curso')
    expect(usaCursos(null)).toBe(true)
  })
  it('normalizarModalidad acepta sólo las dos', () => {
    expect(normalizarModalidad(' Particular ')).toBe('particular')
    expect(normalizarModalidad('curso')).toBe('curso')
    expect(normalizarModalidad('aula')).toBeNull()
    expect(normalizarModalidad(null)).toBeNull()
  })
  it('el particular que ya tiene más de 2 los conserva: sólo se frena el siguiente', () => {
    expect(entraOtroParticular(1, 2)).toBe(true)
    expect(entraOtroParticular(2, 2)).toBe(false)
    expect(entraOtroParticular(5, 2)).toBe(false)
  })
})

describe('decidirIngresoPorCodigo (AC1): el 3.er alumno que entra por el link', () => {
  const gratis = { estado: 'gratis' as const, tipo: 'particular' as const, nivel: 0, otrosCursosConAlumnos: 0, env: {} }
  it('un particular con 2 alumnos no suma un 3.º por el link', () => {
    expect(decidirIngresoPorCodigo({ ...gratis, modalidad: 'particular', alumnos: 2, enEsteCurso: 2 })).toBe('sin_lugar')
    expect(decidirIngresoPorCodigo({ ...gratis, modalidad: 'particular', alumnos: 1, enEsteCurso: 1 })).toBe(true)
  })
  it('uno de curso sí (curso de hasta 35)', () => {
    expect(decidirIngresoPorCodigo({ ...gratis, modalidad: 'curso', alumnos: 2, enEsteCurso: 2 })).toBe(true)
    expect(decidirIngresoPorCodigo({ ...gratis, modalidad: 'curso', alumnos: 35, enEsteCurso: 35 })).toBe('curso_completo')
  })
  it('sin dato, como hoy: entra (B1)', () => {
    expect(decidirIngresoPorCodigo({ ...gratis, modalidad: null, alumnos: 2, enEsteCurso: 2 })).toBe(true)
  })
  it('con un plan pago, el cupo del nivel (la modalidad no cambia nada)', () => {
    const pago = { estado: 'activo' as const, tipo: 'particular' as const, nivel: 1, otrosCursosConAlumnos: 0, env: {}, enEsteCurso: 0 }
    expect(decidirIngresoPorCodigo({ ...pago, modalidad: 'particular', alumnos: 4 })).toBe(true)
    expect(decidirIngresoPorCodigo({ ...pago, modalidad: 'particular', alumnos: 5 })).toBe('sin_lugar')
    expect(decidirIngresoPorCodigo({ ...pago, modalidad: null, alumnos: 5 })).toBe('sin_lugar')
  })
  it('exento: siempre entra; vencido: nunca', () => {
    expect(decidirIngresoPorCodigo({ ...gratis, estado: 'exento', modalidad: 'particular', alumnos: 99, enEsteCurso: 0 })).toBe(true)
    expect(decidirIngresoPorCodigo({ ...gratis, estado: 'vencido', modalidad: 'particular', alumnos: 3, enEsteCurso: 0 })).toBe('sin_lugar')
  })
})
