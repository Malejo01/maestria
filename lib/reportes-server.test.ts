import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * M6. Permisos del buzón: un docente no admin recibe 404 en /admin/reportes
 * (la página y su API), y un docente sólo ve los reportes de SUS grupos y SUS
 * tareas.
 */
const { getAdminViewer, getTeacherViewer, getOwnedClassroom, consultas } = vi.hoisted(() => ({
  getAdminViewer: vi.fn(),
  getTeacherViewer: vi.fn(),
  getOwnedClassroom: vi.fn(),
  consultas: [] as { texto: string; valores: unknown[] }[],
}))
let responder: (texto: string) => unknown = () => []

vi.mock('@/lib/auth-session', () => ({ getAdminViewer, getTeacherViewer }))
vi.mock('@/lib/classrooms-server', () => ({ getOwnedClassroom }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/components/admin/buzon-de-reportes', () => ({ BuzonDeReportes: () => null }))

import ReportesAdminPage from '@/app/admin/reportes/page'
import { GET as getBuzon } from '@/app/api/admin/reportes/route'
import { PATCH as patchReporte } from '@/app/api/admin/reportes/[id]/route'
import { GET as getDelGrupo } from '@/app/api/teacher/grupos/[id]/reportes/route'
import { avisosPendientes, cambiarEstadoDeReporte, guardarReporte, listarReportes, marcarAvisosVistos, reportesDelGrupo } from './reportes-server'

beforeEach(() => {
  consultas.length = 0
  responder = () => []
  getAdminViewer.mockReset()
  getTeacherViewer.mockReset()
  getOwnedClassroom.mockReset()
})

describe('/admin/reportes', () => {
  it('un docente no admin recibe 404 en la página', async () => {
    getAdminViewer.mockResolvedValue(null)
    await expect(ReportesAdminPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('y en la API, sin leer la base', async () => {
    getAdminViewer.mockResolvedValue(null)
    expect((await getBuzon(new Request('http://x/api/admin/reportes'))).status).toBe(404)
    expect(
      (await patchReporte(new Request('http://x', { method: 'PATCH', body: '{"estado":"visto"}' }), { params: Promise.resolve({ id: '1' }) })).status,
    ).toBe(404)
    expect(consultas).toHaveLength(0)
  })

  it('el admin ve la página y la lista', async () => {
    getAdminViewer.mockResolvedValue({ id: 'mauro', email: 'admin@x' })
    await expect(ReportesAdminPage()).resolves.toBeTruthy()
    responder = (t) => (t.includes('COUNT') ? [{ n: 9 }] : [])
    const res = await getBuzon(new Request('http://x/api/admin/reportes?estado=nuevo'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reportes: [], nuevos: 9 })
  })
})

describe('reportes del grupo para su docente', () => {
  it('otro docente recibe 404 y no se consulta ningún reporte', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'joaquin' })
    getOwnedClassroom.mockResolvedValue(null)
    const res = await getDelGrupo(new Request('http://x'), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(404)
    expect(consultas.some((c) => c.texto.includes('feedback_reports'))).toBe(false)
  })

  it('la consulta se limita al grupo y a los cuestionarios del docente, y no dice quién reportó', async () => {
    getOwnedClassroom.mockResolvedValue({ id: 1, teacher_id: 'irina' })
    responder = () => [
      {
        id: 6,
        created_at: '2026-11-20T15:00:00Z',
        status: 'nuevo',
        description: 'El ejercicio plantea un Verdadero o Falso pero el inciso es una pregunta.',
        pathname: '/aulas',
        question_id: 'q3',
        question_type: 'true_false',
        is_guest: false,
        role: 'ALUMNO',
        user_id: null,
        nombre: null,
        teacher_quiz_id: '41',
        assignment_id: '7',
        classroom_id: '1',
        question_index: '2',
        grupo: 'Grupo 4',
        cuestionario: 'Matemática - Mixto - 20/11/2026',
        preguntas: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3', type: 'true_false', question: '¿qué sucede…?' }],
      },
    ]
    const reportes = await reportesDelGrupo('irina', 1)
    const consulta = consultas.find((c) => c.texto.includes('feedback_reports'))!
    expect(consulta.texto).toContain('c.teacher_id = ?')
    expect(consulta.texto).toContain('q.user_id = ?')
    expect(consulta.texto).toContain('f.classroom_id = ?')
    expect(consulta.valores).toEqual(['irina', 'irina', 1])
    expect(reportes).toHaveLength(1)
    expect(reportes![0].pregunta).toMatchObject({ id: 'q3' })
    expect(reportes![0].quien).toEqual({ nombre: null, rol: null, invitado: false })
  })

  it('sin la 029: vacío, no un error', async () => {
    getOwnedClassroom.mockResolvedValue({ id: 1 })
    responder = () => {
      throw Object.assign(new Error('column f.classroom_id does not exist'), { code: '42703' })
    }
    expect(await reportesDelGrupo('irina', 1)).toEqual([])
  })
})

describe('guardar y cambiar estado, con la válvula de la 029', () => {
  const base = {
    userId: 'clara',
    isGuest: false,
    role: 'ALUMNO',
    description: 'No es una afirmación.',
    pathname: '/aulas',
    questionId: 'q3',
    questionType: 'true_false',
    userAgent: null,
  }

  it('con contexto, lo guarda en las columnas de la 029', async () => {
    responder = () => [{ id: 10 }]
    const id = await guardarReporte({ ...base, contexto: { teacherQuizId: 41, assignmentId: 7, classroomId: 1, questionIndex: 2 } })
    expect(id).toBe(10)
    expect(consultas[0].texto).toContain('teacher_quiz_id, assignment_id, classroom_id, question_index')
    expect(consultas[0].valores.slice(-4)).toEqual([41, 7, 1, 2])
  })

  it('sin la 029, guarda como antes', async () => {
    let vez = 0
    responder = () => {
      vez += 1
      if (vez === 1) throw Object.assign(new Error('no column'), { code: '42703' })
      return [{ id: 11 }]
    }
    const id = await guardarReporte({ ...base, contexto: { teacherQuizId: 41, assignmentId: null, classroomId: 1, questionIndex: 2 } })
    expect(id).toBe(11)
    expect(consultas[1].texto).not.toContain('teacher_quiz_id')
  })

  it('"visto" sin la 029 (ni la 030) se guarda como "revisado"', async () => {
    let vez = 0
    responder = () => {
      vez += 1
      // 1: con las columnas de la 030 → no existen; 2: 'visto' → CHECK de la 019.
      if (vez === 1) throw Object.assign(new Error('columna'), { code: '42703' })
      if (vez === 2) throw Object.assign(new Error('check'), { code: '23514' })
      return [{ id: 3 }]
    }
    expect(await cambiarEstadoDeReporte(3, 'visto')).toBe(true)
    expect(consultas[2].valores[0]).toBe('revisado')
  })
})

describe('N1 · el aviso a quien reportó (030)', () => {
  it('resolver guarda cuándo, el mensaje y quién lo firma, y deja el aviso pendiente', async () => {
    responder = () => [{ id: 6 }]
    expect(await cambiarEstadoDeReporte(6, 'resuelto', { mensaje: 'Ya la arreglé', respondidoPor: 'Mauro' })).toBe(true)
    expect(consultas).toHaveLength(1)
    expect(consultas[0].texto).toContain('resuelto_el = NOW()')
    expect(consultas[0].texto).toContain('aviso_visto_el = NULL')
    expect(consultas[0].valores).toEqual(['resuelto', 'Ya la arreglé', 'Mauro', 6])
  })

  it('volver a nuevo o visto limpia resuelto_el y aviso_visto_el', async () => {
    responder = () => [{ id: 6 }]
    await cambiarEstadoDeReporte(6, 'nuevo')
    expect(consultas[0].texto).toContain('resuelto_el = NULL')
    expect(consultas[0].texto).toContain('aviso_visto_el = NULL')
  })

  it('sin la 030, resolver cambia sólo el estado, como en M6', async () => {
    let vez = 0
    responder = () => {
      vez += 1
      if (vez === 1) throw Object.assign(new Error('columna'), { code: '42703' })
      return [{ id: 6 }]
    }
    expect(await cambiarEstadoDeReporte(6, 'resuelto', { mensaje: 'x' })).toBe(true)
    expect(consultas[1].texto).not.toContain('resuelto_el')
    expect(consultas[1].valores).toEqual(['resuelto', 6])
  })

  it('los avisos pendientes se piden sólo por el id del viewer', async () => {
    responder = () => [
      { id: 6, created_at: '2026-11-20T15:00:00.000Z', respuesta: null, respondido_por: 'Mauro', cuestionario: 'Matemática - Mixto - 20/11/2026' },
    ]
    const avisos = await avisosPendientes('guest_clarita')
    expect(consultas[0].valores).toEqual(['guest_clarita'])
    expect(consultas[0].texto).toContain("f.status = 'resuelto'")
    expect(consultas[0].texto).toContain('aviso_visto_el IS NULL')
    expect(avisos).toEqual([
      { id: 6, reportadoEl: '2026-11-20T15:00:00.000Z', cuestionario: 'Matemática - Mixto - 20/11/2026', respuesta: null, respondidoPor: 'Mauro' },
    ])
  })

  it('sin la 030, no hay avisos y no da error', async () => {
    responder = () => {
      throw Object.assign(new Error('columna'), { code: '42703' })
    }
    expect(await avisosPendientes('u1')).toEqual([])
    expect(await marcarAvisosVistos('u1', [1])).toBe(0)
  })

  it('"Entendido" sólo marca reportes del propio usuario', async () => {
    responder = () => [{ id: 6 }]
    expect(await marcarAvisosVistos('guest_clarita', [6, 9])).toBe(1)
    expect(consultas[0].texto).toContain('user_id = ?')
    expect(consultas[0].valores).toEqual([[6, 9], 'guest_clarita'])
  })

  it('el buzón dice si el aviso se vio, está pendiente o no corresponde', async () => {
    process.env.ADMIN_EMAILS = 'admin@x'
    const fila = {
      id: 1, created_at: '2026-11-20T15:00:00Z', status: 'resuelto', description: 'x', pathname: null, question_id: null, question_type: null,
      is_guest: false, role: 'ALUMNO', user_id: 'u', nombre: 'Ana', teacher_quiz_id: null, assignment_id: null, classroom_id: null,
      question_index: null, grupo: null, cuestionario: null, preguntas: null, email: 'ana@x', resuelto_el: '2026-11-22T00:00:00Z',
      aviso_visto_el: null, respuesta: 'Gracias',
    }
    responder = () => [
      fila,
      { ...fila, id: 2, aviso_visto_el: '2026-11-23T12:00:00Z' },
      { ...fila, id: 3, email: 'admin@x' },
      { ...fila, id: 4, user_id: null },
      { ...fila, id: 5, resuelto_el: null },
      { ...fila, id: 7, status: 'visto' },
    ]
    const lista = await listarReportes(null)
    expect(lista.map((r) => r.aviso?.estado ?? null)).toEqual(['pendiente', 'visto', 'delAdmin', 'sinQuien', 'sinMigracion', null])
    expect(lista[0].aviso?.respuesta).toBe('Gracias')
    delete process.env.ADMIN_EMAILS
  })
})
