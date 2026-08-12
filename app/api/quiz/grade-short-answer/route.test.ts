/**
 * Cubre lo único de esta ruta que no se ve mirando el archivo: cuándo reintenta
 * y cómo cierra la contabilidad del guard.
 *
 * `guardAiCall` abre UNA fila en `ai_usage_log` y espera exactamente un `finish`
 * o un `fail`. El reintento agrega una segunda llamada al modelo debajo de esa
 * misma fila, así que los dos invariantes que hay que sostener son: se cierra
 * una sola vez, y se cierra con los tokens de TODOS los intentos (Google factura
 * el intento truncado igual). Nada de esto le pega a la API de Google: el módulo
 * `ai` está mockeado salvo por sus clases de error, que se usan de verdad para
 * que el reconocimiento del error se pruebe contra la forma real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateObject, NoObjectGeneratedError } from 'ai'
import { guardAiCall } from '@/lib/ai-guard'
import { POST } from './route'

// vitest iza los vi.mock por encima de los imports, así que los estáticos de
// arriba ya reciben la versión mockeada.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  // Todo mockeado menos las clases de error, que se usan reales para probar el
  // reconocimiento contra la forma que tienen en producción.
  return { ...actual, generateObject: vi.fn() }
})

vi.mock('@ai-sdk/google', () => ({
  google: (modelId: string) => ({ modelId }),
}))

vi.mock('@/lib/ai-guard', () => ({
  guardAiCall: vi.fn(),
}))

vi.mock('@/lib/observability', () => ({
  captureAiSchemaFailure: vi.fn(),
}))

const generateObjectMock = vi.mocked(generateObject)
const guardAiCallMock = vi.mocked(guardAiCall)

const finish = vi.fn()
const fail = vi.fn()

const VALID_GRADE = {
  isCorrect: true,
  category: 'Excelente' as const,
  scorePercent: 100,
  feedback: 'Muy bien: identificaste el concepto central.',
}

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/quiz/grade-short-answer', {
    method: 'POST',
    body: JSON.stringify({
      question: '¿Qué es un número primo?',
      acceptedAnswers: ['Divisible sólo por 1 y por sí mismo'],
      studentAnswer: 'uno que solo se divide por 1 y por el mismo',
      nivel: 'Secundario',
      grado: '2do',
      materia: 'Matemática',
      ...body,
    }),
  })
}

/** El error real que produce un JSON cortado a mitad de camino. */
function truncatedObjectError(outputTokens: number) {
  return new NoObjectGeneratedError({
    message: 'No object generated: could not parse the response.',
    cause: Object.assign(new Error('JSON parsing failed'), { name: 'AI_JSONParseError' }),
    text: '{\n  "isCorrect',
    response: { id: 'res-1', timestamp: new Date('2026-08-12T10:00:00.000Z'), modelId: 'gemini-2.5-flash' },
    usage: {
      inputTokens: 800,
      outputTokens,
      totalTokens: 800 + outputTokens,
      inputTokenDetails: { noCacheTokens: 800, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { reasoningTokens: outputTokens, textTokens: 0 },
    },
    finishReason: 'length',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  guardAiCallMock.mockResolvedValue({
    ok: true,
    viewer: { id: 'u1', isGuest: false } as never,
    actor: 'alumno',
    finish,
    fail,
  })
})

describe('POST /api/quiz/grade-short-answer — camino feliz', () => {
  it('llama al modelo una sola vez y cierra la fila con ese usage', async () => {
    generateObjectMock.mockResolvedValue({
      object: VALID_GRADE,
      usage: { inputTokens: 800, outputTokens: 120 },
    } as never)

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(VALID_GRADE)
    expect(generateObjectMock).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledWith({ inputTokens: 800, outputTokens: 120, totalTokens: 920 })
    expect(fail).not.toHaveBeenCalled()
  })

  it('manda el techo de tokens y el thinking apagado que motivaron el fix', async () => {
    generateObjectMock.mockResolvedValue({ object: VALID_GRADE, usage: {} } as never)

    await POST(request())

    const params = generateObjectMock.mock.calls[0][0] as {
      maxOutputTokens?: number
      providerOptions?: { google?: { thinkingConfig?: { thinkingBudget?: number } } }
    }
    expect(params.maxOutputTokens).toBe(2000)
    expect(params.providerOptions?.google?.thinkingConfig?.thinkingBudget).toBe(0)
  })
})

describe('POST /api/quiz/grade-short-answer — reintento', () => {
  it('reintenta una vez ante un objeto truncado y suma el usage de los dos intentos', async () => {
    generateObjectMock
      .mockRejectedValueOnce(truncatedObjectError(500))
      .mockResolvedValueOnce({
        object: VALID_GRADE,
        usage: { inputTokens: 800, outputTokens: 140 },
      } as never)

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(generateObjectMock).toHaveBeenCalledTimes(2)
    // Una sola fila cerrada, con los tokens de los DOS intentos: el truncado
    // también se facturó del lado de Google.
    expect(finish).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledWith({ inputTokens: 1600, outputTokens: 640, totalTokens: 2240 })
    expect(fail).not.toHaveBeenCalled()
  })

  it('reconoce un AI_JSONParseError envuelto aunque no sea NoObjectGeneratedError', async () => {
    const wrapped = new Error('fallo al generar', {
      cause: Object.assign(new Error('JSON parsing failed'), { name: 'AI_JSONParseError' }),
    })
    generateObjectMock
      .mockRejectedValueOnce(wrapped)
      .mockResolvedValueOnce({ object: VALID_GRADE, usage: { inputTokens: 800, outputTokens: 140 } } as never)

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(generateObjectMock).toHaveBeenCalledTimes(2)
    // Sin NoObjectGeneratedError no hay usage recuperable del intento perdido:
    // se cierra con lo que reportó el reintento y nada más.
    expect(finish).toHaveBeenCalledWith({ inputTokens: 800, outputTokens: 140, totalTokens: 940 })
  })

  it('no reintenta un error que no es de parseo', async () => {
    generateObjectMock.mockRejectedValue(Object.assign(new Error('429 Too Many Requests'), { name: 'AI_APICallError' }))

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(generateObjectMock).toHaveBeenCalledTimes(1)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(finish).not.toHaveBeenCalled()
  })

  it('es un solo reintento, no un bucle: si el segundo también falla, responde 500', async () => {
    generateObjectMock.mockRejectedValue(truncatedObjectError(500))

    const response = await POST(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'No se pudo corregir la respuesta' })
    expect(generateObjectMock).toHaveBeenCalledTimes(2)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(finish).not.toHaveBeenCalled()
  })

  it('no cuelga con una cadena de causas cíclica', async () => {
    const a = new Error('a')
    const b = new Error('b', { cause: a })
    ;(a as { cause?: unknown }).cause = b
    generateObjectMock.mockRejectedValue(b)

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(generateObjectMock).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/quiz/grade-short-answer — contrato HTTP', () => {
  it('rechaza parámetros inválidos con 400 y sin abrir fila de uso', async () => {
    const response = await POST(request({ acceptedAnswers: 'no es un array' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Parametros invalidos' })
    expect(guardAiCallMock).not.toHaveBeenCalled()
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('devuelve exactamente las claves que espera el cliente desplegado', async () => {
    generateObjectMock.mockResolvedValue({ object: VALID_GRADE, usage: {} } as never)

    const body = (await (await POST(request())).json()) as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual(['category', 'feedback', 'isCorrect', 'scorePercent'])
  })

  it('propaga el corte del guard sin llamar al modelo', async () => {
    guardAiCallMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'rate limited' }, { status: 429 }),
    })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(generateObjectMock).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })
})
