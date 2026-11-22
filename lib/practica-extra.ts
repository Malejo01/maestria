/**
 * P4 · "Practicar otra vez con preguntas nuevas" al terminar una tarea
 * (decisión 1 de la ronda O). Puro: el estado del botón, el tope y la
 * configuración de la práctica sacada de la tarea. Lo que toca la base está
 * en lib/practica-extra-server.ts.
 *
 * La práctica extra NO es un intento de la tarea: no cambia la nota ni el
 * conteo de intentos. Se guarda como práctica del grupo (assignment_id NULL,
 * classroom_id del grupo, `practica_extra_id`) y el docente la ve aparte.
 */
import type { QuestionType } from '@/lib/types'

/** Los tipos del motor (la lista de lib/quiz-generation.ts; ése no se importa acá porque arrastra la IA al navegador). */
const TIPOS: readonly QuestionType[] = ['multiple_choice', 'short_answer', 'true_false', 'numeric']

/** Por alumno, por tarea y por día (de Argentina). */
export const TOPE_PRACTICAS_EXTRA = 3

export type MotivoSinPracticaExtra = 'sinMigracion' | 'noEsTuya' | 'diagnostico' | 'planVencido' | 'tope' | 'topeMes'

export interface EstadoDePracticaExtra {
  disponible: boolean
  motivo: MotivoSinPracticaExtra | null
  restantes: number
}

/**
 * Si el botón aparece. Con el plan del docente vencido o sin la 036, no
 * aparece. Con el tope alcanzado, en lugar del botón va el texto del tope.
 * Un diagnóstico no se practica: se rinde sin devolución (J5).
 */
export function estadoDePracticaExtra(e: {
  hayMigracion: boolean
  esDelAlumno: boolean
  esDiagnostico: boolean
  planVencido: boolean
  hechasHoy: number
  /** B1 (ronda T): en el plan Aula, 10 por alumno en los últimos 30 días. */
  delMes?: { hechas: number; tope: number } | null
}): EstadoDePracticaExtra {
  const restantes = Math.max(0, TOPE_PRACTICAS_EXTRA - e.hechasHoy)
  const no = (motivo: MotivoSinPracticaExtra) => ({ disponible: false, motivo, restantes })
  if (!e.hayMigracion) return no('sinMigracion')
  if (!e.esDelAlumno) return no('noEsTuya')
  if (e.esDiagnostico) return no('diagnostico')
  if (e.planVencido) return no('planVencido')
  if (restantes === 0) return no('tope')
  if (e.delMes && e.delMes.hechas >= e.delMes.tope) return no('topeMes')
  return { disponible: true, motivo: null, restantes }
}

/** El botón se muestra (habilitado o con el texto del tope) sólo en estos casos. */
export const muestraLaPracticaExtra = (estado: EstadoDePracticaExtra | null) =>
  Boolean(estado && (estado.disponible || estado.motivo === 'tope' || estado.motivo === 'topeMes'))

export interface TareaGuardada {
  subjectName: string
  mode: string
  questionCount: number
  selectedTopics: unknown
  questions: unknown
  pedagogyContext: string | null
}

export interface ProgramaDelGrupo {
  id: number
  nivel: string | null
  grado: string | null
  carrera: string | null
}

export interface ConfigDePracticaExtra {
  subject: string
  subjectName: string
  topics: { id: string; name: string }[]
  mode: 'teorico' | 'practico' | 'mixto'
  questionCount: number
  questionTypes: QuestionType[]
  nivel?: string
  grado?: string
  carrera?: string
  pedagogyContext?: string
  teacherProgramId: number
}

const texto = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const SIN_CARRERA = /^(no aplica|general|no especificad[oa]|ninguna|-+)$/i

/** Los temas de la tarea, tal como los eligió el docente. */
export function temasDeLaTarea(selectedTopics: unknown): { id: string; name: string }[] {
  if (!Array.isArray(selectedTopics)) return []
  return selectedTopics
    .map((t) => (typeof t === 'string' ? { id: t, name: t } : { id: String((t as { id?: unknown })?.id ?? ''), name: String((t as { name?: unknown })?.name ?? '') }))
    .filter((t) => t.name.trim() !== '')
    .map((t) => ({ id: t.id || t.name, name: t.name }))
}

/** Los tipos de pregunta que tiene la tarea (sin tipo = opción múltiple, lo de antes de la 013). */
export function tiposDeLaTarea(questions: unknown): QuestionType[] {
  if (!Array.isArray(questions)) return ['multiple_choice']
  const tipos = new Set<QuestionType>()
  for (const q of questions) {
    const tipo = (q as { type?: unknown })?.type
    tipos.add(TIPOS.includes(tipo as QuestionType) ? (tipo as QuestionType) : 'multiple_choice')
  }
  return tipos.size > 0 ? [...tipos] : ['multiple_choice']
}

/**
 * La misma configuración que la tarea: temas, nivel, modo, tipos, cantidad y
 * la materia del grupo (O3: nivel, año y carrera del programa del grupo, no
 * del perfil del alumno).
 */
export function configDeLaTarea(tarea: TareaGuardada, programa: ProgramaDelGrupo): ConfigDePracticaExtra {
  const cantidad = Array.isArray(tarea.questions) && tarea.questions.length > 0 ? tarea.questions.length : tarea.questionCount
  const modo = ['teorico', 'practico', 'mixto'].includes(tarea.mode) ? (tarea.mode as ConfigDePracticaExtra['mode']) : 'practico'
  const nivel = texto(programa.nivel)
  const carrera = texto(programa.carrera)
  return {
    subject: tarea.subjectName,
    subjectName: tarea.subjectName,
    topics: temasDeLaTarea(tarea.selectedTopics),
    mode: modo,
    questionCount: Math.min(50, Math.max(1, cantidad || 5)),
    questionTypes: tiposDeLaTarea(tarea.questions),
    ...(nivel ? { nivel } : {}),
    ...(nivel && texto(programa.grado) ? { grado: texto(programa.grado) } : {}),
    ...(carrera && !SIN_CARRERA.test(carrera) ? { carrera } : {}),
    ...(texto(tarea.pedagogyContext) ? { pedagogyContext: texto(tarea.pedagogyContext) } : {}),
    teacherProgramId: programa.id,
  }
}

/** Las consignas de la tarea, para no repetirlas (las usa la dedup del generador). */
export function consignasDe(questions: unknown): { question: string }[] {
  if (!Array.isArray(questions)) return []
  return questions
    .map((q) => String((q as { question?: unknown })?.question ?? '').trim())
    .filter(Boolean)
    .map((question) => ({ question }))
}

/** "Prácticas extra" en el informe y la ficha: cuántas y el promedio (sobre 10). */
export function resumenDePracticasExtra(notas: readonly number[]): { cantidad: number; promedio: number | null } {
  if (notas.length === 0) return { cantidad: 0, promedio: null }
  const suma = notas.reduce((a, b) => a + b, 0)
  return { cantidad: notas.length, promedio: Math.round((suma / notas.length) * 10) / 10 }
}
