import { describe, expect, it } from 'vitest'
import { destinatarioDeFila, diagnosticoEsDe, esDelGrupo, visibleParaAlumno } from './destinatario'

describe('L0 · quién ve una asignación', () => {
  it('la del grupo la ve cualquier alumno del grupo', () => {
    const delGrupo = { soloUserId: null, soloInvitacionId: null }
    expect(esDelGrupo(delGrupo)).toBe(true)
    expect(visibleParaAlumno(delGrupo, 'ana')).toBe(true)
    expect(visibleParaAlumno(delGrupo, 'bruno')).toBe(true)
  })

  it('la individual propia la ve su destinatario', () => {
    expect(visibleParaAlumno({ soloUserId: 'ana', soloInvitacionId: null }, 'ana')).toBe(true)
  })

  it('la individual ajena no la ve otro alumno del mismo grupo', () => {
    const deAna = { soloUserId: 'ana', soloInvitacionId: null }
    expect(esDelGrupo(deAna)).toBe(false)
    expect(visibleParaAlumno(deAna, 'bruno')).toBe(false)
  })

  it('la de una invitación sin reclamar no la ve nadie', () => {
    const deInvitacion = { soloUserId: null, soloInvitacionId: 7 }
    expect(esDelGrupo(deInvitacion)).toBe(false)
    expect(visibleParaAlumno(deInvitacion, 'ana')).toBe(false)
    expect(visibleParaAlumno(deInvitacion, 'bruno')).toBe(false)
  })

  it('sin la 028 la fila no trae las columnas y todo es del grupo', () => {
    expect(destinatarioDeFila({ id: 1 })).toEqual({ soloUserId: null, soloInvitacionId: null })
    expect(visibleParaAlumno(destinatarioDeFila({ id: 1 }), 'ana')).toBe(true)
  })

  it('lee las columnas como las devuelve to_jsonb ->> (texto)', () => {
    expect(destinatarioDeFila({ solo_user_id: 'ana', solo_invitacion_id: null })).toEqual({ soloUserId: 'ana', soloInvitacionId: null })
    expect(destinatarioDeFila({ solo_user_id: null, solo_invitacion_id: '7' })).toEqual({ soloUserId: null, soloInvitacionId: 7 })
  })
})

describe('L0 · qué diagnósticos lista la ficha', () => {
  const ana = { userId: 'ana', invitacionId: null }
  const anaQueEntroPorInvitacion = { userId: 'ana', invitacionId: 7 }
  const invitacion = { userId: null, invitacionId: 7 }

  it('la ficha de A no lista el diagnóstico armado para B', () => {
    expect(diagnosticoEsDe({ userId: 'bruno' }, ana)).toBe(false)
    expect(diagnosticoEsDe({ userId: 'ana' }, ana)).toBe(true)
  })

  it('el de la invitación se ve en la ficha de la invitación y en la de quien entró con ella', () => {
    expect(diagnosticoEsDe({ invitacionId: 7 }, invitacion)).toBe(true)
    expect(diagnosticoEsDe({ invitacionId: 7 }, anaQueEntroPorInvitacion)).toBe(true)
    expect(diagnosticoEsDe({ invitacionId: 8 }, invitacion)).toBe(false)
  })

  it('el del grupo no aparece en ninguna ficha', () => {
    expect(diagnosticoEsDe(null, ana)).toBe(false)
    expect(diagnosticoEsDe(null, invitacion)).toBe(false)
  })
})
