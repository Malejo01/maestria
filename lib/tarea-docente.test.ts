import { describe, expect, it } from 'vitest'
import { configDeTarea, destinoDeVuelta, filtrarPorTipo, rutaDeRevision, tareaDesdeFila } from './tarea-docente'

const fila = {
  id: 33,
  user_id: 'docente',
  teacher_program_id: 13,
  title: 'Diagnóstico integral · Matemática',
  subject_name: 'Matemática',
  mode: 'practico',
  status: 'saved',
  selected_topics: [{ id: 't1', name: 'Fracciones' }],
  question_count: 1,
  questions: [],
  pedagogy_context: null,
}

describe('L1 · una tarea del docente', () => {
  it('lee el tipo; sin la 027 (o sin la columna) es tarea', () => {
    expect(tareaDesdeFila({ ...fila, tipo: 'diagnostico' }).tipo).toBe('diagnostico')
    expect(tareaDesdeFila(fila).tipo).toBe('tarea')
    expect(tareaDesdeFila({ ...fila, tipo: null }).tipo).toBe('tarea')
  })

  it('un diagnóstico se ve como lo rinde el alumno: sin devolución hasta el final, y sin grupo ni asignación', () => {
    const config = configDeTarea(tareaDesdeFila({ ...fila, tipo: 'diagnostico' }))
    expect(config.devolucion).toBe('al_final')
    expect(config.classroomId).toBeUndefined()
    expect(config.assignmentId).toBeUndefined()
    expect(configDeTarea(tareaDesdeFila(fila)).devolucion).toBeUndefined()
  })

  it('filtra Tareas · Diagnósticos', () => {
    const tareas = [{ tipo: 'tarea' as const }, { tipo: 'diagnostico' as const }, {}]
    expect(filtrarPorTipo(tareas, 'todas')).toHaveLength(3)
    expect(filtrarPorTipo(tareas, 'diagnostico')).toEqual([{ tipo: 'diagnostico' }])
    expect(filtrarPorTipo(tareas, 'tarea')).toHaveLength(2)
  })

  it('la revisión vuelve sólo a una pantalla del docente', () => {
    expect(destinoDeVuelta('/teacher/alumnos/u9')).toBe('/teacher/alumnos/u9')
    expect(destinoDeVuelta('https://otro.com')).toBe('/teacher')
    expect(destinoDeVuelta('//otro.com/teacher')).toBe('/teacher')
    expect(destinoDeVuelta('/teacher\\@otro.com')).toBe('/teacher')
    expect(destinoDeVuelta(undefined)).toBe('/teacher')
    expect(rutaDeRevision(33, '/teacher/alumnos/u9?x=1')).toBe('/teacher/tareas/33/revisar?volver=%2Fteacher%2Falumnos%2Fu9%3Fx%3D1')
  })
})
