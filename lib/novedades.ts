/**
 * Ronda Y · Y3 — Novedades de MaestrIA (puro).
 *
 * Cada novedad es un Markdown en content/novedades/<slug>.md con un
 * encabezado:
 *
 *   ---
 *   titulo: Lo nuevo de noviembre
 *   fecha: 2026-11-23
 *   para: todos            (todos | docentes | alumnos)
 *   resumen: Una línea para la lista y la campanita.
 *   ---
 *
 * La campanita la avisa una vez por novedad (la clave es el slug) y sólo los
 * primeros 30 días: a quien entra en marzo no le aparece lo de noviembre.
 */
export const DIAS_EN_LA_CAMPANITA = 30
export type ParaQuien = 'todos' | 'docentes' | 'alumnos'

export interface Novedad {
  slug: string
  titulo: string
  fecha: string
  para: ParaQuien
  resumen: string
  markdown: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Lee una novedad. null si le falta el título, la fecha o el slug no sirve. */
export function parsearNovedad(fuente: string, slug: string): Novedad | null {
  if (!SLUG.test(slug)) return null
  const texto = fuente.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return null
  const datos = Object.fromEntries(
    m[1]
      .split('\n')
      .map((l) => l.match(/^([a-zA-Z]+):\s*(.*)$/))
      .filter((x): x is RegExpMatchArray => x !== null)
      .map(([, k, v]) => [k, v.trim()]),
  )
  if (!datos.titulo || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha ?? '')) return null
  const para: ParaQuien = datos.para === 'docentes' || datos.para === 'alumnos' ? datos.para : 'todos'
  return { slug, titulo: datos.titulo, fecha: datos.fecha, para, resumen: datos.resumen ?? '', markdown: m[2].trim() }
}

/** De la más nueva a la más vieja (las mal armadas, afuera). */
export function ordenarNovedades(novedades: readonly (Novedad | null)[]): Novedad[] {
  return novedades.filter((n): n is Novedad => n !== null).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.slug.localeCompare(b.slug))
}

export function esPara(n: Novedad, rol: 'docente' | 'alumno'): boolean {
  return n.para === 'todos' || (n.para === 'docentes' && rol === 'docente') || (n.para === 'alumnos' && rol === 'alumno')
}

/** El instante de la novedad para la campanita: el comienzo (0 h de Argentina) del día publicado. */
export const fechaDeAviso = (n: Novedad) => `${n.fecha}T03:00:00.000Z`

/** Las que van a la campanita: de ese rol, ya publicadas y de los últimos 30 días. */
export function novedadesParaAvisar(novedades: readonly Novedad[], rol: 'docente' | 'alumno', ahora: Date): Novedad[] {
  const desde = ahora.getTime() - DIAS_EN_LA_CAMPANITA * 86_400_000
  return novedades.filter((n) => {
    const t = Date.parse(fechaDeAviso(n))
    return esPara(n, rol) && t <= ahora.getTime() && t >= desde
  })
}
