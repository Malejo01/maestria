import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let lazySql: NeonQueryFunction<false, false> | null = null

function connect(): NeonQueryFunction<false, false> {
  if (!lazySql) {
    const url = process.env.DATABASE_URL
    if (!url) {
      console.warn("WARNING: DATABASE_URL is not set. Database queries will fail.")
      throw new Error("No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?")
    }
    lazySql = neon(url)
  }
  return lazySql
}

/**
 * Cliente lazy: la conexión se abre en la primera consulta, no al importar el
 * módulo, así un import en build time no exige DATABASE_URL.
 *
 * El wrapper reenvía además `sql.query(text, params)`, la forma no-template que
 * el driver expone para SQL armado como string (la usa
 * lib/diagnostic-report-server.ts, que comparte una CTE larga entre consultas y
 * no puede pasarla por un tagged template — ahí un `${}` sería un PARÁMETRO, no
 * texto SQL). Antes el wrapper era una función pelada casteada a
 * NeonQueryFunction: `sql.query` tipaba bien y en runtime era undefined.
 */
export const sql = Object.assign(
  (...args: unknown[]) => (connect() as (...params: unknown[]) => unknown)(...args),
  {
    query: (text: string, params?: unknown[]) => connect().query(text, params),
  },
) as NeonQueryFunction<false, false>

// Types for database operations
export interface DbUser {
  id: string
  email: string
  name: string | null
  role: 'ALUMNO' | 'DOCENTE' | null
  created_at: Date
  updated_at: Date
}

export interface DbTopicMastery {
  id: string
  user_id: string
  subject: string
  topic_id: string
  topic_name: string
  max_score: number
  attempts_count: number
  last_attempt_at: Date
}

export interface DbQuizAttempt {
  id: string
  user_id: string
  subject: string
  mode: 'teorico' | 'practico' | 'mixto'
  topics: string[]
  total_questions: number
  correct_answers: number
  score: number
  started_at: Date
  completed_at: Date
}

export interface DbQuizAnswer {
  id: string
  quiz_attempt_id: string
  question_id: string
  question_text: string
  options: string[]
  selected_answer: number
  correct_answer: number
  is_correct: boolean
  explanation: string
  topic_name: string
}

export interface DbTeacherProgram {
  id: number
  user_id: string
  subject_name: string
  icon_name: string
  color_name: string
  pedagogy_profile: unknown
  units: unknown
  source_file_name: string | null
  source_mime_type: string | null
  source_file_size_bytes: number | null
  source_expires_at: Date | null
  nivel: 'Primario' | 'Secundario' | 'Superior' | null
  grado: string | null
  jurisdiccion: string | null
  created_from: 'upload' | 'curriculum' | 'manual'
  status: 'active' | 'archived'
  created_at: Date
  updated_at: Date
}

export interface DbTeacherQuiz {
  id: number
  user_id: string
  teacher_program_id: number
  title: string
  subject_name: string
  mode: 'teorico' | 'practico' | 'mixto'
  status: 'saved' | 'pending_share'
  selected_topics: unknown
  question_count: number
  questions: unknown
  pedagogy_context: string | null
  created_at: Date
  updated_at: Date
}
