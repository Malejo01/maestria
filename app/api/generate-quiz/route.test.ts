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
  getViewer,
  bloqueoParaGenerar,
  perfilSinRomper,
  accesoParaGenerar,
  registrarUso,
} = vi.hoisted(() => ({
  accesoParaGenerar: vi.fn(),
  registrarUso: vi.fn(),
  perfilSinRomper: vi.fn(),
  getViewer: vi.fn(),
  bloqueoParaGenerar: vi.fn(),
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

vi.mock('@/lib/auth-session', () => ({ getViewer }))

vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar }))

vi.mock('@/lib/fichas-server', () => ({ perfilSinRomper }))

vi.mock('@/lib/autodidacta-server', () => ({ accesoParaGenerar, registrarUso }))

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
      // Ronda T · A4: sin tipos pedidos se usa la mezcla del área; estos tests
      // fijan el resto del comportamiento con opción múltiple, como antes.
      questionTypes: ['multiple_choice'],
      ...body,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getViewer.mockResolvedValue(null)
  bloqueoParaGenerar.mockResolvedValue(null)
  accesoParaGenerar.mockResolvedValue({ personal: false })

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

describe('POST — plan del docente', () => {
  it('un docente con el plan vencido recibe 402 con questions: [] y no se llama al modelo', async () => {
    getViewer.mockResolvedValue({ id: 'd1', role: 'DOCENTE', isGuest: false, displayName: 'D', email: 'd@x.com' })
    bloqueoParaGenerar.mockResolvedValue(
      Response.json({ questions: [], error: 'Tu plan venció.', plan: { motivo: 'vencido' } }, { status: 402 }),
    )
    const response = await POST(request())
    expect(response.status).toBe(402)
    expect((await response.json()).questions).toEqual([])
    expect(generateObject).not.toHaveBeenCalled()
    expect(guardAiCall).not.toHaveBeenCalled()
  })

  it('a un alumno no se le mira el plan de nadie', async () => {
    getViewer.mockResolvedValue({ id: 'a1', role: 'ALUMNO', isGuest: false, displayName: 'A', email: null })
    await POST(request())
    expect(bloqueoParaGenerar).not.toHaveBeenCalled()
  })
})

describe('POST — Ronda T · E2: la materia personal del modo autodidacta', () => {
  const SOFIA = { id: 'sofia', role: 'ALUMNO', isGuest: false, displayName: 'S', email: null }
  const LIBRE = { pase: null, quedan: { diagnostico: 2, practica: 2, simulacro: 0 } }

  it('con lo gratis: genera con el tope propio de autodidacta y anota el uso', async () => {
    getViewer.mockResolvedValue(SOFIA)
    accesoParaGenerar.mockResolvedValue({ personal: true, ajena: false, acceso: LIBRE })
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    const res = await POST(request({ teacherProgramId: 57, autodidactaTipo: 'practica' }))
    expect(res.status).toBe(200)
    expect(guardAiCall).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'autodidacta' }))
    expect(registrarUso).toHaveBeenCalledWith('sofia', 57, 'practica')
  })

  it('sin pase, el simulacro (o la tercera práctica) da 402 sin gastar IA', async () => {
    getViewer.mockResolvedValue(SOFIA)
    accesoParaGenerar.mockResolvedValue({ personal: true, ajena: false, acceso: LIBRE })
    const res = await POST(request({ teacherProgramId: 57, autodidactaTipo: 'simulacro' }))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ questions: [], pase: true })
    expect(guardAiCall).not.toHaveBeenCalled()
    expect(generateObject).not.toHaveBeenCalled()

    accesoParaGenerar.mockResolvedValue({ personal: true, ajena: false, acceso: { ...LIBRE, quedan: { ...LIBRE.quedan, practica: 0 } } })
    expect((await POST(request({ teacherProgramId: 57 }))).status).toBe(402)
  })

  it('con el pase, el simulacro sale', async () => {
    getViewer.mockResolvedValue(SOFIA)
    accesoParaGenerar.mockResolvedValue({ personal: true, ajena: false, acceso: { pase: '2026-12-09', quedan: { diagnostico: null, practica: null, simulacro: null } } })
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    expect((await POST(request({ teacherProgramId: 57, autodidactaTipo: 'simulacro' }))).status).toBe(200)
    expect(registrarUso).toHaveBeenCalledWith('sofia', 57, 'simulacro')
  })

  it('la materia personal de otra persona (o un invitado): 403', async () => {
    getViewer.mockResolvedValue(SOFIA)
    accesoParaGenerar.mockResolvedValue({ personal: true, ajena: true })
    expect((await POST(request({ teacherProgramId: 99 }))).status).toBe(403)
    getViewer.mockResolvedValue({ id: 'guest-1', role: 'ALUMNO', isGuest: true, displayName: 'I', email: null })
    expect((await POST(request({ teacherProgramId: 99 }))).status).toBe(403)
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('una materia de docente no cambia nada: el tope de siempre y sin anotar usos', async () => {
    getViewer.mockResolvedValue(SOFIA)
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ teacherProgramId: 16 }))
    expect(guardAiCall).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'quiz_generation' }))
    expect(registrarUso).not.toHaveBeenCalled()
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

  it('con questionTypes explícitos, pide sólo ésos', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request())

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('multiple_choice')
    expect(system).not.toContain('TIPO "numeric"')
  })

  it('Ronda T · A4: sin questionTypes, la mezcla del área (Matemática práctico: con numérica, nada pasa del 50 %)', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ questionTypes: undefined, questionCount: 10 }))

    const { system } = generateObject.mock.calls[0][0]
    expect(system).toContain('TIPO "numeric"')
    expect(system).toContain('DISTRIBUCIÓN OBLIGATORIA POR TIPO')
    const cuotas = [...system.matchAll(/- (\w+): (\d+) preguntas?/g)].map((m: RegExpMatchArray) => Number(m[2]))
    expect(Math.max(...cuotas)).toBeLessThanOrEqual(5)
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

describe('POST — alcance de temas y tipos por modo (aula del profesorado, 30/09)', () => {
  const programa = [
    {
      name: 'Unidad I',
      topics: [
        { id: 'a', name: 'Divisibilidad en los naturales' },
        { id: 'b', name: 'Máximo Común Divisor (MCD) y Mínimo Común Múltiplo (MCM)' },
      ],
    },
    { name: 'Unidad V', topics: [{ id: 'c', name: 'Proporcionalidad directa' }] },
  ]

  it('manda al modelo sólo el tema elegido, no el programa entero', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ subjectUnits: programa, topics: [{ id: 'a', name: 'Divisibilidad en los naturales' }] }))

    const { prompt } = generateObject.mock.calls[0][0]
    expect(prompt).toContain('Divisibilidad en los naturales')
    expect(prompt).toContain('REGLA DE ALCANCE')
    expect(prompt).not.toContain('Máximo Común Divisor')
    expect(prompt).not.toContain('Proporcionalidad')
  })

  it('en modo teórico no pide numeric aunque esté tildado', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ mode: 'teorico', questionTypes: ['multiple_choice', 'numeric'] }))

    const { system } = generateObject.mock.calls[0][0]
    expect(system).not.toContain('TIPO "numeric"')
  })

  it('descarta una numeric que pide palabras y pide otra', async () => {
    const conceptual = {
      ...questions(1, 40)[0],
      type: 'numeric' as const,
      options: undefined,
      question: 'Explique cómo se obtiene el MCD. Responda 1 si usa factores primos y 0 si no.',
      correctAnswer: 1,
    }
    generateObject
      .mockResolvedValueOnce({ object: { questions: [conceptual, ...questions(2, 41)] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: questions(3, 42) }, usage: {} })
      // U1: la numérica pedida no quedó; se pide una tanda sólo de numéricas, que acá no trae nada.
      .mockResolvedValueOnce({ object: { questions: [] }, usage: {} })

    const response = await POST(request({ questionTypes: ['multiple_choice', 'numeric'] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.questions).toHaveLength(3)
    expect(body.questions.map((q: { question: string }) => q.question)).not.toContain(conceptual.question)
    expect(generateObject).toHaveBeenCalledTimes(3)
    expect(generateObject.mock.calls[2][0].schemaDescription).toMatch(/\(numeric\)\.$/)
    expect(body.avisosDeTipos).toEqual([{ tipo: 'numeric', motivo: 'no-salio' }])
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

describe('POST — J3: la ficha de los alumnos entra al prompt', () => {
  const perfil = {
    edades: [16],
    anios: ['4to año'],
    orientaciones: ['Técnica en electrónica'],
    comoEvalua: '4 ejercicios de desarrollo, sin calculadora',
    temasDificiles: ['Ecuación de la recta'],
  }
  const promptEnviado = () => String(generateObject.mock.calls[0][0].system)

  it('un docente que genera para su materia: se carga en el servidor y llega al prompt', async () => {
    getViewer.mockResolvedValue({ id: 'doc', role: 'DOCENTE', isGuest: false, email: 'd@x.com' })
    perfilSinRomper.mockResolvedValue(perfil)
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    expect((await POST(request({ teacherProgramId: 13 }))).status).toBe(200)
    expect(perfilSinRomper).toHaveBeenCalledWith('doc', 13)
    expect(promptEnviado()).toContain('Ecuación de la recta')
    expect(promptEnviado()).toContain('sin calculadora')
  })

  it('un perfil que viene en el cuerpo de la request se ignora', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ perfilAlumnos: { ...perfil, temasDificiles: ['INYECTADO'] } }))
    expect(promptEnviado()).not.toContain('INYECTADO')
    expect(perfilSinRomper).not.toHaveBeenCalled()
  })
})

describe('POST — O8: los pulgares abajo de la materia entran como "Evitá esto"', () => {
  const promptDelUsuario = () => String(generateObject.mock.calls[0][0].prompt)

  it('con materia: se cargan en el servidor y llegan al prompt', async () => {
    getViewer.mockResolvedValue({ id: 'doc', role: 'DOCENTE', isGuest: false, email: 'd@x.com' })
    perfilSinRomper.mockResolvedValue(null)
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join('?').includes('pregunta_valoraciones') ? [{ enunciado: '¿Es 7 primo?', motivo: 'tipo_equivocado' }] : [],
    )
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    expect((await POST(request({ teacherProgramId: 13 }))).status).toBe(200)
    expect(promptDelUsuario()).toContain('EVITÁ ESTO')
    expect(promptDelUsuario()).toContain('«¿Es 7 primo?» (tipo equivocado)')
  })

  it('lo que venga en el cuerpo se ignora, y sin materia no hay sección', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ evitar: [{ enunciado: 'INYECTADO', motivo: 'muy_facil' }] }))
    expect(promptDelUsuario()).not.toContain('INYECTADO')
    expect(promptDelUsuario()).not.toContain('EVITÁ ESTO')
  })
})

describe('POST — Ronda T · A4: el área de la materia guía la generación', () => {
  /** Preguntas de un tipo, todas distintas. */
  function deTipo(tipo: 'true_false' | 'multiple_choice' | 'short_answer', count: number, seed: number) {
    return Array.from({ length: count }, (_, i) => {
      const n = seed * 100 + i
      const base = { id: `x${n}`, topic: 't1', topicName: 'Etnocentrismo', explanation: 'Porque sí.' }
      if (tipo === 'true_false') return { ...base, type: 'true_false', question: `El caso ${n} muestra una mirada etnocéntrica.`, correctAnswer: true }
      if (tipo === 'short_answer') return { ...base, type: 'short_answer', question: `¿Qué categoría describe el caso ${n}?`, acceptedAnswers: ['etnocentrismo'] }
      return { ...base, type: 'multiple_choice', question: `En el caso ${n}, ¿qué se observa?`, options: ['a', 'b', 'c', 'd'], correctAnswer: 0 }
    })
  }
  const ANTROPOLOGIA = {
    subject: 'Temas de Antropología Cultural en Psicología',
    nivel: 'Superior',
    grado: '1er Año',
    topics: [{ id: 't1', name: 'Etnocentrismo' }],
    subjectUnits: [{ name: 'Unidad 2: Cultura', topics: [{ id: 't1', name: 'Etnocentrismo' }] }],
  }

  it('Antropología: sin LaTeX, "práctico" es análisis de casos, sin numérica y con la mezcla conceptual', async () => {
    generateObject.mockResolvedValue({ object: { questions: [...deTipo('multiple_choice', 5, 1), ...deTipo('short_answer', 3, 2), ...deTipo('true_false', 2, 3)] }, usage: {} })
    const res = await POST(request({ ...ANTROPOLOGIA, questionTypes: undefined, questionCount: 10 }))
    expect(res.status).toBe(200)

    const { system, prompt } = generateObject.mock.calls[0][0]
    expect(system).not.toContain('FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO')
    expect(system).toContain('ÁREA Y CÓMO SE EVALÚA: Ciencias sociales y humanidades')
    expect(system).toContain('SIN cálculos')
    expect(system).not.toContain('modelar y resolver')
    expect(system).not.toContain('TIPO "numeric"')
    expect(system).toContain('- multiple_choice: 5 preguntas')
    expect(system).toContain('- short_answer: 4 preguntas')
    expect(system).toContain('- true_false: 1 pregunta')
    expect(prompt).toContain('MODO PRÁCTICO: Análisis de situaciones')
    expect(prompt).not.toContain('Ejercicios de cálculo')
  })

  it('el caso de Silvana: el modelo devuelve 40 de 40 verdadero o falso y salen como mucho la mitad', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { questions: deTipo('true_false', 40, 4) }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: [...deTipo('multiple_choice', 25, 5), ...deTipo('short_answer', 15, 6)] }, usage: {} })
    const res = await POST(
      request({ ...ANTROPOLOGIA, mode: 'teorico', questionTypes: ['multiple_choice', 'true_false', 'short_answer'], questionCount: 40 }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.questions).toHaveLength(40)
    expect(body.questions.filter((q: { type: string }) => q.type === 'true_false').length).toBeLessThanOrEqual(20)
  })

  it('un tipo que no se pidió se descarta y se completa la cantidad (decisión 2 de la tanda P)', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { questions: [...deTipo('true_false', 2, 7), ...deTipo('multiple_choice', 1, 8)] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: deTipo('multiple_choice', 3, 9) }, usage: {} })
    const res = await POST(request({ ...ANTROPOLOGIA, questionTypes: ['multiple_choice'], questionCount: 3 }))
    const body = await res.json()
    expect(body.questions).toHaveLength(3)
    expect(body.questions.every((q: { type: string }) => q.type === 'multiple_choice')).toBe(true)
  })

  it('el área y el carácter de las unidades salen del programa del docente, no del cuerpo', async () => {
    getViewer.mockResolvedValue({ id: 'doc', role: 'DOCENTE', isGuest: false, email: 'd@x.com' })
    sqlMock.mockImplementation(async (partes: TemplateStringsArray) =>
      partes.join('?').includes('FROM teacher_programs')
        ? [{
            subject_name: 'Matemática y su Didáctica',
            pedagogy_profile: { area: 'educacion', areaConfianza: 0.9, areaOrigen: 'ia', degree: 'Profesorado' },
            units: [
              { name: 'Unidad I: Números', caracter: 'cuantitativo', topics: [{ id: 'n1', name: 'Fracciones' }] },
              { name: 'Unidad II: Didáctica', caracter: 'conceptual', topics: [{ id: 'd1', name: 'Obstáculos' }] },
            ],
          }]
        : [],
    )
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })

    await POST(request({ subject: 'Matemática y su Didáctica', teacherProgramId: 16, topics: [{ id: 'd1', name: 'Obstáculos' }], area: 'matematica' }))
    const conceptual = generateObject.mock.calls[0][0].system as string
    expect(conceptual).toContain('ÁREA Y CÓMO SE EVALÚA: Educación y didácticas')
    expect(conceptual).not.toContain('FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO')

    generateObject.mockClear()
    await POST(request({ subject: 'Matemática y su Didáctica', teacherProgramId: 16, topics: [{ id: 'n1', name: 'Fracciones' }] }))
    expect(generateObject.mock.calls[0][0].system).toContain('FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO')
  })

  it('matemática no cambia: el bloque de LaTeX y "MODO PRÁCTICO: Ejercicios de cálculo"', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request())
    const { system, prompt } = generateObject.mock.calls[0][0]
    expect(system).toContain('FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO')
    expect(system).toContain('ESTRATEGIA MATEMÁTICA')
    expect(prompt).toContain('MODO PRÁCTICO: Ejercicios de cálculo y resolución de problemas numéricos.')
  })

  it('A5: en una unidad conceptual, una pregunta con LaTeX o una cuenta se descarta y se pide otra', async () => {
    const [a, b, c] = deTipo('multiple_choice', 3, 10)
    const conLatex = { ...a, question: 'Si la comunidad crece como $x^2$, ¿qué mirada predomina?' }
    const conCuenta = { ...b, question: 'Calculá el porcentaje de la población que mantiene el ritual.' }
    generateObject
      .mockResolvedValueOnce({ object: { questions: [conLatex, conCuenta, c] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: deTipo('multiple_choice', 2, 11) }, usage: {} })
    const body = await (await POST(request({ ...ANTROPOLOGIA, questionTypes: ['multiple_choice'], questionCount: 3 }))).json()
    const textos = body.questions.map((q: { question: string }) => q.question)
    expect(textos).toHaveLength(3)
    expect(textos).not.toContain(conLatex.question)
    expect(textos).not.toContain(conCuenta.question)
  })

  it('la metodología del docente sigue llegando como PREFERENCIAS PEDAGOGICAS DEL DOCENTE', async () => {
    generateObject.mockResolvedValue({ object: { questions: questions(3) }, usage: {} })
    await POST(request({ ...ANTROPOLOGIA, questionTypes: ['multiple_choice'], pedagogyContext: 'Trabajo con casos de la vida cotidiana' }))
    expect(generateObject.mock.calls[0][0].prompt).toContain('PREFERENCIAS PEDAGOGICAS DEL DOCENTE:\nTrabajo con casos de la vida cotidiana')
  })
})

describe('POST — Ronda T · F2: varias correctas', () => {
  const varias = (n: number, correctas: number[]) => ({
    id: `v${n}`,
    type: 'multiple_response',
    topic: 't1',
    topicName: 'Álgebra',
    question: `Marcá todas las expresiones equivalentes a ${n}x (caso ${n}).`,
    options: [`${n}x`, `x·${n}`, `${n}+x`, `x^${n}`, `${2 * n}x/2`],
    correctAnswers: correctas,
    explanation: 'Las que valen lo mismo para todo x.',
  })

  it('al barajar, las correctas siguen siendo las mismas opciones; una con una sola correcta se descarta', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { questions: [varias(2, [0, 1, 4]), varias(3, [0]), varias(4, [0, 1, 4])] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: [varias(5, [0, 1, 4])] }, usage: {} })
    const res = await POST(request({ questionTypes: ['multiple_response'], questionCount: 3 }))
    const { questions: salida } = (await res.json()) as { questions: { options: string[]; correctAnswers: number[]; question: string }[] }
    expect(salida).toHaveLength(3)
    expect(salida.some((q) => q.question.includes('caso 3'))).toBe(false)
    for (const q of salida) {
      const n = q.question.match(/caso (\d+)/)![1]
      expect(q.correctAnswers.map((i) => q.options[i]).sort()).toEqual([`${n}x`, `x·${n}`, `${2 * Number(n)}x/2`].sort())
    }
  })
})

describe('POST — Ronda T · F7: la calculada', () => {
  const calculada = (formula: string, caso: number) => ({
    id: `c${caso}`,
    type: 'calculated',
    topic: 't1',
    topicName: 'Álgebra',
    question: `Caso ${caso}: un bien cuesta {p} pesos y sube un {x} %. ¿Cuánto cuesta ahora?`,
    formula,
    variables: [
      { name: 'p', min: 100, max: 500, decimals: 0 },
      { name: 'x', min: 5, max: 20, decimals: 0 },
    ],
    tolerance: 0.01,
    explanation: 'Se multiplica por 1 más el porcentaje.',
  })

  it('sale con los valores sorteados en el enunciado y la correcta de la fórmula; una con "^" se descarta', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { questions: [calculada('{p} * (1 + {x} / 100)', 1), calculada('{p} ^ 2', 2)] }, usage: {} })
      .mockResolvedValueOnce({ object: { questions: [calculada('{p} + {p} * {x} / 100', 3)] }, usage: {} })
    const res = await POST(request({ questionTypes: ['calculated'], questionCount: 2 }))
    const { questions: salida } = (await res.json()) as { questions: { question: string; plantilla: string; valores: { p: number; x: number }; correctAnswer: number }[] }
    expect(salida).toHaveLength(2)
    expect(salida.some((q) => q.plantilla.startsWith('Caso 2'))).toBe(false)
    for (const q of salida) {
      expect(q.question).not.toContain('{p}')
      expect(q.question).toContain(`cuesta ${q.valores.p} pesos`)
      expect(q.correctAnswer).toBeCloseTo(q.valores.p * (1 + q.valores.x / 100))
    }
  })
})
