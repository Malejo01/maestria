import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock, contarAlumnosDelDocente, captureRouteFailure } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  contarAlumnosDelDocente: vi.fn(),
  captureRouteFailure: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/alumnos-docente-server', () => ({ contarAlumnosDelDocente }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure }))

import { bloqueoParaGenerar, bloqueoParaSumarAlumno, lineaDeAcreditacion, resumenDelPlan } from './planes-server'

const columnaInexistente = Object.assign(new Error('column "plan_nivel" does not exist'), { code: '42703' })

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ADMIN_EMAILS
  contarAlumnosDelDocente.mockResolvedValue(7)
})

describe('la válvula de seguridad', () => {
  it('sin la 026 (columna inexistente) el docente es exento, y no es un incidente', async () => {
    sqlMock.mockRejectedValue(columnaInexistente)
    const resumen = await resumenDelPlan('d1', 'd@x.com')
    expect(resumen.estado).toBe('exento')
    expect(resumen.avisoDePruebaPendiente).toBe(false)
    expect(captureRouteFailure).not.toHaveBeenCalled()
    expect(await bloqueoParaGenerar('d1', 'd@x.com')).toBeNull()
    expect(await bloqueoParaSumarAlumno('d1', 'd@x.com')).toBeNull()
  })

  it('con la base caída también es exento, pero queda el evento', async () => {
    sqlMock.mockRejectedValue(new Error('fetch failed'))
    expect((await resumenDelPlan('d1', 'd@x.com')).estado).toBe('exento')
    expect(captureRouteFailure).toHaveBeenCalled()
  })

  it('con plan_nivel nulo es exento', async () => {
    sqlMock.mockResolvedValue([{ plan_nivel: null, plan_vence_el: null, prueba_iniciada_el: null }])
    expect((await resumenDelPlan('d1', 'd@x.com')).estado).toBe('exento')
  })
})

describe('la cuenta exenta', () => {
  it('ni consulta la base ni cuenta alumnos', async () => {
    process.env.ADMIN_EMAILS = 'dueno@x.com'
    const resumen = await resumenDelPlan('d1', 'dueno@x.com')
    expect(resumen).toMatchObject({ estado: 'exento', alumnos: 0, cupo: null, venceEl: null })
    expect(sqlMock).not.toHaveBeenCalled()
    expect(contarAlumnosDelDocente).not.toHaveBeenCalled()
  })
})

describe('con la 026 corrida', () => {
  it('prueba sin arrancar: pide el aviso', async () => {
    sqlMock.mockResolvedValue([{ plan_nivel: 0, plan_vence_el: null, prueba_iniciada_el: null }])
    const resumen = await resumenDelPlan('d1', 'd@x.com')
    expect(resumen).toMatchObject({ estado: 'prueba', cupo: 10, alumnos: 7, avisoDePruebaPendiente: true })
  })

  it('vencido: 402 al generar, con el cuerpo que la UI lee', async () => {
    sqlMock.mockResolvedValue([{ plan_nivel: 1, plan_vence_el: '2020-01-01T00:00:00Z', prueba_iniciada_el: null }])
    contarAlumnosDelDocente.mockResolvedValue(3)
    const respuesta = await bloqueoParaGenerar('d1', 'd@x.com', { questions: [] })
    expect(respuesta?.status).toBe(402)
    const cuerpo = await respuesta!.json()
    expect(cuerpo.questions).toEqual([])
    expect(cuerpo.plan).toMatchObject({ motivo: 'vencido', estado: 'vencido', alumnos: 3, cupo: 5 })
  })

  it('activo y lleno: 402 sin_cupo al sumar el sexto', async () => {
    sqlMock.mockResolvedValue([{ plan_nivel: 1, plan_vence_el: '2099-01-01T00:00:00Z', prueba_iniciada_el: null }])
    contarAlumnosDelDocente.mockResolvedValue(5)
    const respuesta = await bloqueoParaSumarAlumno('d1', 'd@x.com')
    expect(respuesta?.status).toBe(402)
    expect((await respuesta!.json()).plan).toMatchObject({ motivo: 'sin_cupo', siguiente: { nivel: 2 } })
  })

  it('activo con lugar: deja sumar el quinto', async () => {
    sqlMock.mockResolvedValue([{ plan_nivel: 1, plan_vence_el: '2099-01-01T00:00:00Z', prueba_iniciada_el: null }])
    contarAlumnosDelDocente.mockResolvedValue(4)
    expect(await bloqueoParaSumarAlumno('d1', 'd@x.com')).toBeNull()
  })
})

describe('lineaDeAcreditacion', () => {
  it('dice quién, cuándo, qué nivel, hasta cuándo y la nota', () => {
    const linea = lineaDeAcreditacion({
      nivel: 2,
      venceEl: new Date('2026-12-16T15:00:00Z'),
      nota: '  transferencia\nMercadoPago  ',
      acreditadoPor: 'mauro@x.com',
      ahora: new Date('2026-11-16T15:00:00Z'),
    })
    expect(linea).toBe('16/11/2026 · mauro@x.com acreditó nivel 2 hasta el 16/12/2026 · transferencia MercadoPago')
  })
})
