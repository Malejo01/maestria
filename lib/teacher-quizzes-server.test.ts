import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuizImpact } from './teacher-quizzes-server'
import { sql } from '@/lib/db'

vi.mock('@/lib/db', () => ({ sql: vi.fn() }))

/**
 * Lo que se protege acá es el umbral, no el conteo.
 *
 * `requiresDecision` decide si editar un cuestionario abre un diálogo de
 * confirmación o guarda derecho. Si se corre hacia lo permisivo, un docente
 * reescribe en silencio un examen que alguien ya rindió; si se corre hacia lo
 * estricto, se le pide confirmación cada vez que toca un cuestionario recién
 * asignado y a la tercera confirma sin leer — que es la forma de perder el
 * aviso el día que importa.
 */
describe('getQuizImpact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin asignaciones no hay nada que decidir', async () => {
    vi.mocked(sql).mockResolvedValueOnce([])

    const impact = await getQuizImpact(1)

    expect(impact).toEqual({
      assignments: [],
      totalAttempts: 0,
      totalStudents: 0,
      requiresDecision: false,
    })
  })

  it('asignado pero sin intentos NO pide decisión', async () => {
    // El caso del docente que asigna y corrige un error a los dos minutos.
    // Todavía no hay nada que proteger.
    vi.mocked(sql).mockResolvedValueOnce([
      { assignment_id: 7, classroom_id: 2, classroom_name: '1er Año', students_started: 0, attempts: 0 },
    ])

    const impact = await getQuizImpact(1)

    expect(impact.requiresDecision).toBe(false)
    expect(impact.assignments).toHaveLength(1)
    expect(impact.assignments[0].classroomName).toBe('1er Año')
  })

  it('un solo intento ya pide decisión', async () => {
    // Uno alcanza: ese alumno rindió una versión, y editarla en el lugar hace
    // que su nota corresponda a un examen que ya no existe.
    vi.mocked(sql).mockResolvedValueOnce([
      { assignment_id: 7, classroom_id: 2, classroom_name: '1er Año', students_started: 1, attempts: 1 },
    ])

    const impact = await getQuizImpact(1)

    expect(impact.requiresDecision).toBe(true)
    expect(impact.totalAttempts).toBe(1)
    expect(impact.totalStudents).toBe(1)
  })

  it('suma a través de varias aulas', async () => {
    // El mismo cuestionario asignado a dos cursos: el diálogo tiene que decir
    // el total y también de dónde sale.
    vi.mocked(sql).mockResolvedValueOnce([
      { assignment_id: 7, classroom_id: 2, classroom_name: 'Mañana', students_started: 12, attempts: 15 },
      { assignment_id: 8, classroom_id: 3, classroom_name: 'Tarde', students_started: 9, attempts: 9 },
    ])

    const impact = await getQuizImpact(1)

    expect(impact.totalAttempts).toBe(24)
    expect(impact.totalStudents).toBe(21)
    expect(impact.assignments.map((a) => a.classroomName)).toEqual(['Mañana', 'Tarde'])
  })
})
