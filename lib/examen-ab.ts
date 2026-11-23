/**
 * Ronda W · W4 — El examen impreso con temas A y B.
 *
 * Cualquier tarea se imprime en dos versiones: las preguntas y las opciones
 * barajadas con una semilla (siempre igual para la misma tarea y el mismo
 * tema), con la hoja de respuestas del docente aparte. La calculada trae sus
 * propios números en cada tema (F7). Sin PDF en el servidor: CSS de impresión.
 *
 * Cada tipo sale en papel con su forma: opciones con círculos (o cuadrados en
 * varias correctas), dos columnas para unir, pasos para numerar, el texto con
 * huecos y el banco de palabras, una línea para la palabra faltante.
 *
 * Todo esto es puro.
 */
import { aleatorioConSemilla, instanciarCalculada } from '@/lib/calculada'
import { preguntaImpresa } from '@/lib/diagnostico-impreso'
import { partesDelTexto } from '@/lib/tipos-moodle'

export type Tema = 'A' | 'B'

export type FormaEnPapel =
  | { forma: 'opciones'; opciones: string[]; varias: boolean }
  | { forma: 'verdadero_falso' }
  | { forma: 'unir'; izquierda: string[]; derecha: string[] }
  | { forma: 'ordenar'; pasos: string[] }
  | { forma: 'huecos'; texto: string; banco: string[] }
  | { forma: 'desarrollo' }

export interface PreguntaDelExamen {
  numero: number
  enunciado: string
  papel: FormaEnPapel
  /** Lo correcto, escrito: SÓLO en la hoja del docente. */
  correcta: string
}

/** Baraja con semilla (Fisher–Yates). */
export function barajarConSemilla<T>(items: readonly T[], semilla: string): T[] {
  const azar = aleatorioConSemilla(semilla)
  const salida = [...items]
  for (let i = salida.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[salida[i], salida[j]] = [salida[j], salida[i]]
  }
  return salida
}

const LETRAS = 'ABCDEFGHIJ'
const letra = (i: number) => LETRAS[i] ?? String(i + 1)

/**
 * Una pregunta en la versión de un tema: las opciones barajadas (y la
 * correcta movida con ellas), la calculada con sus números, y su forma en
 * papel. `semilla` distingue la tarea, el tema y la pregunta.
 */
export function preguntaEnTema(cruda: Record<string, unknown>, numero: number, semilla: string): PreguntaDelExamen {
  let q = { ...cruda }
  const tipo = String(q.type)

  if (tipo === 'calculated' && typeof q.formula === 'string' && Array.isArray(q.variables)) {
    const nueva = instanciarCalculada(
      { ...q, question: String(q.plantilla ?? q.question), plantilla: String(q.plantilla ?? q.question) } as never,
      aleatorioConSemilla(`${semilla}:valores`),
    ) as Record<string, unknown> | null
    if (nueva) q = { ...q, ...nueva }
  }

  if ((tipo === 'multiple_choice' || tipo === 'missing_word') && Array.isArray(q.options)) {
    const orden = barajarConSemilla(q.options.map((_, i) => i), `${semilla}:opciones`)
    q = { ...q, options: orden.map((i) => (q.options as string[])[i]), correctAnswer: orden.indexOf(Number(q.correctAnswer)) }
  }
  if (tipo === 'multiple_response' && Array.isArray(q.options)) {
    const orden = barajarConSemilla(q.options.map((_, i) => i), `${semilla}:opciones`)
    const correctas = new Set((q.correctAnswers as number[]) ?? [])
    q = { ...q, options: orden.map((i) => (q.options as string[])[i]), correctAnswers: orden.flatMap((i, nuevo) => (correctas.has(i) ? [nuevo] : [])) }
  }

  const enunciado = String(q.question ?? '')
  const correctaDeJ7 = preguntaImpresa(q, numero - 1).correcta
  switch (tipo) {
    case 'multiple_choice':
      return { numero, enunciado, papel: { forma: 'opciones', opciones: q.options as string[], varias: false }, correcta: correctaDeJ7 }
    case 'multiple_response':
      return { numero, enunciado, papel: { forma: 'opciones', opciones: q.options as string[], varias: true }, correcta: correctaDeJ7 }
    case 'true_false':
      return { numero, enunciado, papel: { forma: 'verdadero_falso' }, correcta: correctaDeJ7 }
    case 'missing_word':
      return {
        numero,
        enunciado: `${enunciado}\n${String(q.text ?? '').replace('[[1]]', '__________')}`,
        papel: { forma: 'opciones', opciones: q.options as string[], varias: false },
        correcta: `${letra(Number(q.correctAnswer))}. ${(q.options as string[])[Number(q.correctAnswer)] ?? ''}`,
      }
    case 'matching': {
      const pares = (q.pairs as { left: string; right: string }[]) ?? []
      const izquierda = barajarConSemilla(pares.map((p) => p.left), `${semilla}:izq`)
      const derecha = barajarConSemilla([...pares.map((p) => p.right), ...((q.distractors as string[]) ?? [])], `${semilla}:der`)
      const correcta = izquierda.map((l, i) => `${i + 1} → ${letra(derecha.indexOf(pares.find((p) => p.left === l)!.right))}`).join(' · ')
      return { numero, enunciado, papel: { forma: 'unir', izquierda, derecha }, correcta }
    }
    case 'ordering': {
      const items = (q.items as string[]) ?? []
      let pasos = barajarConSemilla(items, `${semilla}:pasos`)
      if (pasos.length > 1 && pasos.every((p, i) => p === items[i])) pasos = [...pasos.slice(1), pasos[0]]
      const correcta = items.map((item) => letra(pasos.indexOf(item))).join(' → ')
      return { numero, enunciado, papel: { forma: 'ordenar', pasos }, correcta }
    }
    case 'gapselect':
    case 'ddwtos': {
      const choices = (q.choices as string[]) ?? []
      const huecos = partesDelTexto(String(q.text ?? '')).flatMap((p) => (p.tipo === 'hueco' ? [p.hueco] : []))
      const texto = String(q.text ?? '').replace(/\[\[(\d+)\]\]/g, (_m, n) => `(${n}) __________`)
      return {
        numero,
        enunciado,
        papel: { forma: 'huecos', texto, banco: barajarConSemilla(choices, `${semilla}:banco`) },
        correcta: huecos.map((n) => `(${n}) ${choices[n - 1] ?? ''}`).join(' · '),
      }
    }
    default:
      return { numero, enunciado, papel: { forma: 'desarrollo' }, correcta: correctaDeJ7 }
  }
}

/** La versión de un tema: el orden de las preguntas barajado y cada una en su forma. */
export function versionDelExamen(preguntas: readonly Record<string, unknown>[], tema: Tema, semilla: string): PreguntaDelExamen[] {
  const orden = tema === 'A' ? preguntas.map((_, i) => i) : barajarConSemilla(preguntas.map((_, i) => i), `${semilla}:B:orden`)
  return orden.map((i, n) => preguntaEnTema(preguntas[i], n + 1, `${semilla}:${tema}:${i}`))
}
