import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O4. La regla de la racha (igual que antes), y la racha en la base con su válvula. */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))
let responder: (texto: string) => unknown = () => []

vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))

import { rachaDelNavegador, siguienteRacha, textoDeRacha } from './racha'
import { anotarIntentoEnLaRacha, leerRacha, migrarRachaDelNavegador, pasarRachaDeInvitado } from './racha-server'

beforeEach(() => {
  consultas.length = 0
  responder = () => []
})

describe('la regla (la de siempre)', () => {
  it('aprobar suma uno; no aprobar vuelve a cero', () => {
    expect(siguienteRacha(0, true)).toBe(1)
    expect(siguienteRacha(4, true)).toBe(5)
    expect(siguienteRacha(4, false)).toBe(0)
    expect(siguienteRacha(-3, true)).toBe(1)
  })

  it('lo que llega del navegador se valida', () => {
    expect(rachaDelNavegador(3)).toBe(3)
    expect(rachaDelNavegador('7')).toBe(7)
    expect(rachaDelNavegador(-1)).toBe(0)
    expect(rachaDelNavegador(2.5)).toBe(0)
    expect(rachaDelNavegador(99999)).toBe(500)
    expect(rachaDelNavegador(undefined)).toBe(0)
  })

  it('el texto, con voseo y sin "aprobá 2 seguidos"', () => {
    expect(textoDeRacha(0)).toBe('Cuando apruebes un cuestionario, empieza tu racha.')
    expect(textoDeRacha(1)).toBe('Aprobaste 1 cuestionario seguido.')
    expect(textoDeRacha(3)).toBe('Aprobaste 3 cuestionarios seguidos.')
  })
})

describe('en la base (032)', () => {
  it('anotar un intento es una sola sentencia atómica y devuelve la racha nueva', async () => {
    responder = () => [{ racha: 4 }]
    expect(await anotarIntentoEnLaRacha('ana', true)).toBe(4)
    expect(consultas).toHaveLength(1)
    expect(consultas[0].texto).toContain('ON CONFLICT (user_id) DO UPDATE')
    expect(consultas[0].valores.slice(0, 3)).toEqual(['ana', 1, 1])
  })

  it('sin la 032, anotar devuelve null y no lanza (no tumba el guardado)', async () => {
    responder = () => {
      throw Object.assign(new Error('no existe'), { code: '42P01' })
    }
    expect(await anotarIntentoEnLaRacha('ana', true)).toBeNull()
    expect(await leerRacha('ana')).toBeNull()
    expect(await migrarRachaDelNavegador('ana', 3)).toBeNull()
    await expect(pasarRachaDeInvitado('guest_x', 'ana')).resolves.toBeUndefined()
  })

  it('cualquier otro error al anotar tampoco lanza', async () => {
    responder = () => {
      throw new Error('se cayó')
    }
    expect(await anotarIntentoEnLaRacha('ana', false)).toBeNull()
  })

  it('migrar del navegador no pisa una racha que ya está en la base', async () => {
    responder = (t) => (t.includes('SELECT racha') ? [{ racha: 9, mejor: 9 }] : [])
    expect(await migrarRachaDelNavegador('ana', 3)).toBe(9)
    expect(consultas[0].texto).toContain('ON CONFLICT (user_id) DO NOTHING')
    expect(consultas[0].valores).toEqual(['ana', 3, 3])
  })
})
