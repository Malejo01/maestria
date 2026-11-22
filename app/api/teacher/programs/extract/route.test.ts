import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * I1: la foto y el escaneo los lee el modelo. Fixtures sintéticos chicos
 * (los programas reales de los institutos no entran al repo): un PDF de una
 * página sin capa de texto, uno con texto, y una imagen.
 */
const { generateObject, sqlMock, guard, captureRouteFailure, captureAiSchemaFailure } = vi.hoisted(() => ({
  generateObject: vi.fn(),
  sqlMock: vi.fn(),
  guard: { ok: true as const, finish: vi.fn(), fail: vi.fn() },
  captureRouteFailure: vi.fn(),
  captureAiSchemaFailure: vi.fn(),
}))

vi.mock('ai', () => ({ generateObject }))
vi.mock('@ai-sdk/google', () => ({ google: (modelo: string) => ({ modelo }) }))
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'd1', email: 'd@x.com' } }) }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar: async () => null }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall: async () => guard }))
vi.mock('@/lib/observability', () => ({
  captureRouteFailure,
  captureAiSchemaFailure,
  captureFileParsingFailure: vi.fn(),
}))

import { POST } from './route'
import { NO_SE_PUDO_LEER } from '@/lib/lectura-programa'

/** Un PDF mínimo de una página; con `texto`, una capa de texto; sin, nada (un escaneo). */
function pdfMinimo(texto?: string): Buffer {
  // Una línea por renglón de 60 caracteres: lo que se sale de la página, pdf-parse no lo lee.
  const renglones = texto ? (texto.match(/.{1,60}/g) ?? []) : []
  const contenido = renglones.length
    ? `BT /F1 10 Tf 14 TL 40 760 Td ${renglones.map((renglon) => `(${renglon}) Tj T*`).join(' ')} ET`
    : ''
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const posiciones: number[] = []
  objetos.forEach((objeto, i) => {
    posiciones.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const posicion of posiciones) pdf += `${String(posicion).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

/** Un PNG de 1×1: al modelo le llega como imagen; el contenido lo pone el doble. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const ESTRUCTURA = {
  units: [
    { name: 'Unidad 1: Matrices', topics: [{ name: 'Operaciones con matrices' }, { name: 'Determinantes' }] },
    { name: 'Unidad 2: Sistemas', topics: [{ name: 'Método de Gauss' }] },
  ],
  nivel: 'Superior',
  grado: '1º año',
}

function pedido(nombre: string, tipo: string, datos: Buffer) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(datos)], nombre, { type: tipo }))
  return new Request('http://localhost/api/teacher/programs/extract', { method: 'POST', body: form })
}

/** El pedido con progreso: devuelve los eventos, en orden. */
async function eventos(nombre: string, tipo: string, datos: Buffer) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(datos)], nombre, { type: tipo }))
  const res = await POST(
    new Request('http://localhost/api/teacher/programs/extract', {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/x-ndjson' },
    }),
  )
  return (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((linea) => JSON.parse(linea))
}

beforeEach(() => {
  vi.clearAllMocks()
  sqlMock.mockImplementation(async (partes: TemplateStringsArray) =>
    partes.join('?').includes('FROM users') ? [{ role: 'DOCENTE' }] : [],
  )
  generateObject.mockResolvedValue({ object: ESTRUCTURA, usage: { inputTokens: 1, outputTokens: 1 } })
})

describe('/api/teacher/programs/extract — escaneos y fotos (I1)', () => {
  it('una foto va entera al modelo como imagen, en una sola llamada', async () => {
    const res = await POST(pedido('foto.jpg', 'image/jpeg', PNG))
    expect(res.status).toBe(200)
    const cuerpo = await res.json()
    expect(cuerpo.extractionMethod).toBe('ai')
    expect(cuerpo.summary).toEqual({ unitCount: 2, topicCount: 3 })

    expect(generateObject).toHaveBeenCalledTimes(1)
    const llamada = generateObject.mock.calls[0][0]
    expect(llamada.prompt).toBeUndefined()
    const partes = llamada.messages[0].content
    expect(partes.some((parte: { type: string }) => parte.type === 'image')).toBe(true)
    expect(llamada.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('un PDF sin capa de texto (escaneo) va entero al modelo como archivo, no corta en 422', async () => {
    const res = await POST(pedido('escaneo.pdf', 'application/pdf', pdfMinimo()))
    expect(res.status).toBe(200)
    const partes = generateObject.mock.calls[0][0].messages[0].content
    const archivo = partes.find((parte: { type: string }) => parte.type === 'file')
    expect(archivo).toMatchObject({ mediaType: 'application/pdf' })
  })

  it('el progreso del escaneo explica la espera más larga', async () => {
    const etapas = (await eventos('escaneo.pdf', 'application/pdf', pdfMinimo())).map((e) => e.etapa)
    expect(etapas).toEqual(['leyendo', 'leyendo-con-ia', 'ordenando', 'listo'])
  })

  it('un PDF digital sigue yendo como texto', async () => {
    const texto = 'Unidad 1 Matrices operaciones determinantes. '.repeat(12)
    const res = await POST(pedido('digital.pdf', 'application/pdf', pdfMinimo(texto)))
    expect(res.status).toBe(200)
    const llamada = generateObject.mock.calls[0][0]
    expect(llamada.messages).toBeUndefined()
    expect(llamada.prompt).toContain('Matrices')
  })

  it('si el modelo no contesta a tiempo: 422 con qué hacer, sin esperar 300 s', async () => {
    generateObject.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))
    const inicio = Date.now()
    const res = await POST(pedido('foto.jpg', 'image/jpeg', PNG))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe(NO_SE_PUDO_LEER)
    expect(Date.now() - inicio).toBeLessThan(5_000)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 504, operation: 'extract_program_file_timeout' }),
    )
    expect(guard.fail).toHaveBeenCalled()
  })

  it('si el modelo no puede con la foto: 422, no un heurístico sobre texto vacío', async () => {
    generateObject.mockRejectedValue(new Error('No object generated'))
    const res = await POST(pedido('foto.png', 'image/png', PNG))
    expect(res.status).toBe(422)
    expect(captureAiSchemaFailure).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fallback: 'none' }))
  })

  it('la llamada al modelo tiene un tiempo máximo de 60 s', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await POST(pedido('foto.jpg', 'image/jpeg', PNG))
    expect(espia).toHaveBeenCalledWith(60_000)
    espia.mockRestore()
  })
})

describe('la ruta', () => {
  it('declara maxDuration de 90 s: nunca más el 504 de los 300 s', async () => {
    const ruta = await import('./route')
    expect(ruta.maxDuration).toBe(90)
  })
})


describe('temas granulares (I2)', () => {
  const texto = 'Unidad 1 Matrices operaciones determinantes. '.repeat(12)

  it('pide temas finos, deja lugar para 57 temas, y parte un párrafo que igual vino', async () => {
    generateObject.mockResolvedValue({
      object: {
        units: [
          {
            name: 'Unidad III',
            topics: [
              {
                name: 'Sistemas de m ecuaciones lineales con n incógnitas. Reducción a la forma escalonada. Solución general. Rango de una matriz. Teorema de Rouché-Frobenius',
              },
            ],
          },
        ],
      },
      usage: {},
      finishReason: 'stop',
    })
    const res = await POST(pedido('digital.pdf', 'application/pdf', pdfMinimo(texto)))
    const llamada = generateObject.mock.calls[0][0]
    expect(llamada.maxOutputTokens).toBe(8000)
    expect(llamada.prompt).toContain('enseñar y evaluar por separado')
    const cuerpo = await res.json()
    expect(cuerpo.units[0].topics.map((t: { name: string }) => t.name)).toEqual([
      'Sistemas de m ecuaciones lineales con n incógnitas',
      'Reducción a la forma escalonada',
      'Solución general',
      'Rango de una matriz',
      'Teorema de Rouché-Frobenius',
    ])
  })

  it('si el modelo corta por largo, se reporta como falla de esquema', async () => {
    generateObject.mockResolvedValue({ object: ESTRUCTURA, usage: {}, finishReason: 'length' })
    await POST(pedido('digital.pdf', 'application/pdf', pdfMinimo(texto)))
    expect(captureAiSchemaFailure).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ finishReason: 'length' }))
  })
})

describe('/api/teacher/programs/extract — O11: título y temas en la misma línea', () => {
  it('"Unidad 2: Funciones. Dominio, imagen, …" queda como unidad con título y sus temas', async () => {
    generateObject.mockResolvedValue({
      object: {
        units: [
          { name: 'Unidad 1: Números reales', topics: [{ name: 'Intervalos' }] },
          { name: 'Unidad 2: Funciones. Dominio, imagen, ceros', topics: [{ name: 'Función lineal' }] },
          { name: 'Unidad 3', topics: [{ name: 'Límites. Límites laterales, continuidad' }] },
        ],
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    })
    const cuerpo = await (await POST(pedido('foto.jpg', 'image/jpeg', PNG))).json()
    const unidades = cuerpo.units.map((u: { name: string; topics: { name: string }[] }) => [u.name, u.topics.map((t) => t.name)])
    expect(unidades).toEqual([
      ['Unidad 1: Números reales', ['Intervalos']],
      ['Unidad 2: Funciones', ['Dominio', 'Imagen', 'Ceros', 'Función lineal']],
      ['Unidad 3: Límites', ['Límites laterales', 'Continuidad']],
    ])
  })
})

describe('/api/teacher/programs/extract — A2: el área en la misma llamada', () => {
  it('pide el área y el carácter de cada unidad en el mismo esquema, sin otra llamada', async () => {
    generateObject.mockResolvedValue({
      object: {
        units: [
          { name: 'Unidad 1: Cultura', topics: [{ name: 'Etnocentrismo' }], caracter: 'conceptual' },
          { name: 'Unidad 2: Parentesco', topics: [{ name: 'Linajes' }], caracter: 'conceptual' },
        ],
        area: 'sociales',
        areaConfianza: 0.9,
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    })
    const cuerpo = await (await POST(pedido('programa.jpg', 'image/jpeg', PNG))).json()
    expect(generateObject).toHaveBeenCalledTimes(1)
    const instrucciones = generateObject.mock.calls[0][0].messages[0].content[0].text as string
    expect(instrucciones).toMatch(/"area"/)
    expect(instrucciones).toMatch(/"caracter"/)
    expect(cuerpo).toMatchObject({ area: 'sociales', areaConfianza: 0.9, areaOrigen: 'ia' })
    expect(cuerpo.units.map((u: { caracter: string }) => u.caracter)).toEqual(['conceptual', 'conceptual'])
  })

  it('si la IA no dice el área, se infiere (del nombre del archivo y las unidades)', async () => {
    generateObject.mockResolvedValue({ object: ESTRUCTURA, usage: { inputTokens: 1, outputTokens: 1 } })
    const cuerpo = await (await POST(pedido('Algebra-y-Geometria-Analitica.jpg', 'image/jpeg', PNG))).json()
    expect(cuerpo).toMatchObject({ area: 'matematica', areaOrigen: 'inferida' })
    expect(cuerpo.units.every((u: { caracter: string }) => u.caracter === 'cuantitativo')).toBe(true)
  })
})

describe('/api/teacher/programs/extract — D1: los temas largos de un .docx', () => {
  /** Un .docx mínimo, armado en el test con texto de ejemplo (no el programa de Silvana). */
  async function docx(parrafos: string[]): Promise<Buffer> {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    const cuerpo = parrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`)
    return zip.generateAsync({ type: 'nodebuffer' })
  }
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const UNIDAD_1 =
    'La antropología como disciplina científica y su objeto de estudio, el trabajo de campo y la observación participante, ' +
    'el concepto de cultura en sus distintas definiciones, la diversidad cultural y sus formas de explicación, ' +
    'etnocentrismo y relativismo cultural como posiciones frente al otro, la construcción social de la identidad y la alteridad, ' +
    'el lugar de la antropología en la formación del psicólogo, cultura, salud y enfermedad en distintas sociedades'
  const PROGRAMA = [
    'Programa de Temas de Antropología Cultural (ejemplo)',
    'Contenidos',
    'Unidad 1: La perspectiva antropológica',
    UNIDAD_1,
    'Unidad 2: Parentesco y rituales',
    'Familia y parentesco; ritos de paso; el cuerpo como construcción cultural.',
  ]

  it('la IA devuelve la Unidad 1 como un solo tema de ~500 caracteres: se parte (en comas, seguro)', async () => {
    generateObject.mockResolvedValue({
      object: { units: [{ name: 'Unidad 1: La perspectiva antropológica', topics: [{ name: UNIDAD_1 }] }] },
      usage: { inputTokens: 1, outputTokens: 1 },
    })
    const cuerpo = await (await POST(pedido('programa.docx', DOCX, await docx(PROGRAMA)))).json()
    const temas = cuerpo.units[0].topics.map((t: { name: string }) => t.name)
    expect(temas.length).toBeGreaterThanOrEqual(6)
    expect(temas).toContain('etnocentrismo y relativismo cultural como posiciones frente al otro')
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  it('si el modelo falla, el heurístico lee el .docx y también parte la unidad larga', async () => {
    generateObject.mockRejectedValue(new Error('No object generated'))
    const cuerpo = await (await POST(pedido('programa.docx', DOCX, await docx(PROGRAMA)))).json()
    expect(cuerpo.extractionMethod).toBe('heuristic')
    const todos = cuerpo.units.flatMap((u: { topics: { name: string }[] }) => u.topics.map((t) => t.name))
    expect(todos.every((t: string) => t.length <= 120)).toBe(true)
    expect(todos.some((t: string) => /etnocentrismo/i.test(t))).toBe(true)
  })

  it('un párrafo que no se puede partir con certeza: se le pide a la IA sólo esa división, y se verifica', async () => {
    const parrafo = 'La relación entre la experiencia subjetiva del padecimiento y los modos en que cada sociedad organiza sus respuestas frente a la enfermedad y la muerte'
    generateObject
      .mockResolvedValueOnce({ object: { units: [{ name: 'Unidad 3: Salud', topics: [{ name: parrafo }] }] }, usage: { inputTokens: 10, outputTokens: 10 } })
      .mockResolvedValueOnce({ object: { temas: ['La experiencia subjetiva del padecimiento', 'Las respuestas de cada sociedad frente a la enfermedad y la muerte'] }, usage: { inputTokens: 3, outputTokens: 3 } })
    const cuerpo = await (await POST(pedido('programa.docx', DOCX, await docx(PROGRAMA)))).json()
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(String(generateObject.mock.calls[1][0].prompt)).toContain(parrafo)
    expect(cuerpo.units[0].topics.map((t: { name: string }) => t.name)).toEqual([
      'La experiencia subjetiva del padecimiento',
      'Las respuestas de cada sociedad frente a la enfermedad y la muerte',
    ])
    // Las dos llamadas se cobran juntas, en la misma fila.
    expect(guard.finish).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 13, outputTokens: 13 }))
  })
})
