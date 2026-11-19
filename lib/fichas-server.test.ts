/**
 * J2 — la ficha guarda y vuelve a cargar cada campo, pasa de la invitación al
 * alumno, migra el contexto viejo y respeta la válvula. Contra un doble de la
 * base que guarda las filas de `fichas_alumno` y de las invitaciones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, sqlMock, leerMiembros, leerInvitaciones } = vi.hoisted(() => {
  const db = {
    sin027: false,
    fichas: [] as Record<string, unknown>[],
    invitaciones: [] as { id: number; nombre: string; contexto: string | null; grupoId: number }[],
    miembros: [] as { userId: string; nombre: string; contexto: string | null; grupoId: number }[],
    impresos: [] as { userId: string | null; invitationId: number | null }[],
  }
  const COLUMNAS = [
    'edad',
    'anio_cursa',
    'institucion',
    'orientacion',
    'materia_id',
    'fecha_examen',
    'como_evalua',
    'temas_dificiles',
    'observaciones',
    'contacto',
    'responsable',
  ]
  const faltaTabla = () => Object.assign(new Error('relation "fichas_alumno" does not exist'), { code: '42P01' })

  const sqlMock = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')

    if (text.includes('FROM teacher_programs')) {
      return [
        {
          id: 4,
          subject_name: 'Análisis I',
          units: [{ id: 'u1', name: 'Unidad 1', topics: [{ id: 't1', name: 'Límites' }, { id: 't2', name: 'Derivadas' }] }],
        },
      ]
    }

    if (db.sin027 && /fichas_alumno|diagnostico_resultados_impresos/.test(text)) throw faltaTabla()

    if (text.includes('SELECT * FROM fichas_alumno') && text.includes('user_id =')) {
      return db.fichas.filter((f) => f.user_id === values[1])
    }
    if (text.includes('SELECT * FROM fichas_alumno') && text.includes('invitation_id =')) {
      return db.fichas.filter((f) => f.invitation_id === values[1])
    }

    if (text.includes('INSERT INTO fichas_alumno')) {
      const porInvitacion = text.includes('(teacher_id, invitation_id')
      const [teacherId, clave, ...resto] = values
      const fila: Record<string, unknown> = { teacher_id: teacherId, user_id: null, invitation_id: null }
      fila[porInvitacion ? 'invitation_id' : 'user_id'] = clave
      COLUMNAS.forEach((col, i) => (fila[col] = col === 'temas_dificiles' ? JSON.parse(String(resto[i])) : resto[i]))
      const existente = db.fichas.find((f) => (porInvitacion ? f.invitation_id === clave : f.user_id === clave))
      if (existente) Object.assign(existente, { ...fila, user_id: existente.user_id, invitation_id: existente.invitation_id })
      else db.fichas.push(fila)
      return []
    }

    if (text.includes('UPDATE fichas_alumno SET user_id')) {
      const [userId, , invitacionId, , userIdOtra] = values
      if (db.fichas.some((f) => f.user_id === userIdOtra)) return []
      for (const f of db.fichas) if (f.invitation_id === invitacionId) Object.assign(f, { user_id: userId, invitation_id: null })
      return []
    }

    if (text.includes('UPDATE diagnostico_resultados_impresos')) {
      const [userId, invitacionId] = values
      for (const r of db.impresos) if (r.invitationId === invitacionId) Object.assign(r, { userId, invitationId: null })
      return []
    }

    if (text.includes('DELETE FROM classroom_invitations')) {
      const id = values[1]
      db.invitaciones = db.invitaciones.filter((i) => i.id !== id)
      // ON DELETE CASCADE
      db.fichas = db.fichas.filter((f) => f.invitation_id !== id)
      return []
    }

    if (text.includes('UPDATE classroom_members m SET display_name')) {
      const [nombre, , userId] = values
      for (const m of db.miembros) if (m.userId === userId) m.nombre = String(nombre)
      return []
    }

    if (text.includes('UPDATE classroom_invitations i SET nombre')) {
      const [nombre, , id] = values
      for (const i of db.invitaciones) if (i.id === id) i.nombre = String(nombre)
      return []
    }

    throw new Error(`Consulta no reconocida por el doble: ${text}`)
  }

  const comun = { grupoNombre: 'Análisis', materia: 'Análisis I', materiaId: 4 }
  const leerMiembros = vi.fn(async () =>
    db.miembros.map((m) => ({ ...m, ...comun, esInvitadoSinCuenta: true, seSumoEl: '2026-11-01T00:00:00Z' })),
  )
  const leerInvitaciones = vi.fn(async () =>
    db.invitaciones.map((i) => ({ ...i, ...comun, codigo: 'ABC234', creadaEl: '2026-11-01T00:00:00Z' })),
  )
  return { db, sqlMock, leerMiembros, leerInvitaciones }
})

vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/alumnos-docente-server', () => ({ leerMiembros, leerInvitaciones }))

import { guardarFicha, leerFicha, leerResumenDeFichas } from './fichas-server'
import type { DatosFicha } from './fichas'

const COMPLETA: DatosFicha = {
  edad: 16,
  anioCursa: '5to año',
  institucion: 'Colegio Belgrano',
  orientacion: 'Técnica en electrónica',
  materiaId: 4,
  fechaExamen: '2026-12-12',
  comoEvalua: '4 ejercicios de desarrollo, sin calculadora',
  temasDificiles: ['t2'],
  observaciones: 'Viene de recursar',
  contacto: '387 555 0000',
  responsable: 'Laura (mamá)',
}

beforeEach(() => {
  db.sin027 = false
  db.fichas = []
  db.invitaciones = [{ id: 7, nombre: 'Sofía Ayarde', contexto: 'Análisis I · rinde el 12/12', grupoId: 1 }]
  db.miembros = []
  db.impresos = []
})

describe('guarda y vuelve a cargar cada campo', () => {
  it('para una invitación (todavía no entró)', async () => {
    expect(await guardarFicha('docente', { invitacionId: 7 }, 'Sofía Ayarde', COMPLETA)).toBe(true)
    const leida = await leerFicha('docente', { invitacionId: 7 })
    expect(leida).toMatchObject({ disponible: true, origen: 'ficha', nombre: 'Sofía Ayarde', ficha: COMPLETA })
  })

  it('para un alumno que ya entró', async () => {
    db.invitaciones = []
    db.miembros = [{ userId: 'u1', nombre: 'Tomás', contexto: null, grupoId: 1 }]
    await guardarFicha('docente', { userId: 'u1' }, 'Tomás Villa', COMPLETA)
    const leida = await leerFicha('docente', { userId: 'u1' })
    expect(leida).toMatchObject({ nombre: 'Tomás Villa', ficha: COMPLETA, origen: 'ficha' })
  })

  it('un tema que no es de la materia elegida no se guarda', async () => {
    await guardarFicha('docente', { invitacionId: 7 }, 'Sofía', { ...COMPLETA, temasDificiles: ['t2', 'de-otra'] })
    expect((await leerFicha('docente', { invitacionId: 7 }))?.ficha.temasDificiles).toEqual(['t2'])
  })
})

describe('de invitación a alumno', () => {
  it('cuando entra con el mismo nombre, ve la ficha que se armó antes', async () => {
    await guardarFicha('docente', { invitacionId: 7 }, 'Sofía Ayarde', COMPLETA)
    db.miembros = [{ userId: 'u9', nombre: 'sofia ayarde', contexto: null, grupoId: 1 }]

    const leida = await leerFicha('docente', { userId: 'u9' })
    expect(leida).toMatchObject({ origen: 'invitacion', ficha: COMPLETA })
  })

  it('al guardarla desde el alumno pasa a ser suya, y la invitación usada se va (con sus impresos)', async () => {
    await guardarFicha('docente', { invitacionId: 7 }, 'Sofía Ayarde', COMPLETA)
    db.impresos = [{ userId: null, invitationId: 7 }]
    db.miembros = [{ userId: 'u9', nombre: 'ayarde sofia', contexto: null, grupoId: 1 }]

    await guardarFicha('docente', { userId: 'u9' }, 'Sofía Ayarde', { ...COMPLETA, observaciones: 'Ya entró' })

    expect(db.fichas).toHaveLength(1)
    expect(db.fichas[0]).toMatchObject({ user_id: 'u9', invitation_id: null, observaciones: 'Ya entró' })
    expect(db.invitaciones).toEqual([])
    expect(db.impresos).toEqual([{ userId: 'u9', invitationId: null }])
    // Y el nombre que había escrito el alumno queda corregido.
    expect(db.miembros[0].nombre).toBe('Sofía Ayarde')
    expect((await leerFicha('docente', { userId: 'u9' }))?.origen).toBe('ficha')
  })
})

describe('la migración del contexto', () => {
  it('sin ficha, el "Qué prepara" viejo aparece en Observaciones', async () => {
    db.invitaciones = []
    db.miembros = [{ userId: 'u1', nombre: 'Tomás', contexto: 'Ingreso · marzo', grupoId: 1 }]
    const leida = await leerFicha('docente', { userId: 'u1' })
    expect(leida).toMatchObject({ origen: 'contexto', ficha: { observaciones: 'Ingreso · marzo' } })
  })

  it('el de la invitación también, y la materia del grupo viene elegida', async () => {
    const leida = await leerFicha('docente', { invitacionId: 7 })
    expect(leida?.ficha).toMatchObject({ observaciones: 'Análisis I · rinde el 12/12', materiaId: 4 })
  })
})

describe('la válvula: sin la 027', () => {
  it('la ficha no está disponible y no tira', async () => {
    db.sin027 = true
    expect(await leerFicha('docente', { invitacionId: 7 })).toMatchObject({ disponible: false })
    const resumen = await leerResumenDeFichas('docente')
    expect(resumen.porAlumno.size + resumen.porInvitacion.size).toBe(0)
  })

  it('quien no es del docente: null', async () => {
    expect(await leerFicha('docente', { invitacionId: 99 })).toBeNull()
    expect(await guardarFicha('docente', { userId: 'nadie' }, 'X', COMPLETA)).toBe(false)
  })
})
