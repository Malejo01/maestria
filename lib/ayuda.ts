/**
 * Ronda V · V6 — El centro de ayuda (`/ayuda`). Las guías son archivos
 * Markdown del repo (`content/ayuda/<slug>.md`), para que Mauro las edite sin
 * tocar código. Cada una empieza con sus datos:
 *
 *   ---
 *   titulo: Cargar el programa de tu materia
 *   resumen: Una línea que se ve en el índice.
 *   orden: 1
 *   accion: /teacher?seccion=materias
 *   accionTexto: Ir a Mis materias
 *   ---
 *
 * y sigue el texto. Una línea `![qué se ve](/ayuda/archivo.png)` sola es una
 * captura (sólo de `/ayuda/` o `/portada/`). El resto es el Markdown de las
 * explicaciones (encabezados, negrita, listas).
 *
 * Todo esto es puro.
 */

export const GUIAS = [
  'cargar-el-programa',
  'el-area-de-la-materia',
  'armar-una-tarea',
  'grupos-y-alumnos',
  'diagnostico',
  'exportar-a-moodle',
  'planes-y-pagos',
  'reportar-un-problema',
] as const
export type Guia = (typeof GUIAS)[number]

export const esGuia = (v: unknown): v is Guia => typeof v === 'string' && (GUIAS as readonly string[]).includes(v)

export type ParteDeGuia = { tipo: 'texto'; markdown: string } | { tipo: 'imagen'; src: string; alt: string }

export interface GuiaLeida {
  slug: Guia
  titulo: string
  resumen: string
  orden: number
  accion: string | null
  accionTexto: string | null
  partes: ParteDeGuia[]
}

const IMAGEN = /^!\[([^\]]*)\]\((\/(?:ayuda|portada)\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp))\)\s*$/

/** Lee una guía. null si le faltan los datos o el título. */
export function parsearGuia(fuente: string, slug: Guia): GuiaLeida | null {
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
  if (!datos.titulo) return null
  const partes: ParteDeGuia[] = []
  let buffer: string[] = []
  const volcar = () => {
    const md = buffer.join('\n').trim()
    if (md) partes.push({ tipo: 'texto', markdown: md })
    buffer = []
  }
  for (const linea of m[2].split('\n')) {
    const img = linea.trim().match(IMAGEN)
    if (img) {
      volcar()
      partes.push({ tipo: 'imagen', alt: img[1].trim(), src: img[2] })
    } else {
      buffer.push(linea)
    }
  }
  volcar()
  const accion = datos.accion && /^\/[^/]/.test(datos.accion) ? datos.accion : null
  return {
    slug,
    titulo: datos.titulo,
    resumen: datos.resumen ?? '',
    orden: Number.isFinite(Number(datos.orden)) ? Number(datos.orden) : 99,
    accion,
    accionTexto: accion ? datos.accionTexto || null : null,
    partes,
  }
}

/** El índice, en el orden de cada guía. */
export function ordenarGuias(guias: (GuiaLeida | null)[]): GuiaLeida[] {
  return guias.filter((g): g is GuiaLeida => g !== null).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'))
}
