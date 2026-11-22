import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * N1. Permisos de los avisos: cada uno ve sólo los suyos (la consulta va con
 * el id de getViewer, nunca con algo del cliente), un invitado ve los suyos,
 * el admin no ve avisos de sus propios reportes, y "Entendido" no puede marcar
 * reportes de otro.
 */
const { getViewer, consultas } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  consultas: [] as { texto: string; valores: unknown[] }[],
}))
let responder: (texto: string, valores: unknown[]) => unknown = () => []

vi.mock('@/lib/auth-session', () => ({ getViewer }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto, valores))
  },
}))

import { GET } from './route'
import { POST } from './visto/route'

/** La base de prueba: el reporte 6 es de Clarita (invitada), el 7 de Ana. */
const REPORTES = [
  { id: 6, user_id: 'guest_clarita', created_at: '2026-11-20T15:00:00Z', respuesta: null, respondido_por: null, cuestionario: 'Matemática - Mixto - 20/11/2026' },
  { id: 7, user_id: 'ana', created_at: '2026-11-21T15:00:00Z', respuesta: null, respondido_por: null, cuestionario: null },
]

beforeEach(() => {
  consultas.length = 0
  getViewer.mockReset()
  delete process.env.ADMIN_EMAILS
  // Simula el WHERE user_id = … de la base.
  responder = (texto, valores) => {
    if (texto.includes('SELECT')) return REPORTES.filter((r) => r.user_id === valores[0])
    if (texto.includes('UPDATE')) {
      const [ids, userId] = valores as [number[], string]
      return REPORTES.filter((r) => ids.includes(r.id) && r.user_id === userId).map((r) => ({ id: r.id }))
    }
    return []
  }
})

describe('GET /api/feedback/avisos', () => {
  it('sin sesión, 401 y no se consulta la base', async () => {
    getViewer.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(consultas).toHaveLength(0)
  })

  it('un invitado ve los suyos', async () => {
    getViewer.mockResolvedValue({ id: 'guest_clarita', isGuest: true, email: null, role: 'ALUMNO', displayName: 'Clarita' })
    const cuerpo = await (await GET()).json()
    expect(cuerpo.avisos.map((a: { id: number }) => a.id)).toEqual([6])
  })

  it('un usuario no ve los avisos de otro', async () => {
    getViewer.mockResolvedValue({ id: 'ana', isGuest: false, email: 'ana@x', role: 'ALUMNO', displayName: 'Ana' })
    const cuerpo = await (await GET()).json()
    expect(cuerpo.avisos.map((a: { id: number }) => a.id)).toEqual([7])
    expect(consultas[0].valores).toEqual(['ana'])
  })

  it('el admin no ve avisos de sus propios reportes', async () => {
    process.env.ADMIN_EMAILS = 'mauro@x'
    getViewer.mockResolvedValue({ id: 'mauro', isGuest: false, email: 'mauro@x', role: 'DOCENTE', displayName: 'Mauro' })
    expect(await (await GET()).json()).toEqual({ avisos: [] })
    expect(consultas).toHaveLength(0)
  })
})

describe('POST /api/feedback/avisos/visto', () => {
  it('marca los suyos y no los de otro', async () => {
    getViewer.mockResolvedValue({ id: 'guest_clarita', isGuest: true, email: null, role: 'ALUMNO', displayName: 'Clarita' })
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ ids: [6, 7] }) }))
    expect(await res.json()).toEqual({ marcados: 1 })
    expect(consultas[0].valores[1]).toBe('guest_clarita')
  })

  it('sin sesión, 401; sin ids, 400', async () => {
    getViewer.mockResolvedValue(null)
    expect((await POST(new Request('http://x', { method: 'POST', body: '{"ids":[6]}' }))).status).toBe(401)
    getViewer.mockResolvedValue({ id: 'ana', isGuest: false, email: 'ana@x' })
    expect((await POST(new Request('http://x', { method: 'POST', body: '{}' }))).status).toBe(400)
    expect(consultas).toHaveLength(0)
  })
})
