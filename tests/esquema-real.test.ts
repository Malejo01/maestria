import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { describe, expect, it } from 'vitest'
import { buildSchemaModelFromDir } from '../scripts/lib/schema-model'

/**
 * O15 · Lo que el código da por cierto sobre la base, contra la base real.
 *
 * Los tipos `Db*` de lib/db.ts se borraron el 25/08 (estaban desalineados y no
 * los usaba nadie); la convención es una interfaz por consulta, junto a la
 * consulta. Lo que sí tiene que coincidir con la base es lo que esas
 * consultas nombran. Este test lo compara contra `information_schema` de
 * STAGING:
 *   1. cada tabla y cada columna agregada por las migraciones del repo existe;
 *   2. las columnas que nombran las consultas de la app (la lista de abajo,
 *      mantenida a mano junto con cada migración nueva) existen en su tabla.
 *
 * NO ENTRA AL CI (necesita base): se salta salvo que se pida.
 *   PowerShell:  $env:ESQUEMA_REAL="1"; npx vitest run tests/esquema-real.test.ts
 * Sólo lee, y sólo una base marcada `staging` (deployment_env).
 */
const PEDIDO = process.env.ESQUEMA_REAL === '1'

/** Las columnas que nombran las consultas de la app, por tabla (las de la ronda O incluidas). */
export const COLUMNAS_QUE_USA_EL_CODIGO: Record<string, string[]> = {
  users: ['id', 'email', 'name', 'role', 'is_guest', 'claimed_by_user_id', 'nivel', 'grado', 'created_at', 'avisos_docente_visto_el'],
  quiz_attempts: ['id', 'user_id', 'subject', 'mode', 'topics', 'score', 'passed', 'started_at', 'completed_at', 'classroom_id', 'assignment_id', 'attempt_number', 'client_attempt_id'],
  quiz_answers: ['id', 'quiz_attempt_id', 'question_index', 'topic_name', 'question_text', 'is_correct', 'question_type', 'answer_payload'],
  student_misconceptions: ['id', 'user_id', 'subject', 'topic_id', 'topic_name', 'resolved', 'resolved_at', 'resolved_by', 'created_at'],
  feedback_reports: ['id', 'user_id', 'status', 'description', 'teacher_quiz_id', 'classroom_id', 'question_index', 'respuesta', 'respondido_por', 'resuelto_el', 'aviso_visto_el'],
  teacher_quizzes: ['id', 'user_id', 'teacher_program_id', 'title', 'questions', 'tipo', 'diagnostico_id'],
  teacher_programs: ['id', 'user_id', 'subject_name', 'units', 'pedagogy_profile', 'nivel', 'grado'],
  classrooms: ['id', 'teacher_id', 'teacher_program_id', 'name', 'join_code', 'status'],
  classroom_members: ['id', 'classroom_id', 'user_id', 'display_name', 'is_verified', 'status', 'joined_at'],
  classroom_assignments: ['id', 'classroom_id', 'teacher_quiz_id', 'opens_at', 'due_at', 'max_attempts', 'created_at'],
  rachas_alumno: ['user_id', 'racha', 'mejor', 'migrada_de_local', 'actualizada_el'],
  avisos_lectura: ['user_id', 'visto_el'],
  pregunta_valoraciones: ['docente_id', 'teacher_quiz_id', 'teacher_program_id', 'indice', 'valor', 'motivo', 'enunciado', 'creado_el'],
  curriculum: ['id', 'nivel', 'materia', 'grado', 'eje', 'temas', 'carrera', 'contexto_profesional', 'tipos_pregunta_sugeridos'],
}

function urlDeStaging(): string {
  const archivo = join(process.cwd(), '.env.staging.local')
  if (!existsSync(archivo)) throw new Error('Falta .env.staging.local')
  const linea = readFileSync(archivo, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!linea) throw new Error('.env.staging.local no tiene DATABASE_URL')
  return linea.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '')
}

describe.skipIf(!PEDIDO)('O15 · el esquema que usa el código, contra staging', () => {
  it('es staging, y existe todo lo que declaran las migraciones y nombran las consultas', async () => {
    const sql = neon(urlDeStaging())
    const [marca] = (await sql`SELECT environment FROM deployment_env LIMIT 1`) as { environment: string }[]
    expect(marca?.environment, 'sólo contra una base marcada staging').toBe('staging')

    const filas = (await sql`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `) as { table_name: string; column_name: string }[]
    const real = new Map<string, Set<string>>()
    for (const f of filas) real.set(f.table_name, (real.get(f.table_name) ?? new Set()).add(f.column_name))

    const faltan: string[] = []
    for (const tabla of buildSchemaModelFromDir(join(process.cwd(), 'scripts')).values()) {
      if (!real.has(tabla.name)) faltan.push(`tabla ${tabla.name} (${tabla.migration})`)
      for (const [columna, migracion] of tabla.columns) {
        if (!real.get(tabla.name)?.has(columna)) faltan.push(`${tabla.name}.${columna} (${migracion})`)
      }
    }
    for (const [tabla, columnas] of Object.entries(COLUMNAS_QUE_USA_EL_CODIGO)) {
      for (const columna of columnas) if (!real.get(tabla)?.has(columna)) faltan.push(`${tabla}.${columna} (la nombra el código)`)
    }
    expect(faltan).toEqual([])
  })
})
