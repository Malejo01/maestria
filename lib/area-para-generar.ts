import {
  bloquesDeNotacion,
  limitarMezcla,
  mezclaPonderada,
  perfilDeArea,
  rolEspecialista,
  type AreaId,
  type BloquesDeNotacion,
  type Caracter,
  type Modo,
  type PerfilDeArea,
} from './areas'
import { caracterDeLaUnidad, type UnidadConCaracter } from './area-del-programa'
import type { QuestionTypeMix } from './question-mix'
import type { QuestionType } from './types'

/**
 * Ronda T · A4 — Lo que el área le aporta a una generación (puro).
 *
 * Todo lo que genera preguntas pasa por `generateQuiz`, y ahí se arma esto una
 * vez: el perfil del área, el carácter de cada unidad que entra (pesado por la
 * cantidad de temas elegidos de ella), la mezcla de tipos por modo con el tope
 * del 50 %, la sección "ÁREA Y CÓMO SE EVALÚA" y el bloque de notación que
 * corresponde (LaTeX sólo si algo es cuantitativo; código sólo en informática).
 */

export interface UnidadParaGenerar extends UnidadConCaracter {
  topics?: { id?: unknown; name?: unknown }[]
}

export interface ContextoDeArea {
  area: AreaId
  perfil: PerfilDeArea
  /** El carácter de cada unidad que aporta temas (o el del área, si no se sabe). */
  caracteres: Caracter[]
  /** Unidad por unidad: su carácter y cuántos de los temas elegidos son suyos. */
  pesos: { caracter: Caracter; temas: number }[]
  bloques: BloquesDeNotacion
}

const normalizar = (texto: unknown) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Cuántos de los temas elegidos son de cada unidad. Un tema se reconoce por id
 * o por nombre; si ninguno se reconoce (P4 manda sólo los temas), todas las
 * unidades cuentan parejo.
 */
export function contextoDeArea({
  area,
  unidades,
  temas,
}: {
  area: AreaId
  unidades: readonly UnidadParaGenerar[]
  temas: readonly { id?: unknown; name?: unknown }[]
}): ContextoDeArea {
  const perfil = perfilDeArea(area)
  const ids = new Set(temas.map((t) => String(t.id ?? '')).filter(Boolean))
  const nombres = new Set(temas.map((t) => normalizar(t.name)).filter(Boolean))

  const pesos = unidades
    .map((unidad) => {
      const propios = (Array.isArray(unidad.topics) ? unidad.topics : []).filter(
        (t) => ids.has(String(t?.id ?? '')) || nombres.has(normalizar(t?.name)),
      ).length
      return { caracter: caracterDeLaUnidad(unidad, area), temas: propios }
    })
  const conTemas = pesos.filter((p) => p.temas > 0)
  const usados = conTemas.length > 0 ? conTemas : pesos.map((p) => ({ ...p, temas: 1 }))
  const caracteres = usados.length > 0 ? [...new Set(usados.map((p) => p.caracter))] : [perfil.caracter]

  return {
    area,
    perfil,
    caracteres,
    pesos: usados.length > 0 ? usados : [{ caracter: perfil.caracter, temas: 1 }],
    bloques: bloquesDeNotacion(area, caracteres),
  }
}

/** La mezcla del área para un modo, ya con el tope del 50 %. */
export function mezclaDelArea(ctx: ContextoDeArea, modo: Modo): QuestionTypeMix {
  return limitarMezcla(mezclaPonderada(ctx.area, modo, ctx.pesos))
}

/** "MODO PRÁCTICO: …", con lo que significa práctico en esa área. */
export function descripcionDelModo(ctx: ContextoDeArea, modo: Modo): string {
  const titulo = modo === 'teorico' ? 'MODO TEÓRICO' : modo === 'practico' ? 'MODO PRÁCTICO' : 'MODO MIXTO'
  return `${titulo}: ${ctx.perfil.modos[modo].descripcion}`
}

export function rolDeLaGeneracion(ctx: ContextoDeArea, materia: string): string {
  return rolEspecialista(ctx.area, materia)
}

/** La sección del prompt de sistema: rol, qué significa el modo y ejemplos. */
export function seccionDeArea(ctx: ContextoDeArea, modo: Modo): string {
  const modos: Modo[] = modo === 'mixto' ? ['teorico', 'practico'] : [modo]
  const lineas = modos.map((m) => {
    const d = ctx.perfil.modos[m]
    const ejemplos = d.ejemplos.length > 0 ? `\n  Ejemplos de consigna (el estilo, no el tema): ${d.ejemplos.map((e) => `"${e.replace(/\n/g, ' ')}"`).join(' · ')}` : ''
    return `- ${m === 'teorico' ? 'Teórico' : 'Práctico'}: ${d.descripcion}${ejemplos}`
  })
  const cuantitativas = ctx.caracteres.includes('cuantitativo')
  const soloConceptual = ctx.caracteres.every((c) => c === 'conceptual')
  const reglaDeCalculo = soloConceptual
    ? '\n- Estos temas se evalúan SIN cálculos: no pidas cuentas, no uses fórmulas ni LaTeX, y no generes preguntas "numeric".'
    : cuantitativas
      ? ''
      : '\n- Los cálculos, si aparecen, son simples y al servicio del concepto.'
  return `ÁREA Y CÓMO SE EVALÚA: ${ctx.perfil.nombre}
${lineas.join('\n')}${reglaDeCalculo}`
}

export const BLOQUE_LATEX = `FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO (si aplica):
- TODO contenido matemático debe estar entre $...$
- Usa LaTeX estándar: \\frac{a}{b}, \\sqrt{x}, x^2, etc.
- Operadores lógicos: $p \\wedge q$ (y), $p \\vee q$ (o), $\\neg p$ (no), $p \\rightarrow q$ (si...entonces), $p \\leftrightarrow q$ (si y solo si)
- Escapa backslashes: \\\\frac, \\\\sqrt, \\\\wedge (dos barras en JSON)
- COMA DECIMAL (Argentina): en enunciados, opciones, respuestas aceptadas y explicaciones los decimales se escriben con coma, nunca con punto: 3,14 · 0,75. Dentro de LaTeX la coma decimal va como {,} para que no quede un espacio: $3{,}14$. Los miles, si hacen falta, con punto: 12.500. Un decimal largo se redondea a lo sumo a cuatro cifras (0,9167), y si el resultado es una fracción que no da un decimal exacto, se escribe como fracción. El campo numérico "correctAnswer" del JSON sigue siendo un número JSON con punto (0.75): la coma es sólo para el texto.`

const BLOQUE_SOLO_NUMEROS = `NÚMEROS Y FÓRMULAS (sólo donde haga falta):
- Montos, porcentajes y tasas en texto: 12.500 pesos, 4 %, 0,35. Nunca el símbolo $ para dinero.
- Una fórmula simple va en LaTeX entre $...$ (por ejemplo $E = \\frac{\\Delta Q / Q}{\\Delta P / P}$), con las barras escapadas en JSON (\\\\frac).
- COMA DECIMAL (Argentina): 3,14 en el texto; dentro de LaTeX, $3{,}14$. Los miles con punto: 12.500. El "correctAnswer" numérico del JSON va con punto (0.75).`

const BLOQUE_FORMULAS = `FÓRMULAS QUÍMICAS:
- Escribí las fórmulas con subíndices en LaTeX entre $...$: $H_2O$, $CO_2$, $H_2SO_4$; las flechas de reacción como $\\rightarrow$. Escapá las barras en JSON (\\\\rightarrow).
- COMA DECIMAL (Argentina) en el texto: 0,5 mol; dentro de LaTeX, $0{,}5$. El "correctAnswer" numérico del JSON va con punto.`

const BLOQUE_CODIGO = `CÓDIGO:
- Un fragmento de código va en un bloque con su lenguaje: \`\`\`python … \`\`\` (en JSON, los saltos de línea como \\n).
- Fragmentos breves (hasta 12 líneas), que se lean sin ejecutarlos, con nombres de variables claros.
- Si la respuesta es lo que imprime el programa, que sea un único valor.
- No uses LaTeX salvo que el tema sea matemático.`

/** Los bloques de notación que van al prompt de sistema, en orden. */
export function bloqueDeNotacion(bloques: BloquesDeNotacion): string {
  const partes: string[] = []
  if (bloques.latex) partes.push(bloques.latexSoloNumeros ? BLOQUE_SOLO_NUMEROS : BLOQUE_LATEX)
  if (bloques.formulas) partes.push(BLOQUE_FORMULAS)
  if (bloques.codigo) partes.push(BLOQUE_CODIGO)
  return partes.join('\n\n')
}

/**
 * El tope del 50 % al juntar las preguntas: con más de un tipo pedido, un tipo
 * que ya tiene su máximo no suma más (la pregunta queda de reserva, por si al
 * final no se completa la cantidad).
 */
export function excedeElTope(cuenta: ReadonlyMap<QuestionType, number>, tipo: QuestionType, maximo: number): boolean {
  return (cuenta.get(tipo) ?? 0) >= maximo
}
