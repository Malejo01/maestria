/**
 * O12 · El embudo del docente (FASE 2, activación). Puro: en qué paso está
 * cada docente, desde cuándo, y quiénes están trabados.
 *
 * Los pasos, en orden: se registró → creó una materia → creó un grupo → mandó
 * la primera tarea → el primer alumno la hizo → 5 alumnos activos. Cada paso
 * tiene la fecha en que se alcanzó (o null); todo sale de las tablas que ya
 * existen (lib/embudo-server.ts), sin herramientas externas.
 */
export const PASOS = ['registro', 'materia', 'grupo', 'tarea', 'primerAlumno', 'cincoAlumnos'] as const
export type Paso = (typeof PASOS)[number]

/** Más de esto en un paso que no es el último, y el docente está trabado. */
export const DIAS_PARA_TRABADO = 3

export interface FechasDelDocente {
  id: string
  nombre: string | null
  email: string | null
  /** La fecha (ISO) en que alcanzó cada paso, o null. */
  fechas: Record<Paso, string | null>
}

export interface DocenteEnElEmbudo {
  id: string
  nombre: string | null
  email: string | null
  /** El último paso alcanzado, sin saltear (si falta uno del medio, se queda en el anterior). */
  paso: Paso
  /** Índice del paso (0 = registro). */
  indice: number
  desde: string
  dias: number
  terminado: boolean
  trabado: boolean
}

const DIA_MS = 86_400_000

export function ubicarEnElEmbudo(d: FechasDelDocente, ahora: Date): DocenteEnElEmbudo {
  let indice = 0
  for (let i = 1; i < PASOS.length; i++) {
    if (!d.fechas[PASOS[i]]) break
    indice = i
  }
  const paso = PASOS[indice]
  const desde = d.fechas[paso] ?? d.fechas.registro ?? ahora.toISOString()
  const dias = Math.max(0, Math.floor((ahora.getTime() - new Date(desde).getTime()) / DIA_MS))
  const terminado = indice === PASOS.length - 1
  return { id: d.id, nombre: d.nombre, email: d.email, paso, indice, desde, dias, terminado, trabado: !terminado && dias > DIAS_PARA_TRABADO }
}

/** Los trabados arriba (los de más días primero); después el resto, del paso más atrasado al más avanzado. */
export function ordenarEmbudo(docentes: readonly DocenteEnElEmbudo[]): DocenteEnElEmbudo[] {
  return [...docentes].sort((a, b) => {
    if (a.trabado !== b.trabado) return a.trabado ? -1 : 1
    if (a.trabado) return b.dias - a.dias
    return a.indice - b.indice || b.dias - a.dias
  })
}

/** Cuántos docentes alcanzaron cada paso (el embudo en sí). */
export function conteoPorPaso(docentes: readonly DocenteEnElEmbudo[]): Record<Paso, number> {
  const conteo = Object.fromEntries(PASOS.map((p) => [p, 0])) as Record<Paso, number>
  for (const d of docentes) for (let i = 0; i <= d.indice; i++) conteo[PASOS[i]]++
  return conteo
}
