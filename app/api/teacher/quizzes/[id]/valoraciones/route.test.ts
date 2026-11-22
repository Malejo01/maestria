import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O8. El pulgar se guarda sólo en un cuestionario propio, con la consigna guardada, y la válvula de la 033. */
const { getTeacherViewer, consultas } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  consultas: [] as { texto: string; valores: unknown[] }[],
}))
let faltaLa033 = false

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    if (texto.includes('FROM teacher_quizzes')) {
      return Promise.resolve(valores[1] === 'irina' ? [{ id: 41, teacher_program_id: 13, questions: [{ question: '¿Es 7 primo?' }, { question: 'Calculá 2+2' }] }] : [])
    }
    if (faltaLa033) return Promise.reject(Object.assign(new Error('no existe'), { code: '42P01' }))
    return Promise.resolve([])
  },
}))

import { PUT } from './route'

const pedir = (cuerpo: unknown) =>
  PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id: '41' }) })

beforeEach(() => {
  consultas.length = 0
  faltaLa033 = false
  getTeacherViewer.mockResolvedValue({ id: 'irina' })
})

describe('PUT valoraciones', () => {
  it('guarda el pulgar abajo con el motivo, la materia y la consigna como está guardada', async () => {
    expect((await pedir({ indice: 0, valor: -1, motivo: 'tipo_equivocado' })).status).toBe(200)
    const insert = consultas.find((c) => c.texto.includes('INSERT INTO pregunta_valoraciones'))!
    expect(insert.valores).toEqual(['irina', 41, 13, 0, -1, 'tipo_equivocado', '¿Es 7 primo?'])
  })

  it('pulgar abajo sin motivo: 400', async () => {
    expect((await pedir({ indice: 0, valor: -1 })).status).toBe(400)
  })

  it('el cuestionario de otro docente: 404, sin escribir', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'joaquin' })
    expect((await pedir({ indice: 0, valor: 1 })).status).toBe(404)
    expect(consultas.some((c) => c.texto.includes('INSERT'))).toBe(false)
  })

  it('una pregunta que no existe: 400', async () => {
    expect((await pedir({ indice: 9, valor: 1 })).status).toBe(400)
  })

  it('sin la 033: 503 con el motivo, no 500', async () => {
    faltaLa033 = true
    const r = await pedir({ indice: 1, valor: 1 })
    expect(r.status).toBe(503)
    expect((await r.json()).error).toContain('033')
  })
})
