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
import { cambiarEstadoDeReporte, guardarReporte, reportesDelGrupo } from './reportes-server'

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

  it('"visto" sin la 029 se guarda como "revisado"', async () => {
    let vez = 0
    responder = () => {
      vez += 1
      if (vez === 1) throw Object.assign(new Error('check'), { code: '23514' })
      return [{ id: 3 }]
    }
    expect(await cambiarEstadoDeReporte(3, 'visto')).toBe(true)
    expect(consultas[1].valores[0]).toBe('revisado')
  })
})
