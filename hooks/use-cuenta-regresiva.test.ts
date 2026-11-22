import { describe, expect, it } from 'vitest'
import { formatearTiempo, segundosQueQuedan } from './use-cuenta-regresiva'

describe('E1 · la cuenta regresiva del simulacro', () => {
  it('formatea', () => {
    expect(formatearTiempo(65)).toBe('01:05')
    expect(formatearTiempo(3600)).toBe('1:00:00')
    expect(formatearTiempo(-3)).toBe('00:00')
  })
  it('cuenta desde el inicio guardado: recargar no devuelve el tiempo', () => {
    const inicio = '2027-02-01T12:00:00Z'
    expect(segundosQueQuedan(5, inicio, Date.parse('2027-02-01T12:00:00Z'))).toBe(300)
    expect(segundosQueQuedan(5, inicio, Date.parse('2027-02-01T12:04:30Z'))).toBe(30)
    expect(segundosQueQuedan(5, inicio, Date.parse('2027-02-01T12:09:00Z'))).toBe(0)
  })
})
