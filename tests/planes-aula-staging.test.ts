import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * B1 · El plan Aula contra la base de STAGING, con datos armados en el test
 * (y borrados al final): una docente Aula con 1 curso; el curso se llena y el
 * alumno siguiente ve "Este curso está completo"; no puede abrir otro grupo ni
 * usar las funciones individuales (sumar un alumno particular, la ficha, el
 * diagnóstico de un alumno).
 *
 * El tope de 35 se baja a 2 sólo para el test (MAESTRIA_AULA_ALUMNOS_POR_CURSO):
 * la regla es la misma, sin crear 36 alumnos.
 *
 * NO ENTRA AL CI (necesita base): se salta salvo que se pida.
 *   PowerShell:  $env:AULA_STAGING="1"; npx vitest run tests/planes-aula-staging.test.ts
 * Sólo contra una base marcada `staging`, con la 037 corrida.
 */
const PEDIDO = process.env.AULA_STAGING === '1'

function urlDeStaging(): string {
  const archivo = join(process.cwd(), '.env.staging.local')
  if (!existsSync(archivo)) throw new Error('Falta .env.staging.local')
  const linea = readFileSync(archivo, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!linea) throw new Error('.env.staging.local no tiene DATABASE_URL')
  return linea.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '')
}

type Sql = (strings: TemplateStringsArray, ...valores: unknown[]) => Promise<Record<string, unknown>[]>

describe.skipIf(!PEDIDO)('B1 · plan Aula contra staging', () => {
  const marca = `b1t${Date.now().toString(36)}`
  const DOCENTE = `stg-${marca}-docente`
  const ALUMNOS = [`guest_${marca}a`, `guest_${marca}b`]
  let sql: Sql
  let planes: typeof import('@/lib/planes-server')
  let grupoId = 0
  let programaId = 0

  beforeAll(async () => {
    process.env.DATABASE_URL = urlDeStaging()
    process.env.MAESTRIA_AULA_ALUMNOS_POR_CURSO = '2'
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.DATABASE_URL) as unknown as Sql
    const [env] = await sql`SELECT environment FROM deployment_env LIMIT 1`
    expect(env?.environment, 'sólo contra una base marcada staging').toBe('staging')
    planes = await import('@/lib/planes-server')

    await sql`
      INSERT INTO users (id, email, name, role, is_onboarded, is_guest, plan_nivel, plan_vence_el, plan_tipo, aula_cursos, created_at, updated_at)
      VALUES (${DOCENTE}, NULL, 'Docente Aula (test B1)', 'DOCENTE', true, false, 1, NOW() + INTERVAL '30 days', 'aula', 1, NOW(), NOW())`
    const [p] = await sql`
      INSERT INTO teacher_programs (user_id, subject_name, pedagogy_profile, units, status)
      VALUES (${DOCENTE}, 'Test B1', '{}'::jsonb, '[]'::jsonb, 'active') RETURNING id`
    programaId = Number(p.id)
    const [g] = await sql`
      INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status)
      VALUES (${DOCENTE}, ${programaId}, 'Curso B1', ${marca.slice(-8).toUpperCase()}, 'open') RETURNING id`
    grupoId = Number(g.id)
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM classroom_members WHERE classroom_id = ${grupoId}`
    await sql`DELETE FROM classrooms WHERE teacher_id = ${DOCENTE}`
    await sql`DELETE FROM teacher_programs WHERE user_id = ${DOCENTE}`
    for (const id of ALUMNOS) await sql`DELETE FROM users WHERE id = ${id}`
    await sql`DELETE FROM users WHERE id = ${DOCENTE}`
  })

  it('el plan se lee como Aula, 1 curso, sin funciones individuales', async () => {
    const resumen = await planes.resumenDelPlan(DOCENTE, null)
    expect(resumen).toMatchObject({ estado: 'activo', tipo: 'aula', aulaCursos: 1, permiteIndividual: false, alumnosPorCurso: 2 })
  })

  it('entran los del curso hasta el tope; el siguiente ve "Este curso está completo"', async () => {
    for (const [i, id] of ALUMNOS.entries()) {
      expect(await planes.motivoSinLugarEnElGrupo({ teacherId: DOCENTE, classroomId: grupoId, userId: null, nombre: `Alumno ${i}` })).toBeNull()
      await sql`INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at) VALUES (${id}, NULL, ${`Alumno ${i}`}, 'ALUMNO', true, true, NOW(), NOW())`
      await sql`INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at) VALUES (${grupoId}, ${id}, ${`Alumno ${i}`}, false, 'active', NOW(), NOW())`
    }
    expect(await planes.motivoSinLugarEnElGrupo({ teacherId: DOCENTE, classroomId: grupoId, userId: null, nombre: 'El tercero' })).toBe('curso_completo')
    // Quien ya está, sigue entrando.
    expect(await planes.motivoSinLugarEnElGrupo({ teacherId: DOCENTE, classroomId: grupoId, userId: ALUMNOS[0], nombre: 'Alumno 0' })).toBeNull()
  })

  it('no puede abrir un segundo grupo, ni sumar un particular, ni usar la ficha o el diagnóstico individual', async () => {
    const motivo = async (res: Response | null) => (res ? ((await res.json()) as { plan: { motivo: string } }).plan.motivo : null)
    expect(await motivo(await planes.bloqueoParaCrearGrupo(DOCENTE, null))).toBe('sin_cursos')
    expect(await motivo(await planes.bloqueoParaSumarAlumno(DOCENTE, null))).toBe('solo_particular')
    expect(await motivo(await planes.bloqueoIndividual(DOCENTE, null))).toBe('solo_particular')
  })
})
