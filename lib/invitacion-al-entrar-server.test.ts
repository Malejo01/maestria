import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock, consultas, estado } = vi.hoisted(() => {
  const consultas: string[] = []
  const estado = { falta027: false, falta028: false }

  async function ejecutar(texto: string): Promise<unknown[]> {
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
    if (texto.includes('SELECT solo_user_id') && estado.falta028) {
      throw Object.assign(new Error('column "solo_user_id" does not exist'), { code: '42703' })
    }
    return []
  }

  // Como el driver: la consulta no corre hasta que se la espera, o hasta que
  // entra en una transacción, que corre todas o ninguna.
  const sqlMock = Object.assign(
    vi.fn((strings: TemplateStringsArray) => {
      const texto = strings.join('?')
      return {
        texto,
        then(ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) {
          consultas.push(texto)
          return ejecutar(texto).then(ok, mal)
        },
      }
    }),
    {
      transaction: async (lista: { texto: string }[]) => {
        const resultados = []
        for (const consulta of lista) resultados.push(await ejecutar(consulta.texto))
        consultas.push(...lista.map((c) => c.texto))
        return resultados
      },
    },
  )
  return { sqlMock, consultas, estado }
})
vi.mock('@/lib/db', () => ({ sql: sqlMock }))

import { invitacionPorNombre, pendientesDelGrupo, usarInvitacion } from './invitacion-al-entrar-server'

beforeEach(() => {
  consultas.length = 0
  estado.falta027 = false
  estado.falta028 = false
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
    expect(escrituras.at(-2)).toContain('UPDATE classroom_members')
    expect(escrituras.at(-1)).toContain('DELETE FROM classroom_invitations')
  })

  it('sin la 027 no toca nada: la invitación queda y la fusión al leer sigue como antes', async () => {
    estado.falta027 = true
    expect(await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })).toBe(false)
    expect(consultas.some((c) => c.includes('DELETE FROM classroom_invitations'))).toBe(false)
    expect(consultas.some((c) => c.includes('UPDATE classroom_members'))).toBe(false)
  })
})

describe('L0 · el "Soy yo" pasa lo individual al alumno', () => {
  it('las asignaciones y los diagnósticos de la invitación pasan a solo_user_id, antes de borrarla', async () => {
    expect(await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })).toBe(true)
    const escrituras = consultas.filter((c) => /UPDATE|DELETE/.test(c))
    const asignaciones = escrituras.findIndex((c) => c.includes('UPDATE classroom_assignments SET solo_user_id'))
    const diagnosticos = escrituras.findIndex((c) => c.includes('UPDATE diagnosticos SET user_id'))
    const borrado = escrituras.findIndex((c) => c.includes('DELETE FROM classroom_invitations'))
    expect(asignaciones).toBeGreaterThan(-1)
    expect(escrituras[asignaciones]).toContain('solo_invitacion_id = NULL')
    expect(escrituras[asignaciones]).toContain('WHERE solo_invitacion_id = ?')
    expect(diagnosticos).toBeGreaterThan(-1)
    expect(asignaciones).toBeLessThan(borrado)
    expect(diagnosticos).toBeLessThan(borrado)
  })

  it('todo va en la misma transacción que la ficha', async () => {
    const transaccion = vi.spyOn(sqlMock, 'transaction')
    await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })
    const textos = transaccion.mock.calls[0][0].map((c) => c.texto)
    expect(textos[0]).toContain('UPDATE fichas_alumno')
    expect(textos.some((t) => t.includes('UPDATE classroom_assignments'))).toBe(true)
    expect(textos.at(-1)).toContain('DELETE FROM classroom_invitations')
    transaccion.mockRestore()
  })

  it('sin la 028 la invitación se usa igual, sin tocar asignaciones', async () => {
    estado.falta028 = true
    expect(await usarInvitacion({ classroomId: 1, invitacionId: 5, userId: 'guest_x' })).toBe(true)
    expect(consultas.some((c) => c.includes('UPDATE classroom_assignments'))).toBe(false)
    expect(consultas.some((c) => c.includes('DELETE FROM classroom_invitations'))).toBe(true)
  })
})
