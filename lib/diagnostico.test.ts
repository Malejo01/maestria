import { describe, expect, it } from 'vitest'
import {
  MAX_INTEGRAL,
  planDeUnidad,
  planDiagnostico,
  planIntegral,
  repartirProporcional,
  resumirPlan,
  validarCuestionario,
} from './diagnostico'
import type { ProgramUnit } from './types'

const unidad = (id: string, temas: number): ProgramUnit => ({
  id,
  name: `Unidad ${id}`,
  topics: Array.from({ length: temas }, (_, i) => ({ id: `${id}-t${i + 1}`, name: `Tema ${id}.${i + 1}` })),
})

describe('por unidad: 1 por tema, 2 si la unidad tiene menos de 5, entre 5 y 15', () => {
  it('8 temas → 8 preguntas, una por tema', () => {
    const plan = planDeUnidad(unidad('a', 8))!
    expect(plan.total).toBe(8)
    expect(plan.temas.every((t) => t.preguntas === 1)).toBe(true)
  })

  it('4 temas → 2 por tema, 8', () => {
    expect(planDeUnidad(unidad('a', 4))!.total).toBe(8)
  })

  it('2 temas → 2 por tema daría 4: sube al mínimo de 5', () => {
    const plan = planDeUnidad(unidad('a', 2))!
    expect(plan.total).toBe(5)
    expect(plan.temas.map((t) => t.preguntas).sort()).toEqual([2, 3])
  })

  it('con 2 temas, la pregunta de más va al que le cuesta', () => {
    const plan = planDeUnidad(unidad('a', 2), new Set(['a-t2']))!
    expect(plan.temas.find((t) => t.id === 'a-t2')!.preguntas).toBe(3)
  })

  it('1 tema → las 5 sobre ese tema', () => {
    expect(planDeUnidad(unidad('a', 1))!.temas).toEqual([{ id: 'a-t1', nombre: 'Tema a.1', preguntas: 5 }])
  })

  it('5 temas → 5 (el borde: con 5 ya es 1 por tema)', () => {
    expect(planDeUnidad(unidad('a', 5))!.total).toBe(5)
  })

  it('20 temas → máximo 15, repartidos a lo largo de la unidad y con los que le cuestan adentro', () => {
    const plan = planDeUnidad(unidad('a', 20), new Set(['a-t20']))!
    expect(plan.total).toBe(15)
    expect(plan.temas.map((t) => t.id)).toContain('a-t20')
    expect(plan.temas.map((t) => t.id)).toContain('a-t1')
  })

  it('una unidad sin temas no genera cuestionario', () => {
    expect(planDeUnidad(unidad('a', 0))).toBeNull()
  })
})

describe('integral: 1 por tema, máximo 40', () => {
  it('37 temas → 37 preguntas en un solo examen', () => {
    const plan = planDiagnostico([unidad('a', 10), unidad('b', 12), unidad('c', 15)], 'integral')
    expect(plan).toHaveLength(1)
    expect(plan[0].total).toBe(37)
  })

  it('el borde: 40 temas entran todos; 41 ya recorta a 40', () => {
    expect(planIntegral([unidad('a', 20), unidad('b', 20)])!.total).toBe(40)
    expect(planIntegral([unidad('a', 20), unidad('b', 21)])!.total).toBe(MAX_INTEGRAL)
  })

  it('con más de 40: primero los que le cuestan, el resto en proporción a cada unidad', () => {
    // 60 temas: 30 + 20 + 10. Le cuestan 4 de la unidad c.
    const unidades = [unidad('a', 30), unidad('b', 20), unidad('c', 10)]
    const dificiles = new Set(['c-t1', 'c-t2', 'c-t3', 'c-t4'])
    const plan = planIntegral(unidades, dificiles)!
    const ids = plan.temas.map((t) => t.id)
    expect(plan.total).toBe(40)
    for (const id of dificiles) expect(ids).toContain(id)
    // Quedan 36 lugares para 56 temas (30, 20, 6): 19,3 / 12,9 / 3,9 → 19, 13, 4.
    const deUnidad = (u: string) => ids.filter((id) => id.startsWith(`${u}-`)).length
    expect(deUnidad('a')).toBe(19)
    expect(deUnidad('b')).toBe(13)
    expect(deUnidad('c')).toBe(4 + 4)
  })

  it('más temas difíciles que lugares: se queda con 40 de ellos', () => {
    const unidades = [unidad('a', 50)]
    const dificiles = new Set(unidades[0].topics.map((t) => t.id))
    expect(planIntegral(unidades, dificiles)!.total).toBe(40)
  })
})

describe('repartirProporcional', () => {
  it('suma exactamente el cupo y nadie recibe más de lo que tiene', () => {
    const partes = repartirProporcional([30, 20, 6], 36)
    expect(partes.reduce((a, b) => a + b, 0)).toBe(36)
    expect(partes).toEqual([19, 13, 4])
  })
  it('con cupo de sobra, todo', () => {
    expect(repartirProporcional([3, 2], 10)).toEqual([3, 2])
  })
})

describe('el docente destilda unidades que todavía no vio', () => {
  it('por unidad: no aparecen', () => {
    const plan = planDiagnostico([unidad('a', 6), unidad('b', 6)], 'por_unidad', { unidadesExcluidas: ['b'] })
    expect(plan.map((c) => c.unidadId)).toEqual(['a'])
  })
  it('integral: sus temas no entran', () => {
    const plan = planDiagnostico([unidad('a', 6), unidad('b', 6)], 'integral', { unidadesExcluidas: ['a'] })
    expect(plan[0].temas.every((t) => t.id.startsWith('b-'))).toBe(true)
  })
})

describe('resumirPlan — "4 cuestionarios · 37 preguntas · unos 45 minutos"', () => {
  it('37 preguntas son unos 45 minutos', () => {
    const plan = planDiagnostico([unidad('a', 10), unidad('b', 12), unidad('c', 9), unidad('d', 6)], 'por_unidad')
    expect(resumirPlan(plan)).toEqual({ cuestionarios: 4, preguntas: 37, minutos: 45 })
  })
})

describe('validarCuestionario (lo que manda el cliente)', () => {
  const unidades = [unidad('a', 6), unidad('b', 6)]
  it('acepta un cuestionario del plan', () => {
    const plan = planDiagnostico(unidades, 'por_unidad')[0]
    expect(validarCuestionario(plan, unidades, 'por_unidad')).toEqual(plan)
  })
  it('rechaza temas de otra unidad, ids inventados y totales sobre el tope', () => {
    expect(validarCuestionario({ unidadId: 'a', temas: [{ id: 'b-t1', preguntas: 1 }] }, unidades, 'por_unidad')).toBeNull()
    expect(validarCuestionario({ unidadId: 'a', temas: [{ id: 'x', preguntas: 1 }] }, unidades, 'por_unidad')).toBeNull()
    expect(validarCuestionario({ unidadId: 'a', temas: [{ id: 'a-t1', preguntas: 16 }] }, unidades, 'por_unidad')).toBeNull()
  })
})
