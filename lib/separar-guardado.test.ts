import { describe, expect, it } from 'vitest'
import { aplicarSeparacion, temasLargos, validarPedazos } from './separar-guardado'

const LARGO = 'La antropología como disciplina científica y su objeto de estudio, el trabajo de campo y la observación participante, el concepto de cultura'
const PROGRAMA = [
  { id: 'u1', name: 'Unidad 1', topics: [{ id: 'tp-u-1-t-1', name: LARGO, origin: 'custom' }, { id: 'tp-u-1-t-2', name: 'Rituales' }] },
  { id: 'u2', name: 'Unidad 2', topics: [{ id: 'tp-u-1-t-1-s2', name: 'Ya existe este id' }] },
]

describe('D2 · separar lo guardado', () => {
  it('encuentra los temas largos', () => {
    expect(temasLargos(PROGRAMA)).toEqual([{ unidadId: 'u1', temaId: 'tp-u-1-t-1', nombre: LARGO }])
  })

  it('el primer tema conserva el id original (A reforzar y diagnósticos siguen apuntando); los demás, ids nuevos y únicos', () => {
    const r = aplicarSeparacion(PROGRAMA, 'u1', 'tp-u-1-t-1', ['La antropología como disciplina', 'El trabajo de campo', 'El concepto de cultura'])!
    expect(r[0].topics.map((t) => t.id)).toEqual(['tp-u-1-t-1', 'tp-u-1-t-1-s2-1', 'tp-u-1-t-1-s3', 'tp-u-1-t-2'])
    expect(r[0].topics[0]).toMatchObject({ id: 'tp-u-1-t-1', name: 'La antropología como disciplina', origin: 'custom' })
    expect(r[1]).toEqual(PROGRAMA[1])
  })

  it('una unidad o un tema que no existen: null', () => {
    expect(aplicarSeparacion(PROGRAMA, 'u9', 'tp-u-1-t-1', ['a', 'b'])).toBeNull()
    expect(aplicarSeparacion(PROGRAMA, 'u1', 'nada', ['a', 'b'])).toBeNull()
  })

  it('lo revisado: sin vacíos ni repetidos, de 2 a 15', () => {
    expect(validarPedazos([' Uno ', 'uno', '', 'Dos'])).toEqual(['Uno', 'Dos'])
    expect(validarPedazos(['Solo uno'])).toBeNull()
    expect(validarPedazos('no es lista')).toBeNull()
  })
})
