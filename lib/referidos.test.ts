import { describe, expect, it } from 'vitest'
import { codigoParaDocente, premioDelReferente, referidosActivo, validarReferido } from './referidos'
import { codigoValido } from './codigos-descuento'
import { normalizarRef } from './origen'

const docente = { plan: 'particular', forma: 'mensual' } as const

describe('referidos (V3)', () => {
  it('la válvula: sólo con MAESTRIA_REFERIDOS_ACTIVO=1', () => {
    expect(referidosActivo({})).toBe(false)
    expect(referidosActivo({ MAESTRIA_REFERIDOS_ACTIVO: '0' })).toBe(false)
    expect(referidosActivo({ MAESTRIA_REFERIDOS_ACTIVO: '1' })).toBe(true)
  })

  it('el código: el primer nombre sin tildes y 4 caracteres; vale como código de C1 y como ?ref=', () => {
    let i = 0
    const fijo = () => [0.1, 0.5, 0.9, 0.3][i++ % 4]
    const c = codigoParaDocente('Íñigo Martínez', fijo)
    expect(c).toMatch(/^INIGO-[A-Z2-9]{4}$/)
    expect(codigoValido(c)).toBe(true)
    expect(normalizarRef(c)).toBe(c)
    expect(codigoParaDocente(null)).toMatch(/^DOCENTE-/)
    expect(codigoParaDocente('X')).toMatch(/^DOCENTE-/)
  })

  it('AA2 · ningún código de docente empieza con «AD-» (es el prefijo de los anuncios)', () => {
    expect(codigoParaDocente('Ad Pérez')).toMatch(/^DOCENTE-/)
    expect(codigoParaDocente('Adriana')).toMatch(/^ADRIANA-/)
  })

  it('10 % en el primer pago de un plan docente, nunca del propio código', () => {
    const base = { activo: true, codigo: 'IRINA-K7Q2', referenteId: 'irina', quienPaga: 'nuevo', yaPago: false, que: docente }
    expect(validarReferido(base)).toMatchObject({ ok: true, porcentaje: 10 })
    expect(validarReferido({ ...base, quienPaga: 'irina' })).toEqual({ ok: false, motivo: 'no_aplica' })
    expect(validarReferido({ ...base, yaPago: true })).toEqual({ ok: false, motivo: 'se_termino' })
    expect(validarReferido({ ...base, que: { plan: 'pase_alumno', forma: 'pase' } })).toEqual({ ok: false, motivo: 'no_aplica' })
  })

  it('apagado, o si no es un código de referido, sigue la búsqueda de C1', () => {
    const base = { activo: true, codigo: 'X', referenteId: 'irina', quienPaga: 'nuevo', yaPago: false, que: docente }
    expect(validarReferido({ ...base, activo: false })).toBeNull()
    expect(validarReferido({ ...base, referenteId: null })).toBeNull()
  })

  it('el premio: se suma si tiene un plan con vencimiento; si no, queda pendiente', () => {
    const ahora = new Date('2026-11-23T12:00:00Z')
    expect(premioDelReferente({ planVenceEl: '2026-12-10T00:00:00Z', ahora })).toBe('sumar')
    expect(premioDelReferente({ planVenceEl: '2026-11-10T00:00:00Z', ahora })).toBe('sumar')
    expect(premioDelReferente({ planVenceEl: '2026-08-01T00:00:00Z', ahora })).toBe('pendiente')
    expect(premioDelReferente({ planVenceEl: null, ahora })).toBe('pendiente')
  })
})
