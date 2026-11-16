import type { FilePart, ImagePart } from 'ai'
import { esImagen, MIME_PDF } from '@/lib/lectura-programa'

/**
 * La lectura del archivo de un programa, compartida por /api/teacher/programs/
 * extract y /guide (antes cada ruta tenía su copia). Qué camino se toma lo
 * decide lib/lectura-programa.ts; acá sólo se lee.
 *
 * No hay OCR local: una imagen o un PDF escaneado van enteros al modelo
 * (`parteDelArchivo`). `tesseract.js` se fue en I1.
 */

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const MIME_DOC = 'application/msword'

export type ParserDePrograma = 'pdf-parse' | 'mammoth' | 'word-extractor' | 'modelo'

export function parserPara(mimeType: string): ParserDePrograma {
  if (mimeType === MIME_PDF) return 'pdf-parse'
  if (mimeType === MIME_DOCX) return 'mammoth'
  if (mimeType === MIME_DOC) return 'word-extractor'
  return 'modelo'
}

/** El MIME de verdad, mirando también la extensión (los navegadores mandan cualquier cosa). */
export function normalizarMimeDePrograma(nombre: string, tipo: string): string {
  const minusculas = nombre.toLowerCase()
  if (minusculas.endsWith('.doc') || tipo === MIME_DOC) return MIME_DOC
  if (minusculas.endsWith('.png') || tipo === 'image/png') return 'image/png'
  if (minusculas.endsWith('.jpg') || minusculas.endsWith('.jpeg') || tipo === 'image/jpeg') return 'image/jpeg'
  if (minusculas.endsWith('.docx')) return MIME_DOCX
  if (minusculas.endsWith('.pdf')) return MIME_PDF
  return tipo
}

interface PdfLeido {
  texto: string
  /** 0 si la versión de pdf-parse no lo informa. */
  paginas: number
}

async function leerPdf(buffer: Buffer): Promise<PdfLeido> {
  const pdfModule = await import('pdf-parse')
  const legacyParse = (pdfModule as unknown as {
    default?: (data: Buffer) => Promise<{ text?: string; numpages?: number }>
  }).default

  // Compatibilidad con las versiones viejas de pdf-parse, que exportan una función.
  if (typeof legacyParse === 'function') {
    const parsed = await legacyParse(buffer)
    return { texto: (parsed?.text || '').trim(), paginas: Number(parsed?.numpages ?? 0) }
  }

  type Parser = { getText: () => Promise<{ text?: string; total?: number }>; destroy?: () => Promise<void> }
  const PDFParse = (pdfModule as unknown as {
    PDFParse?: { new (params: { data: Buffer }): Parser; setWorker?: (workerSrc?: string) => string }
  }).PDFParse

  if (typeof PDFParse !== 'function') {
    throw new Error('PDF parser no disponible: exportacion invalida de pdf-parse')
  }
  if (typeof PDFParse.setWorker === 'function') {
    PDFParse.setWorker('pdfjs-dist/legacy/build/pdf.worker.mjs')
  }

  const parser = new PDFParse({ data: buffer })
  try {
    const parsed = await parser.getText()
    return { texto: (parsed?.text || '').trim(), paginas: Number(parsed?.total ?? 0) }
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy()
  }
}

async function leerDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return (result.value || '').trim()
}

async function leerDoc(buffer: Buffer): Promise<string> {
  const wordExtractorModule = await import('word-extractor')
  const WordExtractor = wordExtractorModule.default
  const extractor = new WordExtractor()
  const document = await extractor.extract(buffer)
  return String(document.getBody() || '').trim()
}

/**
 * El texto del archivo. Una imagen no tiene texto que extraer acá: devuelve
 * vacío y la lee el modelo. Lanza si el parser falla; quien llama decide si
 * eso es un 422 (Word roto) o si el archivo igual puede ir al modelo (PDF).
 */
export async function extraerTextoDePrograma(buffer: Buffer, mimeType: string): Promise<PdfLeido> {
  if (mimeType === MIME_PDF) return leerPdf(buffer)
  if (mimeType === MIME_DOCX) return { texto: await leerDocx(buffer), paginas: 0 }
  if (mimeType === MIME_DOC) return { texto: await leerDoc(buffer), paginas: 0 }
  return { texto: '', paginas: 0 }
}

/** El archivo como parte de un mensaje al modelo: una imagen como imagen, un PDF como archivo. */
export function parteDelArchivo(buffer: Buffer, mimeType: string): ImagePart | FilePart {
  if (esImagen(mimeType)) return { type: 'image', image: buffer, mediaType: mimeType }
  return { type: 'file', data: buffer, mediaType: MIME_PDF }
}
