import { describe, expect, it, vi } from 'vitest'

/** O12. El embudo del docente: en qué paso, desde cuándo, quién está trabado; y la página, sólo admin. */
const { getAdminViewer } = vi.hoisted(() => ({ getAdminViewer: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({ getAdminViewer }))
vi.mock('@/lib/db', () => ({ sql: vi.fn(async () => []) }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import EmbudoAdminPage from '@/app/admin/embudo/page'
import { conteoPorPaso, ordenarEmbudo, ubicarEnElEmbudo, type FechasDelDocente } from './embudo'

const AHORA = new Date('2026-11-22T12:00:00.000Z')
const vacias = { registro: null, materia: null, grupo: null, tarea: null, primerAlumno: null, cincoAlumnos: null }
const docente = (id: string, fechas: Partial<FechasDelDocente['fechas']>): FechasDelDocente => ({ id, nombre: id, email: `${id}@x`, fechas: { ...vacias, ...fechas } })

describe('ubicarEnElEmbudo', () => {
  it('el último paso alcanzado y hace cuántos días', () => {
    const d = ubicarEnElEmbudo(docente('ana', { registro: '2026-11-10T00:00:00Z', materia: '2026-11-15T12:00:00Z' }), AHORA)
    expect(d).toMatchObject({ paso: 'materia', indice: 1, dias: 7, trabado: true, terminado: false })
  })

  it('no saltea pasos: con tarea pero sin grupo, se queda en materia', () => {
    const d = ubicarEnElEmbudo(docente('beto', { registro: '2026-11-21T00:00:00Z', materia: '2026-11-21T01:00:00Z', tarea: '2026-11-21T02:00:00Z' }), AHORA)
    expect(d.paso).toBe('materia')
  })

  it('3 días o menos no es trabado; el que llegó a 5 alumnos nunca', () => {
    expect(ubicarEnElEmbudo(docente('c', { registro: '2026-11-19T12:00:00Z' }), AHORA).trabado).toBe(false)
    const todo = { registro: '2026-01-01T00:00:00Z', materia: '2026-01-02T00:00:00Z', grupo: '2026-01-03T00:00:00Z', tarea: '2026-01-04T00:00:00Z', primerAlumno: '2026-01-05T00:00:00Z', cincoAlumnos: '2026-01-06T00:00:00Z' }
    expect(ubicarEnElEmbudo(docente('d', todo), AHORA)).toMatchObject({ terminado: true, trabado: false })
  })
})

describe('ordenar y contar', () => {
  it('los trabados arriba, los de más días primero', () => {
    const lista = ordenarEmbudo([
      ubicarEnElEmbudo(docente('nuevo', { registro: '2026-11-22T00:00:00Z' }), AHORA),
      ubicarEnElEmbudo(docente('poco', { registro: '2026-11-10T00:00:00Z' }), AHORA),
      ubicarEnElEmbudo(docente('mucho', { registro: '2026-10-01T00:00:00Z' }), AHORA),
    ])
    expect(lista.map((d) => d.id)).toEqual(['mucho', 'poco', 'nuevo'])
  })

  it('cuántos alcanzaron cada paso', () => {
    const lista = [
      ubicarEnElEmbudo(docente('a', { registro: '2026-11-01T00:00:00Z', materia: '2026-11-02T00:00:00Z', grupo: '2026-11-03T00:00:00Z' }), AHORA),
      ubicarEnElEmbudo(docente('b', { registro: '2026-11-01T00:00:00Z' }), AHORA),
    ]
    expect(conteoPorPaso(lista)).toEqual({ registro: 2, materia: 1, grupo: 1, tarea: 0, primerAlumno: 0, cincoAlumnos: 0 })
  })
})

describe('/admin/embudo', () => {
  it('un docente no admin recibe 404', async () => {
    getAdminViewer.mockResolvedValue(null)
    await expect(EmbudoAdminPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
