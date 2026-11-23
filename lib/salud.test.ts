import { describe, expect, it } from 'vitest'
import { alertasDelSistema, fallanDemasiado, porcentaje, resumenDeGeneraciones, tasa } from './salud'

const AHORA = new Date('2026-11-23T15:42:10Z')

describe('las tasas', () => {
  it('fallas y descarte; sin datos, null', () => {
    expect(resumenDeGeneraciones({ total: 40, fallidas: 2, crudas: 200, descartadas: 30 })).toEqual({ tasaDeFallas: 0.05, tasaDeDescarte: 0.15 })
    expect(resumenDeGeneraciones({ total: 0, fallidas: 0, crudas: null, descartadas: null })).toEqual({ tasaDeFallas: null, tasaDeDescarte: null })
    expect(tasa(1, 0)).toBeNull()
    expect(porcentaje(0.125)).toBe('12,5 %')
    expect(porcentaje(null)).toBeNull()
  })
})

describe('alertas', () => {
  it('más del 10 % de fallas en la hora, con al menos 5 generaciones', () => {
    expect(fallanDemasiado({ total: 10, fallidas: 2, crudas: null, descartadas: null })).toBe(true)
    expect(fallanDemasiado({ total: 10, fallidas: 1, crudas: null, descartadas: null })).toBe(false)
    expect(fallanDemasiado({ total: 3, fallidas: 3, crudas: null, descartadas: null })).toBe(false)
  })
  it('una por hora para las generaciones y una por pago', () => {
    const alertas = alertasDelSistema({
      ultimaHora: { total: 8, fallidas: 4, crudas: null, descartadas: null },
      pagos: [{ id: 7, docente: 'Irina', monto: 20000, motivo: 'montoDistinto', desde: '2026-11-23T10:00:00.000Z' }],
      ahora: AHORA,
    })
    expect(alertas.map((a) => a.clave)).toEqual(['alerta-generaciones|2026-11-23T15:00:00.000Z', 'alerta-pago|7'])
    expect(alertas[0]).toMatchObject({ fallidas: 4, total: 8, fecha: '2026-11-23T15:00:00.000Z' })
  })
  it('sin problemas, sin alertas', () => {
    expect(alertasDelSistema({ ultimaHora: { total: 30, fallidas: 1, crudas: 100, descartadas: 50 }, pagos: [], ahora: AHORA })).toEqual([])
  })
})
