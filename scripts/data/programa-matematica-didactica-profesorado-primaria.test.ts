import { describe, expect, it } from 'vitest'
import {
  CARRERA,
  GRADO,
  NIVEL,
  UNIDADES,
  construirPerfil,
  construirUnidades,
} from './programa-matematica-didactica-profesorado-primaria'
import { pedagogyProfileToContext } from '../../lib/teacher-programs'

describe('programa de Matemática y su Didáctica · Profesorado de Educación Primaria', () => {
  it('tiene las 5 unidades y los 53 temas del documento de contenidos', () => {
    expect(UNIDADES.map((u) => u.temas.length)).toEqual([9, 10, 17, 11, 6])
    expect(UNIDADES.flatMap((u) => u.temas)).toHaveLength(53)
  })

  it('numera según el documento de contenidos, no según el cronograma', () => {
    expect(UNIDADES.map((u) => u.nombre)).toEqual([
      'Unidad I — Números y operaciones',
      'Unidad II — El campo de la matemática y su didáctica',
      'Unidad III — Números racionales',
      'Unidad IV — Geometría y medida',
      'Unidad V — Estadística y probabilidad',
    ])
  })

  it('lleva corregida la sigla del Word (MCD = Máximo Común Divisor, MCM = Mínimo Común Múltiplo)', () => {
    const temas = UNIDADES.flatMap((u) => u.temas)
    expect(temas).toContain('Máximo Común Divisor (MCD) y Mínimo Común Múltiplo (MCM)')
    expect(temas.join(' ')).not.toMatch(/Divisor Común Mayor|\(DCM\)/)
  })

  it('no inventa temas de probabilidad que el programa no lista', () => {
    const unidadV = UNIDADES[4]
    expect(unidadV.temas.join(' ')).not.toMatch(/probabilidad/i)
  })

  it('no repite temas', () => {
    const temas = UNIDADES.flatMap((u) => u.temas)
    expect(new Set(temas).size).toBe(temas.length)
  })

  it('arma las unidades con la forma que guarda el wizard para un temario propio', () => {
    const unidades = construirUnidades()
    expect(unidades[0]).toMatchObject({ id: 'tp-u-1', name: UNIDADES[0].nombre })
    expect(unidades[2].topics[16]).toEqual({
      id: 'tp-u-3-t-17',
      name: 'Situaciones problemáticas con descuento, recargo y cuotas',
      origin: 'custom',
    })
    const ids = unidades.flatMap((u) => [u.id, ...u.topics.map((t) => t.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el perfil hace llegar la carrera y la metodología al prompt', () => {
    const contexto = pedagogyProfileToContext(construirPerfil('Análisis de producciones de alumnos.'))
    expect(contexto).toContain(`Nivel: ${NIVEL}`)
    expect(contexto).toContain(`Grado/Año: ${GRADO}`)
    expect(contexto).toContain(`Carrera: ${CARRERA}`)
    expect(contexto).toContain('Metodologia: Análisis de producciones de alumnos.')
  })
})
