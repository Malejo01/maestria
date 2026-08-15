import { describe, expect, it } from 'vitest'
import { buildEducationSystemPrompt, type ContextoProfesionalCarrera } from './education-context'

/**
 * El contexto profesional es la diferencia entre que un alumno de una
 * tecnicatura en sistemas reciba "modelá el crecimiento de usuarios de una app"
 * y que reciba "hallá el dominio de f(x)". Lo que se prueba acá no es el texto
 * exacto del prompt sino las dos garantías que lo hacen funcionar: que la
 * sección aparezca con lo que declara el programa, y que desaparezca entera
 * cuando no hay programa que declarar.
 */
const SISTEMAS: ContextoProfesionalCarrera = {
  carrera: 'Tecnicatura Superior en Análisis de Sistemas',
  unidades: [
    {
      eje: 'Unidad 1 — Fundamentos de Lógica y Razonamiento Matemático',
      aplicacion: 'Diseño de algoritmos, validación de procesos',
      herramientas: ['GeoGebra', 'Simulador de lógica'],
    },
  ],
}

describe('buildEducationSystemPrompt · contexto profesional', () => {
  it('incluye carrera, aplicación y herramientas cuando el programa las declara', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: SISTEMAS,
    })

    expect(prompt).toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
    expect(prompt).toContain('Tecnicatura Superior en Análisis de Sistemas')
    expect(prompt).toContain('Diseño de algoritmos, validación de procesos')
    expect(prompt).toContain('GeoGebra, Simulador de lógica')
    expect(prompt).toContain('Unidad 1 — Fundamentos de Lógica y Razonamiento Matemático')
  })

  it('exige contextualizar de forma cuantificada, no como sugerencia', () => {
    // Una indicación blanda se pierde entre las otras reglas del prompt y el
    // modelo vuelve al ejercicio genérico. Si alguien suaviza esta regla, la
    // funcionalidad deja de tener efecto sin que falle nada más.
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: SISTEMAS,
    })

    expect(prompt).toContain('MITAD')
  })

  it('omite la sección entera cuando no hay contexto profesional', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
  })

  it('omite la sección cuando la carrera no tiene unidades con contexto', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: { carrera: 'Tecnicatura en Enfermería', unidades: [] },
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
  })

  it('no altera el prompt de K-12, que nunca lleva contexto profesional', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Secundario',
      grado: '4to Año',
      materia: 'Matemática',
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
    expect(prompt).toContain('Nivel Educativo: Secundario')
  })

  it('tolera una unidad sin herramientas declaradas', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: {
        carrera: 'Tecnicatura Superior en Análisis de Sistemas',
        unidades: [{ eje: 'Unidad 7 — Derivadas', aplicacion: 'Optimización de recursos', herramientas: [] }],
      },
    })

    expect(prompt).toContain('Optimización de recursos')
    expect(prompt).not.toContain('Herramientas de la cátedra:')
  })
})
