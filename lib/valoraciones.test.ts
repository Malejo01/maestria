import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O8. Validación, la regla de recorte de "Evitá esto", y el servidor con su válvula. */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))
let responder: (texto: string) => unknown = () => []

vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))

import { leerValoracion, MAX_CARACTERES_A_EVITAR, seccionEvitar, type PreguntaAEvitar } from './valoraciones'
import { preguntasAEvitar, resumenDeValoraciones } from './valoraciones-server'

beforeEach(() => {
  consultas.length = 0
  responder = () => []
})

describe('leerValoracion', () => {
  it('arriba no lleva motivo; abajo lo exige', () => {
    expect(leerValoracion({ indice: 2, valor: 1, motivo: 'muy_facil' })).toEqual({ indice: 2, valor: 1, motivo: null })
    expect(leerValoracion({ indice: 2, valor: -1, motivo: 'mal_redactada' })).toEqual({ indice: 2, valor: -1, motivo: 'mal_redactada' })
    expect(leerValoracion({ indice: 2, valor: -1 })).toBeNull()
    expect(leerValoracion({ indice: 2, valor: -1, motivo: 'otro' })).toBeNull()
    expect(leerValoracion({ indice: -1, valor: 1 })).toBeNull()
    expect(leerValoracion({ indice: 2, valor: 0 })).toBeNull()
  })
})

describe('"Evitá esto": la regla de recorte', () => {
  const p = (enunciado: string, motivo: PreguntaAEvitar['motivo'] = 'mal_redactada'): PreguntaAEvitar => ({ enunciado, motivo })

  it('sin nada, nada', () => {
    expect(seccionEvitar([])).toBe('')
  })

  it('cada uno con su enunciado y su motivo', () => {
    const s = seccionEvitar([p('¿Es 7 primo?', 'tipo_equivocado'), p('Calculá 2 + 2', 'muy_facil')])
    expect(s).toContain('EVITÁ ESTO')
    expect(s).toContain('- «¿Es 7 primo?» (tipo equivocado)')
    expect(s).toContain('- «Calculá 2 + 2» (muy fácil)')
  })

  it('hasta 10, aunque lleguen más', () => {
    const s = seccionEvitar(Array.from({ length: 15 }, (_, i) => p(`Pregunta ${i}`)))
    expect(s.match(/^- «/gm)).toHaveLength(10)
  })

  it('un enunciado largo se corta a 220 caracteres', () => {
    const s = seccionEvitar([p('x'.repeat(500))])
    expect(s).toContain(`«${'x'.repeat(219)}…»`)
  })

  it('el total no pasa el presupuesto, y lo que no entra entero no entra', () => {
    const s = seccionEvitar(Array.from({ length: 10 }, (_, i) => p(`${i} ${'y'.repeat(300)}`)))
    const renglones = s.split('\n').filter((l) => l.startsWith('- «'))
    expect(renglones.join('\n').length).toBeLessThanOrEqual(MAX_CARACTERES_A_EVITAR)
    expect(renglones.length).toBeLessThan(10)
    expect(renglones.every((r) => r.endsWith(')'))).toBe(true)
  })
})

describe('en la base (033)', () => {
  it('los pulgares abajo de la materia, del dueño, los más nuevos primero', async () => {
    responder = () => [{ enunciado: '¿Es 7 primo?', motivo: 'tipo_equivocado' }]
    expect(await preguntasAEvitar(13)).toEqual([{ enunciado: '¿Es 7 primo?', motivo: 'tipo_equivocado' }])
    expect(consultas[0].texto).toContain('p.user_id = v.docente_id')
    expect(consultas[0].texto).toContain('ORDER BY v.creado_el DESC')
    expect(consultas[0].valores).toEqual([13, 10])
  })

  it('sin materia no consulta; sin la 033 (o con un error) devuelve vacío y no lanza', async () => {
    expect(await preguntasAEvitar(null)).toEqual([])
    expect(consultas).toHaveLength(0)
    responder = () => {
      throw Object.assign(new Error('x'), { code: '42P01' })
    }
    expect(await preguntasAEvitar(13)).toEqual([])
    expect(await resumenDeValoraciones()).toBeNull()
    responder = () => {
      throw new Error('se cayó')
    }
    expect(await preguntasAEvitar(13)).toEqual([])
  })

  it('el resumen del admin cuenta por motivo', async () => {
    responder = () => [
      { valor: -1, motivo: 'muy_facil', n: 3 },
      { valor: -1, motivo: 'mal_redactada', n: 1 },
      { valor: 1, motivo: null, n: 7 },
    ]
    const r = await resumenDeValoraciones()
    expect(r?.arriba).toBe(7)
    expect(r?.porMotivo.muy_facil).toBe(3)
    expect(r?.porMotivo.tipo_equivocado).toBe(0)
  })
})
