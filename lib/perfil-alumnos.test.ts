import { describe, expect, it } from 'vitest'
import { buildEducationSystemPrompt } from './education-context'
import { FICHA_VACIA, type DatosFicha, type MateriaConTemas } from './fichas'
import { combinarFichas, seccionPerfilAlumnos } from './perfil-alumnos'

const MATERIA: MateriaConTemas = {
  id: 13,
  nombre: 'Matemática',
  unidades: [
    { id: 'u1', name: 'Geometría', topics: [{ id: 't1', name: 'Ecuación de la recta' }, { id: 't2', name: 'Parábola' }] },
    { id: 'u2', name: 'Números', topics: [{ id: 't3', name: 'Números irracionales' }] },
  ],
}

const ficha = (parcial: Partial<DatosFicha>): DatosFicha => ({ ...FICHA_VACIA, ...parcial })

/** Una ficha con TODO lo que el docente puede escribir, incluido lo que nunca va a la IA. */
const COMPLETA = ficha({
  edad: 16,
  anioCursa: '4to año',
  institucion: 'Colegio San Ignacio de Loyola',
  orientacion: 'Técnica en electrónica',
  materiaId: 13,
  fechaExamen: '2026-12-12',
  comoEvalua: 'Su profe toma 4 ejercicios de desarrollo, sin calculadora, uno de demostración',
  temasDificiles: ['t1'],
  observaciones: 'Viene de recursar, la mamá pidió reforzar',
  contacto: '387 555 0101',
  responsable: 'Laura Pérez (mamá)',
})

describe('combinarFichas', () => {
  it('con 2 o 3 alumnos los temas que les cuestan se suman, sin repetir', () => {
    const perfil = combinarFichas(
      [COMPLETA, ficha({ materiaId: 13, edad: 17, temasDificiles: ['t1', 't3'] })],
      MATERIA,
    )
    expect(perfil?.temasDificiles).toEqual(['Ecuación de la recta', 'Números irracionales'])
    expect(perfil?.edades).toEqual([16, 17])
  })

  it('"cómo evalúa" es el de la materia: gana la ficha que eligió esta materia', () => {
    const perfil = combinarFichas(
      [ficha({ materiaId: 99, comoEvalua: 'Oral, de otra materia' }), ficha({ materiaId: 13, comoEvalua: 'Escrito, 4 ejercicios' })],
      MATERIA,
    )
    expect(perfil?.comoEvalua).toBe('Escrito, 4 ejercicios')
  })

  it('los temas de una ficha de otra materia no se cuelan', () => {
    expect(combinarFichas([ficha({ materiaId: 99, temasDificiles: ['t1'], edad: 15 })], MATERIA)?.temasDificiles).toEqual([])
  })

  it('fichas sin nada pedagógico: null, y el prompt no cambia', () => {
    const perfil = combinarFichas([ficha({ contacto: '387', observaciones: 'algo' })], MATERIA)
    expect(perfil).toBeNull()
    expect(seccionPerfilAlumnos(perfil)).toBe('')
  })
})

describe('J3 — a la IA va sólo lo pedagógico', () => {
  const prompt = buildEducationSystemPrompt({
    nivel: 'Secundario',
    grado: '4to Año',
    materia: 'Matemática',
    perfilAlumnos: combinarFichas([COMPLETA], MATERIA),
  })

  it('edad, año, orientación, cómo lo evalúan y lo que le cuesta, sí (lo que le cuesta, con prioridad)', () => {
    expect(prompt).toContain('16 años')
    expect(prompt).toContain('4to año')
    expect(prompt).toContain('Técnica en electrónica')
    expect(prompt).toContain('sin calculadora, uno de demostración')
    expect(prompt).toMatch(/TEMAS QUE LE CUESTAN \(prioridad alta\): Ecuación de la recta/)
  })

  it('nunca el contacto, el responsable, la institución ni las observaciones', () => {
    for (const privado of ['387 555 0101', 'Laura', 'Pérez', 'San Ignacio', 'Loyola', 'recursar', 'mamá']) {
      expect(prompt, `se coló "${privado}"`).not.toContain(privado)
    }
  })

  it('sin perfil, el prompt es exactamente el de siempre', () => {
    const base = { nivel: 'Secundario', grado: '4to Año', materia: 'Matemática' }
    expect(buildEducationSystemPrompt({ ...base, perfilAlumnos: null })).toBe(buildEducationSystemPrompt(base).replace(/\n$/, '\n'))
  })
})
