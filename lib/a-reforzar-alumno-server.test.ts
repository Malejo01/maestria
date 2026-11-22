import { beforeEach, describe, expect, it, vi } from 'vitest'

/** P7 · "A reforzar" de la base y la migración de lo que guardaba el navegador. */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))
let responder: (texto: string) => unknown = () => []
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))

import { debilesValidos, migrarDebilesDelNavegador, temasAReforzar, TIPO_DEL_NAVEGADOR } from './a-reforzar-alumno-server'

beforeEach(() => {
  consultas.length = 0
  responder = () => []
})

describe('temasAReforzar', () => {
  it('sólo lo del alumno y sin resolver; la ficha filtra por la materia del grupo', async () => {
    responder = () => [{ subject: 'Lengua', topic_id: 't1', topic_name: 'Clases de palabras', veces: 2, tipo: 'Confusión', ultimo_tip: 'Mirá el género.' }]
    expect(await temasAReforzar('sofia', 'Lengua')).toEqual([
      { topic: 't1', topicName: 'Clases de palabras', subject: 'Lengua', count: 2, misconceptionType: 'Confusión', lastTip: 'Mirá el género.' },
    ])
    expect(consultas[0].texto).toContain('resolved = FALSE')
    expect(consultas[0].valores).toContain('sofia')
    expect(consultas[0].valores).toContain('Lengua')
  })
})

describe('lo que manda el navegador', () => {
  it('se valida: materia y tema obligatorios, recortes, tipo por defecto', () => {
    expect(
      debilesValidos([
        { topic: 'fracciones', topicName: 'Fracciones', subject: 'Matemática', misconceptionType: 'Suma los denominadores', lastTip: 'Buscá el común.' },
        { topicName: 'Sin materia' },
        { subject: 'Lengua', topic: 'Acentos' },
        'basura',
      ]),
    ).toEqual([
      { subject: 'Matemática', topic: 'fracciones', topicName: 'Fracciones', tipo: 'Suma los denominadores', tip: 'Buscá el común.' },
      { subject: 'Lengua', topic: 'Acentos', topicName: 'Acentos', tipo: TIPO_DEL_NAVEGADOR, tip: '' },
    ])
    expect(debilesValidos(null)).toEqual([])
    expect(debilesValidos(Array.from({ length: 300 }, (_, i) => ({ subject: 'M', topicName: `t${i}` })))).toHaveLength(100)
  })

  it('migra sólo lo que la base no conoce (manda la base), con el id del alumno', async () => {
    let vez = 0
    responder = () => (vez++ === 0 ? [{ id: 1 }] : [])
    const n = await migrarDebilesDelNavegador('sofia', [
      { subject: 'Lengua', topicName: 'Nuevo' },
      { subject: 'Lengua', topicName: 'Ya estaba' },
    ])
    expect(n).toBe(1)
    expect(consultas.every((c) => c.texto.includes('WHERE NOT EXISTS') && c.valores.includes('sofia'))).toBe(true)
  })
})
