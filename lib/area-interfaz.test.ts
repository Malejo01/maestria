import { describe, expect, it } from 'vitest'
import { etiquetaDeCaracter, queSonLasPracticas, renglonDeArea } from './area-interfaz'

describe('el renglón del área', () => {
  it('Antropología: análisis de casos', () => {
    expect(renglonDeArea('sociales', 0.9)).toBe(
      'Área: Ciencias sociales y humanidades · las preguntas prácticas van a ser análisis de casos',
    )
  })

  it('con confianza baja: "Nos parece que es…"', () => {
    expect(renglonDeArea('administracion', 0.45)).toMatch(/^Nos parece que es Administración, marketing y gestión/)
  })

  it('lo que eligió el docente nunca dice "Nos parece"', () => {
    expect(renglonDeArea('artes', 0.2, 'manual')).toMatch(/^Área: Artes/)
  })

  it('matemática sigue diciendo ejercicios', () => {
    expect(queSonLasPracticas('matematica')).toBe('ejercicios y problemas')
  })

  it('el chip de cada unidad', () => {
    expect(['cuantitativo', 'conceptual', 'mixto'].map((c) => etiquetaDeCaracter(c as never))).toEqual(['Con cálculos', 'Conceptual', 'Mixta'])
  })
})

describe('las tarjetas de modo según el área (A4)', () => {
  it('Antropología: "Práctico: análisis de casos", no ejercicios', async () => {
    const { tarjetaDeModo } = await import('./area-interfaz')
    expect(tarjetaDeModo('sociales', 'practico')).toEqual({ titulo: 'Práctico: análisis de casos', detalle: 'Aplicar lo aprendido: análisis de casos.' })
    expect(tarjetaDeModo('matematica', 'practico').titulo).toBe('Práctico: ejercicios y problemas')
  })
})
