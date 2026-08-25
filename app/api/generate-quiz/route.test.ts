/**
 * Tests de CARACTERIZACIÓN de /api/generate-quiz.
 *
 * Escritos ANTES de extraer el núcleo a lib/quiz-generation.ts, contra la ruta
 * tal como está hoy. Un test escrito después del refactor documenta lo que
 * quedó, no lo que había: si el refactor rompió algo, lo consagra.
 *
 * Van a través del handler `POST` y no importando funciones internas. Dos
 * razones: no exige tocar una sola línea de la ruta para poder testearla, y
 * ejercita la cadena completa de reparación de JSON — generateObject falla →
 * generateText → cleanGeminiResponse → repairQuizJson → extractFirstJsonObject
 * → quizSchema.safeParse → validación tolerante. Esa cadena es la parte con más
 * lógica no obvia del archivo y la que peor se rompe en silencio.
 *
 * Cuando la extracción esté hecha, estos tests tienen que seguir pasando SIN
 * tocarse. Ese es el contrato del refactor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.hoisted` y no consts sueltas: vitest sube las llamadas a `vi.mock` por
// encima de los imports, así que una factory que referencie una const declarada
// más abajo revienta con ReferenceError. Con esto los dobles existen antes.
const {
  generateObject,
  generateText,
  guardFinish,
  guardFail,
  guardAiCall,
  captureAiSchemaFailure,
  captureRouteFailure,
  sqlMock,
} = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  guardFinish: vi.fn(),
  guardFail: vi.fn(),
  guardAiCall: vi.fn(),
  captureAiSchemaFailure: vi.fn(),
  captureRouteFailure: vi.fn(),
  sqlMock: vi.fn(),
}))

vi.mock('ai', () => ({ generateObject, generateText }))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => (model: string) => ({ modelId: model }),
}))

vi.mock('@/lib/ai-guard', () => ({ guardAiCall }))

vi.mock('@/lib/observability', () => ({ captureAiSchemaFailure, captureRouteFailure }))

vi.mock('@/lib/db', () => ({ sql: sqlMock }))

import { POST } from './route'

/** Cuestionario válido de N preguntas multiple_choice, todas distintas entre sí. */
function questions(count: number, seed = 0) {
  return Array.from({ length: count }, (_, index) => {
    const n = seed * 100 + index
    return {
      id: `gen${n}`,
      topic: 'algebra',
      topicName: 'Álgebra',
      question: `¿Cuánto es ${n} + 1?`,
      explanation: `Sumamos 1 a ${n}.`,
      type: 'multiple_choice' as const,
      options: [`${n}`, `${n + 1}`, `${n + 2}`, `${n + 3}`],
      correctAnswer: 1,
    }
  })
}

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({
      subject: 'Matemática',
      topics: [{ id: 't1', name: 'Álgebra' }],
      mode: 'practico',
      questionCount: 3,
      nivel: 'Secundario',
      grado: '4to Año',
      ...body,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  guardAiCall.mockResolvedValue({
    ok: true,
    viewer: { id: 'u1', role: 'ALUMNO', isGuest: false, displayName: 'A', email: 'a@b.c' },
    actor: 'alumno',
    finish: guardFinish,
    fail: guardFail,
  })
  sqlMock.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST — validación del body', () => {
  it('rechaza un questionCount fuera de rango con 400', async () => {
    const response = await POST(request({ questionCount: 99 }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ questions: [] })
    // Y no llega a llamar al modelo ni al guard.
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('usa 10 preguntas cuando questionCount no es un entero válido', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(10) }, usage: {} })
    const response = await POST(request({ questionCount: 'muchas' }))
    const body = await response.json()
    expect(body.questions).toHaveLength(10)
  })
})

describe('POST — corte por guard', () => {
  it('devuelve la respuesta del guard sin llamar al modelo', async () => {
    guardAiCall.mockResolvedValue({
      ok: false,
      response: Response.json({ questions: [], error: 'sin sesión' }, { status: 401 }),
    })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(generateObject).not.toHaveBeenCalled()
  })
})

describe('POST — camino feliz', () => {
  it('devuelve las preguntas renumeradas q1..qN', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.questions.map((q: { id: string }) => q.id)).toEqual(['q1', 'q2', 'q3'])
    expect(guardFinish).toHaveBeenCalledTimes(1)
  })

  it('baraja las opciones y reapunta correctAnswer al mismo texto', async () => {
    const original = questions(1)
    generateObject.mockResolvedValue({ object: { questions: original }, usage: {} })

    const response = await POST(request({ questionCount: 1 }))
    const [question] = (await response.json()).questions

    expect([...question.options].sort()).toEqual([...original[0].options].sort())
    expect(question.options[question.correctAnswer]).toBe(
      original[0].options[original[0].correctAnswer]
    )
  })

  it('pide sólo multiple_choice cuando el caller no manda questionTypes', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request())

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('multiple_choice')
    expect(system).not.toContain('TIPO "numeric"')
  })

  it('filtra los questionTypes desconocidos y conserva los válidos', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ questionTypes: ['numeric', 'inventado'] }))

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('TIPO "numeric"')
    expect(system).not.toContain('inventado')
  })
})

describe('POST — deduplicación', () => {
  it('descarta las repetidas y reintenta hasta juntar la cantidad pedida', async () => {
    const repeated = questions(3, 1)
    generateObject
      .mockResolvedValueOnce({ object: { questions: [repeated[0], repeated[0], repeated[0]] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: questions(3, 2) }, usage: {} })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(3)
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  it('devuelve 409 cuando después de 3 intentos no hay variedad suficiente', async () => {
    const single = questions(1, 3)
    generateObject.mockResolvedValue({ object: { questions: single }, usage: {} })

    const response = await POST(request())
    expect(response.status).toBe(409)
    expect(generateObject).toHaveBeenCalledTimes(3)
    // Los tokens ya se gastaron: la fila de uso se cierra igual.
    expect(guardFinish).toHaveBeenCalledTimes(1)
  })

  it('no repite una pregunta que el alumno ya vio', async () => {
    const previa = questions(1, 4)[0]
    generateObject
      .mockResolvedValueOnce({ object: { questions: [previa, ...questions(2, 5)] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: questions(3, 6) }, usage: {} })

    const response = await POST(
      request({ previousQuestions: [{ question: previa.question }], questionCount: 3 })
    )
    const body = await response.json()
    expect(body.questions.map((q: { question: string }) => q.question)).not.toContain(previa.question)
  })
})

describe('POST — cadena de reparación de JSON (el fallback)', () => {
  function failObjectThenText(text: string) {
    generateObject.mockRejectedValue(new Error('No object generated'))
    generateText.mockResolvedValue({ text, usage: {} })
  }

  it('parsea JSON envuelto en un bloque markdown', async () => {
    failObjectThenText('```json\n' + JSON.stringify({ questions: questions(3) }) + '\n```')

    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(3)
    expect(captureAiSchemaFailure).toHaveBeenCalledTimes(1)
  })

  it('tolera un preámbulo en prosa antes del JSON', async () => {
    failObjectThenText('Here is the JSON you asked for:\n' + JSON.stringify({ questions: questions(3) }))

    const response = await POST(request())
    expect((await response.json()).questions).toHaveLength(3)
  })

  it('repara comas colgantes antes de } y de ]', async () => {
    const raw = JSON.stringify({ questions: questions(3) })
      .replace(/\}\]/g, '},]')
      .replace(/"\}/g, '",}')
    failObjectThenText(raw)

    const response = await POST(request())
    expect((await response.json()).questions).toHaveLength(3)
  })

  it('descarta el texto que sigue al último }', async () => {
    failObjectThenText(JSON.stringify({ questions: questions(3) }) + '\n\nEspero que te sirva!')

    const response = await POST(request())
    expect((await response.json()).questions).toHaveLength(3)
  })

  it('reintenta generateText una vez antes de rendirse', async () => {
    generateObject.mockRejectedValue(new Error('No object generated'))
    generateText
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ text: JSON.stringify({ questions: questions(3) }), usage: {} })

    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(generateText).toHaveBeenCalledTimes(2)
  })

  it('usa las preguntas válidas cuando sólo algunas fallan el schema', async () => {
    const validas = questions(3, 7)
    const rota = { ...validas[0], id: 'rota', question: '¿Y esta?', options: undefined }
    failObjectThenText(JSON.stringify({ questions: [...validas, rota] }))

    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(3)
    expect(body.questions.map((q: { question: string }) => q.question)).not.toContain('¿Y esta?')
  })

  it('en el camino tolerante, una pregunta sin type se asume multiple_choice', async () => {
    const sinType = questions(3, 8).map(({ type: _type, ...rest }) => rest)
    // Se rompe el schema estricto para forzar el camino tolerante.
    failObjectThenText(JSON.stringify({ questions: [...sinType, { question: 'x' }] }))

    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.questions.every((q: { type: string }) => q.type === 'multiple_choice')).toBe(true)
  })

  it('devuelve 502 y marca el intento como fallido cuando no hay JSON recuperable', async () => {
    failObjectThenText('No puedo generar eso.')

    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(guardFail).toHaveBeenCalledTimes(1)
    expect(captureRouteFailure).toHaveBeenCalledTimes(1)
    await expect(response.json()).resolves.toMatchObject({ questions: [] })
  })

  it('NO devuelve preguntas de relleno cuando la IA falla', async () => {
    // Regresión histórica: esto contestaba 200 con plantillas genéricas y los
    // alumnos recibían un cuestionario sin sentido sin que nadie se enterara.
    failObjectThenText('vacío')
    const response = await POST(request())
    expect((await response.json()).questions).toEqual([])
  })
})

describe('POST — normalización de notación lógica', () => {
  it('convierte los comandos LaTeX de lógica a símbolos Unicode', async () => {
    const [base] = questions(1, 9)
    generateObject.mockResolvedValue({
      object: {
        questions: [
          {
            ...base,
            question: 'Evaluá $p \\wedge q$ y $r \\vee s$',
            explanation: 'Si \\neg p entonces p \\rightarrow q',
            options: ['$p \\leftrightarrow q$', 'b', 'c', 'd'],
          },
        ],
      },
      usage: {},
    })

    const response = await POST(request({ questionCount: 1 }))
    const [question] = (await response.json()).questions

    expect(question.question).toBe('Evaluá $p ∧ q$ y $r ∨ s$')
    expect(question.explanation).toBe('Si ¬p entonces p → q')
    expect(question.options).toContain('$p ↔ q$')
  })

  it('recupera el fósil "eg" de un \\neg mal escapado', async () => {
    const [base] = questions(1, 10)
    generateObject.mockResolvedValue({
      object: { questions: [{ ...base, question: 'Si egp es verdadero...' }] },
      usage: {},
    })

    const response = await POST(request({ questionCount: 1 }))
    const [question] = (await response.json()).questions
    expect(question.question).toBe('Si ¬p es verdadero...')
  })
})

describe('POST — modo mixto', () => {
  it('genera dos tandas y las intercala', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { questions: questions(2, 11) }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: questions(2, 12) }, usage: {} })

    const response = await POST(request({ mode: 'mixto', questionCount: 4 }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(4)
    expect(generateObject).toHaveBeenCalledTimes(2)

    const modos = generateObject.mock.calls.map(([args]) => args.prompt as string)
    expect(modos[0]).toContain('MODO TEÓRICO')
    expect(modos[1]).toContain('MODO PRÁCTICO')
  })

  it('devuelve 409 si alguna de las dos mitades no se completa', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(1, 13) }, usage: {} })

    const response = await POST(request({ mode: 'mixto', questionCount: 4 }))
    expect(response.status).toBe(409)
    expect(guardFinish).toHaveBeenCalledTimes(1)
  })
})

describe('POST — contexto profesional (migración 022)', () => {
  it('no consulta curriculum fuera de Superior', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ nivel: 'Secundario', carrera: 'Lo que sea' }))
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it('inyecta la aplicación profesional en el system prompt cuando el programa la declara', async () => {
    sqlMock.mockResolvedValue([
      {
        eje: 'Unidad 5 — Funciones y Modelización Matemática',
        contexto_profesional: {
          aplicacion: 'Modelado de ingresos y crecimiento de usuarios',
          herramientas: ['GeoGebra'],
        },
      },
    ])
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    await POST(
      request({
        nivel: 'Superior',
        grado: '1er Año',
        carrera: 'Tecnicatura Superior en Análisis de Sistemas',
        subjectUnits: [{ name: 'Unidad 5 — Funciones y Modelización Matemática', topics: [] }],
      })
    )

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
    expect(system).toContain('crecimiento de usuarios')
  })

  it('sigue generando (genérico) si la consulta a curriculum explota', async () => {
    sqlMock.mockRejectedValue(new Error('conexión caída'))
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    const response = await POST(
      request({
        nivel: 'Superior',
        grado: '1er Año',
        carrera: 'Tecnicatura Superior en Análisis de Sistemas',
        subjectUnits: [{ name: 'Unidad 5', topics: [] }],
      })
    )

    expect(response.status).toBe(200)
    expect(captureRouteFailure).toHaveBeenCalledTimes(1)
    const { system } = generateObject.mock.calls[0][0]
    expect(system).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
  })
})

describe('POST — pedagogyContext', () => {
  it('extrae nivel, grado y dificultad del texto libre', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    await POST(
      request({
        nivel: undefined,
        grado: undefined,
        pedagogyContext: 'Nivel: Primario | Grado/Año: 3er Año | Dificultad: basico',
      })
    )

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('Primario')
    expect(system).toContain('NIVEL DE DIFICULTAD: BÁSICO')
  })

  it('corta el grado en el salto de línea y no se traga las etiquetas siguientes', async () => {
    // Regresión documentada en la ruta: el match cruzaba newlines y metía las
    // cuatro líneas siguientes dentro de "grado", envenenando el prompt. Se ve
    // en Superior porque ahí el grado viaja verbatim al prompt; en K-12
    // getEducationContext lo re-renderiza como "Nº Año" y taparía el síntoma.
    sqlMock.mockResolvedValue([])
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    await POST(
      request({
        nivel: undefined,
        grado: undefined,
        pedagogyContext:
          'Nivel: Superior\nGrado/Año: 1er Año\nMetodología: aula invertida\nComplejidad: alta',
      })
    )

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('Superior (1er Año)')
    expect(system).not.toContain('aula invertida')
  })

  it('respeta el nivel y grado explícitos por encima del texto libre', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    await POST(
      request({
        nivel: 'Primario',
        grado: '2do Año',
        pedagogyContext: 'Nivel: Superior | Grado/Año: 3er Año',
      })
    )

    const { system } = generateObject.mock.calls[0][0]
    // "2º Grado", no "2º Año": education-context rotula Primario en grados
    // aunque `curriculum` lo guarde como "2do Año". Se caracteriza tal como
    // está — este refactor no cambia comportamiento.
    expect(system).toContain('Primario (2º Grado)')
    expect(system).not.toContain('Superior')
  })
})

/**
 * Regresión de los ids 1430-1448 del 10/08: un intento entero llegó al alumno
 * con los escapes `\uXXXX` sin decodificar ("parábola" como texto).
 *
 * Reproducido el 25/08/2026: el modelo emite `par\u00e1bola` — doble
 * backslash, el mismo hábito con el que escribe `\frac` — que es JSON válido
 * cuyo VALOR es el texto literal `parábola`. Ni la reparación ni el parser
 * ven nada raro; sólo se puede arreglar después de parsear. Estos tests fijan
 * esa decodificación, que era el hueco por el que la suite entera pasaba con el
 * bug puesto: todos los mocks devolvían texto ya limpio, que es lo que el
 * código esperaba y no lo que el sistema real produce.
 */
describe('POST — escapes unicode varados en el texto', () => {
  it('decodifica los escapes de la mitad alta de Latin-1 en enunciado, opciones y explicación', async () => {
    const [corrupta] = questions(1)
    corrupta.question = 'La par\\u00e1bola, \\u00bfqu\\u00e9 representa?'
    corrupta.explanation = 'La par\\u00e1bola es una c\\u00f3nica.'
    corrupta.options = ['par\\u00e1bola', 'elipse', 'hip\\u00e9rbola', 'recta']

    generateObject.mockResolvedValue({ object: { questions: [corrupta] }, usage: {} })

    const response = await POST(request({ questionCount: 1 }))
    const { questions: result } = await response.json()

    expect(result[0].question).toBe('La parábola, ¿qué representa?')
    expect(result[0].explanation).toBe('La parábola es una cónica.')
    expect(result[0].options).toContain('parábola')
    expect(result[0].options).toContain('hipérbola')
  })

  it('NO toca un escape de la mitad ASCII: puede ser el tema de la pregunta', async () => {
    const [pregunta] = questions(1)
    pregunta.question = 'En Unicode, \\u0041 representa la letra A. ¿Verdadero?'

    generateObject.mockResolvedValue({ object: { questions: [pregunta] }, usage: {} })

    const response = await POST(request({ questionCount: 1 }))
    const { questions: result } = await response.json()

    expect(result[0].question).toContain('\\u0041')
  })

  it('decodifica también acceptedAnswers, donde el escape varado hace incorregible la pregunta', async () => {
    const corrupta = {
      id: 'gen-sa',
      topic: 'algebra',
      topicName: 'Álgebra',
      question: '¿Cómo se llama la curva de una función cuadrática?',
      explanation: 'Es la parábola.',
      type: 'short_answer' as const,
      acceptedAnswers: ['par\\u00e1bola', 'parabola'],
    }

    generateObject.mockResolvedValue({ object: { questions: [corrupta] }, usage: {} })

    const response = await POST(request({ questionCount: 1, questionTypes: ['short_answer'] }))
    const { questions: result } = await response.json()

    expect(result[0].acceptedAnswers).toContain('parábola')
  })
})

/**
 * La contabilidad de tokens con la forma REAL del SDK. Todos los demás mocks
 * de esta suite pasan `usage: {}` — que es exactamente lo que el código espera
 * como caso degradado, no lo que devuelve el sistema real. Con eso, un error en
 * la suma (los handlers hacen hasta dos llamadas en mixto y el costo tiene que
 * sumarlas todas) dejaría la facturación mal y la suite en verde.
 */
describe('POST — usage con la forma real del SDK', () => {
  it('cierra el guard con la suma de tokens de las dos tandas del modo mixto', async () => {
    generateObject
      .mockResolvedValueOnce({
        object: { questions: questions(2, 21) },
        usage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 },
      })
      .mockResolvedValueOnce({
        object: { questions: questions(2, 22) },
        usage: { inputTokens: 1100, outputTokens: 700, totalTokens: 1800 },
      })

    const response = await POST(request({ mode: 'mixto', questionCount: 4 }))

    expect(response.status).toBe(200)
    expect(guardFinish).toHaveBeenCalledTimes(1)
    expect(guardFinish).toHaveBeenCalledWith({
      inputTokens: 2300,
      outputTokens: 1500,
      totalTokens: 3800,
    })
  })
})
