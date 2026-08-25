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

/**
 * Acá vivían seis interfaces `Db*` (users, topic_mastery, quiz_attempts,
 * quiz_answers, teacher_programs, teacher_quizzes). Se borraron el 25/08/2026:
 * no las importaba nadie y varias estaban desalineadas con el schema real
 * (`DbTopicMastery.max_score` no existe — la columna es `highest_score`;
 * `DbQuizAttempt` tipaba `id: string` contra un SERIAL, `score: number` cuando
 * el driver devuelve los DECIMAL como string, y no conocía `incorrect_answers`,
 * `passed` ni las columnas de aulas). Tipos equivocados sin uso son peores que
 * ninguno: esperan que alguien los adopte de buena fe.
 *
 * La convención del repo es otra (ver deuda-tecnica.md §3a): cada query declara
 * una interfaz con las columnas que realmente selecciona, junto al call site y
 * con un comentario que apunta al `.sql` del DDL.
 */
