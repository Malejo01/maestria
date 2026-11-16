import { describe, expect, it } from 'vitest'
import { NOMBRE_DE_ICONO, SUBJECT_ICON_OPTIONS } from './subject-appearance'

describe('NOMBRE_DE_ICONO (I5)', () => {
  it('cada ícono tiene un nombre en castellano, no el interno en inglés', () => {
    for (const icono of SUBJECT_ICON_OPTIONS) {
      expect(NOMBRE_DE_ICONO[icono]).toBeTruthy()
      expect(NOMBRE_DE_ICONO[icono]).not.toBe(icono)
    }
    expect(NOMBRE_DE_ICONO['book-open']).toBe('Libro')
    expect(NOMBRE_DE_ICONO.calculator).toBe('Calculadora')
  })
})
