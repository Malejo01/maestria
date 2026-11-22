/**
 * O10 · Avisos al docente dentro de la app (la campanita). Puro: de filas ya
 * agrupadas por la base a los avisos con su texto, ordenados del más nuevo al
 * más viejo, y cuántos no vio.
 *
 * Se calcula de lo que ya hay: intentos terminados (por tarea y por día),
 * alumnos nuevos en un grupo (por grupo y por día) y reportes (M6). No hay
 * correo ni push.
 */
import { AVISOS_DOCENTE as T } from '@/lib/textos'

export type FilaDeAviso =
  | { tipo: 'tarea'; grupoId: number; grupo: string; tarea: string; dia: string; alumnos: number; ultimo: string }
  | { tipo: 'nuevos'; grupoId: number; grupo: string; dia: string; alumnos: number; ultimo: string }
  | { tipo: 'reporte'; grupoId: number | null; grupo: string | null; dia: string; reportes: number; ultimo: string }

export interface AvisoDocente {
  clave: string
  texto: string
  /** A dónde lleva tocarlo. */
  href: string
  /** El evento más nuevo del aviso (ISO): decide si es no leído. */
  cuando: string
  dia: string
  noLeido: boolean
}

function textoDe(f: FilaDeAviso): string {
  if (f.tipo === 'tarea') return T.terminaron(f.alumnos, f.grupo, f.tarea)
  if (f.tipo === 'nuevos') return T.nuevos(f.alumnos, f.grupo)
  return T.reportes(f.reportes, f.grupo)
}

function hrefDe(f: FilaDeAviso): string {
  if (f.tipo === 'reporte') return f.grupoId ? `/teacher/grupos/${f.grupoId}` : '/teacher'
  return `/teacher/grupos/${f.grupoId}${f.tipo === 'tarea' ? '?pestaña=tareas' : ''}`
}

/** Los avisos, del más nuevo al más viejo; no leído = pasó después de la última vez que abrió la campanita. */
export function armarAvisos(filas: readonly FilaDeAviso[], vistoEl: string | null, max = 30): AvisoDocente[] {
  return filas
    .filter((f) => (f.tipo === 'reporte' ? f.reportes : f.alumnos) > 0)
    .map((f) => ({
      clave: `${f.tipo}|${f.grupoId ?? ''}|${f.tipo === 'tarea' ? f.tarea : ''}|${f.dia}`,
      texto: textoDe(f),
      href: hrefDe(f),
      cuando: f.ultimo,
      dia: f.dia,
      noLeido: !vistoEl || f.ultimo > vistoEl,
    }))
    .sort((a, b) => b.cuando.localeCompare(a.cuando))
    .slice(0, max)
}

export const noLeidos = (avisos: readonly AvisoDocente[]) => avisos.filter((a) => a.noLeido).length
