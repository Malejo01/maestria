/**
 * I3: el texto de un Word sin perder las columnas de sus tablas.
 *
 * `mammoth.extractRawText` aplana las tablas: en una tabla "unidad |
 * contenidos | bibliografía | semanas" mezcla todo en un renglón por celda y
 * el modelo ya no sabe qué columna es qué. Con `convertToHtml` las filas
 * llegan enteras, y acá cada fila pasa a ser una línea `celda | celda | celda`.
 * El resto (párrafos, títulos, listas) queda una línea por bloque.
 *
 * Puro y sin DOM: el HTML que arma mammoth es simple y predecible.
 */

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodificar(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo: string) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&([a-z]+);/gi, (entera, nombre: string) => ENTIDADES[nombre.toLowerCase()] ?? entera)
}

/** El texto plano de un pedazo de HTML, con los bloques internos separados por un espacio. */
function textoDe(html: string): string {
  return decodificar(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

export function textoDeHtmlDeWord(html: string): string {
  const conFilas = html.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, fila: string) => {
    const celdas = [...fila.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((celda) => textoDe(celda[1]))
    const conTexto = celdas.some((celda) => celda.length > 0)
    return conTexto ? `\n${celdas.join(' | ')}\n` : '\n'
  })
  return decodificar(
    conFilas
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6]|table|ul|ol)>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .filter((linea) => linea.length > 0)
    .join('\n')
}
