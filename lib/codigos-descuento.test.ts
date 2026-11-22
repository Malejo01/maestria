import { describe, expect, it } from 'vitest'
import { codigoValido, normalizarCodigo, precioConDescuento, validarCodigo, type CodigoDeDescuento } from './codigos-descuento'

const AHORA = new Date('2026-11-22T18:00:00-03:00')
const SIL: CodigoDeDescuento = {
  id: 1,
  codigo: 'FUNDADORA-SIL',
  porcentaje: 50,
  aplica: 'particular',
  forma: 'mensual',
  meses: 6,
  usosMaximos: 1,
  usosHechos: 0,
  venceEl: null,
  fundadora: true,
  activo: true,
  nota: 'Silvana, primera fundadora',
}
const PARTICULAR_MENSUAL = { plan: 'particular', forma: 'mensual' } as const

describe('C1 · el caso de prueba: FUNDADORA-SIL', () => {
  it('1 bloque mensual de $20.000 → $10.000', () => {
    const r = validarCodigo({ codigo: SIL, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: null, ahora: AHORA })
    expect(r).toMatchObject({ ok: true, porcentaje: 50, nuevoUso: true })
    expect(precioConDescuento(20000, 50)).toBe(10000)
  })

  it('Silvana lo vuelve a usar el mes siguiente: vale y no gasta otro uso', () => {
    const r = validarCodigo({ codigo: { ...SIL, usosHechos: 1 }, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: '2026-11-22T18:00:00-03:00', ahora: new Date('2026-12-22T18:00:00-03:00') })
    expect(r).toMatchObject({ ok: true, nuevoUso: false })
  })

  it('a los 6 meses del primer uso se termina', () => {
    const r = validarCodigo({ codigo: { ...SIL, usosHechos: 1 }, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: '2026-11-22T18:00:00-03:00', ahora: new Date('2027-06-01T12:00:00-03:00') })
    expect(r).toEqual({ ok: false, motivo: 'se_termino' })
  })

  it('otra persona no puede: tenía 1 uso y ya se usó', () => {
    expect(validarCodigo({ codigo: { ...SIL, usosHechos: 1 }, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'agotado' })
  })
})

describe('C1 · los rechazos', () => {
  it('vencido, inactivo o inexistente', () => {
    expect(validarCodigo({ codigo: { ...SIL, venceEl: '2026-11-01T00:00:00Z' }, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'vencido' })
    expect(validarCodigo({ codigo: { ...SIL, activo: false }, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'inactivo' })
    expect(validarCodigo({ codigo: null, que: PARTICULAR_MENSUAL, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'no_existe' })
  })

  it('que no aplica a ese plan o a esa forma', () => {
    expect(validarCodigo({ codigo: SIL, que: { plan: 'aula', forma: 'mensual' }, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'no_aplica' })
    expect(validarCodigo({ codigo: SIL, que: { plan: 'particular', forma: 'pase' }, primerUsoDeLaPersona: null, ahora: AHORA })).toEqual({ ok: false, motivo: 'no_aplica' })
    expect(validarCodigo({ codigo: { ...SIL, aplica: 'todos', forma: 'ambos' }, que: { plan: 'pase_alumno', forma: 'pase' }, primerUsoDeLaPersona: null, ahora: AHORA }).ok).toBe(true)
  })
})

describe('C1 · precio y formato', () => {
  it('redondeado a $100', () => {
    expect(precioConDescuento(15000, 33)).toBe(10100)
    expect(precioConDescuento(6000, 15)).toBe(5100)
    expect(precioConDescuento(20000, 100)).toBe(0)
  })

  it('el código se normaliza y se valida', () => {
    expect(normalizarCodigo('  fundadora-sil ')).toBe('FUNDADORA-SIL')
    expect(codigoValido('FUNDADORA-SIL')).toBe(true)
    expect(codigoValido('X')).toBe(false)
    expect(codigoValido('CON ESPACIO')).toBe(false)
  })
})
