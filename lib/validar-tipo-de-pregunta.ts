import { isConceptualNumericQuestion } from './quiz-scope'
import { leerInecuacion, formasDeInecuacion } from './inecuacion'

/**
 * M2 · Que el tipo de pregunta coincida con la consigna.
 *
 * Los reportes (#2, #3, #4 de septiembre y el #6 de Clarita, 20/11) son el
 * mismo defecto con dos caras:
 *
 *  - un `true_false` cuya consigna es una PREGUNTA, no una afirmación: "…, ¿qué
 *    sucede con el sentido de la desigualdad?" no se puede contestar con
 *    Verdadero o Falso;
 *  - un `numeric` cuya consigna pide palabras: "¿qué concepto matemático se
 *    debe emplear?".
 *
 * Y uno vecino: una `short_answer` que pide "el valor de x" cuando la respuesta
 * es un conjunto ("x <= 2"): 4 de 7 alumnos respondieron "2" y quedó mal.
 *
 * Puro y sin IA. Lo usa la generación (lib/quiz-generation.ts, en el mismo
 * filtro que descarta duplicados) para todo lo que se genera —tareas,
 * diagnósticos, práctica libre—, el aviso de *Revisar y editar* y el script
 * de sólo lectura `scripts/qa/tipos-incoherentes.ts`.
 */

export type ProblemaDeTipo =
  /** Verdadero o falso escrito como pregunta de sí o no, en un orden que se puede dar vuelta. */
  | 'vf-pregunta-si-no'
  /** Verdadero o falso escrito como pregunta abierta (qué, cómo, por qué…). */
  | 'vf-pregunta-abierta'
  /** Numérica cuya consigna pide un concepto, un procedimiento o un nombre. */
  | 'numerica-conceptual'
  /** Respuesta corta que pide "el valor" cuando la respuesta es un conjunto. */
  | 'inecuacion-como-valor'
  /**
   * No es un problema de la consigna: a un conjunto solución bien pedido le
   * faltaban formas aceptadas (`(-∞; 2]` además de `x <= 2`). Se completa sin
   * avisarle a nadie y no cuenta como tipo incoherente.
   */
  | 'inecuacion-formas'

export const MOTIVO_DE_PROBLEMA: Record<ProblemaDeTipo, string> = {
  'vf-pregunta-si-no': 'verdadero o falso escrito como pregunta',
  'vf-pregunta-abierta': 'verdadero o falso con una pregunta abierta',
  'numerica-conceptual': 'numérica que pide palabras',
  'inecuacion-como-valor': 'pide un valor y la respuesta es un conjunto',
  'inecuacion-formas': 'faltaban formas del conjunto solución',
}

interface PreguntaParaValidar {
  type?: unknown
  question?: unknown
  acceptedAnswers?: unknown
}

export type CorreccionDeTipo =
  | { accion: 'ok' }
  /** Se arregló sin IA: la consigna (y, si hace falta, las respuestas aceptadas). */
  | { accion: 'reescrita'; problema: ProblemaDeTipo; cambios: { question: string; acceptedAnswers?: string[] } }
  /** No hay forma determinista: hay que pedir otra pregunta. */
  | { accion: 'regenerar'; problema: ProblemaDeTipo }

/** Palabras con que empieza una pregunta abierta: no se contesta con sí o no. */
const INTERROGATIVA_ABIERTA =
  /^(qu[eé]|c[oó]mo|por\s*qu[eé]|para\s+qu[eé]|cu[aá]l(es)?|cu[aá]ndo|d[oó]nde|ad[oó]nde|cu[aá]nt[oa]s?|qui[eé]n(es)?|(a|de|en|con|por|sobre|hacia|desde)\s+(qu[eé]|cu[aá]l(es)?|qui[eé]n(es)?|d[oó]nde))(?=[\s,.:;?!]|$)/i

/**
 * Verbos con que empieza una pregunta de sí o no en orden verbo-sujeto ("¿Es 7
 * primo?"). Dar vuelta ese orden sin entender la oración no sale bien, así que
 * éstas se regeneran (salvo "¿Es cierto que…?", que tiene arreglo exacto).
 */
const EMPIEZA_CON_VERBO =
  /^(se\s+)?(es|son|est[aá]n?|tiene[n]?|puede[n]?|hay|existe[n]?|cumple[n]?|pertenece[n]?|corresponde[n]?|vale[n]?|resulta[n]?|debe[n]?|conviene[n]?|forma[n]?|representa[n]?|verifica[n]?|satisface[n]?|implica[n]?|equivale[n]?|coincide[n]?|da[n]?|sirve[n]?|alcanza[n]?|basta[n]?|invierte[n]?|cambia[n]?|mantiene[n]?|conserva[n]?|aumenta[n]?|disminuye[n]?|ocurre[n]?|sucede[n]?|pasa[n]?|favorece[n]?|dificulta[n]?|ayuda[n]?|permite[n]?|influye[n]?|afecta[n]?|necesita[n]?|requiere[n]?)(?=[\s,.:;?!]|$)/i

/** "¿Es cierto que X?", "¿Es siempre correcto afirmar que X?" → X. */
const ES_CIERTO_QUE =
  /^es\s+(siempre\s+)?(cierto|correcto|verdad|verdadero|v[aá]lido|posible\s+afirmar)\s+((afirmar|decir|sostener)\s+)?que\s+(.+)$/i

/**
 * "…. ¿Verdadero o falso?", "¿Es esta afirmación verdadera o falsa?": la
 * afirmación ya está antes; la pregunta final sobra.
 */
const VERDADERO_O_FALSO = /^(es\s+(esta|la)\s+(afirmaci[oó]n|proposici[oó]n|frase)\s+|es\s+(esto|eso|lo\s+anterior)\s+)?(verdader[oa]|cierto|cierta|v)\s+o\s+(fals[oa]|f)$/i

/**
 * Dos opciones unidas por "o" al empezar ("¿favorecen o dificultan…?"): es
 * abierta, se elige una. Sólo al empezar: "una regla o patrón" en el medio de
 * una pregunta de sí o no no la vuelve abierta.
 */
function ofreceOpciones(interrogativa: string): boolean {
  return /^[a-záéíóúñ]+\s+o\s+[a-záéíóúñ]+(?=[\s,.:;]|$)/i.test(interrogativa) && !/^(mayor|menor)\s+o\s+igual/i.test(interrogativa)
}

/** Lo que está entre `$…$` no cuenta para leer la consigna. */
function sinLatex(texto: string): string {
  return texto.replace(/\$[^$]*\$/g, ' X ').replace(/\\\(.*?\\\)/g, ' X ')
}

/** ¿La consigna está escrita como pregunta? */
export function esPregunta(texto: string): boolean {
  const limpio = sinLatex(texto).trim()
  return limpio.includes('¿') || /\?\s*["»”)]?\s*$/.test(limpio)
}

/**
 * Parte la consigna en lo que va antes de la pregunta y la pregunta misma
 * (sin los signos): "Si a > b, ¿qué pasa…?" → ["Si a > b, ", "qué pasa…"].
 */
function partirPregunta(texto: string): { antes: string; pregunta: string; despues: string } | null {
  const abre = texto.lastIndexOf('¿')
  if (abre !== -1) {
    const cierra = texto.indexOf('?', abre)
    const fin = cierra === -1 ? texto.length : cierra
    return {
      antes: texto.slice(0, abre),
      pregunta: texto.slice(abre + 1, fin).trim(),
      despues: cierra === -1 ? '' : texto.slice(cierra + 1).trim(),
    }
  }
  const cierra = texto.lastIndexOf('?')
  if (cierra === -1) return null
  // Sin "¿": la pregunta es la última oración.
  const previo = texto.slice(0, cierra)
  const corte = Math.max(previo.lastIndexOf('. '), previo.lastIndexOf(': '), previo.lastIndexOf('\n'))
  const inicio = corte === -1 ? 0 : corte + 2
  return { antes: texto.slice(0, inicio), pregunta: texto.slice(inicio, cierra).trim(), despues: texto.slice(cierra + 1).trim() }
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function minuscula(texto: string): string {
  // Sólo una palabra común ("El", "Todo"); no una sigla, una variable ("A
  // tiene…") ni una fórmula.
  if (!/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(texto)) return texto
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

/** Une lo de antes con la afirmación y cierra con punto. */
function armarAfirmacion(antes: string, afirmacion: string, despues: string): string {
  const cuerpo = afirmacion.replace(/\s*,?\s*o\s+no\s*$/i, '').replace(/[\s.]+$/, '')
  const inicio = antes.trim()
  // Después de un punto empieza otra oración; después de una coma, sigue.
  const frase = !inicio
    ? mayuscula(cuerpo)
    : /[.!:]$/.test(inicio)
      ? `${inicio} ${mayuscula(cuerpo)}`
      : `${inicio}${/[,;]$/.test(inicio) ? '' : ','} ${minuscula(cuerpo)}`
  return `${frase}.${despues ? ` ${despues}` : ''}`.replace(/\s+/g, ' ').trim()
}

function corregirVerdaderoFalso(texto: string): CorreccionDeTipo {
  if (!esPregunta(texto)) return { accion: 'ok' }
  const partes = partirPregunta(texto)
  if (!partes) return { accion: 'ok' }
  const interrogativa = sinLatex(partes.pregunta).trim()

  // "La directriz es perpendicular al eje. ¿Verdadero o Falso?": la afirmación
  // ya está; se saca la pregunta del final.
  if (VERDADERO_O_FALSO.test(interrogativa) && partes.antes.trim()) {
    return {
      accion: 'reescrita',
      problema: 'vf-pregunta-si-no',
      cambios: { question: armarAfirmacion('', partes.antes, partes.despues) },
    }
  }

  const esCierto = ES_CIERTO_QUE.exec(partes.pregunta.trim())
  if (esCierto) {
    return {
      accion: 'reescrita',
      problema: 'vf-pregunta-si-no',
      cambios: { question: armarAfirmacion(partes.antes, esCierto[5], partes.despues) },
    }
  }

  if (INTERROGATIVA_ABIERTA.test(interrogativa) || ofreceOpciones(interrogativa)) {
    return { accion: 'regenerar', problema: 'vf-pregunta-abierta' }
  }

  if (EMPIEZA_CON_VERBO.test(interrogativa)) {
    return { accion: 'regenerar', problema: 'vf-pregunta-si-no' }
  }

  // Orden sujeto-verbo ("…, ¿el sentido de la desigualdad se invierte?"):
  // sacarle los signos ya es una afirmación.
  return {
    accion: 'reescrita',
    problema: 'vf-pregunta-si-no',
    cambios: { question: armarAfirmacion(partes.antes, partes.pregunta, partes.despues) },
  }
}

/** Lo que pide un nombre, aunque el detector de K3/30-9 no lo tuviera. */
const PIDE_UN_NOMBRE = /(c[oó]mo\s+se\s+(llama|denomina|conoce)|qu[eé]\s+nombre|qu[eé]\s+(tipo|clase)\s+de\s+(n[uú]mero|funci[oó]n|figura|tri[aá]ngulo|[aá]ngulo|ecuaci[oó]n)\b(?!.*\bcu[aá]nt))/i

function esNumericaConceptual(pregunta: PreguntaParaValidar): boolean {
  if (pregunta.type !== 'numeric' || typeof pregunta.question !== 'string') return false
  return isConceptualNumericQuestion(pregunta) || PIDE_UN_NOMBRE.test(sinLatex(pregunta.question))
}

/** "Determine el valor de x que satisface…": pide UN número. */
const PIDE_EL_VALOR =
  /\b(el|un|los)\s+valor(es)?\s+(de\s+(la\s+inc[oó]gnita\s+)?\$?[a-z]\$?\s+)?(que\s+)?(satisface[n]?|verifica[n]?|cumple[n]?|resuelve[n]?|hace[n]?\s+(verdadera|cierta))\s+(a\s+)?(la\s+(inecuaci[oó]n|desigualdad)\s+)?/i

function corregirInecuacion(pregunta: PreguntaParaValidar): CorreccionDeTipo {
  if (pregunta.type !== 'short_answer' || typeof pregunta.question !== 'string') return { accion: 'ok' }
  const aceptadas = Array.isArray(pregunta.acceptedAnswers)
    ? pregunta.acceptedAnswers.filter((a): a is string => typeof a === 'string')
    : []
  const intervalo = aceptadas.map(leerInecuacion).find((i) => i !== null)
  if (!intervalo) return { accion: 'ok' }

  const formas = formasDeInecuacion(intervalo)
  const faltanFormas = formas.some((f) => !aceptadas.includes(f))
  const pideValor = PIDE_EL_VALOR.test(pregunta.question)
  if (!pideValor && !faltanFormas) return { accion: 'ok' }

  // "el valor de x que satisface 3x + 4 ≤ 10" → "el conjunto solución de 3x + 4 ≤ 10"
  const question = pideValor ? pregunta.question.replace(PIDE_EL_VALOR, 'el conjunto solución de ') : pregunta.question
  return {
    accion: 'reescrita',
    problema: pideValor ? 'inecuacion-como-valor' : 'inecuacion-formas',
    cambios: { question, acceptedAnswers: [...new Set([...aceptadas, ...formas])] },
  }
}

/**
 * Qué hacer con una pregunta recién generada (o ya guardada): dejarla,
 * arreglarla sin IA, o pedir otra.
 */
export function corregirTipoDePregunta(pregunta: PreguntaParaValidar): CorreccionDeTipo {
  if (typeof pregunta.question !== 'string') return { accion: 'ok' }
  if (pregunta.type === 'true_false') return corregirVerdaderoFalso(pregunta.question)
  if (esNumericaConceptual(pregunta)) return { accion: 'regenerar', problema: 'numerica-conceptual' }
  if (pregunta.type === 'short_answer') return corregirInecuacion(pregunta)
  return { accion: 'ok' }
}

/**
 * Para el aviso de *Revisar y editar* y el script de QA: ¿la consigna no encaja
 * con su tipo? Una inecuación a la que sólo le faltan formas aceptadas no es
 * un problema que el docente tenga que ver (lo completa la generación sola).
 */
export function problemaDeTipo(pregunta: PreguntaParaValidar): ProblemaDeTipo | null {
  const correccion = corregirTipoDePregunta(pregunta)
  if (correccion.accion === 'ok' || correccion.problema === 'inecuacion-formas') return null
  return correccion.problema
}
