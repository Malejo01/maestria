import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O7. Traer alumnos de otro grupo: sólo los elegidos, sólo de un grupo propio, y el plan manda. */
const { getTeacherViewer, getOwnedClassroom, bloqueoParaGenerar, consultas } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  getOwnedClassroom: vi.fn(),
  bloqueoParaGenerar: vi.fn(),
  consultas: [] as { texto: string; valores: unknown[] }[],
}))

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/classrooms-server', () => ({ getOwnedClassroom, getClassroomMembers: vi.fn(async () => []) }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    consultas.push({ texto: strings.join('?').replace(/\s+/g, ' '), valores })
    return Promise.resolve([{ id: 1 }])
  },
}))

import { POST, idsDeAlumnos } from './route'

const pedir = (cuerpo: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id: '4' }) })

beforeEach(() => {
  consultas.length = 0
  getTeacherViewer.mockResolvedValue({ id: 'irina', email: 'i@x' })
  bloqueoParaGenerar.mockResolvedValue(null)
  getOwnedClassroom.mockImplementation(async (id: number) => (id === 4 || id === 2 ? { id } : null))
})

describe('O7 · traer alumnos de otro grupo', () => {
  it('los ids del cliente: sin repetir, sólo texto; ausentes = todos', () => {
    expect(idsDeAlumnos(['a', 'a', ' b ', 3, ''])).toEqual(['a', 'b'])
    expect(idsDeAlumnos(undefined)).toBeNull()
    expect(idsDeAlumnos('a')).toEqual([])
  })

  it('trae sólo los elegidos (sin sacarlos del origen: es un INSERT, no un UPDATE del origen)', async () => {
    const r = await pedir({ sourceClassroomId: 2, userIds: ['ana', 'guest_1'] })
    expect(r.status).toBe(200)
    const insert = consultas.find((c) => c.texto.includes('INSERT INTO classroom_members'))!
    expect(insert.texto).toContain('m.user_id = ANY(')
    expect(insert.valores).toContainEqual(['ana', 'guest_1'])
    expect(consultas.some((c) => /UPDATE classroom_members SET status = 'removed'|DELETE/i.test(c.texto))).toBe(false)
  })

  it('una lista vacía es un error, no "todos"', async () => {
    expect((await pedir({ sourceClassroomId: 2, userIds: [] })).status).toBe(400)
  })

  it('un grupo de origen ajeno: 403', async () => {
    expect((await pedir({ sourceClassroomId: 9, userIds: ['x'] })).status).toBe(403)
  })

  it('con el plan vencido, la pantalla de límite (lib/planes.ts)', async () => {
    bloqueoParaGenerar.mockResolvedValue(new Response(JSON.stringify({ plan: { motivo: 'vencido' } }), { status: 402 }))
    expect((await pedir({ sourceClassroomId: 2, userIds: ['ana'] })).status).toBe(402)
    expect(consultas).toHaveLength(0)
  })
})
