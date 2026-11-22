import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { armarCobro, estadoDelPago, firmaValida, leerPedido, nuevoVencimiento, precioDeLista } from './pagos'

const ENV = {
  MAESTRIA_PRECIO_MENSUAL_BLOQUE: '20000',
  MAESTRIA_PRECIO_PASE_BLOQUE: '50000',
  MAESTRIA_PRECIO_AULA_CURSO: '15000',
  MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL: '10000',
  MAESTRIA_PRECIO_PASE_ALUMNO: '6000',
}

describe('C2 · el pedido', () => {
  it('sólo lo que tiene sentido', () => {
    expect(leerPedido({ plan: 'particular', forma: 'mensual', cantidad: 1 })).toEqual({ plan: 'particular', forma: 'mensual', cantidad: 1 })
    expect(leerPedido({ plan: 'aula', forma: 'mensual', cantidad: '2' })).toEqual({ plan: 'aula', forma: 'mensual', cantidad: 2 })
    expect(leerPedido({ plan: 'particular', forma: 'mensual', cantidad: 9 })).toBeNull()
    expect(leerPedido({ plan: 'aula', forma: 'pase', cantidad: 1 })).toBeNull()
    // E2: el pase de alumno va con su materia personal, siempre.
    expect(leerPedido({ plan: 'pase_alumno', forma: 'pase', cantidad: 1 })).toBeNull()
    expect(leerPedido({ plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: '57' })).toEqual({ plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 })
    expect(armarCobro({ plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 }, null, ENV)?.descripcion).toBe('Pase por materia · hasta el examen + 7 días')
    expect(leerPedido({ plan: 'otro', forma: 'mensual' })).toBeNull()
    expect(leerPedido(null)).toBeNull()
  })
})

describe('C2 · el monto lo calcula el servidor', () => {
  it('precio de lista desde las variables', () => {
    expect(precioDeLista({ plan: 'particular', forma: 'mensual', cantidad: 1 }, ENV)).toBe(20000)
    expect(precioDeLista({ plan: 'particular', forma: 'pase', cantidad: 2 }, ENV)).toBe(100000)
    expect(precioDeLista({ plan: 'aula', forma: 'mensual', cantidad: 2 }, ENV)).toBe(25000)
    expect(precioDeLista({ plan: 'pase_alumno', forma: 'pase', cantidad: 1 }, ENV)).toBe(6000)
  })

  it('con FUNDADORA-SIL (50 %): 1 bloque mensual = $10.000, por 30 días', () => {
    const cobro = armarCobro(
      { plan: 'particular', forma: 'mensual', cantidad: 1 },
      { ok: true, porcentaje: 50, nuevoUso: true, codigo: {} as never },
      ENV,
    )
    expect(cobro).toMatchObject({ montoLista: 20000, monto: 10000, dias: 30 })
    expect(cobro?.descripcion).toBe('Plan Particular · 1 bloque · mes')
  })

  it('un código rechazado no descuenta; sin precio cargado, null', () => {
    expect(armarCobro({ plan: 'particular', forma: 'mensual', cantidad: 1 }, { ok: false, motivo: 'vencido' }, ENV)?.monto).toBe(20000)
    expect(armarCobro({ plan: 'aula', forma: 'mensual', cantidad: 1 }, null, {})).toBeNull()
  })
})

describe('C2 · el vencimiento al acreditar', () => {
  const ahora = new Date('2026-11-22T12:00:00Z')
  it('con el plan vigente, suma desde el vencimiento (no se pierde lo que quedaba)', () => {
    expect(nuevoVencimiento('2026-12-01T12:00:00Z', 30, ahora).toISOString()).toBe('2026-12-31T12:00:00.000Z')
  })
  it('vencido o sin plan, desde ahora', () => {
    expect(nuevoVencimiento('2026-11-01T12:00:00Z', 30, ahora).toISOString()).toBe('2026-12-22T12:00:00.000Z')
    expect(nuevoVencimiento(null, 90, ahora).toISOString()).toBe('2027-02-20T12:00:00.000Z')
  })
})

describe('C2 · la firma del webhook', () => {
  const secreto = 'secreto-de-prueba'
  const firmar = (id: string, requestId: string, ts: string) =>
    `ts=${ts},v1=${createHmac('sha256', secreto).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex')}`

  it('válida', () => {
    expect(firmaValida({ firma: firmar('123', 'req-1', '1700000000'), requestId: 'req-1', dataId: '123', secreto })).toBe(true)
  })

  it('inválida: otro id, otra clave, sin firma o sin secreto', () => {
    expect(firmaValida({ firma: firmar('124', 'req-1', '1700000000'), requestId: 'req-1', dataId: '123', secreto })).toBe(false)
    expect(firmaValida({ firma: firmar('123', 'req-1', '1700000000'), requestId: 'req-1', dataId: '123', secreto: 'otro' })).toBe(false)
    expect(firmaValida({ firma: null, requestId: 'req-1', dataId: '123', secreto })).toBe(false)
    expect(firmaValida({ firma: firmar('123', 'req-1', '1'), requestId: 'req-1', dataId: '123', secreto: undefined })).toBe(false)
    expect(firmaValida({ firma: 'ts=1,v1=zz', requestId: 'req-1', dataId: '123', secreto })).toBe(false)
  })
})

describe('C2 · el estado de Mercado Pago', () => {
  it('approved, rejected, cancelado y el resto pendiente', () => {
    expect(estadoDelPago('approved')).toBe('aprobado')
    expect(estadoDelPago('rejected')).toBe('rechazado')
    expect(estadoDelPago('refunded')).toBe('cancelado')
    expect(estadoDelPago('in_process')).toBe('pendiente')
  })
})
