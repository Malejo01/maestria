import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ronda U · U2 — PATCH /api/autodidacta/[id]: cambiar la fecha del examen corre
 * el pase una sola vez y nunca lo acorta. Se prueba contra `cambiarFechaDeExamen`
 * de verdad, con la base simulada, incluida la válvula sin la 043.
 */
const { viewer, sqlMock, fila, escrituras } = vi.hoisted(() => ({
  viewer: { actual: { id: 'sofia', isGuest: false } as { id: string; isGuest: boolean } | null },
  sqlMock: vi.fn(),
  fila: { actual: null as Record<string, unknown> | null },
  escrituras: [] as string[],
}))
vi.mock('@/lib/auth-session', () => ({ getViewer: async () => viewer.actual }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { PATCH } from './route'

const conId = (id: string) => ({ params: Promise.resolve({ id }) })
const pedir = (fechaExamen: unknown) =>
  new Request('http://localhost:3000/api/autodidacta/7', { method: 'PATCH', body: JSON.stringify({ fechaExamen }) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-23T15:00:00Z'))
  viewer.actual = { id: 'sofia', isGuest: false }
  escrituras.length = 0
  fila.actual = { pase_hasta: '2026-12-17', pase_corrido_el: null, con_043: true }
  sqlMock.mockReset()
  sqlMock.mockImplementation(async (partes: TemplateStringsArray) => {
    const q = partes.join('?')
    if (q.includes('SELECT to_jsonb(teacher_programs)')) return fila.actual ? [fila.actual] : []
    if (q.includes('UPDATE teacher_programs')) {
      escrituras.push(q.replace(/\s+/g, ' '))
      return q.includes('RETURNING id') ? [{ id: 7 }] : []
    }
    return []
  })
})

describe('PATCH /api/autodidacta/[id] (U2)', () => {
  it('corre el pase a la fecha nueva + 7', async () => {
    const res = await PATCH(pedir('2026-12-20'), conId('7'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fechaExamen: '2026-12-20', pase: '2026-12-27', resultado: 'corrido' })
    expect(escrituras.some((q) => q.includes('pase_corrido_el = NOW()'))).toBe(true)
  })

  it('si la fecha nueva lo acortaría, cambia la fecha pero no el pase', async () => {
    const res = await PATCH(pedir('2026-11-30'), conId('7'))
    expect(await res.json()).toEqual({ fechaExamen: '2026-11-30', pase: '2026-12-17', resultado: 'no-acorta' })
    expect(escrituras.some((q) => q.includes('fecha_examen'))).toBe(true)
    expect(escrituras.some((q) => q.includes('pase_hasta'))).toBe(false)
  })

  it('el segundo cambio no lo corre', async () => {
    fila.actual = { pase_hasta: '2026-12-27', pase_corrido_el: '2026-11-23T15:00:00Z', con_043: true }
    const res = await PATCH(pedir('2027-01-20'), conId('7'))
    expect(await res.json()).toEqual({ fechaExamen: '2027-01-20', pase: '2026-12-27', resultado: 'ya-corrido' })
    expect(escrituras.some((q) => q.includes('pase_hasta'))).toBe(false)
  })

  it('válvula: sin la 043 cambia la fecha y no toca el pase', async () => {
    fila.actual = { pase_hasta: '2026-12-17', pase_corrido_el: null, con_043: false }
    const res = await PATCH(pedir('2026-12-20'), conId('7'))
    expect(res.status).toBe(200)
    expect((await res.json()).pase).toBe('2026-12-17')
    expect(escrituras.some((q) => q.includes('pase_corrido_el'))).toBe(false)
  })

  it('sin pase, sólo la fecha', async () => {
    fila.actual = { pase_hasta: null, pase_corrido_el: null, con_043: true }
    const res = await PATCH(pedir('2026-12-20'), conId('7'))
    expect(await res.json()).toEqual({ fechaExamen: '2026-12-20', pase: null, resultado: 'sin-pase' })
  })

  it('rechaza una fecha pasada, una materia ajena y al invitado', async () => {
    expect((await PATCH(pedir('2026-11-01'), conId('7'))).status).toBe(400)
    fila.actual = null
    expect((await PATCH(pedir('2026-12-20'), conId('7'))).status).toBe(404)
    viewer.actual = { id: 'g', isGuest: true }
    expect((await PATCH(pedir('2026-12-20'), conId('7'))).status).toBe(401)
  })
})
