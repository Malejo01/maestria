import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * P7 · La ficha del docente y Mi progreso del alumno muestran los MISMOS temas
 * "A reforzar" para el mismo alumno, contra la base de STAGING, pasando por
 * las dos rutas de verdad (`/api/quiz/history` y la ficha
 * `/api/teacher/classrooms/[id]/students/[userId]`), con la sesión simulada.
 * Incluye un tema que venía del navegador y se migra en el test.
 *
 * NO ENTRA AL CI (necesita base): se salta salvo que se pida.
 *   PowerShell:  $env:A_REFORZAR_STAGING="1"; npx vitest run tests/a-reforzar-staging.test.ts
 */
const PEDIDO = process.env.A_REFORZAR_STAGING === '1'
const SOFIA = 'stg-demo-sofia'
const GRUPO_LENGUA = 2

const sesion = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: sesion.userId } }) }))
vi.mock('@/lib/auth-session', async (original) => ({
  ...(await original<typeof import('@/lib/auth-session')>()),
  getTeacherViewer: async () => ({ id: sesion.userId, role: 'DOCENTE', isGuest: false, displayName: 'Docente', email: null }),
}))

function urlDeStaging(): string {
  const archivo = join(process.cwd(), '.env.staging.local')
  if (!existsSync(archivo)) throw new Error('Falta .env.staging.local')
  const linea = readFileSync(archivo, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!linea) throw new Error('.env.staging.local no tiene DATABASE_URL')
  return linea.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '')
}

type Sql = (strings: TemplateStringsArray, ...valores: unknown[]) => Promise<Record<string, unknown>[]>

describe.skipIf(!PEDIDO)('P7 · "A reforzar": la ficha y Mi progreso coinciden (staging)', () => {
  let sql: Sql
  let docente = ''
  let materia = ''
  const tema = `P7 test ${Date.now().toString(36)}`

  beforeAll(async () => {
    process.env.DATABASE_URL = urlDeStaging()
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.DATABASE_URL) as unknown as Sql
    const [env] = await sql`SELECT environment FROM deployment_env LIMIT 1`
    expect(env?.environment).toBe('staging')
    const [g] = await sql`SELECT c.teacher_id, p.subject_name FROM classrooms c JOIN teacher_programs p ON p.id = c.teacher_program_id WHERE c.id = ${GRUPO_LENGUA}`
    docente = String(g.teacher_id)
    materia = String(g.subject_name)
    // Lo que el navegador de Sofía tenía guardado: pasa a la base.
    const { migrarDebilesDelNavegador } = await import('@/lib/a-reforzar-alumno-server')
    const migrados = await migrarDebilesDelNavegador(SOFIA, [{ topic: tema, topicName: tema, subject: materia, count: 2 }])
    expect(migrados).toBe(1)
    // Otra vez: ya está en la base, no se duplica.
    expect(await migrarDebilesDelNavegador(SOFIA, [{ topic: tema, topicName: tema, subject: materia, count: 2 }])).toBe(0)
  }, 60_000)

  afterAll(async () => {
    if (sql) await sql`DELETE FROM student_misconceptions WHERE user_id = ${SOFIA} AND topic_name = ${tema}`
  })

  it('los mismos temas, y el que vino del navegador está en los dos', async () => {
    sesion.userId = SOFIA
    const { GET: historial } = await import('@/app/api/quiz/history/route')
    const deMiProgreso = (await (await historial(new Request('http://x/api/quiz/history'))).json()) as { aReforzar: { subject: string; topicName: string }[] }

    sesion.userId = docente
    const { GET: ficha } = await import('@/app/api/teacher/classrooms/[id]/students/[userId]/route')
    const respuesta = await ficha(new Request('http://x'), { params: Promise.resolve({ id: String(GRUPO_LENGUA), userId: SOFIA }) })
    const deLaFicha = (await respuesta.json()) as { aReforzar: { topicName: string }[] }

    const enMiProgreso = deMiProgreso.aReforzar.filter((t) => t.subject === materia).map((t) => t.topicName).sort()
    const enLaFicha = deLaFicha.aReforzar.map((t) => t.topicName).sort()
    expect(enMiProgreso).toEqual(enLaFicha)
    expect(enLaFicha).toContain(tema)
  }, 60_000)
})
