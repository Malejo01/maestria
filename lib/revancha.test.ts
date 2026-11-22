import { describe, expect, it } from 'vitest'
import { revanchaPermitida } from './revancha'

describe('revanchaPermitida (decisión 1 de la tanda P)', () => {
  it('en la práctica libre (también la de un grupo, sin tarea), sí', () => {
    expect(revanchaPermitida({})).toBe(true)
    expect(revanchaPermitida(null)).toBe(true)
  })
  it('en una tarea o un diagnóstico (con nota), no', () => {
    expect(revanchaPermitida({ assignmentId: 12 })).toBe(false)
  })
  it('en una práctica extra de una tarea, no: ahí va "Practicar otra vez"', () => {
    expect(revanchaPermitida({ practicaExtraId: 3 })).toBe(false)
    expect(revanchaPermitida({ practicaDeTarea: 12 })).toBe(false)
  })
  it('en la vista previa del docente y en un simulacro que cuenta, no', () => {
    expect(revanchaPermitida({ previewOnly: true })).toBe(false)
    expect(revanchaPermitida({ simulacroQueCuenta: true })).toBe(false)
  })
})
