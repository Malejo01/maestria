import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { correrAvisoSemanal, sqlMock } = vi.hoisted(() => ({ correrAvisoSemanal: vi.fn(), sqlMock: vi.fn() }))
vi.mock('@/lib/aviso-semanal-server', () => ({ correrAvisoSemanal }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { GET } from './route'

const pedido = (autorizacion?: string) => new Request('http://x/api/cron/aviso-semanal', { headers: autorizacion ? { authorization: autorizacion } : {} })

beforeEach(() => {
  correrAvisoSemanal.mockReset()
  correrAvisoSemanal.mockResolvedValue({ docentes: 3, creados: 2, yaEstaban: 0, omitidos: 1, fallidos: 0 })
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/cron/aviso-semanal (AC5)', () => {
  it('sin CRON_SECRET: 401 y no hace nada', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(pedido('Bearer algo'))
    expect(res.status).toBe(401)
    expect((await res.json()).configurado).toBe(false)
    expect(correrAvisoSemanal).not.toHaveBeenCalled()
  })

  it('con otro secreto o sin encabezado: 401', async () => {
    vi.stubEnv('CRON_SECRET', 'el-de-verdad')
    expect((await GET(pedido('Bearer otro'))).status).toBe(401)
    expect((await GET(pedido())).status).toBe(401)
    expect(correrAvisoSemanal).not.toHaveBeenCalled()
  })

  it('con el secreto: corre y dice cuántos dejó', async () => {
    vi.stubEnv('CRON_SECRET', 'el-de-verdad')
    const res = await GET(pedido('Bearer el-de-verdad'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, creados: 2, omitidos: 1 })
  })
})
void sqlMock
