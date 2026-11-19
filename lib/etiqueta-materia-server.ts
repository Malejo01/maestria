import { sql } from '@/lib/db'
import { etiquetaDeMateria, type MateriaConNivel } from '@/lib/etiqueta-materia'

/**
 * K6: las materias activas del docente con nivel y año, en el orden en que se
 * crearon (el mismo que usan los selectores), para armar sus etiquetas
 * ("Matemática · 3.º Sec.") en el servidor.
 */
export async function materiasDelDocente(teacherId: string): Promise<MateriaConNivel[]> {
  const filas = (await sql`
    SELECT id, subject_name, nivel, grado
    FROM teacher_programs
    WHERE user_id = ${teacherId} AND status = 'active'
    ORDER BY created_at ASC, id ASC
  `) as Record<string, unknown>[]
  return filas.map((fila) => ({
    id: Number(fila.id),
    nombre: String(fila.subject_name),
    nivel: typeof fila.nivel === 'string' ? fila.nivel : null,
    grado: typeof fila.grado === 'string' ? fila.grado : null,
  }))
}

/** La etiqueta de una materia del docente, o el nombre que se pase si no la encuentra. */
export async function etiquetaDeMateriaDe(teacherId: string, materiaId: number, nombre: string): Promise<string> {
  const todas = await materiasDelDocente(teacherId)
  const materia = todas.find((m) => m.id === materiaId)
  return materia ? etiquetaDeMateria(materia, todas) : nombre
}
