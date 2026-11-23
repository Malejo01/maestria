import { describe, expect, it } from 'vitest'
import {
  avisosVigentes,
  completarTipos,
  frasesDeAvisos,
  leerAvisos,
  lugarParaReemplazar,
  planDeTipos,
  repartirEntreMitades,
  sinTiposDeCalculo,
  tiposFaltantes,
  unirAvisos,
} from './tipos-garantizados'
import type { QuestionType } from './types'

const p = (type: QuestionType, id: string = type) => ({ type, id })

describe('planDeTipos', () => {
  it('garantiza los pedidos que se pueden, en orden', () => {
    expect(planDeTipos(['matching', 'ordering'], ['matching', 'ordering'], 5)).toEqual({
      garantizar: ['matching', 'ordering'],
      avisos: [],
    })
  })

  it('una calculada que el área no permite se avisa como "sin cálculos"', () => {
    const plan = planDeTipos(['calculated', 'matching'], ['matching'], 5)
    expect(plan.garantizar).toEqual(['matching'])
    expect(plan.avisos).toEqual([{ tipo: 'calculated', motivo: 'sin-calculos' }])
  })

  it('con más tipos que preguntas, los que no entran se avisan', () => {
    const plan = planDeTipos(['matching', 'ordering', 'gapselect'], ['matching', 'ordering', 'gapselect'], 2)
    expect(plan.garantizar).toEqual(['matching', 'ordering'])
    expect(plan.avisos).toEqual([{ tipo: 'gapselect', motivo: 'no-entra' }])
  })

  it('no repite un tipo pedido dos veces', () => {
    expect(planDeTipos(['matching', 'matching'], ['matching'], 3).garantizar).toEqual(['matching'])
  })
})

describe('tiposFaltantes', () => {
  it('devuelve los que no tienen ninguna pregunta', () => {
    expect(tiposFaltantes(['matching', 'ordering', 'calculated'], [p('matching'), p('matching')])).toEqual(['ordering', 'calculated'])
  })
})

describe('lugarParaReemplazar', () => {
  it('prefiere una pregunta de un tipo que no hay que garantizar', () => {
    expect(lugarParaReemplazar([p('matching'), p('multiple_choice'), p('matching')], ['matching', 'ordering'])).toBe(1)
  })

  it('si no, la última del tipo más repetido', () => {
    const preguntas = [p('matching', 'a'), p('multiple_response', 'b'), p('matching', 'c'), p('multiple_response', 'd'), p('matching', 'e')]
    expect(lugarParaReemplazar(preguntas, ['matching', 'multiple_response', 'ordering'])).toBe(4)
  })

  it('-1 si sacar cualquiera deja sin su tipo a otro', () => {
    expect(lugarParaReemplazar([p('matching'), p('ordering')], ['matching', 'ordering', 'calculated'])).toBe(-1)
  })
})

describe('completarTipos', () => {
  it('reemplaza una que sobra y mantiene la cantidad', () => {
    // El caso del G1: cinco tipos pedidos, salieron tres (dos repetidos).
    const pedidos: QuestionType[] = ['calculated', 'ddwtos', 'matching', 'multiple_response', 'ordering']
    const juntadas = [p('ddwtos', '1'), p('matching', '2'), p('matching', '3'), p('multiple_response', '4'), p('multiple_response', '5')]
    const { preguntas, faltan } = completarTipos(juntadas, [p('calculated', 'n1'), p('ordering', 'n2')], pedidos)
    expect(preguntas).toHaveLength(5)
    expect(faltan).toEqual([])
    expect(new Set(preguntas.map((q) => q.type))).toEqual(new Set(pedidos))
    // Las que no sobraban no se tocan.
    expect(preguntas[0].id).toBe('1')
  })

  it('ignora una nueva de un tipo que ya estaba', () => {
    const { preguntas } = completarTipos([p('matching', 'a'), p('matching', 'b')], [p('matching', 'n')], ['matching', 'ordering'])
    expect(preguntas.map((q) => q.id)).toEqual(['a', 'b'])
  })

  it('informa lo que sigue faltando', () => {
    const { faltan } = completarTipos([p('matching', 'a'), p('matching', 'b')], [], ['matching', 'ordering'])
    expect(faltan).toEqual(['ordering'])
  })
})

describe('repartirEntreMitades', () => {
  it('los de cálculo van a la práctica y el resto se reparte', () => {
    const r = repartirEntreMitades(['calculated', 'matching', 'ordering', 'gapselect', 'numeric'], 3, 2)
    expect(r.practico).toContain('calculated')
    expect(r.practico).toContain('numeric')
    expect(r.teorico).not.toContain('calculated')
    expect(r.teorico.length).toBeLessThanOrEqual(3)
    expect(r.practico.length).toBeLessThanOrEqual(2)
  })

  it('ninguna mitad garantiza más tipos que preguntas', () => {
    const r = repartirEntreMitades(['matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'multiple_response'], 2, 2)
    expect(r.teorico).toHaveLength(2)
    expect(r.practico).toHaveLength(2)
    expect(new Set([...r.teorico, ...r.practico]).size).toBe(4)
  })
})

describe('sinTiposDeCalculo', () => {
  it('saca la calculada si todas las unidades son conceptuales', () => {
    expect(sinTiposDeCalculo(['calculated', 'matching'], ['conceptual'])).toEqual(['matching'])
  })

  it('la deja si alguna unidad tiene cálculos', () => {
    expect(sinTiposDeCalculo(['calculated', 'matching'], ['conceptual', 'mixto'])).toEqual(['calculated', 'matching'])
  })

  it('nunca deja la lista vacía', () => {
    expect(sinTiposDeCalculo(['calculated'], ['conceptual'])).toEqual(['multiple_choice'])
  })
})

describe('avisos', () => {
  it('unirAvisos no repite un tipo', () => {
    expect(
      unirAvisos([{ tipo: 'ordering', motivo: 'no-salio' }], [{ tipo: 'ordering', motivo: 'no-entra' }, { tipo: 'calculated', motivo: 'sin-calculos' }]),
    ).toEqual([
      { tipo: 'ordering', motivo: 'no-salio' },
      { tipo: 'calculated', motivo: 'sin-calculos' },
    ])
  })

  it('avisosVigentes descarta el tipo que terminó apareciendo', () => {
    expect(avisosVigentes([{ tipo: 'ordering', motivo: 'no-entra' }], [p('ordering')])).toEqual([])
  })
})

describe('frasesDeAvisos y leerAvisos', () => {
  const textos = {
    sinCalculos: (t: string) => `sin cálculos: ${t}`,
    noSalio: (t: string) => `no salió: ${t}`,
    noEntra: (ts: string[]) => `no entran: ${ts.join(', ')}`,
  }
  it('una frase por aviso y una sola para los que no entran', () => {
    expect(
      frasesDeAvisos(
        [
          { tipo: 'calculated', motivo: 'sin-calculos' },
          { tipo: 'gapselect', motivo: 'no-entra' },
          { tipo: 'ddwtos', motivo: 'no-entra' },
        ],
        (t: string) => t.toUpperCase(),
        textos,
      ),
    ).toEqual(['sin cálculos: CALCULATED', 'no entran: GAPSELECT, DDWTOS'])
  })

  it('leerAvisos descarta lo que no es un aviso', () => {
    expect(leerAvisos({ avisosDeTipos: [{ tipo: 'ordering', motivo: 'no-salio' }, { tipo: 'x', motivo: 'otro' }, null] })).toEqual([
      { tipo: 'ordering', motivo: 'no-salio' },
    ])
    expect(leerAvisos(null)).toEqual([])
  })
})
