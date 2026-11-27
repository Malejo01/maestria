import { ALUMNOS_POR_BLOQUE, DIAS_PASE, DIAS_MENSUAL, precioPase, type ResumenDelPlan } from './planes'

/**
 * Ronda T · B3 — Lo de /precios que no es del plan Particular (puro). Los
 * montos salen de variables de entorno, como siempre: ninguno está escrito acá.
 */
type Entorno = Record<string, string | undefined>

function montoDe(env: Entorno, clave: string): number | null {
  const crudo = env[clave]?.trim()
  if (!crudo) return null
  const monto = Number(crudo)
  return Number.isFinite(monto) && monto > 0 ? monto : null
}

/** Un curso de hasta 35, por 30 días (`MAESTRIA_PRECIO_AULA_CURSO`). */
export function precioAulaCurso(env: Entorno = process.env): number | null {
  return montoDe(env, 'MAESTRIA_PRECIO_AULA_CURSO')
}

/** Cada curso adicional (`MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL`). */
export function precioAulaCursoAdicional(env: Entorno = process.env): number | null {
  return montoDe(env, 'MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL')
}

/** Lo que cuesta el Aula con N cursos: el primero, y los adicionales. */
export function precioAula(cursos: number, env: Entorno = process.env): number | null {
  const primero = precioAulaCurso(env)
  if (primero === null || cursos < 1) return null
  if (cursos === 1) return primero
  const adicional = precioAulaCursoAdicional(env)
  return adicional === null ? null : primero + (cursos - 1) * adicional
}

/**
 * El link de WhatsApp de "Hablemos" (`MAESTRIA_WHATSAPP_CONTACTO`, el número
 * con código de país, con o sin "+" y espacios). null si falta o no es un
 * número: entonces la opción no se ofrece.
 */
export function linkDeWhatsApp(mensaje: string, env: Entorno = process.env): string | null {
  const numero = (env.MAESTRIA_WHATSAPP_CONTACTO ?? '').replace(/[\s()+-]/g, '')
  if (!/^\d{8,15}$/.test(numero)) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

/** AB3: el pase por materia del autodidacta (`MAESTRIA_PRECIO_PASE_ALUMNO`), o null sin la variable. */
export function precioPaseAlumno(env: Entorno = process.env): number | null {
  const crudo = env.MAESTRIA_PRECIO_PASE_ALUMNO?.trim()
  const monto = crudo ? Number(crudo) : NaN
  return Number.isFinite(monto) && monto > 0 ? monto : null
}

/**
 * "Son $4.000 por alumno por mes": el pase de 1 bloque, dividido por sus 5
 * alumnos y por los meses que dura (90 días = 3 meses de 30). Redondeado al
 * peso. null sin precio.
 */
export function pasePorAlumnoPorMes(env: Entorno = process.env): number | null {
  const pase = precioPase(1, env)
  if (pase === null) return null
  return Math.round(pase / ALUMNOS_POR_BLOQUE / (DIAS_PASE / DIAS_MENSUAL))
}

export type Camino = 'particular' | 'aula'

export function leerCamino(valor: unknown): Camino | null {
  return valor === 'particular' || valor === 'aula' ? valor : null
}

/**
 * Con sesión de docente, el camino arranca elegido según lo que ya usa: plan
 * Aula → Aula; si no, Particular (las fichas y los alumnos sueltos son lo que
 * hoy usa todo el que paga). null para el exento o sin plan.
 */
export function caminoDelDocente(resumen: Pick<ResumenDelPlan, 'estado' | 'tipo'> | null): Camino | null {
  if (!resumen || resumen.estado === 'exento') return null
  return resumen.tipo === 'aula' ? 'aula' : 'particular'
}
