import { beforeEach, describe, expect, it, vi } from 'vitest'
import { preguntaImpresa, validarCarga } from './diagnostico-impreso'

const { sqlMock, consultas, leerMiembros, leerInvitaciones } = vi.hoisted(() => {
  const consultas: string[] = []
  const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
    const texto = strings.join('?')
    consultas.push(texto)
    if (texto.includes('FROM teacher_quizzes q')) {
      return [{ id: 26, title: 'Diagnóstico integral', subject_name: 'Matemática', questions: [{}, {}, {}], selected_topics: [], classroom_id: 1 }]
    }
    return []
  })
  return {
    sqlMock,
    consultas,
    leerMiembros: vi.fn(async () => [{ userId: 'u9', nombre: 'Sofía', grupoId: 1 }]),
    leerInvitaciones: vi.fn(async () => [{ id: 5, nombre: 'Tomás', grupoId: 1 }]),
  }
})
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/alumnos-docente-server', () => ({ leerMiembros, leerInvitaciones }))

import { guardarCarga } from './diagnostico-impreso-server'

beforeEach(() => {
  consultas.length = 0
})

describe('preguntaImpresa — la respuesta correcta, escrita, para la hoja del docente', () => {
  it('opción múltiple: letra y texto', () => {
    expect(preguntaImpresa({ type: 'multiple_choice', question: '¿?', options: ['1', '2', '3'], correctAnswer: 1 }, 0).correcta).toBe('B. 2')
  })
  it('numérica, con tolerancia', () => {
    expect(preguntaImpresa({ type: 'numeric', question: '¿?', correctAnswer: 3.5, tolerance: 0.1 }, 0).correcta).toBe('3,5 (± 0,1)')
  })
  it('K1: el decimal de máquina sale redondeado y con coma', () => {
    // O5: un decimal que es una fracción simple suma la fracción.
    expect(preguntaImpresa({ type: 'numeric', question: '¿?', correctAnswer: 0.9166666666666666 }, 0).correcta).toBe('$\\frac{11}{12}$ (0,9167)')
    expect(preguntaImpresa({ type: 'numeric', question: '¿?', correctAnswer: 0.123456 }, 0).correcta).toBe('0,1235')
    expect(preguntaImpresa({ type: 'numeric', question: '¿?', correctAnswer: 12500 }, 0).correcta).toBe('12.500')
  })
  it('verdadero o falso', () => {
    expect(preguntaImpresa({ type: 'true_false', question: '¿?', correctAnswer: false }, 0).correcta).toBe('Falso')
  })
})

describe('validarCarga (J7)', () => {
  it('lo que no se marcó queda sin responder', () => {
    expect(validarCarga({ '0': 'bien', '2': 'mal' }, 3)).toEqual({ '0': 'bien', '1': 'sin_responder', '2': 'mal' })
  })
  it('rechaza índices que no existen y marcas inventadas', () => {
    expect(validarCarga({ '3': 'bien' }, 3)).toBeNull()
    expect(validarCarga({ '0': 'regular' }, 3)).toBeNull()
    expect(validarCarga(['bien'], 3)).toBeNull()
  })
})

describe('guardarCarga — queda sólo en el resultado del diagnóstico', () => {
  it('de un alumno que ya entró: una fila con su user_id, y nada en topic_mastery ni en los errores', async () => {
    expect(await guardarCarga('docente', 26, { userId: 'u9' }, { '0': 'bien', '1': 'mal', '2': 'sin_responder' })).toBe(true)
    const escrituras = consultas.filter((c) => /INSERT|UPDATE|DELETE/.test(c))
    expect(escrituras).toHaveLength(1)
    expect(escrituras[0]).toContain('INSERT INTO diagnostico_resultados_impresos')
    expect(consultas.join('\n')).not.toMatch(/topic_mastery|student_misconceptions/)
  })
  it('de quien todavía no entró: cuelga de la invitación', async () => {
    expect(await guardarCarga('docente', 26, { invitacionId: 5 }, { '0': 'bien', '1': 'bien', '2': 'bien' })).toBe(true)
    const insert = sqlMock.mock.calls.at(-1)!
    expect(insert.slice(1, 4)).toEqual([26, null, 5])
  })
  it('un alumno que no es del grupo del diagnóstico: no se guarda', async () => {
    expect(await guardarCarga('docente', 26, { userId: 'otro' }, { '0': 'bien' })).toBe(false)
  })
})
