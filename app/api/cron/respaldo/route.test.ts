import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hacerRespaldo = vi.fn(async () => ({ archivo: 'respaldos-json/maestria-2026-11-23.json.gz', bytes: 1234, filas: 10, borrados: 0 }))
vi.mock('@/lib/respaldo-server', () => ({ hacerRespaldo: () => hacerRespaldo() }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { GET } from './route'

const pedir = (auth?: string) => GET(new Request('http://localhost/api/cron/respaldo', { headers: auth ? { authorization: auth } : {} }))

describe('Y2 · /api/cron/respaldo', () => {
  const antes = { ...process.env }
  beforeEach(() => hacerRespaldo.mockClear())
  afterEach(() => {
    process.env = { ...antes }
  })

  it('sin configurar no hace nada y dice qué falta (503)', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.RESPALDO_SECRETO
    const res = await pedir('Bearer x')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ configurado: false, faltan: ['BLOB_READ_WRITE_TOKEN', 'RESPALDO_SECRETO'] })
    expect(hacerRespaldo).not.toHaveBeenCalled()
  })

  it('sin el secreto correcto, 401 y nada', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok'
    process.env.RESPALDO_SECRETO = 'secreto'
    expect((await pedir()).status).toBe(401)
    expect((await pedir('Bearer otro')).status).toBe(401)
    expect(hacerRespaldo).not.toHaveBeenCalled()
  })

  it('con el secreto, hace el respaldo', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'tok'
    process.env.RESPALDO_SECRETO = 'secreto'
    const res = await pedir('Bearer secreto')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, archivo: 'respaldos-json/maestria-2026-11-23.json.gz' })
    expect(hacerRespaldo).toHaveBeenCalledTimes(1)
  })
})
