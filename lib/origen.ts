/**
 * Ronda V · V1 — De qué canal llegó cada persona.
 *
 * Mauro difunde por Instagram, WhatsApp, Facebook, TikTok, LinkedIn y
 * YouTube. Cada link lleva `?origen=ig` (o `wa`, `fb`, `tt`, `li`, `yt`,
 * `otro`), y el de un docente que recomienda lleva además `?ref=CODIGO` (V3).
 * La primera visita guarda eso en una cookie por 30 días; al registrarse,
 * queda en `users.origen` (migración 044). Una visita posterior con otro link
 * no pisa la primera: cuenta el canal que la trajo.
 *
 * Todo esto es puro (lo usan el middleware, el registro y el panel).
 */

export const CANALES = ['ig', 'wa', 'fb', 'tt', 'li', 'yt', 'otro'] as const
export type Canal = (typeof CANALES)[number]

export const NOMBRE_DEL_CANAL: Record<Canal, string> = {
  ig: 'Instagram',
  wa: 'WhatsApp',
  fb: 'Facebook',
  tt: 'TikTok',
  li: 'LinkedIn',
  yt: 'YouTube',
  otro: 'Otro',
}

export const COOKIE_DE_ORIGEN = 'maestria_origen'
export const DIAS_DE_LA_COOKIE = 30

export const esCanal = (v: unknown): v is Canal => typeof v === 'string' && (CANALES as readonly string[]).includes(v)

export interface Origen {
  origen: Canal | null
  /** El código de referido (V3), en mayúsculas. */
  ref: string | null
  /** El día de la primera visita (AAAA-MM-DD). */
  el?: string
}

/** Un código de referido válido: letras, números y guiones, de 3 a 40. */
export function normalizarRef(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(limpio) ? limpio : null
}

/**
 * Lo que trae la URL. Un `origen` desconocido cuenta como "otro" (alguien
 * armó un link a mano); sin `origen` pero con `ref`, el canal no se sabe.
 */
export function origenDeLaUrl(params: URLSearchParams): Origen | null {
  const crudo = params.get('origen')?.trim().toLowerCase() ?? ''
  const ref = normalizarRef(params.get('ref'))
  const origen = crudo ? (esCanal(crudo) ? crudo : 'otro') : null
  return origen || ref ? { origen, ref } : null
}

/** El valor de la cookie: `ig|CODIGO|2026-11-23`. */
export function cookieDeOrigen(o: Origen, ahora: Date): string {
  return [o.origen ?? '', o.ref ?? '', ahora.toISOString().slice(0, 10)].join('|')
}

export function leerCookieDeOrigen(valor: string | null | undefined): Origen | null {
  if (!valor) return null
  const [origen, ref, el] = decodeURIComponent(valor).split('|')
  const o: Origen = { origen: esCanal(origen) ? origen : null, ref: normalizarRef(ref), el: /^\d{4}-\d{2}-\d{2}$/.test(el ?? '') ? el : undefined }
  return o.origen || o.ref ? o : null
}

/** La primera visita manda: sólo se guarda si no hay una cookie válida. */
export function cookieAGuardar(existente: string | null | undefined, params: URLSearchParams, ahora: Date): string | null {
  if (leerCookieDeOrigen(existente)) return null
  const nuevo = origenDeLaUrl(params)
  return nuevo ? cookieDeOrigen(nuevo, ahora) : null
}

/** El link de un canal para copiar (base sin barra final). */
export function linkDeCanal(base: string, canal: Canal, ref?: string | null): string {
  const url = new URL('/', base.replace(/\/+$/, '') + '/')
  url.searchParams.set('origen', canal)
  const codigo = normalizarRef(ref)
  if (codigo) url.searchParams.set('ref', codigo)
  return url.toString()
}

// ─── El panel ───────────────────────────────────────────────────────────────

export interface PersonaConOrigen {
  origen: string | null
  rol: 'DOCENTE' | 'ALUMNO' | string | null
  /** Para los docentes: el índice del paso del embudo alcanzado (0 = registro). */
  pasoDelEmbudo?: number
}

export interface FilaPorCanal {
  canal: Canal | 'sin-dato'
  docentes: number
  alumnos: number
  /** Docentes que mandaron al menos una tarea (paso 3 del embudo). */
  conTarea: number
  /** Docentes con al menos un alumno que respondió (paso 4). */
  conAlumnos: number
}

/**
 * Docentes y alumnos por canal, y cuántos docentes de cada canal llegaron a
 * mandar una tarea y a tener alumnos: la conversión del canal. Los que se
 * registraron antes de la 044 (o sin link) van en "sin dato".
 */
export function resumenPorCanal(personas: readonly PersonaConOrigen[]): FilaPorCanal[] {
  const filas = new Map<FilaPorCanal['canal'], FilaPorCanal>()
  const fila = (canal: FilaPorCanal['canal']) => {
    if (!filas.has(canal)) filas.set(canal, { canal, docentes: 0, alumnos: 0, conTarea: 0, conAlumnos: 0 })
    return filas.get(canal)!
  }
  for (const p of personas) {
    const f = fila(esCanal(p.origen) ? p.origen : 'sin-dato')
    if (p.rol === 'DOCENTE') {
      f.docentes++
      if ((p.pasoDelEmbudo ?? 0) >= 3) f.conTarea++
      if ((p.pasoDelEmbudo ?? 0) >= 4) f.conAlumnos++
    } else {
      f.alumnos++
    }
  }
  const orden: FilaPorCanal['canal'][] = [...CANALES, 'sin-dato']
  return [...filas.values()].sort((a, b) => orden.indexOf(a.canal) - orden.indexOf(b.canal))
}

/** "40 %" o "—" sin docentes. */
export const porcentaje = (parte: number, total: number) => (total > 0 ? `${Math.round((100 * parte) / total)} %` : '—')
