import { describe, expect, it } from 'vitest'
import { safeCallbackUrl } from './safe-callback-url'

describe('safeCallbackUrl', () => {
  it('acepta rutas del propio sitio, con query incluida', () => {
    expect(safeCallbackUrl('/practicar')).toBe('/practicar')
    expect(safeCallbackUrl('/aula/ABC234')).toBe('/aula/ABC234')
    expect(safeCallbackUrl('/history?tab=2')).toBe('/history?tab=2')
  })

  it('cae al fallback cuando no hay destino', () => {
    expect(safeCallbackUrl(null)).toBe('/')
    expect(safeCallbackUrl(undefined)).toBe('/')
    expect(safeCallbackUrl('')).toBe('/')
    expect(safeCallbackUrl(null, '/practicar')).toBe('/practicar')
  })

  it('rechaza URLs absolutas y protocol-relative', () => {
    expect(safeCallbackUrl('https://evil.com')).toBe('/')
    expect(safeCallbackUrl('//evil.com')).toBe('/')
    expect(safeCallbackUrl('/\\evil.com')).toBe('/')
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/')
  })

  it('rechaza caracteres de control que el parser de URL descarta', () => {
    expect(safeCallbackUrl('/\t/evil.com')).toBe('/')
    expect(safeCallbackUrl('/\n/evil.com')).toBe('/')
  })

  it('no manda de vuelta al login', () => {
    expect(safeCallbackUrl('/sign-in')).toBe('/')
    expect(safeCallbackUrl('/sign-in?callbackUrl=/practicar')).toBe('/')
  })
})
