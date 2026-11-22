import { describe, expect, it } from 'vitest'
import {
  AREA_IDS,
  PERFILES,
  bloquesDeNotacion,
  caracterEfectivo,
  limitarMezcla,
  maximoPorTipo,
  mezclaPonderada,
  perfilDeArea,
  rolEspecialista,
  tiposPermitidos,
  validadoresDe,
  type AreaId,
  type Caracter,
  type Modo,
  type Notacion,
} from './areas'
import { distributeQuestionCounts } from './question-mix'

const MODOS: Modo[] = ['teorico', 'practico', 'mixto']

describe('los perfiles de área', () => {
  it('hay un perfil por área, con su id, y los tres modos completos', () => {
    for (const id of AREA_IDS) {
      const perfil = PERFILES[id]
      expect(perfil.id).toBe(id)
      expect(perfil.nombre.length).toBeGreaterThan(0)
      for (const modo of MODOS) {
        expect(perfil.modos[modo].etiqueta.length).toBeGreaterThan(0)
        expect(perfil.modos[modo].descripcion.length).toBeGreaterThan(0)
        expect(perfil.modos[modo].ejemplos.length).toBeLessThanOrEqual(2)
        expect(Object.keys(perfil.mezclaPorModo[modo]).length).toBeGreaterThan(1)
      }
    }
  })

  it('carácter y notación de cada área, como la tabla del encargo', () => {
    const tabla: Record<AreaId, [Caracter, Notacion]> = {
      matematica: ['cuantitativo', 'latex'],
      estadistica: ['cuantitativo', 'latex'],
      fisica: ['cuantitativo', 'latex'],
      quimica: ['mixto', 'formulas'],
      biologia: ['conceptual', 'ninguna'],
      informatica: ['mixto', 'codigo'],
      contabilidad: ['cuantitativo', 'latex'],
      economia: ['mixto', 'latex'],
      administracion: ['conceptual', 'ninguna'],
      salud: ['conceptual', 'ninguna'],
      psicologia: ['conceptual', 'ninguna'],
      sociales: ['conceptual', 'ninguna'],
      educacion: ['conceptual', 'ninguna'],
      derecho: ['conceptual', 'ninguna'],
      lengua: ['conceptual', 'ninguna'],
      artes: ['conceptual', 'ninguna'],
      otra: ['mixto', 'ninguna'],
    }
    for (const id of AREA_IDS) {
      expect([PERFILES[id].caracter, PERFILES[id].notacion], id).toEqual(tabla[id])
    }
    expect(PERFILES.contabilidad.soloNumeros).toBe(true)
    expect(PERFILES.economia.soloNumeros).toBe(true)
  })

  it('las conceptuales: la mezcla del encargo y nunca numérica', () => {
    for (const id of AREA_IDS.filter((a) => PERFILES[a].caracter === 'conceptual')) {
      expect(PERFILES[id].mezclaPorModo.teorico).toEqual({ multiple_choice: 40, short_answer: 25, true_false: 35 })
      expect(PERFILES[id].mezclaPorModo.practico).toEqual({ multiple_choice: 50, short_answer: 35, true_false: 15 })
      for (const modo of MODOS) expect(PERFILES[id].mezclaPorModo[modo].numeric).toBeUndefined()
    }
  })

  it('ninguna mezcla por defecto pasa del 50 %', () => {
    for (const id of AREA_IDS) {
      for (const modo of MODOS) {
        const mezcla = PERFILES[id].mezclaPorModo[modo]
        const total = Object.values(mezcla).reduce((s, p) => s + (p ?? 0), 0)
        for (const peso of Object.values(mezcla)) expect((peso ?? 0) / total, `${id} ${modo}`).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('el teórico de las cuantitativas no lleva numérica (como questionTypesForMode)', () => {
    expect(PERFILES.matematica.mezclaPorModo.teorico.numeric).toBeUndefined()
    expect(PERFILES.matematica.mezclaPorModo.practico.numeric).toBeGreaterThan(0)
  })

  it('el práctico de sociales y psicología dice "análisis de casos", no ejercicios', () => {
    expect(PERFILES.sociales.modos.practico.etiqueta).toBe('Práctico: análisis de casos')
    expect(PERFILES.psicologia.modos.practico.etiqueta).toBe('Práctico: análisis de casos')
    for (const id of AREA_IDS.filter((a) => PERFILES[a].caracter === 'conceptual')) {
      expect(PERFILES[id].modos.practico.descripcion, id).not.toMatch(/c[aá]lculo de|ejercicios de c[aá]lculo|problemas num[eé]ricos/i)
    }
  })

  it('los ejemplos de consigna no citan a autores reales', () => {
    for (const id of AREA_IDS) {
      for (const modo of MODOS) {
        for (const ejemplo of PERFILES[id].modos[modo].ejemplos) {
          expect(ejemplo.length).toBeLessThan(300)
          expect(ejemplo).not.toMatch(/«|»|seg[uú]n [A-Z][a-z]+ [A-Z]|como (dice|dijo|afirma) [A-Z]/)
        }
      }
    }
  })

  it('un área desconocida cae en Otra', () => {
    expect(perfilDeArea(null).id).toBe('otra')
    expect(perfilDeArea('cualquiera' as AreaId).id).toBe('otra')
  })

  it('el rol de especialista nombra la materia', () => {
    expect(rolEspecialista('psicologia', 'Temas de Antropología Cultural en Psicología')).toMatch(/psicología[\s\S]*Temas de Antropología/)
    expect(rolEspecialista('otra', 'Taller de Oficios')).toMatch(/Taller de Oficios/)
  })
})

describe('caracterEfectivo: qué manda', () => {
  it('lo manual > la unidad > el área > lo genérico', () => {
    expect(caracterEfectivo({ manual: 'conceptual', unidad: 'cuantitativo', area: 'matematica' })).toBe('conceptual')
    expect(caracterEfectivo({ unidad: 'cuantitativo', area: 'educacion' })).toBe('cuantitativo')
    expect(caracterEfectivo({ area: 'psicologia' })).toBe('conceptual')
    expect(caracterEfectivo({})).toBe('mixto')
  })

  it('un valor que no es un carácter no manda', () => {
    expect(caracterEfectivo({ manual: 'raro', unidad: null, area: 'matematica' })).toBe('cuantitativo')
  })
})

describe('limitarMezcla: ningún tipo pasa del 50 %', () => {
  it('los 40 de 40 verdadero o falso no pueden pasar', () => {
    expect(limitarMezcla({ true_false: 100, multiple_choice: 10 })).toEqual({ true_false: 50, multiple_choice: 50 })
  })

  it('lo que sobra se reparte en proporción', () => {
    expect(limitarMezcla({ true_false: 80, multiple_choice: 10, short_answer: 10 })).toEqual({
      true_false: 50,
      multiple_choice: 25,
      short_answer: 25,
    })
  })

  it('un solo tipo queda como está', () => {
    expect(limitarMezcla({ true_false: 100 })).toEqual({ true_false: 100 })
  })

  it('lo que ya cumple no cambia de proporción', () => {
    expect(limitarMezcla({ multiple_choice: 40, short_answer: 25, true_false: 35 })).toEqual({
      multiple_choice: 40,
      short_answer: 25,
      true_false: 35,
    })
  })

  it('en cantidades: 40 preguntas, ninguno pasa de 20', () => {
    const cuotas = distributeQuestionCounts(limitarMezcla({ true_false: 90, multiple_choice: 5, short_answer: 5 }), 40)
    expect(cuotas.reduce((s, c) => s + c.count, 0)).toBe(40)
    for (const c of cuotas) expect(c.count).toBeLessThanOrEqual(maximoPorTipo(40, cuotas.length))
  })

  it('el máximo con un total impar es la mitad para arriba', () => {
    expect(maximoPorTipo(5, 2)).toBe(3)
    expect(maximoPorTipo(10, 3)).toBe(5)
    expect(maximoPorTipo(7, 1)).toBe(7)
  })
})

describe('tiposPermitidos: numérica sólo con algo cuantitativo', () => {
  it('sin unidades cuantitativas, la numérica se cae', () => {
    expect(tiposPermitidos(['multiple_choice', 'numeric', 'true_false'], ['conceptual'])).toEqual(['multiple_choice', 'true_false'])
  })

  it('con una unidad cuantitativa, queda', () => {
    expect(tiposPermitidos(['multiple_choice', 'numeric'], ['conceptual', 'cuantitativo'])).toEqual(['multiple_choice', 'numeric'])
  })

  it('si el docente la tildó a mano, queda', () => {
    expect(tiposPermitidos(['numeric'], ['conceptual'], ['numeric'])).toEqual(['numeric'])
  })

  it('si no queda nada, opción múltiple', () => {
    expect(tiposPermitidos(['numeric'], ['conceptual'])).toEqual(['multiple_choice'])
  })
})

describe('mezclaPonderada: varias unidades', () => {
  it('todo del carácter del área: la mezcla del área', () => {
    expect(mezclaPonderada('psicologia', 'practico', [{ caracter: 'conceptual', temas: 3 }])).toEqual(PERFILES.psicologia.mezclaPorModo.practico)
    expect(mezclaPonderada('informatica', 'practico', [])).toEqual(PERFILES.informatica.mezclaPorModo.practico)
  })

  it('Matemática y su Didáctica: la numérica aparece en proporción a los temas cuantitativos', () => {
    const mitad = mezclaPonderada('educacion', 'practico', [
      { caracter: 'cuantitativo', temas: 2 },
      { caracter: 'conceptual', temas: 2 },
    ])
    const cuarto = mezclaPonderada('educacion', 'practico', [
      { caracter: 'cuantitativo', temas: 1 },
      { caracter: 'conceptual', temas: 3 },
    ])
    expect(mitad.numeric).toBeCloseTo(22.5, 1)
    expect(cuarto.numeric).toBeCloseTo(11.3, 1)
    const total = Object.values(mitad).reduce((s, p) => s + (p ?? 0), 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('las unidades sin temas elegidos no pesan', () => {
    expect(
      mezclaPonderada('educacion', 'teorico', [
        { caracter: 'cuantitativo', temas: 0 },
        { caracter: 'conceptual', temas: 4 },
      ]),
    ).toEqual(PERFILES.educacion.mezclaPorModo.teorico)
  })
})

describe('bloquesDeNotacion', () => {
  it('antropología y psicología: sin LaTeX ni código', () => {
    expect(bloquesDeNotacion('sociales', ['conceptual'])).toEqual({ latex: false, latexSoloNumeros: false, formulas: false, codigo: false })
    expect(bloquesDeNotacion('psicologia', ['conceptual'])).toEqual({ latex: false, latexSoloNumeros: false, formulas: false, codigo: false })
  })

  it('matemática: LaTeX', () => {
    expect(bloquesDeNotacion('matematica', ['cuantitativo']).latex).toBe(true)
  })

  it('una didáctica con una unidad de números: LaTeX por esa unidad; sin ella, no', () => {
    expect(bloquesDeNotacion('educacion', ['conceptual', 'cuantitativo']).latex).toBe(true)
    expect(bloquesDeNotacion('educacion', ['conceptual']).latex).toBe(false)
  })

  it('informática: código siempre; LaTeX sólo con una unidad cuantitativa', () => {
    expect(bloquesDeNotacion('informatica', ['mixto'])).toEqual({ latex: false, latexSoloNumeros: false, formulas: false, codigo: true })
    expect(bloquesDeNotacion('informatica', ['cuantitativo']).latex).toBe(true)
  })

  it('contabilidad y economía: LaTeX sólo para números', () => {
    expect(bloquesDeNotacion('contabilidad', ['cuantitativo'])).toMatchObject({ latex: true, latexSoloNumeros: true })
    expect(bloquesDeNotacion('economia', ['mixto'])).toMatchObject({ latex: true, latexSoloNumeros: true })
    expect(bloquesDeNotacion('economia', ['conceptual']).latex).toBe(false)
  })

  it('química: fórmulas en lo mixto, nada en una unidad conceptual', () => {
    expect(bloquesDeNotacion('quimica', ['mixto']).formulas).toBe(true)
    expect(bloquesDeNotacion('quimica', ['conceptual']).formulas).toBe(false)
  })
})

describe('validadoresDe', () => {
  it('factorización, fracciones y coma decimal sólo en lo cuantitativo', () => {
    expect(validadoresDe('matematica', 'cuantitativo')).toEqual(['factorizacion', 'fracciones', 'coma_decimal'])
    expect(validadoresDe('educacion', 'cuantitativo')).toEqual(['factorizacion', 'fracciones', 'coma_decimal'])
  })

  it('en lo conceptual, "sin LaTeX ni cálculo", aunque el área sea cuantitativa', () => {
    expect(validadoresDe('matematica', 'conceptual')).toEqual(['sin_latex_ni_calculo'])
    expect(validadoresDe('sociales', 'conceptual')).toEqual(['sin_latex_ni_calculo'])
  })

  it('código en informática', () => {
    expect(validadoresDe('informatica', 'mixto')).toEqual(['codigo'])
    expect(validadoresDe('informatica', 'conceptual')).toEqual(['sin_latex_ni_calculo', 'codigo'])
  })
})
