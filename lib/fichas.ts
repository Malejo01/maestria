import { z } from 'zod'
import { FICHA_PEDAGOGICA } from '@/lib/textos'
import type { ProgramUnit } from '@/lib/types'

/**
 * La ficha del alumno (tanda J, J2): lo que el docente sabe de un alumno
 * particular, por secciones. Todo es opcional salvo el nombre, que no vive acá
 * sino donde vivió siempre (classroom_members.display_name o
 * classroom_invitations.nombre).
 *
 * Es la parte pura: forma, validación, la migración del `contexto` viejo y el
 * aviso de "Rinde en N días". Las consultas están en lib/fichas-server.ts.
 */

export interface DatosFicha {
  edad: number | null
  anioCursa: string
  institucion: string
  orientacion: string
  /** Una materia de Mis materias (teacher_programs.id). */
  materiaId: number | null
  /** AAAA-MM-DD, o null. */
  fechaExamen: string | null
  comoEvalua: string
  /** Ids de temas de la materia elegida. */
  temasDificiles: string[]
  observaciones: string
  contacto: string
  /** Adulto responsable, si es menor. */
  responsable: string
}

/** Una materia del docente con sus unidades y temas, para elegir qué le cuesta. */
export interface MateriaConTemas {
  id: number
  nombre: string
  /** K6: nivel y año del temario, para la etiqueta. */
  nivel?: string | null
  grado?: string | null
  /** K6: lo que se muestra ("Matemática · 3.º Sec."); `nombre` es lo que se manda a la IA. */
  etiqueta?: string
  unidades: ProgramUnit[]
}

export const FICHA_VACIA: DatosFicha = {
  edad: null,
  anioCursa: '',
  institucion: '',
  orientacion: '',
  materiaId: null,
  fechaExamen: null,
  comoEvalua: '',
  temasDificiles: [],
  observaciones: '',
  contacto: '',
  responsable: '',
}

export const LARGO = {
  corto: 120,
  largo: 1000,
  nombre: 80,
} as const

const texto = (max: number) => z.string().trim().max(max).default('')

export const fichaSchema = z.object({
  nombre: z.string().trim().min(1).max(LARGO.nombre),
  edad: z.number().int().min(1).max(119).nullable().default(null),
  anioCursa: texto(LARGO.corto),
  institucion: texto(LARGO.corto),
  orientacion: texto(LARGO.corto),
  materiaId: z.number().int().positive().nullable().default(null),
  fechaExamen: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  comoEvalua: texto(LARGO.largo),
  temasDificiles: z.array(z.string().min(1).max(200)).max(200).default([]),
  observaciones: texto(LARGO.largo),
  contacto: texto(LARGO.corto),
  responsable: texto(LARGO.corto),
})

export type FichaEnviada = z.infer<typeof fichaSchema>

export const EDAD_ADULTO = 18

/** El adulto responsable se pide sólo si es menor. Sin edad, no se sabe: no se pide. */
export function esMenor(edad: number | null): boolean {
  return edad !== null && edad < EDAD_ADULTO
}

/**
 * Lo que se guarda, a partir de lo que llega del formulario: el responsable de
 * un mayor no se guarda (se pudo haber escrito antes de corregir la edad), y
 * los temas difíciles sólo valen si hay materia.
 */
export function normalizarFicha(enviada: Omit<FichaEnviada, 'nombre'>): DatosFicha {
  return {
    edad: enviada.edad,
    anioCursa: enviada.anioCursa,
    institucion: enviada.institucion,
    orientacion: enviada.orientacion,
    materiaId: enviada.materiaId,
    fechaExamen: enviada.fechaExamen,
    comoEvalua: enviada.comoEvalua,
    temasDificiles: enviada.materiaId ? [...new Set(enviada.temasDificiles)] : [],
    observaciones: enviada.observaciones,
    contacto: enviada.contacto,
    responsable: esMenor(enviada.edad) ? enviada.responsable : '',
  }
}

/**
 * La migración del campo único "Qué prepara y para cuándo" (025): si el
 * alumno todavía no tiene ficha, lo que el docente había escrito ahí aparece en
 * Observaciones. La 027 además lo copia a la tabla; esto cubre lo escrito
 * después de correrla y la base donde todavía no corrió.
 */
export function fichaDesdeContexto(contexto: string | null | undefined): DatosFicha {
  return { ...FICHA_VACIA, observaciones: contexto?.trim() ?? '' }
}

/** Una fila de `fichas_alumno` a la forma de la UI. */
export function fichaDesdeFila(fila: Record<string, unknown>): DatosFicha {
  const str = (valor: unknown) => (typeof valor === 'string' ? valor : '')
  const temas = Array.isArray(fila.temas_dificiles) ? fila.temas_dificiles.map(String) : []
  return {
    edad: fila.edad === null || fila.edad === undefined ? null : Number(fila.edad),
    anioCursa: str(fila.anio_cursa),
    institucion: str(fila.institucion),
    orientacion: str(fila.orientacion),
    materiaId: fila.materia_id === null || fila.materia_id === undefined ? null : Number(fila.materia_id),
    fechaExamen: fechaComoTexto(fila.fecha_examen),
    comoEvalua: str(fila.como_evalua),
    temasDificiles: temas,
    observaciones: str(fila.observaciones),
    contacto: str(fila.contacto),
    responsable: str(fila.responsable),
  }
}

/**
 * Una columna DATE llega del driver como Date (medianoche UTC) o como texto.
 * Se guarda y se muestra como AAAA-MM-DD, sin pasar por la zona horaria.
 */
export function fechaComoTexto(valor: unknown): string | null {
  if (!valor) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10)
  const texto = String(valor)
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null
}

// ─── "Rinde en 12 días" ───────────────────────────────────────────────────────

/** Desde cuántos días antes del examen se avisa en la lista de Mis alumnos. */
export const DIAS_PARA_AVISAR_EXAMEN = 21

/** Días calendario de hoy (en la hora local de quien mira) hasta la fecha del examen. */
export function diasHastaExamen(fecha: string, ahora: Date): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const examen = Date.UTC(anio, mes - 1, dia)
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  return Math.round((examen - hoy) / 86_400_000)
}

/**
 * El aviso de la lista: "Rinde en 12 días" cuando faltan 21 o menos, "Rinde
 * mañana", "Rinde hoy". Si falta más o ya pasó, nada: una fecha vieja no es
 * una urgencia.
 */
export function avisoDeExamen(fecha: string | null, ahora: Date): string | null {
  if (!fecha) return null
  const dias = diasHastaExamen(fecha, ahora)
  if (dias < 0 || dias > DIAS_PARA_AVISAR_EXAMEN) return null
  if (dias === 0) return FICHA_PEDAGOGICA.rinde.hoy
  if (dias === 1) return FICHA_PEDAGOGICA.rinde.manana
  return FICHA_PEDAGOGICA.rinde.en(dias)
}

/**
 * J6: suma los temas que falló en el diagnóstico a los que le cuestan. Los
 * temas son de una materia: si la ficha tenía otra (o ninguna), pasa a la del
 * diagnóstico y los de la otra se descartan.
 */
export function sumarTemasDificiles(ficha: DatosFicha, materiaId: number, temas: string[]): DatosFicha {
  const base = ficha.materiaId === materiaId ? ficha.temasDificiles : []
  return { ...ficha, materiaId, temasDificiles: [...new Set([...base, ...temas])] }
}
