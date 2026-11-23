/**
 * Ronda W · W1 — El banco de preguntas del docente: todas las preguntas de
 * sus cuestionarios, para buscarlas por texto, materia, unidad, tema, tipo y
 * valoración (los pulgares de O8), y sumarlas a una tarea nueva.
 *
 * Sale de `teacher_quizzes.questions`: no hace falta migración. La misma
 * pregunta repetida en varios cuestionarios aparece una vez (la más nueva).
 *
 * Todo esto es puro.
 */
import { contenidoParaComparar, normalizeQuestionText } from '@/lib/question-dedup'
import type { QuestionType } from '@/lib/types'

export type Valoracion = 'arriba' | 'abajo' | 'sin'

/** Una fila cruda: una pregunta de un cuestionario, con su materia y su pulgar. */
export interface FilaDelBanco {
  quizId: number
  indice: number
  titulo: string
  materiaId: number | null
  materia: string
  creadoEl: string
  pregunta: Record<string, unknown>
  /** 1, -1 o null. */
  valor: number | null
}

export interface PreguntaDelBanco {
  /** "quizId:indice": de dónde sale. */
  clave: string
  quizId: number
  indice: number
  cuestionario: string
  materiaId: number | null
  materia: string
  unidad: string | null
  tema: string
  tipo: QuestionType
  valoracion: Valoracion
  creadoEl: string
  pregunta: Record<string, unknown>
}

export interface FiltrosDelBanco {
  texto?: string
  materiaId?: number | null
  unidad?: string | null
  tema?: string | null
  tipo?: QuestionType | null
  valoracion?: Valoracion | null
}

/** Las unidades de cada materia: id o nombre del tema → nombre de la unidad. */
export type UnidadesPorMateria = Map<number, Map<string, string>>

export function unidadesDelPrograma(units: unknown): Map<string, string> {
  const mapa = new Map<string, string>()
  if (!Array.isArray(units)) return mapa
  for (const u of units as { name?: unknown; topics?: { id?: unknown; name?: unknown }[] }[]) {
    const unidad = typeof u?.name === 'string' ? u.name : null
    if (!unidad || !Array.isArray(u.topics)) continue
    for (const t of u.topics) {
      if (typeof t?.id === 'string') mapa.set(t.id, unidad)
      if (typeof t?.name === 'string') mapa.set(t.name, unidad)
    }
  }
  return mapa
}

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** El banco: sin repetidas (la más nueva gana), filtrado y de lo más nuevo a lo más viejo. */
export function armarBanco(filas: readonly FilaDelBanco[], unidades: UnidadesPorMateria, filtros: FiltrosDelBanco = {}): PreguntaDelBanco[] {
  const vistas = new Set<string>()
  const salida: PreguntaDelBanco[] = []
  const ordenadas = [...filas].sort((a, b) => (a.creadoEl < b.creadoEl ? 1 : a.creadoEl > b.creadoEl ? -1 : a.indice - b.indice))
  const buscado = filtros.texto ? sinTildes(filtros.texto.trim()) : ''
  for (const f of ordenadas) {
    const p = f.pregunta
    if (typeof p?.question !== 'string' || typeof p.type !== 'string') continue
    const huella = normalizeQuestionText(contenidoParaComparar(p as never))
    if (!huella || vistas.has(huella)) continue
    vistas.add(huella)
    const tema = typeof p.topicName === 'string' ? p.topicName : ''
    const deLaMateria = f.materiaId !== null ? unidades.get(f.materiaId) : undefined
    const unidad = deLaMateria?.get(String(p.topic ?? '')) ?? deLaMateria?.get(tema) ?? null
    const valoracion: Valoracion = f.valor === 1 ? 'arriba' : f.valor === -1 ? 'abajo' : 'sin'
    const item: PreguntaDelBanco = {
      clave: `${f.quizId}:${f.indice}`,
      quizId: f.quizId,
      indice: f.indice,
      cuestionario: f.titulo,
      materiaId: f.materiaId,
      materia: f.materia,
      unidad,
      tema,
      tipo: p.type as QuestionType,
      valoracion,
      creadoEl: f.creadoEl,
      pregunta: p,
    }
    if (filtros.materiaId && item.materiaId !== filtros.materiaId) continue
    if (filtros.unidad && item.unidad !== filtros.unidad) continue
    if (filtros.tema && item.tema !== filtros.tema) continue
    if (filtros.tipo && item.tipo !== filtros.tipo) continue
    if (filtros.valoracion && item.valoracion !== filtros.valoracion) continue
    if (buscado && !sinTildes(contenidoParaComparar(p as never)).includes(buscado)) continue
    salida.push(item)
  }
  return salida
}

/** Lo que se puede elegir en cada filtro, con lo que hay en el banco (sin filtrar). */
export function facetasDelBanco(banco: readonly PreguntaDelBanco[]) {
  const unicos = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null && x !== ''))]
  return {
    materias: [...new Map(banco.filter((b) => b.materiaId !== null).map((b) => [b.materiaId as number, b.materia])).entries()].map(([id, nombre]) => ({ id, nombre })),
    unidades: unicos(banco.map((b) => b.unidad)).sort((a, b) => a.localeCompare(b, 'es')),
    temas: unicos(banco.map((b) => b.tema)).sort((a, b) => a.localeCompare(b, 'es')),
    tipos: unicos(banco.map((b) => b.tipo)),
  }
}

/**
 * Lo que se manda a la tarea: las preguntas elegidas del banco, con un id
 * nuevo, y cuántas tiene que completar la IA.
 */
export function sumarDelBanco<T extends { id?: unknown }>(elegidas: readonly Record<string, unknown>[], generadas: readonly T[]): (Record<string, unknown> | T)[] {
  return [...elegidas, ...generadas].map((q, i) => ({ ...q, id: `q${i + 1}` }))
}

export function cuantasGenerar(total: number, delBanco: number): number {
  return Math.max(0, total - delBanco)
}
