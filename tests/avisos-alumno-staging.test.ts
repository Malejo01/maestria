import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * P3 · Cada fuente de aviso del alumno, contra la base de STAGING, con datos
 * armados en el test (y borrados al final), y los permisos: un alumno no ve
 * avisos de otro ni de grupos ajenos.
 *
 * Arma, en el grupo Lengua de Irina (staging):
 *   - dos invitados, A y B, miembros del grupo;
 *   - una tarea del grupo que vence en 5 h (A: "Vence en 4 h", no "Tarea nueva");
 *   - una tarea individual de B (A no la ve; B, "Tarea nueva");
 *   - un diagnóstico individual de A ("Diagnóstico nuevo");
 *   - una tarea en OTRO grupo de Irina, donde A no está (no la ve nadie);
 *   - un reporte de A resuelto con mensaje; un tema de A superado; la racha
 *     de A con su último intento ayer.
 *
 * NO ENTRA AL CI (necesita base): se salta salvo que se pida.
 *   PowerShell:  $env:AVISOS_STAGING="1"; npx vitest run tests/avisos-alumno-staging.test.ts
 * Sólo contra una base marcada `staging` (deployment_env); con la 035 corrida.
 */
const PEDIDO = process.env.AVISOS_STAGING === '1'
const GRUPO_LENGUA = 2

function urlDeStaging(): string {
  const archivo = join(process.cwd(), '.env.staging.local')
  if (!existsSync(archivo)) throw new Error('Falta .env.staging.local')
  const linea = readFileSync(archivo, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!linea) throw new Error('.env.staging.local no tiene DATABASE_URL')
  return linea.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '')
}

type Sql = (strings: TemplateStringsArray, ...valores: unknown[]) => Promise<Record<string, unknown>[]>

describe.skipIf(!PEDIDO)('P3 · avisos del alumno contra staging', () => {
  const marca = `p3t${Date.now().toString(36)}`
  const A = `guest_${marca}a`
  const B = `guest_${marca}b`
  let sql: Sql
  let avisosDelAlumno: typeof import('@/lib/avisos-alumno-server').avisosDelAlumno
  const creados = { quizzes: [] as number[], asignaciones: [] as number[], diagnosticos: [] as number[], reportes: [] as number[] }
  let ids = { grupal: 0, deB: 0, diag: 0, ajena: 0, reporte: 0, tema: 0 }

  beforeAll(async () => {
    process.env.DATABASE_URL = urlDeStaging()
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.DATABASE_URL) as unknown as Sql
    const [env] = await sql`SELECT environment FROM deployment_env LIMIT 1`
    expect(env?.environment, 'sólo contra una base marcada staging').toBe('staging')
    ;({ avisosDelAlumno } = await import('@/lib/avisos-alumno-server'))

    const [grupo] = await sql`SELECT teacher_id, teacher_program_id FROM classrooms WHERE id = ${GRUPO_LENGUA}`
    const docente = String(grupo.teacher_id)
    const programa = Number(grupo.teacher_program_id)
    const [otro] = await sql`SELECT id FROM classrooms WHERE teacher_id = ${docente} AND id <> ${GRUPO_LENGUA} AND status = 'open' ORDER BY id LIMIT 1`

    for (const [id, nombre] of [[A, 'P3 Test A'], [B, 'P3 Test B']]) {
      await sql`INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at) VALUES (${id}, NULL, ${nombre}, 'ALUMNO', true, true, NOW(), NOW())`
      await sql`INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at) VALUES (${GRUPO_LENGUA}, ${id}, ${nombre}, false, 'active', NOW(), NOW())`
    }

    const cuestionario = async (titulo: string, extra: { tipo?: string; diagnosticoId?: number } = {}) => {
      const [q] = await sql`
        INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, tipo, diagnostico_id)
        VALUES (${docente}, ${programa}, ${titulo}, 'Lengua', 'practico', 'saved', '[]'::jsonb, 1, '[]'::jsonb, ${extra.tipo ?? 'tarea'}, ${extra.diagnosticoId ?? null})
        RETURNING id`
      creados.quizzes.push(Number(q.id))
      return Number(q.id)
    }
    const asignar = async (grupoId: number, quizId: number, extra: { venceEnHoras?: number; soloUserId?: string } = {}) => {
      const [a] = await sql`
        INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, due_at, solo_user_id)
        VALUES (${grupoId}, ${quizId}, ${extra.venceEnHoras ? new Date(Date.now() + extra.venceEnHoras * 3_600_000).toISOString() : null}, ${extra.soloUserId ?? null})
        RETURNING id`
      creados.asignaciones.push(Number(a.id))
      return Number(a.id)
    }

    ids.grupal = await asignar(GRUPO_LENGUA, await cuestionario(`${marca} grupal`), { venceEnHoras: 5 })
    ids.deB = await asignar(GRUPO_LENGUA, await cuestionario(`${marca} de B`), { soloUserId: B })
    if (otro) ids.ajena = await asignar(Number(otro.id), await cuestionario(`${marca} ajena`))

    const [d] = await sql`INSERT INTO diagnosticos (teacher_id, classroom_id, teacher_program_id, modo) VALUES (${docente}, ${GRUPO_LENGUA}, ${programa}, 'integral') RETURNING id`
    creados.diagnosticos.push(Number(d.id))
    ids.diag = await asignar(GRUPO_LENGUA, await cuestionario(`${marca} diagnóstico`, { tipo: 'diagnostico', diagnosticoId: Number(d.id) }), { soloUserId: A })

    const [r] = await sql`
      INSERT INTO feedback_reports (user_id, is_guest, role, description, status, resuelto_el, respuesta, respondido_por)
      VALUES (${A}, true, 'ALUMNO', ${`${marca}: la opción C está repetida`}, 'resuelto', NOW(), 'Gracias, ya lo corregí.', 'Irina')
      RETURNING id`
    creados.reportes.push(Number(r.id))
    ids.reporte = Number(r.id)

    const [t] = await sql`
      INSERT INTO student_misconceptions (user_id, subject, topic_id, topic_name, misconception_type, tip, resolved, resolved_at, resolved_by)
      VALUES (${A}, 'Lengua', 'p3-tema', 'Clases de palabras', 'concepto', '-', TRUE, NOW(), 'auto')
      RETURNING id`
    ids.tema = Number(t.id)

    await sql`INSERT INTO rachas_alumno (user_id, racha, mejor) VALUES (${A}, 3, 3)`
    await sql`
      INSERT INTO quiz_attempts (user_id, subject, mode, topics, total_questions, correct_answers, incorrect_answers, score, passed, completed_at)
      VALUES (${A}, 'Lengua', 'practico', ARRAY['Clases de palabras'], 1, 1, 0, 10, true, NOW() - INTERVAL '1 day')`
  }, 60_000)

  afterAll(async () => {
    if (!sql) return
    if (creados.asignaciones.length) await sql`DELETE FROM classroom_assignments WHERE id = ANY(${creados.asignaciones}::int[])`
    if (creados.reportes.length) await sql`DELETE FROM feedback_reports WHERE id = ANY(${creados.reportes}::int[])`
    if (creados.quizzes.length) await sql`DELETE FROM teacher_quizzes WHERE id = ANY(${creados.quizzes}::int[])`
    if (creados.diagnosticos.length) await sql`DELETE FROM diagnosticos WHERE id = ANY(${creados.diagnosticos}::int[])`
    await sql`DELETE FROM users WHERE id IN (${A}, ${B})`
  }, 60_000)

  it('A: vence pronto (no se repite como nueva), diagnóstico, reporte resuelto y tema superado', async () => {
    const { avisos, puedeMarcar } = await avisosDelAlumno(A, { esInvitado: true })
    expect(puedeMarcar).toBe(true)
    const por = (tipo: string) => avisos.filter((a) => a.tipo === tipo)
    expect(por('vencePronto').map((a) => [a.titulo, a.href])).toEqual([['Vence en 4 h', `/aulas?tarea=${ids.grupal}`]])
    expect(por('tareaNueva').map((a) => a.href)).not.toContain(`/aulas?tarea=${ids.grupal}`)
    // Los diagnósticos del grupo entero que ya había en staging también le llegan: se mira el del test.
    expect(por('diagnosticoNuevo').map((a) => a.href)).toContain(`/aulas?tarea=${ids.diag}`)
    expect(por('reporteResuelto').map((a) => [a.detalle, a.href])).toEqual([['Irina te dejó un mensaje', `/reportes/${ids.reporte}`]])
    expect(por('temaSuperado').map((a) => a.detalle)).toEqual(['Clases de palabras · pasó a "Ya lo dominás"'])
    expect(avisos.every((a) => a.noLeido)).toBe(true)
  })

  it('racha en riesgo: con racha, último intento ayer, a las 21 h; el invitado va a sus tareas', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
    const aLas21 = new Date(`${hoy}T21:00:00-03:00`)
    const { avisos } = await avisosDelAlumno(A, { esInvitado: true }, aLas21)
    const racha = avisos.filter((a) => a.tipo === 'rachaEnRiesgo')
    expect(racha.map((a) => [a.titulo, a.href])).toEqual([['Tu racha de 3 aprobados está en riesgo', '/aulas']])
  })

  it('permisos: A no ve la tarea individual de B ni la de un grupo ajeno; B no ve nada de A', async () => {
    const deA = (await avisosDelAlumno(A, { esInvitado: true })).avisos.map((a) => a.href)
    expect(deA).not.toContain(`/aulas?tarea=${ids.deB}`)
    if (ids.ajena) expect(deA).not.toContain(`/aulas?tarea=${ids.ajena}`)

    const deB = (await avisosDelAlumno(B, { esInvitado: true })).avisos
    expect(deB.filter((a) => a.tipo === 'tareaNueva').map((a) => a.href)).toContain(`/aulas?tarea=${ids.deB}`)
    expect(deB.map((a) => a.href)).not.toContain(`/aulas?tarea=${ids.diag}`)
    expect(deB.filter((a) => ['reporteResuelto', 'temaSuperado', 'rachaEnRiesgo'].includes(a.tipo))).toEqual([])
    if (ids.ajena) expect(deB.map((a) => a.href)).not.toContain(`/aulas?tarea=${ids.ajena}`)
  })

  it('marcar todo como leído: sólo para quien lo marca', async () => {
    const { marcarAvisosDelAlumnoLeidos } = await import('@/lib/avisos-alumno-server')
    await marcarAvisosDelAlumnoLeidos(A)
    expect((await avisosDelAlumno(A, { esInvitado: true })).avisos.filter((a) => a.noLeido)).toEqual([])
    expect((await avisosDelAlumno(B, { esInvitado: true })).avisos.some((a) => a.noLeido)).toBe(true)
  })
})
