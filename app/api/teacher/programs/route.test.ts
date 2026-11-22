import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ronda T · E1: la materia personal (modo autodidacta) vive en
 * teacher_programs, pero nunca aparece en "Mis materias" del docente — tampoco
 * si quien la creó como alumno pasa después a ser docente.
 */
const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }))

vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'd1', email: 'd@x.com' } }) }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/subjects', () => ({ upsertTeacherSubject: vi.fn() }))
vi.mock('@/lib/grado-server', () => ({ resolveGradoForNivel: async (_n: unknown, g: unknown) => g }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar: vi.fn() }))

import { GET } from './route'

const fila = (id: number, nombre: string, personal: boolean) => ({
  id,
  user_id: 'd1',
  subject_name: nombre,
  pedagogy_profile: { level: 'Superior', area: 'sociales', areaOrigen: 'detectada' },
  units: [],
  created_at: '2026-11-01T00:00:00Z',
  personal,
})

let consultas: string[]
beforeEach(() => {
  consultas = []
  sqlMock.mockImplementation(async (partes: TemplateStringsArray) => {
    const q = partes.join('?')
    consultas.push(q)
    if (q.includes('FROM users')) return [{ role: 'DOCENTE' }]
    if (q.includes('FROM teacher_programs')) {
      // La base "aplica" el filtro de la consulta: sin él, vendría también la personal.
      const filas = [fila(1, 'Antropología (del docente)', false), fila(2, 'Economía (personal)', true)]
      return q.includes("->> 'personal'") ? filas.filter((f) => !f.personal) : filas
    }
    return []
  })
})

describe('GET /api/teacher/programs', () => {
  it('no lista la materia personal del modo autodidacta', async () => {
    const res = await GET(new Request('http://localhost:3000/api/teacher/programs'))
    const { programs } = (await res.json()) as { programs: { id: number }[] }
    expect(programs.map((p) => p.id)).toEqual([1])
    expect(consultas.filter((q) => q.includes('FROM teacher_programs')).every((q) => q.includes("->> 'personal'"))).toBe(true)
  })
})
