/**
 * Ronda W · W3 — Importar preguntas desde Moodle: GIFT y Moodle XML.
 *
 * El docente que ya tiene un banco en Moodle lo trae a MaestrIA. Se leen
 * todos los tipos que exporta MaestrIA (opción múltiple, verdadero o falso,
 * numérica, respuesta corta, varias correctas, emparejamiento, ordenamiento,
 * seleccionar la palabra, arrastrar al texto, palabra faltante y calculada).
 * Lo que no se puede traer (un ensayo, un Cloze, una descripción, un tipo
 * desconocido) **se informa y se saltea**: nunca rompe el resto.
 *
 * GIFT se lee como lo lee Moodle (las mismas marcas de escape que el
 * validador de M5); XML, con el lector del validador de F1. Las fórmulas
 * vuelven a `$…$`, la notación de la app.
 *
 * Todo esto es puro.
 */
import { comoLlegaAMoodle, marcarEscapes } from '@/lib/gift-validar'
import { leerXml, type NodoXml } from '@/lib/moodle-xml-validar'
import { problemaDeTipoMoodle } from '@/lib/tipos-moodle'
import { aleatorioConSemilla, instanciarCalculada } from '@/lib/calculada'
import type { Question } from '@/lib/types'
import { limpiarRubrica, MINIMO_CRITERIOS, type CriterioDeRubrica } from '@/lib/ensayo'
import { limpiarGrafico, type Grafico } from '@/lib/grafico'

/**
 * W5: los criterios de la rúbrica de un ensayo importado. Salen de una lista
 * HTML (`<li>`, como los escribe nuestro XML en graderinfo) o de un "Criterios:
 * a; b; c" (como los escribe nuestro GIFT en la retroalimentación). Con menos
 * de 3, el ensayo no se puede corregir con rúbrica y se saltea.
 */
export function criteriosDeEnsayo(...fuentes: string[]): CriterioDeRubrica[] {
  for (const f of fuentes) {
    if (!f) continue
    const items = [...f.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => htmlATexto(m[1]))
    const enLinea = /criterios?\s*:\s*([\s\S]+)$/i.exec(items.length > 0 ? '' : htmlATexto(f))
    const crudos = items.length > 0 ? items : enLinea ? enLinea[1].split(/[;\n]/) : []
    const rubrica = limpiarRubrica(crudos)
    if (rubrica.length >= MINIMO_CRITERIOS) return rubrica
  }
  return []
}

/** La guía sin el "Criterios: …" que ya pasó a la rúbrica. */
const sinCriterios = (texto: string) => texto.replace(/\s*criterios?\s*:[\s\S]*$/i, '').trim()

export interface PreguntaSalteada {
  /** "Q3", el nombre de la pregunta o su número. */
  donde: string
  motivo: string
}

export interface ResultadoDeImportar {
  formato: 'gift' | 'xml'
  preguntas: Question[]
  salteadas: PreguntaSalteada[]
  /** El último tramo de la categoría de Moodle, para el título y el tema. */
  categoria: string | null
}

export const MOTIVO_DE_SALTEO = {
  ensayo: 'Es una respuesta larga (ensayo) sin al menos 3 criterios para corregirla (van en la retroalimentación o en la información para quien corrige).',
  cloze: 'Es una pregunta Cloze (respuestas incrustadas): no se importa.',
  descripcion: 'Es una descripción, sin respuestas.',
  desconocido: (tipo: string) => `El tipo «${tipo}» no se puede importar.`,
  malArmada: (detalle: string) => `No se pudo leer: ${detalle}.`,
} as const

/** `\( x \)` → `$x$` y `\[ x \]` → `$$x$$`, la notación de la app. */
export function aNotacionDeLaApp(texto: string): string {
  return texto
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, f: string) => `$$${f.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, f: string) => `$${f.trim()}$`)
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** El HTML de Moodle como texto: párrafos y <br> a saltos, sin etiquetas, con las entidades resueltas. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e: string) =>
      e.startsWith('#x') ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith('#') ? String.fromCodePoint(parseInt(e.slice(1), 10)) : (ENTIDADES[e.toLowerCase()] ?? todo),
    )
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/** Los párrafos de un HTML, como texto. */
function parrafos(html: string): string[] {
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => htmlATexto(m[1])).filter(Boolean)
  return ps.length > 0 ? ps : [htmlATexto(html)].filter(Boolean)
}

const limpio = (t: string) => aNotacionDeLaApp(t.trim())

// ─── GIFT ───────────────────────────────────────────────────────────────────

interface RespuestaGift {
  correcta: boolean
  peso: number | null
  texto: string
}

/** Parte las respuestas por `=` y `~` sin escapar (ya marcados los escapes). */
function respuestasGift(marcado: string): RespuestaGift[] {
  const salida: RespuestaGift[] = []
  for (const m of marcado.matchAll(/([=~])([^=~]*)/g)) {
    let cuerpo = m[2]
    let peso: number | null = null
    const conPeso = cuerpo.match(/^%(-?\d+(?:\.\d+)?)%/)
    if (conPeso) {
      peso = Number(conPeso[1])
      cuerpo = cuerpo.slice(conPeso[0].length)
    }
    // La retroalimentación de cada respuesta (`#…`) no se trae.
    const sinFeedback = cuerpo.split('#')[0]
    salida.push({ correcta: m[1] === '=', peso, texto: comoLlegaAMoodle(sinFeedback).trim() })
  }
  return salida
}

function preguntaGift(bloque: string, numero: number, tema: string): { pregunta?: Question; salteada?: PreguntaSalteada } {
  const marcado = marcarEscapes(bloque)
  const titulo = /^::(.*?)::/.exec(marcado)
  const donde = titulo ? comoLlegaAMoodle(titulo[1]).trim() || `Q${numero}` : `Q${numero}`
  const sinTitulo = (titulo ? marcado.slice(titulo[0].length) : marcado).replace(/^\s*\[(html|moodle|plain|markdown)\]/i, '')
  const inicio = sinTitulo.indexOf('{')
  const fin = sinTitulo.lastIndexOf('}')
  if (inicio === -1 || fin < inicio) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.descripcion } }

  const antes = limpio(comoLlegaAMoodle(sinTitulo.slice(0, inicio)))
  const despues = limpio(comoLlegaAMoodle(sinTitulo.slice(fin + 1)))
  const [opcionesMarcadas, ...resto] = sinTitulo.slice(inicio + 1, fin).split('####')
  const explanation = limpio(comoLlegaAMoodle(resto.join('####')))
  const r = opcionesMarcadas.trim()
  const base = { id: `q${numero}`, topic: 'importada', topicName: tema, explanation }

  if (r === '') {
    const rubrica = criteriosDeEnsayo(explanation)
    if (rubrica.length === 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.ensayo } }
    return { pregunta: { ...base, explanation: sinCriterios(explanation), type: 'essay', question: antes, rubrica } as Question }
  }

  // Verdadero o falso.
  const vf = r.match(/^(TRUE|FALSE|T|F)\b/i)
  if (vf) return { pregunta: { ...base, type: 'true_false', question: antes, correctAnswer: /^t/i.test(vf[1]) } as Question }

  // Numérica: {#4}, {#4:0.1}, {#1..5}.
  if (r.startsWith('#')) {
    const cuerpo = comoLlegaAMoodle(r.slice(1).split(/[=#~]/)[0]).trim()
    const rango = cuerpo.match(/^(-?[\d.]+)\.\.(-?[\d.]+)$/)
    const conTolerancia = cuerpo.match(/^(-?[\d.]+)(?::([\d.]+))?$/)
    if (rango) {
      const a = Number(rango[1])
      const b = Number(rango[2])
      return { pregunta: { ...base, type: 'numeric', question: antes, correctAnswer: (a + b) / 2, tolerance: Math.abs(b - a) / 2 } as Question }
    }
    if (conTolerancia && Number.isFinite(Number(conTolerancia[1]))) {
      const tol = conTolerancia[2] ? Number(conTolerancia[2]) : undefined
      return { pregunta: { ...base, type: 'numeric', question: antes, correctAnswer: Number(conTolerancia[1]), ...(tol ? { tolerance: tol } : {}) } as Question }
    }
    return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('una numérica sin número') } }
  }

  const respuestas = respuestasGift(r)
  if (respuestas.length === 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('sin respuestas') } }

  // Emparejamiento: =izquierda -> derecha.
  if (respuestas.every((x) => x.correcta) && respuestas.some((x) => x.texto.includes('->'))) {
    const pares = respuestas.map((x) => x.texto.split('->').map((s) => limpio(s)))
    const pairs = pares.filter(([l, d]) => l && d).map(([left, right]) => ({ left, right }))
    const distractors = pares.filter(([l, d]) => !l && d).map(([, d]) => d)
    return { pregunta: { ...base, type: 'matching', question: antes, pairs, ...(distractors.length ? { distractors } : {}) } as Question }
  }

  // Respuesta corta: sólo respuestas correctas.
  if (respuestas.every((x) => x.correcta && x.peso === null)) {
    return { pregunta: { ...base, type: 'short_answer', question: antes || despues, acceptedAnswers: respuestas.map((x) => limpio(x.texto)) } as Question }
  }

  const opciones = respuestas.map((x) => limpio(x.texto))
  // Varias correctas: pesos positivos.
  if (respuestas.some((x) => x.peso !== null && x.peso > 0) && !respuestas.some((x) => x.correcta)) {
    const correctAnswers = respuestas.flatMap((x, i) => (x.peso !== null && x.peso > 0 ? [i] : []))
    return { pregunta: { ...base, type: 'multiple_response', question: antes, options: opciones, correctAnswers } as Question }
  }

  const correctas = respuestas.flatMap((x, i) => (x.correcta || (x.peso ?? 0) >= 100 ? [i] : []))
  if (correctas.length !== 1) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada(`${correctas.length} respuestas correctas en una opción múltiple`) } }

  // La palabra faltante: hay texto después de las llaves.
  if (despues) {
    return {
      pregunta: { ...base, type: 'missing_word', question: 'Elegí la palabra que falta.', text: `${antes} [[1]] ${despues}`.replace(/\s+([.,;:!?])/g, '$1').trim(), options: opciones, correctAnswer: correctas[0] } as Question,
    }
  }
  return { pregunta: { ...base, type: 'multiple_choice', question: antes, options: opciones, correctAnswer: correctas[0] } as Question }
}

export function importarGift(contenido: string): ResultadoDeImportar {
  const bloques = contenido
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('//'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
  let categoria: string | null = null
  const preguntas: Question[] = []
  const salteadas: PreguntaSalteada[] = []
  let numero = 0
  for (const bloque of bloques) {
    if (bloque.startsWith('$CATEGORY:')) {
      categoria = bloque.slice('$CATEGORY:'.length).trim().split('/').pop()?.trim() || null
      continue
    }
    numero++
    const { pregunta, salteada } = preguntaGift(bloque, numero, categoria ?? 'Importadas')
    if (pregunta) agregar(pregunta, `Q${numero}`, preguntas, salteadas)
    if (salteada) salteadas.push(salteada)
  }
  return { formato: 'gift', preguntas, salteadas, categoria }
}

// ─── Moodle XML ─────────────────────────────────────────────────────────────

const hijo = (n: NodoXml | undefined, nombre: string) => n?.hijos.find((h) => h.nombre === nombre)
const hijos = (n: NodoXml | undefined, nombre: string) => n?.hijos.filter((h) => h.nombre === nombre) ?? []
const textoDe = (n: NodoXml | undefined) => (hijo(n, 'text')?.texto ?? n?.texto ?? '').trim()

/** X3: el gráfico de una pregunta exportada por MaestrIA (el `data-grafico` de su imagen). */
function graficoDelHtml(html: string): Grafico | null {
  const m = /data-grafico="([^"]*)"/.exec(html)
  if (!m) return null
  try {
    return limpiarGrafico(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')))
  } catch {
    return null
  }
}

function preguntaXml(q: NodoXml, numero: number, tema: string): { pregunta?: Question; salteada?: PreguntaSalteada } {
  const r = preguntaXmlSinGrafico(q, numero, tema)
  const grafico = r.pregunta ? graficoDelHtml(textoDe(hijo(q, 'questiontext'))) : null
  return grafico && r.pregunta ? { pregunta: { ...r.pregunta, grafico } } : r
}

function preguntaXmlSinGrafico(q: NodoXml, numero: number, tema: string): { pregunta?: Question; salteada?: PreguntaSalteada } {
  const tipo = q.atributos.type ?? ''
  const donde = htmlATexto(textoDe(hijo(q, 'name'))) || `Q${numero}`
  const html = textoDe(hijo(q, 'questiontext'))
  const enunciado = limpio(htmlATexto(html))
  const explanation = limpio(htmlATexto(textoDe(hijo(q, 'generalfeedback'))))
  const base = { id: `q${numero}`, topic: 'importada', topicName: tema, explanation }
  const respuestas = hijos(q, 'answer').map((a) => ({ fraccion: Number(a.atributos.fraction ?? 0), texto: limpio(htmlATexto(textoDe(a))), nodo: a }))

  switch (tipo) {
    case 'multichoice': {
      const single = !/^(false|0)$/i.test(textoDe(hijo(q, 'single')) || 'true')
      const opciones = respuestas.map((r) => r.texto)
      if (!single) {
        const correctAnswers = respuestas.flatMap((r, i) => (r.fraccion > 0 ? [i] : []))
        return { pregunta: { ...base, type: 'multiple_response', question: enunciado, options: opciones, correctAnswers } as Question }
      }
      const correcta = respuestas.findIndex((r) => r.fraccion >= 100)
      if (correcta < 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('sin respuesta correcta') } }
      // La palabra faltante como la exporta MaestrIA (y GIFT): un párrafo con "_____".
      const ps = parrafos(html)
      const conHueco = ps.findIndex((p) => /_{3,}/.test(p))
      if (conHueco >= 0) {
        const consigna = ps.filter((_, i) => i !== conHueco).join('\n') || 'Elegí la palabra que falta.'
        return { pregunta: { ...base, type: 'missing_word', question: limpio(consigna), text: limpio(ps[conHueco].replace(/_{3,}/, '[[1]]')), options: opciones, correctAnswer: correcta } as Question }
      }
      return { pregunta: { ...base, type: 'multiple_choice', question: enunciado, options: opciones, correctAnswer: correcta } as Question }
    }
    case 'truefalse': {
      const verdadera = respuestas.find((r) => /^(true|verdadero)$/i.test(r.texto))
      return { pregunta: { ...base, type: 'true_false', question: enunciado, correctAnswer: (verdadera?.fraccion ?? 0) >= 100 } as Question }
    }
    case 'shortanswer': {
      const acceptedAnswers = respuestas.filter((r) => r.fraccion >= 100).map((r) => r.texto)
      if (acceptedAnswers.length === 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('sin respuesta aceptada') } }
      return { pregunta: { ...base, type: 'short_answer', question: enunciado, acceptedAnswers } as Question }
    }
    case 'numerical': {
      const r = respuestas.find((x) => x.fraccion >= 100)
      const valor = Number(r?.texto.replace(',', '.'))
      if (!r || !Number.isFinite(valor)) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('una numérica sin número') } }
      const tol = Number(textoDe(hijo(r.nodo, 'tolerance')))
      return { pregunta: { ...base, type: 'numeric', question: enunciado, correctAnswer: valor, ...(tol > 0 ? { tolerance: tol } : {}) } as Question }
    }
    case 'matching': {
      // La pregunta es HTML; la respuesta, texto plano.
      const subs = hijos(q, 'subquestion').map((s) => ({ left: limpio(htmlATexto(textoDe(s))), right: limpio(textoDe(hijo(s, 'answer'))) }))
      const pairs = subs.filter((s) => s.left && s.right)
      const distractors = subs.filter((s) => !s.left && s.right).map((s) => s.right)
      return { pregunta: { ...base, type: 'matching', question: enunciado, pairs, ...(distractors.length ? { distractors } : {}) } as Question }
    }
    case 'ordering': {
      const items = [...respuestas].sort((a, b) => a.fraccion - b.fraccion).map((r) => r.texto)
      return { pregunta: { ...base, type: 'ordering', question: enunciado, items } as Question }
    }
    case 'gapselect':
    case 'ddwtos': {
      const etiqueta = tipo === 'gapselect' ? 'selectoption' : 'dragbox'
      // Texto plano en Moodle (no HTML): ya viene decodificado del XML.
      const opciones = hijos(q, etiqueta).map((o) => limpio(textoDe(o)))
      const ps = parrafos(html)
      const conHuecos = ps.findIndex((p) => /\[\[\d+\]\]/.test(p))
      if (conHuecos < 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('un texto sin huecos') } }
      // En Moodle [[n]] es la opción n; en la app, el hueco i tiene su palabra en choices[i-1].
      const refs = [...ps[conHuecos].matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]))
      const correctas = refs.map((n) => opciones[n - 1])
      if (correctas.some((c) => !c)) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('un hueco sin su palabra') } }
      let i = 0
      const text = limpio(ps[conHuecos].replace(/\[\[\d+\]\]/g, () => `[[${++i}]]`))
      const resto = opciones.filter((_, idx) => !refs.includes(idx + 1))
      const consigna = ps.filter((_, idx) => idx !== conHuecos).join('\n') || 'Completá el texto con las palabras que faltan.'
      return { pregunta: { ...base, type: tipo, question: limpio(consigna), text, choices: [...correctas, ...resto] } as Question }
    }
    case 'calculated':
    case 'calculatedsimple': {
      const r = respuestas.find((x) => x.fraccion >= 100)
      const definiciones = hijos(hijo(q, 'dataset_definitions'), 'dataset_definition')
      const variables = definiciones.map((d) => ({
        name: textoDe(hijo(d, 'name')),
        min: Number(textoDe(hijo(d, 'minimum'))),
        max: Number(textoDe(hijo(d, 'maximum'))),
        decimals: Number(textoDe(hijo(d, 'decimals')) || 0),
      }))
      const tol = Number(textoDe(hijo(r?.nodo, 'tolerance'))) || 0.01
      const tipoDeTolerancia = textoDe(hijo(r?.nodo, 'tolerancetype'))
      if (!r || variables.length === 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('una calculada sin fórmula o sin comodines') } }
      // La app usa tolerancia relativa (tolerancetype 1); otra se trae como 1 %.
      // Los valores se sortean ahora (con semilla: el mismo archivo da lo mismo), como al generar.
      const instanciada = instanciarCalculada(
        { ...base, type: 'calculated' as const, question: enunciado, plantilla: enunciado, formula: htmlATexto(r.texto), variables, tolerance: tipoDeTolerancia === '1' ? tol : 0.01 },
        aleatorioConSemilla(`importar:${donde}`),
      )
      if (!instanciada) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.malArmada('una calculada cuya fórmula no da un número') } }
      return { pregunta: instanciada as unknown as Question }
    }
    case 'essay': {
      const rubrica = criteriosDeEnsayo(textoDe(hijo(q, 'graderinfo')), textoDe(hijo(q, 'generalfeedback')))
      if (rubrica.length === 0) return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.ensayo } }
      return { pregunta: { ...base, explanation: sinCriterios(explanation), type: 'essay', question: enunciado, rubrica } as Question }
    }
    case 'multianswer':
      return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.cloze } }
    case 'description':
      return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.descripcion } }
    default:
      return { salteada: { donde, motivo: MOTIVO_DE_SALTEO.desconocido(tipo || 'sin tipo') } }
  }
}

export function importarMoodleXml(xml: string): ResultadoDeImportar {
  const { raiz, problemas } = leerXml(xml.replace(/^﻿/, ''))
  const quiz = raiz?.nombre === 'quiz' ? raiz : raiz?.hijos.find((h) => h.nombre === 'quiz')
  if (!quiz) return { formato: 'xml', preguntas: [], salteadas: [{ donde: 'archivo', motivo: MOTIVO_DE_SALTEO.malArmada(problemas[0] ?? 'no es un archivo Moodle XML') }], categoria: null }
  let categoria: string | null = null
  const preguntas: Question[] = []
  const salteadas: PreguntaSalteada[] = []
  let numero = 0
  for (const q of hijos(quiz, 'question')) {
    if (q.atributos.type === 'category') {
      categoria = textoDe(hijo(q, 'category')).split('/').pop()?.trim() || null
      continue
    }
    numero++
    const { pregunta, salteada } = preguntaXml(q, preguntas.length + 1, categoria ?? 'Importadas')
    if (pregunta) agregar(pregunta, `Q${numero}`, preguntas, salteadas)
    if (salteada) salteadas.push(salteada)
  }
  return { formato: 'xml', preguntas, salteadas, categoria }
}

/** Se suma si está bien armada para la app (los tipos de Moodle, con su validador); si no, se saltea con el motivo. */
function agregar(p: Question, donde: string, preguntas: Question[], salteadas: PreguntaSalteada[]) {
  const problema = problemaDeTipoMoodle(p as unknown as Record<string, unknown>)
  if (!String(p.question ?? '').trim() && p.type !== 'missing_word') {
    salteadas.push({ donde, motivo: MOTIVO_DE_SALTEO.malArmada('sin enunciado') })
    return
  }
  if (problema) {
    salteadas.push({ donde, motivo: MOTIVO_DE_SALTEO.malArmada(problema) })
    return
  }
  preguntas.push({ ...p, id: `q${preguntas.length + 1}` } as Question)
}

/** Detecta el formato por el contenido (XML si empieza con `<`). */
export function importarDeMoodle(contenido: string): ResultadoDeImportar {
  return /^\s*(﻿)?\s*</.test(contenido) ? importarMoodleXml(contenido) : importarGift(contenido)
}
