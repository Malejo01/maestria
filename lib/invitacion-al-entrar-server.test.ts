import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock, consultas, estado } = vi.hoisted(() => {
  const consultas: string[] = []
  const estado = { falta027: false }
  const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
    const texto = strings.join('?')
    consultas.push(texto)
    if (texto.includes('FROM classroom_invitations i JOIN classrooms c')) {
      return [{ id: 5, nombre: 'Sofía Ayarde', contexto: 'Rinde en diciembre', teacher_id: 'docente' }]
    }
    if (texto.includes('SELECT id, nombre FROM classroom_invitations')) {
      return [
        { id: 5, nombre: 'Sofía Ayarde' },
        { id: 6, nombre: 'Tomás Villa' },
      ]
    }
    if (texto.includes('SELECT display_name FROM classroom_members')) return [{ display_name: 'villa tomas' }]
    if (texto.includes('UPDATE fichas_alumno') && estado.falta027) {
      throw Object.assign(new Error('relation "fichas_alumno" does not exist'), { code: '42P01' })
    }
    return []
  })
  return { sqlMock, consultas, estado }
})
vi.mock('@/lib/db', () => ({ sql: sqlMock }))

import { invitacionPorNombre, pendientesDelGrupo, usarInvitacion } from './invitacion-al-entrar-server'

beforeEach(() => {
  consultas.length = 0
  estado.falta027 = false
})

describe('K5 · la invitación se usa al entrar', () => {
  it('pendientes: las que todavía no tienen un miembro con ese nombre', async () => {
    expect(await pendientesDelGrupo(1)).toEqual([{ id: 5, nombre: 'Sofía Ayarde' }])
  })

  it('un nombre escrito corresponde a una invitación sólo si hay exactamente una igual', () => {
    const pendientes = [
      { id: 5, nombre: 'Sofía Ayarde' },
      { id: 7, nombre: 'Juan Pérez' },
      { id: 8, nombre: 'juan perez' },
    ]
    expect(invitacionPorNombre(pendientes, 'ayarde sofia')?.id).toBe(5)
    expect(invitacionPorNombre(pendientes, 'Juan Pérez')).toBeNull()
    expect(invitacionPorNombre(pendientes, '')).toBeNull()
  })

  it('pasa la ficha y los impresos al alumno, le pone el nombre y borra la invitación al final', async () => {
    expect(await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })).toBe(true)
    const escrituras = consultas.filter((c) => /UPDATE|DELETE/.test(c))
    expect(escrituras[0]).toContain('UPDATE fichas_alumno SET user_id')
    expect(escrituras[1]).toContain('UPDATE diagnostico_resultados_impresos')
    expect(escrituras[2]).toContain('UPDATE classroom_members')
    expect(escrituras[3]).toContain('DELETE FROM classroom_invitations')
  })

  it('sin la 027 no toca nada: la invitación queda y la fusión al leer sigue como antes', async () => {
    estado.falta027 = true
    expect(await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })).toBe(false)
    expect(consultas.some((c) => c.includes('DELETE FROM classroom_invitations'))).toBe(false)
    expect(consultas.some((c) => c.includes('UPDATE classroom_members'))).toBe(false)
  })
})
