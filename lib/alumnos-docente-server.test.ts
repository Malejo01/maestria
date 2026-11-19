/**
 * J1 — quitar y volver a sumar, contra un doble de la base que guarda filas.
 *
 * El doble reconoce las consultas por su texto y las resuelve sobre
 * `db.miembros`: así el test mira el efecto (quién ocupa lugar después de
 * quitar), no la forma del SQL. Con `db.sin027` cualquier consulta que nombre
 * `removed_at` falla con 42703, como una base donde la 027 no corrió.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Miembro {
  id: number
  grupoId: number
  userId: string
  nombre: string
  status: 'active' | 'removed'
  removedAt: string | null
  updatedAt: string
}

const { db, sqlMock } = vi.hoisted(() => {
  const db = {
    sin027: false,
    teacherId: 'docente',
    miembros: [] as Miembro[],
    invitaciones: [] as { id: number; grupoId: number; nombre: string }[],
    intentos: [] as { userId: string }[],
  }

  const columnaInexistente = () => Object.assign(new Error('column "removed_at" does not exist'), { code: '42703' })
  const grupo = { grupo_nombre: 'Análisis I', materia_id: 10, subject_name: 'Análisis I', join_code: 'ABC234' }

  const sqlMock = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')
    if (db.sin027 && text.includes('removed_at')) throw columnaInexistente()

    if (text.includes('UPDATE classroom_members m') && text.includes("SET status = 'removed'")) {
      const [, userId] = values as [string, string]
      const tocadas = db.miembros.filter((m) => m.userId === userId && m.status === 'active')
      for (const m of tocadas) {
        m.status = 'removed'
        m.updatedAt = 'ahora'
        if (text.includes('removed_at = NOW()')) m.removedAt = 'ahora'
      }
      return tocadas.map((m) => ({ id: m.id }))
    }

    if (text.includes('UPDATE classroom_members m') && text.includes("SET status = 'active'")) {
      const [, userId] = values as [string, string]
      const tocadas = db.miembros.filter((m) => m.userId === userId && m.status === 'removed')
      for (const m of tocadas) {
        m.status = 'active'
        if (text.includes('removed_at = NULL')) m.removedAt = null
      }
      return tocadas.map((m) => ({ id: m.id }))
    }

    if (text.includes('FROM classroom_members m') && text.includes("m.status = 'active'")) {
      return db.miembros
        .filter((m) => m.status === 'active')
        .map((m) => ({
          user_id: m.userId,
          display_name: m.nombre,
          contexto: null,
          joined_at: '2026-11-01T00:00:00Z',
          grupo_id: m.grupoId,
          is_guest: true,
          ...grupo,
        }))
    }

    if (text.includes('FROM classroom_members m') && text.includes("m.status = 'removed'")) {
      return db.miembros
        .filter((m) => m.status === 'removed')
        .map((m) => ({
          user_id: m.userId,
          display_name: m.nombre,
          grupo_id: m.grupoId,
          quitado_el: '2026-11-19T12:00:00Z',
          ...grupo,
        }))
    }

    if (text.includes('FROM classroom_invitations i')) {
      return db.invitaciones.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        contexto: null,
        created_at: '2026-11-01T00:00:00Z',
        grupo_id: i.grupoId,
        ...grupo,
      }))
    }

    if (text.includes('SELECT DISTINCT att.user_id')) {
      const pedidos = values[1] as string[]
      return [...new Set(db.intentos.map((i) => i.userId))].filter((u) => pedidos.includes(u)).map((u) => ({ user_id: u }))
    }

    throw new Error(`Consulta no reconocida por el doble: ${text}`)
  }

  return { db, sqlMock }
})

vi.mock('@/lib/db', () => ({ sql: sqlMock }))

import {
  contarAlumnosDelDocente,
  filtrarSinRespuestas,
  quitarAlumno,
  volverASumarAlumno,
} from './alumnos-docente-server'

function sembrar() {
  db.miembros = [
    { id: 1, grupoId: 1, userId: 'ana', nombre: 'Ana', status: 'active', removedAt: null, updatedAt: 'antes' },
    { id: 2, grupoId: 1, userId: 'beto', nombre: 'Beto Gómez', status: 'active', removedAt: null, updatedAt: 'antes' },
    { id: 3, grupoId: 2, userId: 'beto', nombre: 'Beto Gómez', status: 'active', removedAt: null, updatedAt: 'antes' },
    { id: 4, grupoId: 1, userId: 'cami', nombre: 'Cami', status: 'active', removedAt: null, updatedAt: 'antes' },
  ]
  // Beto entró por una invitación con su nombre.
  db.invitaciones = [{ id: 7, grupoId: 1, nombre: 'beto gomez' }]
  db.intentos = [{ userId: 'ana' }]
}

beforeEach(() => {
  db.sin027 = false
  sembrar()
})

describe('quitar libera el lugar del plan', () => {
  it('con la 027: el quitado deja de contar en el cupo, y su invitación tampoco', async () => {
    expect(await contarAlumnosDelDocente('docente')).toBe(3)
    expect(await quitarAlumno('docente', 'beto')).toBe(2) // de los dos grupos
    expect(await contarAlumnosDelDocente('docente')).toBe(2)
    expect(db.miembros.filter((m) => m.userId === 'beto').every((m) => m.removedAt === 'ahora')).toBe(true)
  })

  it('sin la 027 (no existe removed_at): quita igual, con status y updated_at', async () => {
    db.sin027 = true
    expect(await quitarAlumno('docente', 'beto')).toBe(2)
    expect(db.miembros.find((m) => m.id === 2)).toMatchObject({ status: 'removed', removedAt: null, updatedAt: 'ahora' })
    expect(await contarAlumnosDelDocente('docente')).toBe(2)
  })

  it('no se borra nada: la fila queda, con otro estado', async () => {
    await quitarAlumno('docente', 'cami')
    expect(db.miembros).toHaveLength(4)
  })
})

describe('volver a sumar', () => {
  it('vuelve a activo en sus grupos, vuelve a ocupar lugar y se limpia removed_at', async () => {
    await quitarAlumno('docente', 'beto')
    expect(await volverASumarAlumno('docente', 'beto')).toBe(2)
    expect(db.miembros.filter((m) => m.userId === 'beto').map((m) => [m.status, m.removedAt])).toEqual([
      ['active', null],
      ['active', null],
    ])
    expect(await contarAlumnosDelDocente('docente')).toBe(3)
  })

  it('sin la 027, también', async () => {
    db.sin027 = true
    await quitarAlumno('docente', 'cami')
    expect(await volverASumarAlumno('docente', 'cami')).toBe(1)
    expect(await contarAlumnosDelDocente('docente')).toBe(3)
  })

  it('a quien no estaba quitado no le hace nada', async () => {
    expect(await volverASumarAlumno('docente', 'ana')).toBe(0)
  })
})

describe('el lote de los que nunca respondieron', () => {
  it('el servidor vuelve a mirar: quien respondió entre que se vio la lista y se confirmó, se queda', async () => {
    expect(await filtrarSinRespuestas('docente', ['ana', 'beto', 'cami'])).toEqual(['beto', 'cami'])
  })
})
