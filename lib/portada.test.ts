import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { testimoniosValidos, videoDeDemo } from './portada'
import { leerTokens } from './tokens-del-sistema'

describe('el video de demo (V5)', () => {
  it('YouTube y Vimeo se embeben sin cookies; lo demás, no', () => {
    expect(videoDeDemo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(videoDeDemo('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(videoDeDemo('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(videoDeDemo('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789')
    expect(videoDeDemo('http://youtu.be/dQw4w9WgXcQ')).toBeNull()
    expect(videoDeDemo('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(videoDeDemo('')).toBeNull()
    expect(videoDeDemo(undefined)).toBeNull()
  })
})

describe('los testimonios (V5)', () => {
  it('sin contenido no hay testimonios; lo mal armado se ignora', () => {
    expect(testimoniosValidos([])).toEqual([])
    expect(testimoniosValidos(null)).toEqual([])
    expect(testimoniosValidos([{ texto: 'Muy útil', nombre: 'Ana', rol: 'Profe' }, { texto: 'x' }, { texto: '', nombre: 'B', rol: '' }])).toEqual([
      { texto: 'Muy útil', nombre: 'Ana', rol: 'Profe' },
    ])
  })
  it('el archivo del repo es una lista válida', () => {
    const crudo = JSON.parse(readFileSync(join(process.cwd(), 'content', 'portada', 'testimonios.json'), 'utf8'))
    expect(Array.isArray(crudo)).toBe(true)
  })
})

describe('leerTokens', () => {
  it('lee los tokens del bloque claro y del oscuro de app/tokens.css', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'tokens.css'), 'utf8')
    const claro = leerTokens(css, 'claro')
    const oscuro = leerTokens(css, 'oscuro')
    expect(claro.accion).toMatch(/^#|^rgb|^oklch|^hsl/)
    expect(claro['superficie-base']).toBeTruthy()
    expect(oscuro['superficie-base']).toBeTruthy()
    expect(oscuro['superficie-base']).not.toBe(claro['superficie-base'])
  })
})
