import { describe, expect, it } from 'vitest'
import { diasQueQuedan, esCandidatoALaGarantia } from './garantia'

const AHORA = new Date('2026-11-27T15:00:00Z')
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString()

describe('esCandidatoALaGarantia (AB8)', () => {
  it('pagó hace 14 días o menos y nadie practicó: candidato', () => {
    expect(esCandidatoALaGarantia({ acreditadoEl: hace(3), practicasDesdeElPago: 0 }, AHORA)).toBe(true)
    expect(esCandidatoALaGarantia({ acreditadoEl: hace(14), practicasDesdeElPago: 0 }, AHORA)).toBe(true)
  })
  it('alguien practicó desde el pago: no', () => {
    expect(esCandidatoALaGarantia({ acreditadoEl: hace(3), practicasDesdeElPago: 1 }, AHORA)).toBe(false)
  })
  it('pasaron más de 14 días: no', () => {
    expect(esCandidatoALaGarantia({ acreditadoEl: hace(14.1), practicasDesdeElPago: 0 }, AHORA)).toBe(false)
  })
  it('fecha rota o en el futuro: no', () => {
    expect(esCandidatoALaGarantia({ acreditadoEl: 'basura', practicasDesdeElPago: 0 }, AHORA)).toBe(false)
    expect(esCandidatoALaGarantia({ acreditadoEl: hace(-1), practicasDesdeElPago: 0 }, AHORA)).toBe(false)
  })
  it('los días que le quedan', () => {
    expect(diasQueQuedan(hace(3), AHORA)).toBe(11)
    expect(diasQueQuedan(hace(14), AHORA)).toBe(0)
  })
})
