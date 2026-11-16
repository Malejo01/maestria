import { describe, expect, it } from 'vitest'
import {
  MINIMO_DE_TEXTO,
  comoLeerPrograma,
  elModeloLoLee,
  esTiempoAgotado,
} from './lectura-programa'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('comoLeerPrograma (I1)', () => {
  it('una foto siempre va al modelo como archivo', () => {
    expect(comoLeerPrograma({ mimeType: 'image/jpeg', texto: '', paginas: 0 })).toBe('archivo')
    expect(comoLeerPrograma({ mimeType: 'image/png', texto: 'lo que sea', paginas: 1 })).toBe('archivo')
  })

  it('un PDF sin capa de texto (escaneo) va como archivo', () => {
    expect(comoLeerPrograma({ mimeType: PDF, texto: '', paginas: 3 })).toBe('archivo')
    expect(comoLeerPrograma({ mimeType: PDF, texto: '— 1 —\n— 2 —', paginas: 2 })).toBe('archivo')
  })

  it('un PDF con poco texto en total también', () => {
    expect(comoLeerPrograma({ mimeType: PDF, texto: 'x'.repeat(MINIMO_DE_TEXTO - 1), paginas: 0 })).toBe('archivo')
  })

  it('un escaneo de 10 páginas con una carátula tipeada: poco texto por página, archivo', () => {
    expect(comoLeerPrograma({ mimeType: PDF, texto: 'x'.repeat(300), paginas: 10 })).toBe('archivo')
  })

  it('un PDF digital va como texto, como siempre', () => {
    expect(comoLeerPrograma({ mimeType: PDF, texto: 'x'.repeat(5000), paginas: 6 })).toBe('texto')
    // Sin saber las páginas, alcanza con el total.
    expect(comoLeerPrograma({ mimeType: PDF, texto: 'x'.repeat(500), paginas: 0 })).toBe('texto')
  })

  it('un Word siempre por texto: el modelo no recibe .docx', () => {
    expect(comoLeerPrograma({ mimeType: DOCX, texto: '', paginas: 0 })).toBe('texto')
    expect(elModeloLoLee(DOCX)).toBe(false)
    expect(elModeloLoLee(PDF)).toBe(true)
    expect(elModeloLoLee('image/jpeg')).toBe(true)
  })
})

describe('esTiempoAgotado', () => {
  it('reconoce el corte de AbortSignal.timeout, también envuelto', () => {
    expect(esTiempoAgotado(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true)
    expect(esTiempoAgotado(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true)
    expect(esTiempoAgotado(Object.assign(new Error('envuelto'), { cause: Object.assign(new Error('x'), { name: 'TimeoutError' }) }))).toBe(true)
  })
  it('no confunde otro error con un tiempo agotado', () => {
    expect(esTiempoAgotado(new Error('schema'))).toBe(false)
    expect(esTiempoAgotado(null)).toBe(false)
  })
})
