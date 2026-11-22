import type { QuestionType } from '@/lib/types'

/**
 * O3 · La práctica dentro de un grupo usa la materia del grupo (decisión de
 * Mauro, 22/11). Antes, `SubjectContent` en `/aulas`:
 *   - no mandaba `carrera`, así que el programa de cátedra no aportaba su
 *     contexto profesional ni su mezcla de tipos;
 *   - tomaba nivel y año del PERFIL del alumno: un alumno del profesorado
 *     registrado como Secundario recibía el prompt de Secundario;
 *   - mandaba siempre `questionTypes` (el selector arranca en opción múltiple),
 *     que le gana a la mezcla sugerida del programa: 100 % opción múltiple.
 *
 * Fuera de un grupo (la práctica libre, el docente armando una tarea) nada cambia.
 */
export interface FuentesDeLaPractica {
  /** El grupo, si la práctica es dentro de uno. */
  classroomId?: number | null
  /** Nivel y año del programa del grupo (`teacher_programs`). */
  programa?: { nivel?: string | null; grado?: string | null; carrera?: string | null } | null
  /** Lo que ya traía el cuestionario en curso o el perfil del alumno. */
  config?: { nivel?: string | null; grado?: string | null } | null
  perfil?: { nivel?: string | null; grado?: string | null } | null
  /** Los tipos del selector, y si el alumno lo tocó. */
  tipos: QuestionType[]
  tocoLosTipos: boolean
}

export interface ParametrosDeLaPractica {
  nivel?: string
  grado?: string
  carrera?: string
  /** Ausente: decide el programa (o el default del servidor). */
  questionTypes?: QuestionType[]
}

const texto = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** El asistente de materias guarda "No aplica" cuando no hay carrera: eso no es una carrera. */
const SIN_CARRERA = /^(no aplica|general|no especificad[oa]|ninguna|-+)$/i
const carreraDe = (v: string | null | undefined) => {
  const c = texto(v)
  return c && !SIN_CARRERA.test(c) ? c : undefined
}

export function parametrosDeLaPractica(f: FuentesDeLaPractica): ParametrosDeLaPractica {
  if (!f.classroomId) {
    return {
      nivel: texto(f.config?.nivel) ?? texto(f.perfil?.nivel),
      grado: texto(f.config?.grado) ?? texto(f.perfil?.grado),
      questionTypes: f.tipos,
    }
  }
  // En un grupo: nivel y año del programa, nunca del perfil. Si el programa no
  // los tiene, no se manda nada y el servidor los saca del contexto pedagógico
  // del programa (`resolveQuizRequest`).
  const nivel = texto(f.programa?.nivel)
  return {
    nivel,
    grado: nivel ? texto(f.programa?.grado) : undefined,
    carrera: carreraDe(f.programa?.carrera),
    ...(f.tocoLosTipos ? { questionTypes: f.tipos } : {}),
  }
}
