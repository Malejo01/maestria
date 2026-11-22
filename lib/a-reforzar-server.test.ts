import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O2. La regla automática en el servidor y el PATCH del docente: permisos,
 * válvula de la 031, y que un problema nunca tumbe el guardado del intento.
 */
const { getTeacherViewer, getOwnedClassroom, consultas } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  getOwnedClassroom: vi.fn(),
  consultas: [] as { texto: string; valores: unknown[] }[],
}))
let responder: (texto: string, valores: unknown[]) => unknown = () => []

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/classrooms-server', () => ({ getOwnedClassroom }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto, valores))
  },
}))

import { PATCH } from '@/app/api/teacher/classrooms/[id]/students/[userId]/route'
import { marcarTemaDelAlumno, resolverPorAciertos } from './a-reforzar-server'

const TEMA = 'Suma y resta de fracciones de distinto denominador'
const INTENTO = [TEMA, 'Multiplicación y división de fracciones']

beforeEach(() => {
  consultas.length = 0
  responder = () => []
  getTeacherViewer.mockReset()
  getOwnedClassroom.mockReset()
})

describe('resolverPorAciertos', () => {
  const pendiente = { id: 7, subject: 'Matemática', topic_name: TEMA, created_at: '2026-11-20T15:00:00Z' }
  const acierto = (i: number) => ({
    subject: 'Matemática', topics: INTENTO, started_at: '2026-11-21T10:00:00Z', completed_at: '2026-11-21T10:20:00Z',
    topic_name: TEMA, is_correct: true, question_index: i,
  })

  it('con 3 aciertos seguidos marca el tema como superado por "auto"', async () => {
    responder = (t) => (t.includes('FROM student_misconceptions') ? [pendiente] : t.includes('FROM quiz_attempts') ? [acierto(0), acierto(1), acierto(2)] : [])
    expect(await resolverPorAciertos('ana')).toEqual([7])
    const update = consultas.find((c) => c.texto.startsWith(' UPDATE') || c.texto.includes('UPDATE student_misconceptions'))
    expect(update?.texto).toContain('resolved_by = ?')
    expect(update?.valores).toEqual(['auto', 'ana', [7]])
  })

  it('sin la 031 marca sólo resolved', async () => {
    responder = (t) => {
      if (t.includes('FROM student_misconceptions')) return [pendiente]
      if (t.includes('FROM quiz_attempts')) return [acierto(0), acierto(1), acierto(2)]
      if (t.includes('resolved_at = NOW()')) throw Object.assign(new Error('col'), { code: '42703' })
      return []
    }
    expect(await resolverPorAciertos('ana')).toEqual([7])
    expect(consultas.at(-1)?.texto).not.toContain('resolved_at')
  })

  it('nunca lanza: un error de la base devuelve [] (no tumba el guardado)', async () => {
    responder = () => {
      throw new Error('se cayó la base')
    }
    await expect(resolverPorAciertos('ana')).resolves.toEqual([])
  })

  it('sin temas pendientes no lee respuestas', async () => {
    await resolverPorAciertos('ana')
    expect(consultas).toHaveLength(1)
  })
})

describe('PATCH /api/teacher/classrooms/[id]/students/[userId]', () => {
  const pedir = (cuerpo: unknown, id = '2', userId = 'ana') =>
    PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id, userId }) })

  it('otro docente recibe 404 y no se toca nada', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'joaquin' })
    getOwnedClassroom.mockResolvedValue(null)
    expect((await pedir({ misconceptionId: 7, superado: true })).status).toBe(404)
    expect(consultas.some((c) => c.texto.includes('UPDATE'))).toBe(false)
  })

  it('un alumno que no está en el grupo: 404', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'irina' })
    getOwnedClassroom.mockResolvedValue({ id: 2 })
    expect((await pedir({ misconceptionId: 7, superado: true })).status).toBe(404)
    expect(consultas.some((c) => c.texto.includes('UPDATE'))).toBe(false)
  })

  it('el docente del grupo lo marca, firmado con su id', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'irina' })
    getOwnedClassroom.mockResolvedValue({ id: 2 })
    responder = (t) => (t.includes('classroom_members') ? [{ '?column?': 1 }] : t.includes('UPDATE') ? [{ id: 7 }] : [])
    expect((await pedir({ misconceptionId: 7, superado: true })).status).toBe(200)
    const update = consultas.find((c) => c.texto.includes('UPDATE'))
    expect(update?.valores).toEqual(['irina', 7, 'ana'])
  })

  it('un alumno (sin rol docente) recibe 403; parámetros malos, 400', async () => {
    getTeacherViewer.mockResolvedValue(null)
    expect((await pedir({ misconceptionId: 7, superado: true })).status).toBe(403)
    getTeacherViewer.mockResolvedValue({ id: 'irina' })
    expect((await pedir({ misconceptionId: 'x', superado: true })).status).toBe(400)
  })

  it('volver a reforzar limpia el cuándo y el quién', async () => {
    responder = () => [{ id: 7 }]
    expect(await marcarTemaDelAlumno('ana', 7, false, 'irina')).toBe(true)
    expect(consultas[0].texto).toContain('resolved_at = NULL')
  })
})
