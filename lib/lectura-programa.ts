/**
 * Cómo se lee un programa que sube el docente (I1, 16/11/2026).
 *
 * Hasta acá, una foto pasaba por `tesseract.js` —que en producción se quedó
 * colgado hasta el 504 de los 300 s— y un PDF escaneado devolvía cero
 * caracteres y un "no pudimos leer". Son justo los dos formatos que más usa un
 * docente que no se lleva bien con la tecnología, y la pantalla de subida le
 * ofrece uno de ellos.
 *
 * Ahora hay dos caminos, y esto decide cuál:
 *   - `texto`: Word, o un PDF con capa de texto. Se extrae el texto y se le
 *     manda al modelo, como siempre.
 *   - `archivo`: una imagen, o un PDF que no trae texto (escaneo). El archivo
 *     entero va al modelo, que lo lee y lo estructura en la misma llamada.
 *
 * Puro: no lee el archivo ni llama al modelo.
 */

export const MIME_PDF = 'application/pdf'
export const MIME_IMAGENES = ['image/jpeg', 'image/png'] as const

/** Menos que esto en todo el PDF, y es un escaneo (con algún sello o número de página suelto). */
export const MINIMO_DE_TEXTO = 200
/** Menos que esto por página, también: un escaneo con una carátula tipeada no es un PDF digital. */
export const MINIMO_POR_PAGINA = 40

/** Cuánto se espera al modelo. La ruta tiene `maxDuration = 90`: nunca más los 300 s. */
export const TIEMPO_MAXIMO_DEL_MODELO_MS = 60_000

export type ComoLeer = 'texto' | 'archivo'

export function esImagen(mimeType: string): boolean {
  return (MIME_IMAGENES as readonly string[]).includes(mimeType)
}

/** Si el modelo puede recibir este archivo tal cual (imagen o PDF). Un Word, no. */
export function elModeloLoLee(mimeType: string): boolean {
  return mimeType === MIME_PDF || esImagen(mimeType)
}

export function comoLeerPrograma({
  mimeType,
  texto,
  paginas,
}: {
  mimeType: string
  /** El texto que se pudo extraer; vacío para una imagen o si el parser falló. */
  texto: string
  /** Páginas del PDF, o 0 si no se sabe. */
  paginas: number
}): ComoLeer {
  if (esImagen(mimeType)) return 'archivo'
  if (mimeType !== MIME_PDF) return 'texto'
  const largo = texto.trim().length
  if (largo < MINIMO_DE_TEXTO) return 'archivo'
  if (paginas > 0 && largo / paginas < MINIMO_POR_PAGINA) return 'archivo'
  return 'texto'
}

/** Si el error es que se acabó el tiempo de espera del modelo (AbortSignal.timeout). */
export function esTiempoAgotado(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const nombre = (error as { name?: unknown }).name
  if (nombre === 'TimeoutError' || nombre === 'AbortError') return true
  const causa = (error as { cause?: unknown }).cause
  return causa !== undefined && causa !== error && esTiempoAgotado(causa)
}

/** Lo que ve el docente cuando el archivo no se pudo leer (I4 lo acompaña con los otros caminos). */
export const NO_SE_PUDO_LEER =
  'No pudimos leer este archivo. Podés probar con el Word o el PDF original, o armar el temario de otra forma.'
