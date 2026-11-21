/**
 * M5 · Un lector de GIFT que se porta como el de Moodle, para probar lo que
 * exporta lib/moodle-export.ts ANTES de que un docente lo suba.
 *
 * El 20/11 Mauro exportó el cuestionario de Matemática 1 y hubo que corregir a
 * mano 27 errores sobre 30 preguntas: la retroalimentación quedaba afuera de
 * las llaves, las llaves de conjunto llegaban como agrupación de LaTeX y un
 * tramo de la categoría pasaba los 255 caracteres. Este validador mira esas
 * cosas, y el test de exportación exige cero errores.
 *
 * Cómo lee Moodle (qformat_gift): primero cambia `\\` por una marca, después
 * `\~ \= \# \{ \} \:` por el carácter literal y `\n` por un salto de línea, y
 * recién ahí parte la pregunta por la llave de respuestas. Acá se hace igual.
 */

export interface ErrorDeGift {
  /** "Q3", o "categoría". */
  donde: string
  mensaje: string
}

export const MAXIMO_TRAMO_MOODLE = 255

/** Marcas privadas (zona de uso privado de Unicode): no aparecen en un texto real. */
const MARCA = {
  barra: '',
  '~': '',
  '=': '',
  '#': '',
  '{': '',
  '}': '',
  ':': '',
  n: '',
} as const

/** El texto con los escapes de GIFT cambiados por marcas: lo que queda sin marcar es estructura. */
export function marcarEscapes(texto: string): string {
  return texto
    .replace(/\\\\/g, MARCA.barra)
    .replace(/\\([~=#{}:n])/g, (_m, c: keyof typeof MARCA) => MARCA[c])
}

/** Lo que el alumno ve: las marcas vueltas a su carácter (`\n` como salto de línea). */
export function comoLlegaAMoodle(textoMarcado: string): string {
  return textoMarcado
    .replace(new RegExp(MARCA.barra, 'g'), '\\')
    .replace(new RegExp(MARCA.n, 'g'), '\n')
    .replace(/[-]/g, (m) => ({ '': '~', '': '=', '': '#', '': '{', '': '}', '': ':' })[m]!)
}

/**
 * ¿Las llaves de cada fórmula están balanceadas? `\{` y `\}` son llaves
 * literales (un conjunto) y no cuentan; las otras son agrupación.
 */
function latexBalanceado(texto: string): string | null {
  const formulas = texto.match(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g) ?? []
  for (const formula of formulas) {
    let nivel = 0
    for (let i = 0; i < formula.length; i += 1) {
      const c = formula[i]
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === '{') nivel += 1
      if (c === '}') nivel -= 1
      if (nivel < 0) return formula
    }
    if (nivel !== 0) return formula
  }
  return null
}

function validarPregunta(bloque: string, donde: string): ErrorDeGift[] {
  const errores: ErrorDeGift[] = []
  const marcado = marcarEscapes(bloque)
  const abre = [...marcado].filter((c) => c === '{').length
  const cierra = [...marcado].filter((c) => c === '}').length

  if (abre !== 1 || cierra !== 1) {
    errores.push({ donde, mensaje: `tiene ${abre} llaves "{" y ${cierra} "}" sin escapar; tiene que haber una de cada` })
    return errores
  }
  const inicio = marcado.indexOf('{')
  const fin = marcado.indexOf('}')
  if (fin < inicio) {
    errores.push({ donde, mensaje: 'la llave de cierre está antes que la de apertura' })
    return errores
  }
  const despues = marcado.slice(fin + 1).trim()
  if (despues) {
    errores.push({ donde, mensaje: `hay texto después de "}": Moodle lo muestra como enunciado («${comoLlegaAMoodle(despues).slice(0, 40)}»)` })
  }

  const respuestas = marcado.slice(inicio + 1, fin)
  const [opciones] = respuestas.split('####')
  // Un "~" sin escapar es una opción incorrecta: es opción múltiple.
  if (opciones.includes('~')) {
    const correctas = (opciones.match(/=/g) ?? []).length
    if (correctas !== 1) errores.push({ donde, mensaje: `opción múltiple con ${correctas} respuestas correctas ("="); tiene que haber una` })
  }

  const enunciado = comoLlegaAMoodle(marcado.slice(0, inicio))
  const contenido = comoLlegaAMoodle(respuestas)
  for (const [parte, texto] of [
    ['el enunciado', enunciado],
    ['las respuestas', contenido],
  ] as const) {
    const roto = latexBalanceado(texto)
    if (roto) errores.push({ donde, mensaje: `LaTeX con llaves desbalanceadas en ${parte}: ${roto.slice(0, 60)}` })
  }
  return errores
}

/**
 * Valida un archivo GIFT entero. Las preguntas se separan con una línea en
 * blanco, como las separa Moodle. Devuelve la lista de errores (vacía si
 * Moodle lo importaría sin tocarlo).
 */
export function validarGift(contenido: string): ErrorDeGift[] {
  const errores: ErrorDeGift[] = []
  const bloques = contenido
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('//'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)

  let numero = 0
  for (const bloque of bloques) {
    if (bloque.startsWith('$CATEGORY:')) {
      const tramos = bloque.slice('$CATEGORY:'.length).trim().split('/')
      for (const tramo of tramos) {
        if (tramo.length > MAXIMO_TRAMO_MOODLE) {
          errores.push({ donde: 'categoría', mensaje: `un tramo tiene ${tramo.length} caracteres; Moodle admite ${MAXIMO_TRAMO_MOODLE}` })
        }
      }
      continue
    }
    numero += 1
    const titulo = /^::(.*?)::/.exec(bloque)?.[1] ?? `pregunta ${numero}`
    errores.push(...validarPregunta(bloque, titulo))
  }
  return errores
}
