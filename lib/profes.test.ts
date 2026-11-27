import { describe, expect, it } from 'vitest'
import { linkParaEmpezar } from './profes'

const q = (s: string) => new URLSearchParams(s)
const leer = (href: string) => new URL(href, 'https://x.test').searchParams

describe('linkParaEmpezar (AA3)', () => {
  it('va al ingreso del docente y vuelve al panel', () => {
    expect(linkParaEmpezar(null)).toBe('/sign-in?rol=docente&callbackUrl=%2Fteacher')
  })

  it('conserva origen y ref del anuncio', () => {
    const p = leer(linkParaEmpezar(q('origen=meta&ref=AD-prueba')))
    expect(p.get('rol')).toBe('docente')
    expect(p.get('callbackUrl')).toBe('/teacher')
    expect(p.get('origen')).toBe('meta')
    expect(p.get('ref')).toBe('AD-PRUEBA')
  })

  it('conserva también un referido de un docente', () => {
    expect(leer(linkParaEmpezar(q('origen=wa&ref=silvina-ab12'))).get('ref')).toBe('SILVINA-AB12')
  })

  it('no pasa basura: un ref o un canal raros se caen, y el destino no se puede cambiar', () => {
    const p = leer(linkParaEmpezar(q('origen=<b>x</b>&ref=<script>&callbackUrl=https://malo.test')))
    expect(p.get('origen')).toBeNull()
    expect(p.get('ref')).toBeNull()
    expect(p.get('callbackUrl')).toBe('/teacher')
  })
})
