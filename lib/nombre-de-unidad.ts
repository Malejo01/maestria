/**
 * I3: cómo se llama una unidad después de leer el programa.
 *
 * Según cómo esté escrito cada programa salían "Unidad I – Números y
 * operaciones", "UNIDAD I: LÓGICA PROPOSICIONAL", "Unidad Nº 1: Fundamentos…"
 * y "1". La regla es corta a propósito:
 *   - sólo un número o un romano ("1", "IV", "2.") → "Unidad 1", "Unidad 4";
 *   - todo en mayúsculas → mayúscula inicial (y después de ":" o de un guion),
 *     respetando romanos y siglas conocidas (TIC, MCM, R2…);
 *   - un "UNIDAD" en mayúsculas al principio pasa a "Unidad";
 *   - el resto no se toca: no inventamos títulos.
 */

const ROMANO = /^(?=[IVX])X{0,3}(IX|IV|V?I{0,3})$/

const VALOR_ROMANO: Record<string, number> = { I: 1, V: 5, X: 10 }

function romanoANumero(romano: string): number {
  let total = 0
  for (let i = 0; i < romano.length; i++) {
    const actual = VALOR_ROMANO[romano[i]]
    const siguiente = VALOR_ROMANO[romano[i + 1]] ?? 0
    total += actual < siguiente ? -actual : actual
  }
  return total
}

/** Siglas que se escriben en mayúsculas aunque el resto del título no. */
export const SIGLAS = new Set([
  'TIC', 'TICS', 'TICX', 'MCM', 'MCD', 'ESI', 'ABP', 'IA', 'PC', 'CPU', 'HTML', 'CSS', 'SQL', 'UML', 'API',
  'ADN', 'ARN', 'ONU', 'UBA', 'ARG', 'NAP', 'PBI', 'IVA', 'SI', 'MRU', 'MRUV', 'GPS', 'TV', 'URL', 'PDF',
])

/** Una palabra en mayúsculas, como va en un título con mayúscula inicial. */
function palabraEnTitulo(palabra: string): string {
  const letras = palabra.replace(/[^\p{L}\p{N}]/gu, '')
  if (!letras) return palabra
  // Romanos, siglas y lo que tiene números (R2, R3, 3D) se dejan como están.
  if (ROMANO.test(letras) || SIGLAS.has(letras) || /\d/.test(letras)) return palabra
  return palabra.toLocaleLowerCase('es')
}

function esTodoMayusculas(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, '')
  return letras.length >= 3 && letras === letras.toLocaleUpperCase('es') && letras !== letras.toLocaleLowerCase('es')
}

function conMayusculaInicial(texto: string): string {
  return texto.replace(/\p{L}/u, (letra) => letra.toLocaleUpperCase('es'))
}

export function normalizarNombreDeUnidad(nombre: string): string {
  const limpio = nombre.replace(/\s+/g, ' ').trim()
  if (!limpio) return limpio

  // "1", "1.", "IV", "IV." → "Unidad 1", "Unidad 4".
  const solo = limpio.replace(/[.:)\-–]+$/, '').trim()
  if (/^\d{1,2}$/.test(solo)) return `Unidad ${Number(solo)}`
  if (ROMANO.test(solo.toUpperCase()) && solo === solo.toUpperCase()) return `Unidad ${romanoANumero(solo)}`

  // "UNIDAD I: Función de variable real": sólo la palabra del principio.
  if (!esTodoMayusculas(limpio)) return limpio.replace(/^UNIDAD(?=\s|:|$)/, 'Unidad')

  // Todo en mayúsculas: cada tramo (separado por ":" o un guion) empieza con
  // mayúscula; el resto, en minúscula salvo romanos y siglas.
  return limpio
    .split(/(\s*[:–—]\s*|\s+-\s+)/)
    .map((tramo, i) =>
      i % 2 === 1 ? tramo : conMayusculaInicial(tramo.split(' ').map(palabraEnTitulo).join(' ')),
    )
    .join('')
}
