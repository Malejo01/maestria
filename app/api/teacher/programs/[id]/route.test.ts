import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Ronda T · A2: el área de un programa viejo se completa y se guarda al abrirlo. */
const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }))

vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'd1', email: 'd@x.com' } }) }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/subjects', () => ({ upsertTeacherSubject: vi.fn() }))
vi.mock('@/lib/grado-server', () => ({ resolveGradoForNivel: async (_n: unknown, g: unknown) => g }))

import { GET, PATCH } from './route'

const VIEJO = {
  id: 18,
  user_id: 'd1',
  subject_name: 'Temas de Antropología Cultural en Psicología',
  pedagogy_profile: { level: 'Superior', degree: 'Psicología', academicYear: '1º', complexity: 'media', assessmentStyle: 'mixto', methodology: 'casos' },
  units: [{ id: 'u1', name: 'Unidad 1', topics: [{ id: 't1', name: 'El concepto de cultura' }] }],
  nivel: 'Superior',
  grado: '1º',
}

let programa: Record<string, unknown>
const textos = () => sqlMock.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'))

beforeEach(() => {
  vi.clearAllMocks()
  programa = structuredClone(VIEJO)
  sqlMock.mockImplementation(async (partes: TemplateStringsArray, ...valores: unknown[]) => {
    const q = partes.join('?')
    if (q.includes('FROM users')) return [{ role: 'DOCENTE' }]
    if (q.includes('FROM teacher_programs')) return [programa]
    if (q.includes('UPDATE teacher_programs') && q.includes('subject_name =')) {
      return [{ ...programa, pedagogy_profile: JSON.parse(String(valores[3])), units: JSON.parse(String(valores[4])) }]
    }
    return []
  })
})

const params = { params: Promise.resolve({ id: '18' }) }

describe('GET /api/teacher/programs/[id] — el área del programa viejo', () => {
  it('se infiere, se devuelve y se guarda una sola vez (sólo si sigue sin área)', async () => {
    const { program } = await (await GET(new Request('http://x'), params)).json()
    expect(program.pedagogy_profile).toMatchObject({ area: 'sociales', areaOrigen: 'inferida', methodology: 'casos' })
    expect(program.units[0].caracter).toBe('conceptual')
    const update = textos().find((q) => q.includes('UPDATE teacher_programs'))
    expect(update).toMatch(/\(pedagogy_profile ->> 'area'\) IS NULL/)
  })

  it('con el área ya guardada, no escribe', async () => {
    programa.pedagogy_profile = { ...VIEJO.pedagogy_profile, area: 'sociales', areaConfianza: 0.9, areaOrigen: 'inferida' }
    programa.units = [{ ...VIEJO.units[0], caracter: 'conceptual' }]
    await GET(new Request('http://x'), params)
    expect(textos().some((q) => q.includes('UPDATE'))).toBe(false)
  })
})

describe('PATCH /api/teacher/programs/[id] — el área al editar', () => {
  it('lo elegido a mano no se pisa; la unidad nueva recibe su carácter', async () => {
    const body = {
      subjectName: VIEJO.subject_name,
      pedagogyProfile: { ...VIEJO.pedagogy_profile, area: 'psicologia', areaOrigen: 'manual' },
      units: [...VIEJO.units, { id: 'u2', name: 'Unidad 2: Estadística descriptiva', topics: [{ id: 't2', name: 'Media y mediana' }] }],
    }
    const res = await PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }), params)
    const { program } = await res.json()
    expect(program.pedagogy_profile).toMatchObject({ area: 'psicologia', areaOrigen: 'manual' })
    expect(program.units.map((u: { caracter: string }) => u.caracter)).toEqual(['conceptual', 'cuantitativo'])
  })
})
