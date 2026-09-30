import { describe, expect, it } from 'vitest'
import { aiCutoffMessage } from './ai-cutoff-message'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('aiCutoffMessage', () => {
  it('devuelve el mensaje del guard en los cortes (429 y 503)', async () => {
    expect(await aiCutoffMessage(json({ error: 'La práctica con IA para invitados llegó al límite de hoy.' }, 429))).toBe(
      'La práctica con IA para invitados llegó al límite de hoy.'
    )
    expect(await aiCutoffMessage(json({ error: 'Pausada por hoy.', questions: [] }, 503))).toBe('Pausada por hoy.')
  })

  it('ignora los errores que no son del guard: no están escritos para el alumno', async () => {
    expect(await aiCutoffMessage(json({ error: 'Faltan selectedText/correctText.' }, 400))).toBeNull()
    expect(await aiCutoffMessage(json({ error: 'TypeError: x is undefined' }, 500))).toBeNull()
    expect(await aiCutoffMessage(json({ explanation: 'ok' }, 200))).toBeNull()
  })

  it('no rompe con cuerpos raros y deja el body legible para el llamador', async () => {
    expect(await aiCutoffMessage(new Response('<html>502</html>', { status: 503 }))).toBeNull()
    expect(await aiCutoffMessage(json({ error: '   ' }, 429))).toBeNull()

    const response = json({ error: 'Corte' }, 429)
    await aiCutoffMessage(response)
    expect((await response.json()).error).toBe('Corte')
  })
})
