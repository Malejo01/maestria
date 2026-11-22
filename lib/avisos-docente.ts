/**
 * O10/P2 · Avisos al docente dentro de la app (la campanita). Puro: de filas
 * ya agrupadas por la base a avisos del modelo común (lib/avisos/tipos.ts),
 * del más nuevo al más viejo.
 *
 * Se calcula de lo que ya hay: intentos terminados (por tarea y por día),
 * alumnos nuevos en un grupo (por grupo y por día) y reportes (M6). No hay
 * correo ni push.
 */
import { ordenarAvisos } from '@/lib/avisos/armar'
import { crearAviso, type Aviso, type Lectura } from '@/lib/avisos/tipos'
import { AVISOS_DOCENTE as T } from '@/lib/textos'

export type FilaDeAviso =
  | { tipo: 'tarea'; grupoId: number; grupo: string; tarea: string; dia: string; alumnos: number; ultimo: string }
  | { tipo: 'nuevos'; grupoId: number; grupo: string; dia: string; alumnos: number; ultimo: string }
  | { tipo: 'reporte'; grupoId: number | null; grupo: string | null; dia: string; reportes: number; ultimo: string }

/** A dónde lleva tocar el aviso. */
export function hrefDelAviso(f: FilaDeAviso): string {
  if (f.tipo === 'reporte') return f.grupoId ? `/teacher/grupos/${f.grupoId}` : '/teacher'
  return `/teacher/grupos/${f.grupoId}${f.tipo === 'tarea' ? '?pestaña=tareas' : ''}`
}

function avisoDe(f: FilaDeAviso, lectura: Lectura): Aviso {
  const clave = `${f.tipo}|${f.grupoId ?? ''}|${f.tipo === 'tarea' ? f.tarea : ''}|${f.dia}`
  const base = { clave, href: hrefDelAviso(f), fecha: f.ultimo }
  if (f.tipo === 'tarea') {
    return crearAviso('tareaTerminada', { ...base, titulo: T.terminaron(f.alumnos), detalle: T.detalleTarea(f.grupo, f.tarea) }, lectura)
  }
  if (f.tipo === 'nuevos') {
    return crearAviso('alumnosNuevos', { ...base, titulo: T.nuevos(f.alumnos), detalle: T.nuevosDetalle(f.alumnos, f.grupo) }, lectura)
  }
  return crearAviso('reporte', { ...base, titulo: T.reportes(f.reportes), detalle: T.reportesDetalle(f.grupo) }, lectura)
}

/** Los avisos, del más nuevo al más viejo; no leído = pasó después de la última vez que marcó todo como leído. */
export function armarAvisos(filas: readonly FilaDeAviso[], lectura: Lectura, max = 30): Aviso[] {
  return ordenarAvisos(
    filas.filter((f) => (f.tipo === 'reporte' ? f.reportes : f.alumnos) > 0).map((f) => avisoDe(f, lectura)),
    max,
  )
}
