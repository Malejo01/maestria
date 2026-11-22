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

/**
 * Ronda T · D1 — Un tema largo, partido, y si el corte es seguro.
 *
 * El caso real: la Unidad 1 del programa 18 quedó como UN tema de ~600
 * caracteres. `partirTema` sólo corta en punto seguido de mayúscula y en punto
 * y coma, y un programa que escribe la unidad como una lista separada por
 * comas (o con minúscula después del punto) quedaba entero. Acá, además:
 *
 *   - punto seguido de cualquier letra, viñetas (•, ·), guiones con espacios,
 *     ítems numerados ("1) …", "2. …") y saltos de línea: seguro;
 *   - comas, sólo en un párrafo muy largo (más de 180) y si todos los pedazos
 *     tienen el largo de un tema: seguro ("Figuras planas, perímetro y área"
 *     es corto y no se toca);
 *   - si sigue largo y no hay dónde cortar con certeza: `seguro: false`, y
 *     quien llama le pide a la IA SÓLO la división de ese párrafo.
 */
export const LARGO_PARA_COMAS = 180

export function separarTemaLargo(nombre: string): { pedazos: string[]; seguro: boolean } {
  const conSaltos = nombre.replace(/\r/g, '').trim()
  const limpio = conSaltos.replace(/\s+/g, ' ').trim()
  if (limpio.length <= LARGO_MAXIMO_DE_TEMA) return { pedazos: [limpio], seguro: true }

  const deSiempre = partirTema(limpio)
  if (deSiempre.length > 1) return { pedazos: deSiempre.flatMap((p) => separarTemaLargo(p).pedazos), seguro: true }

  const porMarcas = conSaltos
    .split(/\n+|\s[•·\u25AA\u25E6]\s|\s[–—-]\s|(?<=[^\s.]{2})\.\s+(?=[a-záéíóúñ]{3})|\s(?=\d{1,2}[.)]\s+[A-Za-zÁÉÍÓÚÑáéíóúñ])/u)
    .map(limpiar)
    .filter((p) => p.length >= 3)
  if (porMarcas.length > 1) return { pedazos: porMarcas, seguro: true }

  if (limpio.length > LARGO_PARA_COMAS) {
    const porComas = limpio
      .split(/,\s+|\s+y\s+(?=[^,]+$)/u)
      .map(limpiar)
      .filter((p) => p.length >= 3)
    if (porComas.length >= 3 && porComas.every((p) => p.length <= LARGO_MAXIMO_DE_TEMA)) return { pedazos: porComas, seguro: true }
  }

  return { pedazos: [limpio], seguro: false }
}

/** Los temas que siguen largos y no se pudieron partir con certeza (para pedirle a la IA). */
export function temasPorDividir<U extends { topics: { name: string }[] }>(unidades: U[]): string[] {
  return unidades.flatMap((u) => u.topics.map((t) => t.name)).filter((nombre) => !separarTemaLargo(nombre).seguro)
}

/**
 * ¿La división de la IA sale del párrafo? Cada pedazo tiene que estar hecho
 * con palabras del párrafo (al menos 3 de cada 4): la IA divide, no escribe.
 */
export function divisionFiel(parrafo: string, pedazos: string[]): boolean {
  const normal = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length > 2)
  const delParrafo = new Set(normal(parrafo))
  return (
    pedazos.length > 1 &&
    pedazos.every((p) => {
      const palabras = normal(p)
      return palabras.length > 0 && palabras.filter((w) => delParrafo.has(w)).length / palabras.length >= 0.75
    })
  )
}

/** Aplica `separarTemaLargo` a todas las unidades, sin repetir un tema dentro de la misma unidad. */
export function granularizarUnidades<U extends { name: string; topics: { name: string }[] }>(
  unidades: U[],
  divisiones: ReadonlyMap<string, string[]> = new Map(),
): U[] {
  return unidades.map((unidad) => {
    const vistos = new Set<string>()
    const temas = unidad.topics
      .flatMap((tema) => divisiones.get(tema.name.replace(/\s+/g, ' ').trim()) ?? separarTemaLargo(tema.name).pedazos)
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
