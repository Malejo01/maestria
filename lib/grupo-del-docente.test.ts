import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pestanaDeLaUrl, rutaDePestana } from './grupo-del-docente'

const { getTeacherViewer, getOwnedClassroom } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  getOwnedClassroom: vi.fn(),
}))
vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/classrooms-server', () => ({ getOwnedClassroom }))
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('@/components/docente/grupo/pagina-del-grupo', () => ({ PaginaDelGrupo: () => null }))
vi.mock('@/lib/etiqueta-materia-server', () => ({ etiquetaDeMateriaDe: async () => 'Matemática · 3.º Sec.' }))

import { grupoDelDocente } from './grupo-del-docente-server'
import GrupoPage from '@/app/(app)/teacher/grupos/[id]/page'

const grupoDeIrina = {
  id: 1,
  teacher_id: 'irina',
  teacher_program_id: 13,
  name: '3° A turno mañana',
  join_code: 'ABC123',
  status: 'open',
  created_at: '2026-11-01',
  subject_name: 'Matemática',
  nivel: 'Secundario',
  grado: '3°',
  icon_name: 'calculator',
  color_name: 'blue',
}

beforeEach(() => {
  getTeacherViewer.mockReset()
  getOwnedClassroom.mockReset()
  notFound.mockClear()
  // getOwnedClassroom filtra por docente en el SQL; acá, lo mismo a mano.
  getOwnedClassroom.mockImplementation(async (id: number, docente: string) =>
    id === 1 && docente === 'irina' ? grupoDeIrina : null,
  )
})

describe('permisos de la página del grupo (M3)', () => {
  it('la dueña ve su grupo', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'irina', role: 'DOCENTE' })
    expect(await grupoDelDocente('1')).toEqual(grupoDeIrina)
    await expect(GrupoPage({ params: Promise.resolve({ id: '1' }), searchParams: Promise.resolve({}) })).resolves.toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('otro docente recibe 404', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'joaquin', role: 'DOCENTE' })
    expect(await grupoDelDocente('1')).toBeNull()
    await expect(GrupoPage({ params: Promise.resolve({ id: '1' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('sin docente (alumno, invitado, sin sesión) también 404', async () => {
    getTeacherViewer.mockResolvedValue(null)
    await expect(GrupoPage({ params: Promise.resolve({ id: '1' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getOwnedClassroom).not.toHaveBeenCalled()
  })

  it('un id que no es un número no llega a la base', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'irina', role: 'DOCENTE' })
    expect(await grupoDelDocente('abc')).toBeNull()
    expect(await grupoDelDocente('-3')).toBeNull()
    expect(getOwnedClassroom).not.toHaveBeenCalled()
  })
})

describe('pestañas en la URL', () => {
  it('lee ?pestaña= y cae en Alumnos con cualquier otra cosa', () => {
    expect(pestanaDeLaUrl('temas')).toBe('temas')
    expect(pestanaDeLaUrl(['diagnosticos'])).toBe('diagnosticos')
    expect(pestanaDeLaUrl('cualquiera')).toBe('alumnos')
    expect(pestanaDeLaUrl(undefined)).toBe('alumnos')
  })

  it('arma el link de cada pestaña conservando el resto de la consulta', () => {
    expect(rutaDePestana(5, 'alumnos')).toBe('/teacher/grupos/5')
    expect(rutaDePestana(5, 'tareas')).toBe('/teacher/grupos/5?pesta%C3%B1a=tareas')
    const consulta = new URLSearchParams('orden=promedio&dir=desc&nuevo=1&pestaña=temas')
    expect(rutaDePestana(5, 'alumnos', consulta)).toBe('/teacher/grupos/5?orden=promedio&dir=desc')
  })
})
