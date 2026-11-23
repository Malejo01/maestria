/**
 * Ronda V · V4 — El informe para el alumno y la familia.
 *
 * Desde la ficha, "Compartir informe" arma un link de sólo lectura, sin login,
 * que vence a los 30 días y se puede revocar. Muestra lo que practicó, los
 * temas que domina, los que tiene que reforzar y los próximos pasos que
 * escribe el docente. **Nunca** muestra notas de otros alumnos, datos de
 * contacto, ni lo que el docente escribió en la ficha.
 *
 * Esto es puro: arma el informe con lo que ya calculó la ficha.
 */
import type { TemaDeAlumno } from '@/lib/alumnos-docente'

export const DIAS_DEL_LINK = 30
export const LARGO_MAXIMO_PROXIMOS_PASOS = 800

export interface DatosParaElInforme {
  nombre: string
  materias: string[]
  temas: TemaDeAlumno[]
  intentos: { completadoEl: string; correctas: number; calificadas: number }[]
}

export interface InformeParaLaFamilia {
  /** El nombre como lo cargó el docente, sin el apellido completo: "Camila R." */
  nombre: string
  materias: string[]
  cuestionarios: number
  ultimaVez: string | null
  /** El porcentaje de aciertos de los últimos 30 días, o null si no practicó. */
  aciertosDelMes: number | null
  dominados: string[]
  aReforzar: string[]
  /** Practicados, pero con pocas respuestas para decir que los domina. */
  enCamino: string[]
  proximosPasos: string
}

/** "Camila Ríos" → "Camila R."; un solo nombre queda igual. */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`
}

/** Los próximos pasos que escribió el docente, limpios y con tope. */
export function limpiarProximosPasos(texto: unknown): string {
  return String(texto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, LARGO_MAXIMO_PROXIMOS_PASOS)
}

export function armarInforme(datos: DatosParaElInforme, proximosPasos: string, ahora: Date): InformeParaLaFamilia {
  const desde = ahora.getTime() - DIAS_DEL_LINK * 86_400_000
  const delMes = datos.intentos.filter((i) => new Date(i.completadoEl).getTime() >= desde)
  const correctas = delMes.reduce((s, i) => s + i.correctas, 0)
  const calificadas = delMes.reduce((s, i) => s + i.calificadas, 0)
  const porEstado = (e: TemaDeAlumno['estado']) => datos.temas.filter((t) => t.estado === e).map((t) => t.tema)
  const ultima = [...datos.intentos].sort((a, b) => (a.completadoEl < b.completadoEl ? 1 : -1))[0]
  return {
    nombre: nombreCorto(datos.nombre),
    materias: datos.materias,
    cuestionarios: datos.intentos.length,
    ultimaVez: ultima?.completadoEl ?? null,
    aciertosDelMes: calificadas > 0 ? Math.round((100 * correctas) / calificadas) : null,
    dominados: porEstado('dominado'),
    aReforzar: porEstado('flojo'),
    enCamino: datos.temas.filter((t) => t.estado === 'sin_datos' && t.calificadas > 0).map((t) => t.tema),
    proximosPasos: limpiarProximosPasos(proximosPasos),
  }
}

/** Si el link sigue valiendo: no revocado y no vencido. */
export function linkVigente(link: { venceEl: string | Date; revocadoEl: string | Date | null }, ahora: Date): boolean {
  return !link.revocadoEl && new Date(link.venceEl).getTime() > ahora.getTime()
}

/** Un token de link con la forma que se genera (43 caracteres base64url). Lo demás ni se busca. */
export function tokenConForma(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}
