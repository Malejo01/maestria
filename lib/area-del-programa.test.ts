import { describe, expect, it } from 'vitest'
import { caracterDeLaUnidad, completarAreaDelPrograma } from './area-del-programa'

const DIDACTICA = [
  { id: 'u1', name: 'Unidad 1: La enseñanza de la matemática', topics: [{ name: 'Transposición didáctica' }] },
  { id: 'u2', name: 'Unidad 2: Números racionales', topics: [{ name: 'Fracciones' }] },
]

describe('completarAreaDelPrograma', () => {
  it('un programa viejo, sin área: se infiere y avisa que cambió', () => {
    const r = completarAreaDelPrograma({ materia: 'Matemática y su Didáctica', perfil: { methodology: 'x' }, unidades: DIDACTICA })
    expect(r.perfil).toMatchObject({ methodology: 'x', area: 'educacion', areaOrigen: 'inferida' })
    expect(r.unidades.map((u) => u.caracter)).toEqual(['conceptual', 'cuantitativo'])
    expect(r.cambio).toBe(true)
  })

  it('ya completo: no cambia nada (no se reescribe al abrirlo otra vez)', () => {
    const primera = completarAreaDelPrograma({ materia: 'Matemática y su Didáctica', perfil: {}, unidades: DIDACTICA })
    const segunda = completarAreaDelPrograma({ materia: 'Matemática y su Didáctica', perfil: primera.perfil, unidades: primera.unidades })
    expect(segunda.cambio).toBe(false)
  })

  it('lo que eligió el docente no se toca', () => {
    const r = completarAreaDelPrograma({
      materia: 'Matemática I',
      perfil: { area: 'educacion', areaOrigen: 'manual' },
      unidades: [{ name: 'Funciones', caracterManual: 'conceptual' }],
    })
    expect(r.perfil.area).toBe('educacion')
    expect(r.perfil.areaOrigen).toBe('manual')
    expect(caracterDeLaUnidad(r.unidades[0], 'educacion')).toBe('conceptual')
  })

  it('la IA con confianza alta manda sobre las palabras clave', () => {
    const r = completarAreaDelPrograma({
      materia: 'Taller I',
      perfil: { area: 'administracion', areaConfianza: 0.85, areaOrigen: 'ia' },
      unidades: [{ name: 'Unidad 1', caracter: 'conceptual' }],
    })
    expect(r.perfil).toMatchObject({ area: 'administracion', areaConfianza: 0.85, areaOrigen: 'ia' })
    expect(r.unidades[0].caracter).toBe('conceptual')
  })

  it('la IA con confianza baja: gana lo inferido si reconoce la materia', () => {
    const r = completarAreaDelPrograma({
      materia: 'Microeconomía',
      perfil: { area: 'matematica', areaConfianza: 0.4, areaOrigen: 'ia' },
      unidades: [],
    })
    expect(r.perfil).toMatchObject({ area: 'economia', areaOrigen: 'inferida' })
  })

  it('la IA con confianza baja y nada que inferir: queda la de la IA, con su confianza', () => {
    const r = completarAreaDelPrograma({
      materia: 'Taller I',
      perfil: { area: 'artes', areaConfianza: 0.5, areaOrigen: 'ia' },
      unidades: [],
    })
    expect(r.perfil).toMatchObject({ area: 'artes', areaConfianza: 0.5, areaOrigen: 'ia' })
  })

  it('un área inventada o un carácter inválido no pasan', () => {
    const r = completarAreaDelPrograma({
      materia: 'Derecho Civil',
      perfil: { area: 'astrologia', areaConfianza: 0.99 },
      unidades: [{ name: 'Contratos', caracter: 'numerico' }],
    })
    expect(r.perfil.area).toBe('derecho')
    expect(r.unidades[0].caracter).toBe('conceptual')
  })
})
