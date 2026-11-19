/**
 * K3: una consigna, una respuesta.
 *
 * Una pregunta `numeric` o `short_answer` tiene UN casillero. Si la consigna
 * pide dos resultados ("Calcule la media aritmética y la mediana"), el alumno
 * no sabe qué escribir y, escriba lo que escriba, la mitad de lo pedido no se
 * evalúa. El prompt ya lo prohíbe; esto es la red de seguridad, al lado de
 * `isConceptualNumericQuestion`: la pregunta se descarta y el bucle de
 * generación pide otra.
 *
 * Es deliberadamente conservador. Mira lo que la consigna PIDE (lo que sigue a
 * "calculá", "determiná", "¿cuál es…") y no los datos: "Calculá el área
 * sabiendo que la base y la altura miden 3 y 4" pide un solo valor.
 */

/** Medidas que se piden calcular. Con artículo opcional, en singular o plural. */
const MEDIDAS = [
  'media(?:\\s+aritm[eé]tica)?',
  'promedio',
  'mediana',
  'moda',
  'rango',
  'desv[ií]o(?:\\s+est[aá]ndar)?',
  'desviaci[oó]n(?:\\s+est[aá]ndar)?',
  'varianza',
  'per[ií]metro',
  '[aá]rea',
  'superficie',
  'volumen',
  'mcd',
  'mcm',
  'm[aá]ximo\\s+com[uú]n\\s+divisor',
  'm[ií]nimo\\s+com[uú]n\\s+m[uú]ltiplo',
  'suma',
  'resta',
  'diferencia',
  'producto',
  'cociente',
  'resto',
  'pendiente',
  'ordenada(?:\\s+al\\s+origen)?',
  'ra[ií]z',
  'v[eé]rtice',
  'radio',
  'di[aá]metro',
  'hipotenusa',
  'velocidad',
  'aceleraci[oó]n',
  'distancia',
  'tiempo',
  'fuerza',
  'masa',
  'precio',
  'costo',
  'ganancia',
  'inter[eé]s',
  'probabilidad',
  'frecuencia(?:\\s+(?:absoluta|relativa))?',
].join('|')

const ARTICULO = '(?:(?:el|la|los|las|su|sus)\\s+)?'
const MEDIDA = `(?:${MEDIDAS})`

/** Verbos o preguntas que introducen lo que hay que calcular. */
const PEDIDO =
  // `\w` no reconoce la tilde: "Calculá", "Determiná", "Hallá".
  '(?:(?:calcul|determin|hall|encontr|obten|obt[eé]n|indic|averigu|resolv)[\\wáéíóú]*|' +
  '¿\\s*cu[aá]l(?:es)?\\s+(?:es|son|ser[aá]n?)|¿\\s*cu[aá]nto\\s+(?:vale|valen|mide|miden|es|son))'

/**
 * "la media y la mediana", "el perímetro y el área", "el MCD y el MCM":
 * dos medidas distintas unidas por "y", justo como objeto del pedido (a lo
 * sumo tres palabras entre el verbo y la primera, y dos entre la primera y la
 * "y", para "la media aritmética de estos datos y la mediana").
 */
const DOS_MEDIDAS = new RegExp(
  `${PEDIDO}\\s+(?:[\\wáéíóúñ]+\\s+){0,3}?${ARTICULO}(${MEDIDA})\\b(?:\\s+[\\wáéíóúñ,]+){0,4}?\\s+(?:y|e)\\s+(?:tambi[eé]n\\s+)?${ARTICULO}(${MEDIDA})\\b`,
  'i',
)

/** "¿Cuánto…? ¿Y cuántos…?": dos preguntas que piden un valor cada una. */
const PREGUNTA_DE_VALOR = /¿[^?]*\b(?:cu[aá]nt[oa]s?|cu[aá]l(?:es)?|qu[eé]\s+(?:valor|n[uú]mero|resultado))\b[^?]*\?/gi

/** "Calcule a) … b) …", "1) … 2) …", "i) … ii) …". */
const ENUMERACION = /(?:^|[\s:;,.])(?:a|1|i)\)\s[\s\S]*?(?:^|[\s:;,.])(?:b|2|ii)\)\s/i

export type MotivoMultiple = 'dos_medidas' | 'dos_preguntas' | 'enumeracion'

/** Por qué la consigna pide más de un valor, o null si pide uno solo. */
export function motivoConsignaMultiple(enunciado: string): MotivoMultiple | null {
  if (typeof enunciado !== 'string' || !enunciado.trim()) return null
  // Lo que está entre `$…$` son fórmulas: "x y y" ahí no es una conjunción.
  const texto = enunciado.replace(/\$[^$]*\$/g, ' X ')

  const dos = texto.match(DOS_MEDIDAS)
  if (dos && normalizar(dos[1]) !== normalizar(dos[2])) return 'dos_medidas'

  const preguntas = texto.match(PREGUNTA_DE_VALOR) ?? []
  if (preguntas.length >= 2) return 'dos_preguntas'

  if (ENUMERACION.test(texto)) return 'enumeracion'
  return null
}

function normalizar(medida: string): string {
  return medida
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)[0]
}

/**
 * ¿Una pregunta de un solo casillero (`numeric` o `short_answer`) cuya
 * consigna pide más de un valor? Las de opción múltiple y verdadero/falso no:
 * ahí la opción ya trae los dos valores juntos.
 */
export function pideMasDeUnValor(question: { type?: unknown; question?: unknown }): boolean {
  if (question.type !== 'numeric' && question.type !== 'short_answer') return false
  return motivoConsignaMultiple(String(question.question ?? '')) !== null
}
