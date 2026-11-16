/**
 * I2: un tema es un concepto que se enseña y se evalúa por separado, no un
 * párrafo.
 *
 * Muchos programas universitarios escriben cada unidad como dos o tres
 * párrafos de conceptos encadenados, y la IA tomaba cada párrafo como un tema:
 * "Flojo en [un párrafo de 40 palabras]" no le sirve a nadie. El arreglo de
 * fondo está en el pedido al modelo (`REGLAS_DE_TEMAS`); esto es la red de
 * abajo, determinista: si igual vuelve un tema largo que enumera conceptos
 * separados por punto o punto y coma, se parte ahí. No se inventa nada: cada
 * pedazo es texto que ya estaba.
 */

/** Más largo que esto, y el tema se mira para partirlo. */
export const LARGO_MAXIMO_DE_TEMA = 90

/** Lo que se le pide al modelo sobre los temas (va dentro del prompt de extracción). */
export const REGLAS_DE_TEMAS = `Cada tema es un concepto que se puede enseñar y evaluar por separado. Si un parrafo u oracion enumera varios conceptos separados por punto, punto y coma o coma, separalos en temas distintos. Un tema no supera los ${LARGO_MAXIMO_DE_TEMA} caracteres. Si una unidad tendria mas de 12 temas, agrupa los que esten muy cerca. No inventes conceptos que no esten en el documento.`

function limpiar(pedazo: string): string {
  return pedazo
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•·:,.;]+|[\s\-–—•·:,;]+$/g, '')
    .replace(/\.$/, '')
    .trim()
}

/**
 * Un tema largo, partido en los conceptos que enumera. Corta en punto seguido
 * de espacio (no en "R2.3" ni en "1.5") y en punto y coma; la coma no, porque
 * "Figuras planas, perímetro y área" es un tema. Si no hay dónde cortar, o
 * es corto, vuelve tal cual.
 */
export function partirTema(nombre: string): string[] {
  const limpio = nombre.replace(/\s+/g, ' ').trim()
  if (limpio.length <= LARGO_MAXIMO_DE_TEMA) return [limpio]
  const pedazos = limpio
    .split(/(?<=[^\s.]{2})\.\s+(?=[A-ZÁÉÍÓÚÑ¿(])|;\s*/u)
    .map(limpiar)
    .filter((pedazo) => pedazo.length >= 3)
  return pedazos.length > 1 ? pedazos : [limpio]
}

/** Aplica `partirTema` a todas las unidades, sin repetir un tema dentro de la misma unidad. */
export function granularizarUnidades<U extends { name: string; topics: { name: string }[] }>(unidades: U[]): U[] {
  return unidades.map((unidad) => {
    const vistos = new Set<string>()
    const temas = unidad.topics
      .flatMap((tema) => partirTema(tema.name))
      .filter((nombre) => {
        const clave = nombre.toLowerCase()
        if (vistos.has(clave)) return false
        vistos.add(clave)
        return true
      })
      .map((nombre) => ({ name: nombre }))
    return { ...unidad, topics: temas.length > 0 ? temas : unidad.topics }
  })
}
