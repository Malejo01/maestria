import { expect, test } from '@playwright/test'
import { entrarConId, sqlDeStaging } from './ayudas'

/**
 * Ronda V · V2 — Un docente nuevo prueba con una materia de ejemplo: en un
 * clic tiene materia, grupo con alumnos ficticios que ya respondieron, una
 * tarea y un diagnóstico. No cuenta para el plan ni avisa, y se borra con un
 * botón (y se borra todo).
 *
 * Usa un docente de prueba propio (`stg-v2-ejemplo`, @staging.invalid) y lo
 * deja sin nada de ejemplo al terminar.
 */
const DOCENTE_ID = 'stg-v2-ejemplo'

test('V2 · probar con una materia de ejemplo y borrarla', async ({ page }, info) => {
  test.setTimeout(180_000)
  const sql = await sqlDeStaging()
  await sql`
    INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
    VALUES (${DOCENTE_ID}, ${`${DOCENTE_ID}@staging.invalid`}, 'Docente V2 Ejemplo', 'DOCENTE', true, false, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'DOCENTE'
  `
  // Arranca limpio: sin materias propias (así el primer paso es "Tu materia").
  await sql`DELETE FROM teacher_programs WHERE user_id = ${DOCENTE_ID}`
  await page.addLocatorHandler(page.getByRole('button', { name: 'Empezar los 30 días' }), async (boton) => {
    await boton.click()
  })
  await page.goto('/')
  await entrarConId(page, DOCENTE_ID)
  // Si una corrida anterior se cortó, su ejemplo se borra como lo borraría el docente.
  await page.request.delete('/api/teacher/ejemplo')
  await page.goto('/teacher')

  const avisosAntes = (await (await page.request.get('/api/teacher/avisos')).json()) as { avisos?: unknown[] }

  await page.getByRole('button', { name: 'Probar con una materia de ejemplo' }).click()
  await expect(page.getByRole('dialog')).toContainText('alumnos ficticios')
  await page.screenshot({ path: `docs/capturas/ronda-v/v2/elegir-area-${info.project.name}.png` })
  await page.getByRole('dialog').getByRole('button', { name: 'Antropología' }).click()

  // Abre el grupo de ejemplo, con sus alumnos y la tarea respondida.
  await page.waitForURL(/\/teacher\/grupos\/\d+/, { timeout: 60_000 })
  await expect(page.getByText('Camila Ríos').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Diagnósticos (1)' })).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `docs/capturas/ronda-v/v2/grupo-${info.project.name}.png`, fullPage: true })
  await page.getByRole('link', { name: 'Diagnósticos (1)' }).click()
  await expect(page.getByText(/Diagnóstico integral/).first()).toBeVisible()
  await page.screenshot({ path: `docs/capturas/ronda-v/v2/diagnostico-${info.project.name}.png`, fullPage: true })
  // La ficha de un alumno ficticio.
  await page.getByRole('link', { name: /^Alumnos \(/ }).click()
  await page.getByText('Camila Ríos', { exact: true }).first().click()
  const ficha = page.getByRole('dialog')
  await expect(ficha).toContainText('Camila Ríos', { timeout: 30_000 })
  await expect(ficha.getByText(/Cargando ficha/)).toHaveCount(0, { timeout: 30_000 })
  await page.screenshot({ path: `docs/capturas/ronda-v/v2/ficha-${info.project.name}.png` })
  await page.keyboard.press('Escape')

  const [materia] = (await sql`SELECT id FROM teacher_programs WHERE user_id = ${DOCENTE_ID} AND ejemplo = TRUE`) as { id: number }[]
  expect(materia).toBeTruthy()
  const [cuenta] = (await sql`
    SELECT (SELECT COUNT(*)::int FROM classroom_members m JOIN classrooms c ON c.id = m.classroom_id WHERE c.teacher_program_id = ${materia.id}) AS alumnos,
           (SELECT COUNT(*)::int FROM quiz_attempts att JOIN classrooms c ON c.id = att.classroom_id WHERE c.teacher_program_id = ${materia.id}) AS intentos
  `) as { alumnos: number; intentos: number }[]
  expect(cuenta).toEqual({ alumnos: 7, intentos: 13 })

  // No cuenta para el plan ni avisa nada en la campanita.
  const plan = (await (await page.request.get('/api/teacher/plan')).json()) as { plan: { alumnos: number } }
  expect(plan.plan.alumnos).toBe(0)
  const avisosDespues = (await (await page.request.get('/api/teacher/avisos')).json()) as { avisos?: unknown[] }
  expect(avisosDespues.avisos?.length ?? 0).toBe(avisosAntes.avisos?.length ?? 0)

  // En el panel, el aviso del ejemplo; y se borra todo.
  await page.goto('/teacher')
  const aviso = page.locator('[data-materia-de-ejemplo]')
  await expect(aviso).toContainText('Antropología Cultural (ejemplo)')
  await page.screenshot({ path: `docs/capturas/ronda-v/v2/aviso-${info.project.name}.png` })
  await aviso.getByRole('button', { name: 'Borrar el ejemplo' }).click()
  await aviso.getByRole('button', { name: 'Borrar el ejemplo' }).click()
  await expect(aviso).toHaveCount(0, { timeout: 30_000 })

  const [quedan] = (await sql`
    SELECT (SELECT COUNT(*)::int FROM teacher_programs WHERE user_id = ${DOCENTE_ID}) AS materias,
           (SELECT COUNT(*)::int FROM classrooms WHERE teacher_id = ${DOCENTE_ID}) AS grupos,
           (SELECT COUNT(*)::int FROM quiz_attempts WHERE id IN (SELECT id FROM quiz_attempts WHERE classroom_id IS NULL AND user_id LIKE 'ejemplo_%')) AS huerfanos
  `) as { materias: number; grupos: number; huerfanos: number }[]
  expect(quedan).toEqual({ materias: 0, grupos: 0, huerfanos: 0 })
  // Y vuelve a aparecer la oferta.
  await expect(page.getByRole('button', { name: 'Probar con una materia de ejemplo' })).toBeVisible()
})
