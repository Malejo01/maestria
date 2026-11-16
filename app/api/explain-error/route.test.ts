/**
 * A2 (16/11/2026): qué nivel recibe el modelo y qué le llega al alumno.
 *
 * Los dos invariantes: el registro lo decide el grupo antes que el perfil del
 * alumno, y fuera de Primario la explicación sale sin emojis aunque el modelo
 * los escriba igual. Nada de esto le pega a la API: `ai` está mockeado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { guardAiCall } from '@/lib/ai-guard'
import { getSession } from '@/lib/auth-session'
import { POST } from './route'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@ai-sdk/google', () => ({ google: (modelId: string) => ({ modelId }) }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({ getSession: vi.fn() }))

const generateTextMock = vi.mocked(generateText)
const guardAiCallMock = vi.mocked(guardAiCall)
const getSessionMock = vi.mocked(getSession)

/** Lo que el modelo devolvió de verdad en staging para un 4.º año, resumido. */
const CON_EMOJIS = [
  '## 1. 🧠 ¿Por qué elegiste esta opción?',
  '¡Casi! Elegiste la opción de futuro ☀️.',
  '',
  '## 2. 💡 Explicación paso a paso',
  '- **Pasado:** ya te la comiste 😋',
  '',
  '## 3. 📌 ¿Por qué la respuesta correcta es la única válida?',
  'Ya sucedió. 🕰️',
  '',
  '## 4. ⭐ Tip o consejo para recordar',
  'Mirá la tilde final. 🔍✨',
].join('\n')

const HAY_EMOJI = /\p{Extended_Pictographic}/u

function pedido(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/explain-error', {
    method: 'POST',
    body: JSON.stringify({
      question: '¿En qué tiempo verbal está "comió"?',
      questionType: 'multiple_choice',
      selectedText: 'Futuro',
      correctText: 'Pasado',
      topic: 'El verbo',
      subject: 'Lengua',
      ...body,
    }),
  })
}

function promptEnviado(): string {
  const args = generateTextMock.mock.calls[0][0] as { messages: { content: string }[] }
  return args.messages[0].content
}

function sesionCon(nivel: string | null, grado: string | null) {
  getSessionMock.mockResolvedValue({ user: { id: 'u1', nivel, grado } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  guardAiCallMock.mockResolvedValue({
    ok: true,
    viewer: { id: 'u1', isGuest: false } as never,
    actor: 'alumno',
    finish: vi.fn(),
    fail: vi.fn(),
  })
  generateTextMock.mockResolvedValue({ text: CON_EMOJIS, usage: { inputTokens: 1, outputTokens: 1 } } as never)
  getSessionMock.mockResolvedValue(null as never)
})

describe('POST /api/explain-error — con qué nivel se explica', () => {
  it('el nivel del grupo gana sobre el perfil del alumno', async () => {
    sesionCon('Primario', '4to Grado')

    await POST(pedido({ nivel: 'Secundario', grado: '4to Año' }))

    expect(promptEnviado()).toContain('LENGUAJE PARA ADOLESCENTES')
    expect(promptEnviado()).not.toContain('LENGUAJE PARA NIÑOS')
  })

  it('una tarea sin nivel explícito usa el del programa del docente', async () => {
    sesionCon('Primario', '2do Grado')

    await POST(pedido({ pedagogyContext: 'Nivel: Terciario\nGrado/Año: 1er Año' }))

    expect(promptEnviado()).toContain('LENGUAJE DE EDUCACIÓN SUPERIOR')
  })

  it('Mi progreso no manda nivel: sale del perfil', async () => {
    sesionCon('Superior', '1er Año')

    await POST(pedido())

    expect(promptEnviado()).toContain('LENGUAJE DE EDUCACIÓN SUPERIOR')
  })

  it('sin nivel en ningún lado (un invitado), Secundario: nunca Primario', async () => {
    await POST(pedido())

    expect(promptEnviado()).toContain('LENGUAJE PARA ADOLESCENTES')
    expect(promptEnviado()).not.toMatch(HAY_EMOJI)
  })
})

describe('POST /api/explain-error — emojis en la salida', () => {
  it.each([
    ['Secundario', '4to Año'],
    ['Superior', '1er Año'],
  ])('%s: ninguno, aunque el modelo los haya escrito', async (nivel, grado) => {
    const respuesta = await POST(pedido({ nivel, grado }))
    const data = await respuesta.json()

    expect(data.explanation).not.toMatch(HAY_EMOJI)
    expect(data.tipText).not.toMatch(HAY_EMOJI)
    expect(data.misconceptionType).not.toMatch(HAY_EMOJI)
    // El contenido sigue entero y los títulos siguen siendo títulos.
    expect(data.explanation).toContain('## 1. ¿Por qué elegiste esta opción?')
    expect(data.explanation).toContain('- **Pasado:** ya te la comiste')
    expect(data.tipText).toBe('Mirá la tilde final.')
  })

  it('Primario: se conservan, son contenido pedagógico', async () => {
    const respuesta = await POST(pedido({ nivel: 'Primario', grado: '2do Grado' }))
    const data = await respuesta.json()

    expect(data.explanation).toBe(CON_EMOJIS)
  })
})
