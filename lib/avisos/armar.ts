import { AVISOS as T } from '@/lib/textos'
import type { Aviso } from './tipos'

/**
 * P2 · El armado común de la lista de avisos (docente y alumno): orden, grupo
 * del día (Hoy / Ayer / Antes), hora relativa y cuántos no se leyeron. Puro:
 * `ahora` entra por parámetro y los días son los de Argentina.
 */

const ZONA = 'America/Argentina/Buenos_Aires'
const MS_MINUTO = 60_000
const MS_HORA = 60 * MS_MINUTO
const MS_DIA = 24 * MS_HORA

/** "2026-11-22" en hora de Argentina. */
export function diaEnArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(fecha)
}

/** Días de calendario (de Argentina) entre la fecha y ahora: 0 hoy, 1 ayer. */
export function diasDeCalendario(fecha: Date, ahora: Date): number {
  const a = Date.parse(`${diaEnArgentina(ahora)}T00:00:00Z`)
  const f = Date.parse(`${diaEnArgentina(fecha)}T00:00:00Z`)
  return Math.round((a - f) / MS_DIA)
}

/** Del más nuevo al más viejo, y hasta `max`. */
export function ordenarAvisos<A extends Aviso>(avisos: readonly A[], max = 30): A[] {
  return [...avisos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, max)
}

export type GrupoDeDia = 'hoy' | 'ayer' | 'antes'

/** Los avisos (ya ordenados) en Hoy / Ayer / Antes, sin grupos vacíos y en ese orden. */
export function agruparPorDia<A extends Aviso>(avisos: readonly A[], ahora: Date): { grupo: GrupoDeDia; titulo: string; avisos: A[] }[] {
  const grupos: Record<GrupoDeDia, A[]> = { hoy: [], ayer: [], antes: [] }
  for (const aviso of avisos) {
    const dias = diasDeCalendario(new Date(aviso.fecha), ahora)
    grupos[dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : 'antes'].push(aviso)
  }
  return (['hoy', 'ayer', 'antes'] as const)
    .filter((g) => grupos[g].length > 0)
    .map((g) => ({ grupo: g, titulo: T.grupos[g], avisos: grupos[g] }))
}

/**
 * "hace un momento", "hace 5 min", "hace 2 h", "ayer", "hace 3 días", "14/11".
 * Las horas valen dentro del mismo día de calendario: a las 0:30, algo de las
 * 23:00 es "ayer", no "hace 1 h".
 */
export function horaRelativa(fechaIso: string, ahora: Date): string {
  const fecha = new Date(fechaIso)
  const ms = Math.max(0, ahora.getTime() - fecha.getTime())
  const dias = diasDeCalendario(fecha, ahora)
  if (dias <= 0) {
    if (ms < MS_MINUTO) return T.relativa.recien
    if (ms < MS_HORA) return T.relativa.minutos(Math.floor(ms / MS_MINUTO))
    return T.relativa.horas(Math.floor(ms / MS_HORA))
  }
  if (dias === 1) return T.relativa.ayer
  if (dias < 7) return T.relativa.dias(dias)
  const [, mes, dia] = diaEnArgentina(fecha).split('-')
  return `${dia}/${mes}`
}

export const contarNoLeidos = (avisos: readonly Aviso[]) => avisos.filter((a) => a.noLeido).length
