import { beforeEach, describe, expect, it, vi } from 'vitest'

/** D2 · Separar en temas lo guardado: proponer (seguro o con la IA) y aplicar (el primero conserva el id). */
const { sqlMock, docente, guard, dividir } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  docente: { actual: { id: 'doc' } as { id: string } | null },
  guard: { ok: true as const, finish: vi.fn(), fail: vi.fn() },
  dividir: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getTeacherViewer: async () => docente.actual }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall: async () => guard }))
vi.mock('@/lib/dividir-parrafo-server', () => ({ dividirParrafosConIA: dividir }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { POST } from './route'

const EN_COMAS = 'La antropología como disciplina científica y su objeto de estudio, el trabajo de campo y la observación participante, el concepto de cultura en sus distintas definiciones, la diversidad cultural y sus formas'
const SIN_CORTE = 'La relación entre la experiencia subjetiva del padecimiento y los modos en que cada sociedad organiza sus respuestas frente a la enfermedad y la muerte'
let guardado: unknown = null
beforeEach(() => {
  vi.clearAllMocks()
  docente.actual = { id: 'doc' }
  guardado = null
  sqlMock.mockImplementation(async (partes: TemplateStringsArray, ...v: unknown[]) => {
    const q = partes.join('?')
    if (q.includes('SELECT units')) return v[1] === 'doc' ? [{ units: [{ id: 'u1', name: 'Unidad 1', topics: [{ id: 't1', name: EN_COMAS }, { id: 't2', name: SIN_CORTE }] }] }] : []
    if (q.includes('UPDATE teacher_programs')) guardado = JSON.parse(String(v[0]))
    return []
  })
  dividir.mockResolvedValue({ divisiones: new Map([[SIN_CORTE, ['La experiencia subjetiva del padecimiento', 'Las respuestas de cada sociedad']]]), usos: [{ inputTokens: 5, outputTokens: 5 }] })
})
const pedir = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '18' }) })

describe('POST /api/teacher/programs/[id]/separar-tema', () => {
  it('proponer con corte seguro: sin IA', async () => {
    const r = await (await pedir({ unidadId: 'u1', temaId: 't1', accion: 'proponer' })).json()
    expect(r.viaIA).toBe(false)
    expect(r.pedazos.length).toBeGreaterThanOrEqual(3)
    expect(dividir).not.toHaveBeenCalled()
  })

  it('proponer sin corte seguro: la IA divide sólo ese párrafo y se cobra', async () => {
    const r = await (await pedir({ unidadId: 'u1', temaId: 't2', accion: 'proponer' })).json()
    expect(r).toEqual({ pedazos: ['La experiencia subjetiva del padecimiento', 'Las respuestas de cada sociedad'], viaIA: true })
    expect(dividir).toHaveBeenCalledWith([SIN_CORTE])
    expect(guard.finish).toHaveBeenCalled()
  })

  it('aplicar: guarda lo revisado y el primero conserva el id', async () => {
    const res = await pedir({ unidadId: 'u1', temaId: 't1', accion: 'aplicar', pedazos: ['La antropología como disciplina', 'El trabajo de campo'] })
    expect(res.status).toBe(200)
    expect((guardado as { topics: { id: string; name: string }[] }[])[0].topics.map((t) => t.id)).toEqual(['t1', 't1-s2', 't2'])
  })

  it('lo revisado sin al menos 2 temas: 400; una materia ajena: 404; un alumno: 403', async () => {
    expect((await pedir({ unidadId: 'u1', temaId: 't1', accion: 'aplicar', pedazos: ['Uno'] })).status).toBe(400)
    docente.actual = { id: 'otro' }
    expect((await pedir({ unidadId: 'u1', temaId: 't1', accion: 'proponer' })).status).toBe(404)
    docente.actual = null
    expect((await pedir({ unidadId: 'u1', temaId: 't1', accion: 'proponer' })).status).toBe(403)
    expect(guardado).toBeNull()
  })
})
