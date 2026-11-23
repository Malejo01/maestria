import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, capturarSinRecargar, entrarComo, GRUPO_LENGUA, marca, preguntasSimuladas, sqlDeStaging } from './ayudas'

/**
 * Ronda X · X1 — La pista antes de responder:
 *   1. en la práctica del día del autodidacta aparece "Pedir una pista" y la
 *      pista se ve (la ruta, simulada: no gasta);
 *   2. en una tarea del aula no hay botón;
 *   3. la ruta real rechaza un pedido con contexto de tarea (403), sin gastar.
 */
async function practicaDelDia(page: Page) {
  const sql = await sqlDeStaging()
  const [materia] = (await sql`
    SELECT id FROM teacher_programs
    WHERE user_id = 'stg-demo-sofia' AND personal = TRUE AND status = 'active' AND pase_hasta >= CURRENT_DATE
      AND EXISTS (SELECT 1 FROM autodidacta_resultados r WHERE r.program_id = teacher_programs.id AND r.tipo = 'diagnostico')
    ORDER BY id DESC LIMIT 1
  `) as { id: number }[]
  expect(materia, 'Hace falta una materia personal de Sofía con el pase y el diagnóstico').toBeTruthy()
  await page.route('**/api/generate-quiz', (ruta) => ruta.fulfill({ json: { questions: preguntasSimuladas(10) } }))
  await page.goto(`/autodidacta/${materia.id}`)
  await page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' }).click()
}

test('X1 · la pista aparece en la práctica y no regala la respuesta', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  let pedido: { contexto?: Record<string, unknown>; question?: { id: string } } | null = null
  await page.route('**/api/quiz/pista', async (ruta) => {
    pedido = ruta.request().postDataJSON()
    await ruta.fulfill({ json: { pista: 'Sumá el número consigo mismo: es lo mismo que multiplicarlo por dos.' } })
  })
  await practicaDelDia(page)
  const pedir = page.getByRole('button', { name: 'Pedir una pista' })
  await expect(pedir).toBeVisible({ timeout: 30_000 })
  await pedir.click()
  await expect(page.getByRole('status').filter({ hasText: 'Pista:' })).toContainText('multiplicarlo por dos')
  await expect(pedir).toHaveCount(0)
  expect(pedido!.contexto).toMatchObject({ autodidacta: { tipo: 'practica' } })
  expect(pedido!.contexto).not.toHaveProperty('pedagogyContext')
  await capturarSinRecargar(page, 'docs/capturas/ronda-x/x1', 'pista')

  // La ruta real: con contexto de tarea, 403 antes de llamar a la IA.
  const res = await page.request.post('/api/quiz/pista', {
    data: { question: preguntasSimuladas(1)[0], contexto: { assignmentId: 1 } },
  })
  expect(res.status()).toBe(403)
})

test('X1 · en una tarea del aula no hay pista', async ({ browser }) => {
  test.setTimeout(120_000)
  const sql = await sqlDeStaging()
  const [grupo] = (await sql`SELECT c.teacher_program_id, p.subject_name FROM classrooms c JOIN teacher_programs p ON p.id = c.teacher_program_id WHERE c.id = ${GRUPO_LENGUA.id}`) as {
    teacher_program_id: number
    subject_name: string
  }[]
  const titulo = `E2E · Sin pista ${marca()}`
  const [quiz] = (await sql`
    INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, created_at, updated_at)
    VALUES ('stg-user-0008', ${grupo.teacher_program_id}, ${titulo}, ${grupo.subject_name}, 'practico', 'saved', ${JSON.stringify([{ id: 'e2e', name: 'Tema' }])},
            2, ${JSON.stringify(preguntasSimuladas(2))}, NOW(), NOW())
    RETURNING id
  `) as { id: number }[]
  const [asignacion] = (await sql`INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id) VALUES (${GRUPO_LENGUA.id}, ${quiz.id}) RETURNING id`) as { id: number }[]
  try {
    const page = await (await browser.newContext()).newPage()
    await entrarComo(page, ALUMNA)
    await page.goto('/aulas')
    await page.getByRole('listitem').filter({ hasText: titulo }).first().getByRole('button', { name: 'Empezar tarea' }).click()
    await expect(page.getByText(/^1\/2$/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Pedir una pista' })).toHaveCount(0)
  } finally {
    await sql`DELETE FROM quiz_attempts WHERE assignment_id = ${asignacion.id}`
    await sql`DELETE FROM classroom_assignments WHERE id = ${asignacion.id}`
    await sql`DELETE FROM teacher_quizzes WHERE id = ${quiz.id}`
  }
})
