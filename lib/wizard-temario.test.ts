import { describe, expect, it } from 'vitest'
import { PASO, elegirGrado, leerNivelSugerido, ordenDePasos, pasoVecino, puedeLlegarA, type PasoId } from './wizard-temario'

const sinPendientes: Record<PasoId, string | null> = { 1: null, 2: null, 3: null, 4: null }

describe('ordenDePasos', () => {
  it('con el plan oficial, nivel y año van primero: hacen falta para filtrar', () => {
    expect(ordenDePasos('curriculum', false)).toEqual([PASO.nivel, PASO.materia, PASO.temario, PASO.ajustes])
  })

  it('subiendo un archivo o a mano, nivel y año van después del temario', () => {
    const esperado = [PASO.materia, PASO.temario, PASO.nivel, PASO.ajustes]
    expect(ordenDePasos('import', false)).toEqual(esperado)
    expect(ordenDePasos('manual', false)).toEqual(esperado)
  })

  it('nivel va siempre antes de "cómo das la materia", que pregunta la carrera según el nivel', () => {
    for (const camino of ['import', 'curriculum', 'manual', null] as const) {
      const orden = ordenDePasos(camino, false)
      expect(orden.indexOf(PASO.nivel)).toBeLessThan(orden.indexOf(PASO.ajustes))
    }
  })

  it('al editar se conserva el orden de siempre, venga del camino que venga', () => {
    expect(ordenDePasos('import', true)).toEqual([1, 2, 3, 4])
  })

  it('sin camino elegido (el botón "Crear materia" directo), el orden de siempre', () => {
    expect(ordenDePasos(null, false)).toEqual([1, 2, 3, 4])
  })

  it('siempre son los cuatro pasos, sin repetir', () => {
    expect([...ordenDePasos('import', false)].sort()).toEqual([1, 2, 3, 4])
  })
})

describe('puedeLlegarA', () => {
  const orden = ordenDePasos('import', false)

  it('al primer paso se llega siempre', () => {
    expect(puedeLlegarA(orden, { ...sinPendientes, 1: 'Elegí un nivel.' }, PASO.materia)).toBe(true)
  })

  it('subiendo un archivo, el temario NO exige haber elegido nivel', () => {
    expect(puedeLlegarA(orden, { ...sinPendientes, 1: 'Elegí un nivel.' }, PASO.temario)).toBe(true)
  })

  it('pero el último paso sí: nivel quedó antes', () => {
    expect(puedeLlegarA(orden, { ...sinPendientes, 1: 'Elegí un nivel.' }, PASO.ajustes)).toBe(false)
  })

  it('con el plan oficial, sin nivel no se llega a la materia', () => {
    expect(puedeLlegarA(ordenDePasos('curriculum', false), { ...sinPendientes, 1: 'Elegí un nivel.' }, PASO.materia)).toBe(false)
  })
})

describe('pasoVecino', () => {
  const orden = ordenDePasos('manual', false)

  it('avanza y retrocede según el orden, no según el número', () => {
    expect(pasoVecino(orden, PASO.temario, 1)).toBe(PASO.nivel)
    expect(pasoVecino(orden, PASO.nivel, -1)).toBe(PASO.temario)
  })

  it('en los extremos no hay vecino', () => {
    expect(pasoVecino(orden, PASO.materia, -1)).toBeNull()
    expect(pasoVecino(orden, PASO.ajustes, 1)).toBeNull()
  })
})

describe('leerNivelSugerido', () => {
  it('acepta lo que el modelo suele devolver', () => {
    expect(leerNivelSugerido({ nivel: 'Secundario', grado: '3er año' })).toEqual({ nivel: 'Secundario', grado: '3er año' })
    expect(leerNivelSugerido({ nivel: ' universitario ', grado: 'Primero' })).toEqual({ nivel: 'Superior', grado: 'Primero' })
  })

  it('ante un nivel que no reconoce, no sugiere nada', () => {
    expect(leerNivelSugerido({ nivel: 'posgrado', grado: '1' })).toBeNull()
    expect(leerNivelSugerido({ nivel: null })).toBeNull()
    expect(leerNivelSugerido(null)).toBeNull()
    expect(leerNivelSugerido('Secundario')).toBeNull()
  })

  it('sin año, sugiere sólo el nivel', () => {
    expect(leerNivelSugerido({ nivel: 'primaria' })).toEqual({ nivel: 'Primario', grado: '' })
  })
})

describe('elegirGrado', () => {
  const grados = ['1er Año', '2do Año', '3er Año', '4to Año']

  it('lleva lo que escribió el modelo a la opción de la lista', () => {
    expect(elegirGrado('3er año', grados)).toBe('3er Año')
    expect(elegirGrado('tercero', grados)).toBe('3er Año')
    expect(elegirGrado('3°', grados)).toBe('3er Año')
    expect(elegirGrado('Cuarto Año', grados)).toBe('4to Año')
  })

  it('si no hay una opción con ese número, no elige', () => {
    expect(elegirGrado('6to', grados)).toBeNull()
    expect(elegirGrado('avanzado', grados)).toBeNull()
    expect(elegirGrado('', grados)).toBeNull()
  })

  it('si hay dos opciones con el mismo número, no adivina', () => {
    expect(elegirGrado('1ro', ['1er Año', '1er Año B'])).toBeNull()
  })
})
