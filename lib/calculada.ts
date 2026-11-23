import { comodinesDe, evaluarFormula } from '@/lib/evaluar-formula'
import { formatearNumero } from '@/lib/numeros'
import type { CalculatedQuestion, CalculatedVariable } from '@/lib/types'

/**
 * Ronda T · F7 — La pregunta calculada (Moodle `calculated`): un enunciado con
 * comodines {a}, {b}…, una fórmula y el rango de cada comodín. Al generarla se
 * sortean los valores (el alumno ve números, no letras) y la correcta sale de
 * la fórmula con el evaluador propio (lib/evaluar-formula.ts, sin eval).
 * A Moodle se exporta la plantilla con sus conjuntos de datos, así cada
 * alumno de Moodle recibe otros números.
 */

const redondear = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales

/** Un número al azar del rango del comodín, con sus decimales. */
function sortear(v: CalculatedVariable, aleatorio: () => number): number {
  return redondear(v.min + aleatorio() * (v.max - v.min), v.decimals)
}

/** El enunciado con los valores en lugar de los comodines (con coma decimal). */
export function enunciadoConValores(plantilla: string, valores: Record<string, number>): string {
  return plantilla.replace(/\{([a-z][a-z0-9_]*)\}/gi, (todo, nombre: string) => (nombre in valores ? formatearNumero(valores[nombre]) : todo))
}

/** Un generador de números al azar con semilla (el mismo para la misma semilla). */
export function aleatorioConSemilla(semilla: string): () => number {
  let h = 2166136261
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
    return (h >>> 0) / 4294967296
  }
}

/**
 * Sortea los valores y arma la pregunta que ve el alumno. Si con algún sorteo
 * la fórmula no da un número (una división por cero, una raíz de negativo),
 * sortea de nuevo; si en 20 intentos no sale, devuelve null.
 */
export function instanciarCalculada<T extends Pick<CalculatedQuestion, 'formula' | 'variables'> & { question: string; plantilla?: string }>(
  q: T,
  aleatorio: () => number = Math.random,
): (T & Pick<CalculatedQuestion, 'plantilla' | 'valores' | 'correctAnswer'>) | null {
  const plantilla = q.plantilla ?? q.question
  for (let intento = 0; intento < 20; intento++) {
    const valores = Object.fromEntries(q.variables.map((v) => [v.name, sortear(v, aleatorio)]))
    try {
      const correcta = evaluarFormula(q.formula, valores)
      return { ...q, plantilla, valores, correctAnswer: correcta, question: enunciadoConValores(plantilla, valores) }
    } catch {
      // Otro sorteo.
    }
  }
  return null
}

/**
 * Una calculada que sirve: de 1 a 4 comodines, los mismos en el enunciado y
 * en sus rangos (y la fórmula no usa ninguno sin rango), cada rango con
 * mínimo menor que máximo y 0 a 3 decimales, una tolerancia relativa entre 0
 * y 10 %, y la fórmula da un número en al menos 8 de 10 sorteos.
 */
export function calculadaValida(q: { question?: string; plantilla?: string; formula?: unknown; variables?: unknown; tolerance?: unknown }): boolean {
  const plantilla = q.plantilla ?? q.question
  if (typeof plantilla !== 'string' || typeof q.formula !== 'string' || !Array.isArray(q.variables)) return false
  const variables = q.variables as CalculatedVariable[]
  if (variables.length < 1 || variables.length > 4) return false
  const nombres = variables.map((v) => v?.name)
  if (new Set(nombres).size !== nombres.length) return false
  for (const v of variables) {
    if (typeof v.name !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(v.name)) return false
    if (!Number.isFinite(v.min) || !Number.isFinite(v.max) || v.min >= v.max) return false
    if (!Number.isInteger(v.decimals) || v.decimals < 0 || v.decimals > 3) return false
  }
  const enEnunciado = comodinesDe(plantilla)
  if (enEnunciado.length !== nombres.length || !enEnunciado.every((n) => nombres.includes(n))) return false
  if (!comodinesDe(q.formula).every((n) => nombres.includes(n))) return false
  const tolerancia = Number(q.tolerance)
  if (!(tolerancia > 0 && tolerancia <= 0.1)) return false
  const aleatorio = aleatorioConSemilla(q.formula)
  let buenos = 0
  for (let i = 0; i < 10; i++) {
    try {
      evaluarFormula(q.formula, Object.fromEntries(variables.map((v) => [v.name, sortear(v, aleatorio)])))
      buenos++
    } catch {
      // No cuenta.
    }
  }
  return buenos >= 8
}

/** Tolerancia relativa: |x − c| ≤ t·|c| (con c = 0, t como margen absoluto). */
export function corregirCalculada(correcta: number, tolerancia: number, respuesta: number): boolean {
  if (!Number.isFinite(respuesta)) return false
  const margen = correcta === 0 ? tolerancia : tolerancia * Math.abs(correcta)
  return Math.abs(respuesta - correcta) <= margen + 1e-12
}

/** El margen absoluto de la correcta (para la numérica de GIFT y para mostrarlo). */
export function margenAbsoluto(correcta: number, tolerancia: number): number {
  return correcta === 0 ? tolerancia : Math.abs(correcta) * tolerancia
}

/** Los valores del conjunto de datos de un comodín para Moodle (siempre los mismos para la pregunta). */
export function valoresDelConjunto(v: CalculatedVariable, cantidad: number, semilla: string): number[] {
  const aleatorio = aleatorioConSemilla(`${semilla}:${v.name}`)
  return Array.from({ length: cantidad }, () => sortear(v, aleatorio))
}
