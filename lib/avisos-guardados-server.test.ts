import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/evidencia-del-muro-server', () => ({ leerEvidencia: vi.fn(async () => ({ alumnos: 2, ejercicios: 10, desde: null, temaMasFlojo: null })) }))

import { guardarAviso } from './avisos-guardados-server'

const aviso = { userId: 'd1', tipo: 'resumenSemanal' as const, clave: 'semana|2026-11-30', titulo: 't', detalle: 'd', href: '/teacher' }

beforeEach(() => {
  sqlMock.mockReset()
})

describe('guardarAviso (AC1 / AC5): un aviso por clave', () => {
  it('la primera vez lo guarda; la segunda (misma clave) no duplica', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([])
    expect(await guardarAviso(aviso)).toBe(true)
    expect(await guardarAviso(aviso)).toBe(false)
    const consulta = (sqlMock.mock.calls[0][0] as TemplateStringsArray).join('?')
    expect(consulta).toMatch(/ON CONFLICT \(user_id, clave\) DO NOTHING/)
  })

  it('sin la 050 (tabla inexistente) no lanza ni guarda', async () => {
    sqlMock.mockImplementation(async () => {
      throw Object.assign(new Error('la tabla no existe'), { code: '42P01' })
    })
    let resultado: unknown
    try {
      resultado = await guardarAviso(aviso)
    } catch (error) {
      resultado = error
    }
    expect(resultado).toBe(false)
  })
})
