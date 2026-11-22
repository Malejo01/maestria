import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * E1 · Las rutas del modo autodidacta: hace falta una cuenta (el invitado no
 * entra), la materia se crea sólo con la declaración de mayor de 18, y la
 * materia de otro no se ve ni recibe resultados.
 */
const { viewer, servidor } = vi.hoisted(() => ({
  viewer: { actual: { id: 'sofia', isGuest: false } as { id: string; isGuest: boolean } | null },
  servidor: {
    leerAutodidacta: vi.fn(),
    declararMayorDeEdad: vi.fn(),
    crearMateriaPersonal: vi.fn(),
    leerMateriaPersonal: vi.fn(),
    guardarResultado: vi.fn(),
  },
}))
vi.mock('@/lib/auth-session', () => ({ getViewer: async () => viewer.actual }))
vi.mock('@/lib/autodidacta-server', () => servidor)
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { GET, POST } from './route'
import { POST as crear } from './materias/route'
import { GET as leerMateria } from './[id]/route'
import { POST as guardar } from './[id]/resultados/route'

const json = (body: unknown) => new Request('http://localhost:3000/api/autodidacta', { method: 'POST', body: JSON.stringify(body) })
const conId = (id: string) => ({ params: Promise.resolve({ id }) })
const MATERIA = {
  nombre: 'Antropología',
  fechaExamen: '2026-12-10',
  unidades: [{ name: 'Unidad 1', topics: [{ name: 'Cultura' }] }],
}

beforeEach(() => {
  vi.clearAllMocks()
  viewer.actual = { id: 'sofia', isGuest: false }
  servidor.leerAutodidacta.mockResolvedValue({ disponible: true, mayorDeEdad: true, materias: [] })
  servidor.crearMateriaPersonal.mockResolvedValue(51)
})

describe('modo autodidacta: quién entra', () => {
  it('sin cuenta o como invitado: 401 en todas', async () => {
    for (const actual of [null, { id: 'guest-1', isGuest: true }]) {
      viewer.actual = actual
      expect((await GET()).status).toBe(401)
      expect((await POST(json({ mayorDeEdad: true }))).status).toBe(401)
      expect((await crear(json(MATERIA))).status).toBe(401)
      expect((await leerMateria(json({}), conId('51'))).status).toBe(401)
      expect((await guardar(json({ tipo: 'practica', porTema: [] }), conId('51'))).status).toBe(401)
    }
    expect(servidor.crearMateriaPersonal).not.toHaveBeenCalled()
    expect(servidor.guardarResultado).not.toHaveBeenCalled()
  })

  it('la declaración sólo vale con mayorDeEdad: true', async () => {
    expect((await POST(json({ mayorDeEdad: 'si' }))).status).toBe(400)
    expect(servidor.declararMayorDeEdad).not.toHaveBeenCalled()
    expect((await POST(json({ mayorDeEdad: true }))).status).toBe(200)
    expect(servidor.declararMayorDeEdad).toHaveBeenCalledWith('sofia')
  })
})

describe('crear la materia personal', () => {
  it('sin la declaración de mayor de 18: 403 y no se crea', async () => {
    servidor.leerAutodidacta.mockResolvedValue({ disponible: true, mayorDeEdad: false, materias: [] })
    expect((await crear(json(MATERIA))).status).toBe(403)
    expect(servidor.crearMateriaPersonal).not.toHaveBeenCalled()
  })

  it('sin la migración 040: 409', async () => {
    servidor.leerAutodidacta.mockResolvedValue({ disponible: false, mayorDeEdad: false, materias: [] })
    expect((await crear(json(MATERIA))).status).toBe(409)
  })

  it('sin fecha o sin temario: 400', async () => {
    expect((await crear(json({ ...MATERIA, fechaExamen: '10/12' }))).status).toBe(400)
    expect((await crear(json({ ...MATERIA, unidades: [] }))).status).toBe(400)
  })

  it('con todo: la crea a nombre de quien pide', async () => {
    const res = await crear(json(MATERIA))
    expect(await res.json()).toEqual({ id: 51 })
    expect(servidor.crearMateriaPersonal).toHaveBeenCalledWith('sofia', expect.objectContaining({ nombre: 'Antropología', fechaExamen: '2026-12-10' }))
  })
})

describe('la materia de otro', () => {
  it('no se lee: 404', async () => {
    servidor.leerMateriaPersonal.mockResolvedValue(null)
    expect((await leerMateria(json({}), conId('99'))).status).toBe(404)
    expect(servidor.leerMateriaPersonal).toHaveBeenCalledWith('sofia', 99)
  })

  it('no recibe resultados: 404', async () => {
    servidor.guardarResultado.mockResolvedValue(false)
    const res = await guardar(json({ tipo: 'diagnostico', porTema: [{ tema: 'Cultura', correctas: 1, total: 1 }], nota: 10 }), conId('99'))
    expect(res.status).toBe(404)
  })

  it('un resultado imposible (más correctas que preguntas) no se guarda', async () => {
    const res = await guardar(json({ tipo: 'practica', porTema: [{ tema: 'Cultura', correctas: 3, total: 2 }] }), conId('51'))
    expect(res.status).toBe(400)
    expect(servidor.guardarResultado).not.toHaveBeenCalled()
  })
})
