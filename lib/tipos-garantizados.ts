/**
 * Ronda U · U1 — Al menos una pregunta de cada tipo pedido.
 *
 * En el recorrido G1, con 5 tipos pedidos para 5 preguntas, la IA no armó ni
 * la calculada ni el ordenamiento. `generateQuiz` junta como siempre (el bucle
 * de A4) y, si falta un tipo que la persona tildó, pide una tanda chica sólo
 * de ese tipo y reemplaza una pregunta de un tipo que sobra.
 *
 * Lo que no se puede (una calculada en una unidad conceptual, que A1 no
 * permite) no se fuerza: se informa con un aviso.
 *
 * Todo esto es puro; el servidor sólo lo usa.
 */
import type { QuestionType } from '@/lib/types'
import type { Caracter } from '@/lib/areas'

/** Los tipos que necesitan cuentas: sólo con alguna unidad cuantitativa. */
export const TIPOS_CON_CALCULO: readonly QuestionType[] = ['numeric', 'calculated']

/** Los que nunca van en la tanda teórica de un mixto (`questionTypesForMode`). */
const SOLO_PRACTICO: readonly QuestionType[] = ['numeric', 'calculated']

export type MotivoSinTipo =
  /** Ninguna unidad elegida tiene cálculos (A1). */
  | 'sin-calculos'
  /** Se pidió y, con la tanda extra, la IA no lo armó bien. */
  | 'no-salio'
  /** Se pidieron más tipos que preguntas. */
  | 'no-entra'

export interface AvisoDeTipo {
  tipo: QuestionType
  motivo: MotivoSinTipo
}

/**
 * Qué tipos pedidos se pueden garantizar y cuáles no, antes de generar.
 *
 * - `permitidos`: los tipos con los que se va a generar (ya filtrados por el
 *   área). Un pedido que no está ahí no se puede: si es de cálculo, por la
 *   unidad conceptual.
 * - A lo sumo `cantidad` tipos: con más tipos que preguntas, los primeros en
 *   el orden en que se pidieron; los demás, con el aviso `no-entra`.
 */
export function planDeTipos(
  pedidos: readonly QuestionType[],
  permitidos: readonly QuestionType[],
  cantidad: number,
): { garantizar: QuestionType[]; avisos: AvisoDeTipo[] } {
  const avisos: AvisoDeTipo[] = []
  const posibles: QuestionType[] = []
  for (const tipo of new Set(pedidos)) {
    if (permitidos.includes(tipo)) posibles.push(tipo)
    else avisos.push({ tipo, motivo: TIPOS_CON_CALCULO.includes(tipo) ? 'sin-calculos' : 'no-salio' })
  }
  const lugar = Math.max(0, Math.floor(cantidad))
  for (const tipo of posibles.slice(lugar)) avisos.push({ tipo, motivo: 'no-entra' })
  return { garantizar: posibles.slice(0, lugar), avisos }
}

/** Los tipos a garantizar que todavía no tienen ninguna pregunta. */
export function tiposFaltantes(garantizar: readonly QuestionType[], preguntas: readonly { type?: unknown }[]): QuestionType[] {
  const hay = new Set(preguntas.map((p) => p.type))
  return garantizar.filter((tipo) => !hay.has(tipo))
}

/**
 * Qué pregunta se reemplaza para hacerle lugar a un tipo que falta: primero
 * una de un tipo que no hay que garantizar; si no, una de un tipo que tiene
 * más de una. Siempre la última de esas (las primeras suelen ser las más
 * básicas del tema). -1 si sacar cualquiera dejaría sin su tipo a otro.
 */
export function lugarParaReemplazar(preguntas: readonly { type?: unknown }[], garantizar: readonly QuestionType[]): number {
  const cuenta = new Map<unknown, number>()
  for (const p of preguntas) cuenta.set(p.type, (cuenta.get(p.type) ?? 0) + 1)
  for (let i = preguntas.length - 1; i >= 0; i--) {
    if (!garantizar.includes(preguntas[i].type as QuestionType)) return i
  }
  let mejor = -1
  let mayor = 1
  for (let i = preguntas.length - 1; i >= 0; i--) {
    const n = cuenta.get(preguntas[i].type) ?? 0
    if (n > mayor) {
      mayor = n
      mejor = i
    }
  }
  return mejor
}

/**
 * Pone cada pregunta nueva (de un tipo que faltaba) en el lugar de una que
 * sobra. Devuelve las preguntas y los tipos que siguen faltando. No cambia la
 * cantidad ni el orden de las demás.
 */
export function completarTipos<T extends { type?: unknown }>(
  preguntas: readonly T[],
  nuevas: readonly T[],
  garantizar: readonly QuestionType[],
): { preguntas: T[]; faltan: QuestionType[] } {
  const salida = [...preguntas]
  for (const nueva of nuevas) {
    if (!tiposFaltantes(garantizar, salida).includes(nueva.type as QuestionType)) continue
    const lugar = lugarParaReemplazar(salida, garantizar)
    if (lugar < 0) break
    salida[lugar] = nueva
  }
  return { preguntas: salida, faltan: tiposFaltantes(garantizar, salida) }
}

/**
 * El mixto que arma el navegador pide la mitad teórica y la práctica por
 * separado. Cada mitad garantiza su parte: los de cálculo van a la práctica
 * (la teórica no los admite); los demás se reparten para que ninguna mitad
 * tenga que garantizar más tipos que preguntas.
 */
export function repartirEntreMitades(
  tipos: readonly QuestionType[],
  teoricoCount: number,
  practicoCount: number,
): { teorico: QuestionType[]; practico: QuestionType[] } {
  const teorico: QuestionType[] = []
  const practico: QuestionType[] = []
  const unicos = [...new Set(tipos)]
  for (const tipo of unicos.filter((t) => SOLO_PRACTICO.includes(t))) {
    if (practico.length < practicoCount) practico.push(tipo)
  }
  for (const tipo of unicos.filter((t) => !SOLO_PRACTICO.includes(t))) {
    if (teorico.length < teoricoCount && (teorico.length <= practico.length || practico.length >= practicoCount)) teorico.push(tipo)
    else if (practico.length < practicoCount) practico.push(tipo)
    else if (teorico.length < teoricoCount) teorico.push(tipo)
  }
  return { teorico, practico }
}

/** Si todas las unidades son conceptuales, los tipos de cálculo no van. */
export function sinTiposDeCalculo(tipos: readonly QuestionType[], caracteres: readonly Caracter[]): QuestionType[] {
  if (caracteres.length === 0 || caracteres.some((c) => c !== 'conceptual')) return [...tipos]
  const salida = tipos.filter((t) => t !== 'calculated')
  return salida.length > 0 ? salida : ['multiple_choice']
}

/**
 * Los avisos que siguen valiendo para el cuestionario final: si un tipo
 * terminó apareciendo (por ejemplo, en la otra mitad de un mixto), no se avisa.
 */
export function avisosVigentes(avisos: readonly AvisoDeTipo[], preguntas: readonly { type?: unknown }[]): AvisoDeTipo[] {
  const hay = new Set(preguntas.map((p) => p.type))
  return unirAvisos(avisos).filter((a) => !hay.has(a.tipo))
}

/** Une los avisos de dos mitades sin repetir un tipo (el primero manda). */
export function unirAvisos(...listas: readonly (readonly AvisoDeTipo[] | undefined)[]): AvisoDeTipo[] {
  const vistos = new Set<QuestionType>()
  const salida: AvisoDeTipo[] = []
  for (const lista of listas) {
    for (const aviso of lista ?? []) {
      if (vistos.has(aviso.tipo)) continue
      vistos.add(aviso.tipo)
      salida.push(aviso)
    }
  }
  return salida
}

/** Las frases para la interfaz, en el orden de los avisos. */
export function frasesDeAvisos(
  avisos: readonly AvisoDeTipo[],
  etiqueta: (tipo: QuestionType) => string,
  textos: {
    sinCalculos: (tipo: string) => string
    noSalio: (tipo: string) => string
    noEntra: (tipos: string[]) => string
  },
): string[] {
  const frases: string[] = []
  for (const a of avisos) {
    if (a.motivo === 'sin-calculos') frases.push(textos.sinCalculos(etiqueta(a.tipo)))
    if (a.motivo === 'no-salio') frases.push(textos.noSalio(etiqueta(a.tipo)))
  }
  const fuera = avisos.filter((a) => a.motivo === 'no-entra').map((a) => etiqueta(a.tipo))
  if (fuera.length > 0) frases.push(textos.noEntra(fuera))
  return frases
}

/** Lee los avisos que vienen en la respuesta de la ruta (nunca lanza). */
export function leerAvisos(data: unknown): AvisoDeTipo[] {
  const crudos = (data as { avisosDeTipos?: unknown } | null)?.avisosDeTipos
  if (!Array.isArray(crudos)) return []
  return crudos.filter(
    (a): a is AvisoDeTipo =>
      typeof a === 'object' && a !== null && typeof (a as AvisoDeTipo).tipo === 'string' &&
      ['sin-calculos', 'no-salio', 'no-entra'].includes((a as AvisoDeTipo).motivo),
  )
}
