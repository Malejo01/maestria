import { describe, expect, it } from 'vitest'
import { parametrosDeLaPractica } from './practica-del-grupo'

const perfilSecundario = { nivel: 'Secundario', grado: '3er Año' }
const profesorado = { nivel: 'Superior', grado: '1er Año', carrera: 'Profesorado de Educación Primaria' }

describe('O3 · la práctica dentro de un grupo usa la materia del grupo', () => {
  it('en un grupo, nivel y año salen del programa, no del perfil', () => {
    expect(parametrosDeLaPractica({ classroomId: 3, programa: profesorado, perfil: perfilSecundario, tipos: ['multiple_choice'], tocoLosTipos: false })).toEqual({
      nivel: 'Superior',
      grado: '1er Año',
      carrera: 'Profesorado de Educación Primaria',
    })
  })

  it('"No aplica" (lo que guarda el asistente sin carrera) no es una carrera', () => {
    expect(parametrosDeLaPractica({ classroomId: 1, programa: { nivel: 'Secundario', grado: '3er Año', carrera: 'No aplica' }, tipos: [], tocoLosTipos: false }).carrera).toBeUndefined()
  })

  it('sin tocar el selector no se mandan tipos: decide el programa', () => {
    expect(parametrosDeLaPractica({ classroomId: 3, programa: profesorado, tipos: ['multiple_choice'], tocoLosTipos: false }).questionTypes).toBeUndefined()
  })

  it('si el alumno tocó el selector, manda lo que eligió', () => {
    expect(parametrosDeLaPractica({ classroomId: 3, programa: profesorado, tipos: ['true_false', 'numeric'], tocoLosTipos: true }).questionTypes).toEqual(['true_false', 'numeric'])
  })

  it('un programa sin nivel no toma el del perfil (lo resuelve el servidor del contexto del programa)', () => {
    expect(parametrosDeLaPractica({ classroomId: 3, programa: { carrera: '' }, perfil: perfilSecundario, tipos: [], tocoLosTipos: false })).toEqual({
      nivel: undefined,
      grado: undefined,
      carrera: undefined,
    })
  })

  it('fuera de un grupo, como siempre: el cuestionario en curso, después el perfil, y los tipos del selector', () => {
    expect(parametrosDeLaPractica({ perfil: perfilSecundario, tipos: ['multiple_choice'], tocoLosTipos: false })).toEqual({
      nivel: 'Secundario',
      grado: '3er Año',
      questionTypes: ['multiple_choice'],
    })
    expect(parametrosDeLaPractica({ config: { nivel: 'Primario', grado: '4to Año' }, perfil: perfilSecundario, tipos: [], tocoLosTipos: false }).nivel).toBe('Primario')
  })
})
