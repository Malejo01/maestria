import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock, viewer } = vi.hoisted(() => ({ sqlMock: vi.fn(), viewer: { current: { id: 'd1' } as { id: string } | null } }))

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer: async () => viewer.current }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { PATCH } from './route'

const PROGRAMA = {
  subject_name: 'Matemática y su Didáctica',
  pedagogy_profile: { methodology: 'talleres', area: 'educacion', areaConfianza: 0.9, areaOrigen: 'inferida' },
  units: [
    { id: 'u1', name: 'Números naturales', topics: [{ id: 't1', name: 'Operaciones' }], caracter: 'cuantitativo' },
    { id: 'u2', name: 'La enseñanza del número', topics: [{ id: 't2', name: 'Secuencias' }], caracter: 'conceptual' },
  ],
}

let escrito: { perfil: unknown; unidades: unknown } | null
beforeEach(() => {
  vi.clearAllMocks()
  viewer.current = { id: 'd1' }
  escrito = null
  sqlMock.mockImplementation(async (partes: TemplateStringsArray, ...valores: unknown[]) => {
    const q = partes.join('?')
    if (q.includes('SELECT subject_name')) return valores[1] === 'd1' ? [structuredClone(PROGRAMA)] : []
    if (q.includes('UPDATE')) escrito = { perfil: JSON.parse(String(valores[0])), unidades: JSON.parse(String(valores[1])) }
    return []
  })
})

const pedir = (body: unknown) =>
  PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '16' }) })

describe('PATCH /api/teacher/programs/[id]/area', () => {
  it('cambiar el área la marca como elegida a mano, sin tocar el resto del perfil', async () => {
    const res = await pedir({ area: 'matematica' })
    expect(res.status).toBe(200)
    expect(escrito?.perfil).toMatchObject({ methodology: 'talleres', area: 'matematica', areaOrigen: 'manual', areaConfianza: 1 })
  })

  it('cambiar el carácter de una unidad lo guarda a mano; null vuelve al detectado', async () => {
    await pedir({ unidadId: 'u2', caracter: 'mixto' })
    expect((escrito?.unidades as { caracterManual?: string }[])[1].caracterManual).toBe('mixto')
    expect((escrito?.unidades as { caracter?: string }[])[1].caracter).toBe('conceptual')

    PROGRAMA.units[1] = { ...PROGRAMA.units[1], caracterManual: 'mixto' } as (typeof PROGRAMA.units)[number]
    await pedir({ unidadId: 'u2', caracter: null })
    expect((escrito?.unidades as { caracterManual?: string }[])[1].caracterManual).toBeUndefined()
  })

  it('valores inválidos: 400, sin escribir', async () => {
    expect((await pedir({ area: 'astrologia' })).status).toBe(400)
    expect((await pedir({ unidadId: 'u1', caracter: 'numerico' })).status).toBe(400)
    expect((await pedir({})).status).toBe(400)
    expect(escrito).toBeNull()
  })

  it('la materia de otro docente: 404; un alumno: 403', async () => {
    viewer.current = { id: 'otro' }
    expect((await pedir({ area: 'matematica' })).status).toBe(404)
    viewer.current = null
    expect((await pedir({ area: 'matematica' })).status).toBe(403)
    expect(escrito).toBeNull()
  })
})
