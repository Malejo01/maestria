import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo, GRUPO_LENGUA, sqlDeStaging } from './ayudas'

/**
 * Ronda W · W2 — Duplicar una tarea desde la página del grupo y mandar la
 * copia con fechas nuevas, sin generar nada: la copia tiene las mismas
 * preguntas y queda mandada. Deja en staging la copia "(copia…)" mandada al
 * grupo de Lengua de Irina, que se quita del grupo al final.
 */
test('W2 · duplicar una tarea y mandarla con fechas nuevas', async ({ page }, info) => {
  test.setTimeout(120_000)
  await entrarComo(page, DOCENTE)
  let generaciones = 0
  await page.route('**/api/generate-quiz', (ruta) => {
    generaciones++
    return ruta.abort()
  })
  await page.goto(`/teacher/grupos/${GRUPO_LENGUA.id}?pestana=tareas`)
  await page.getByRole('link', { name: /^Tareas \(/ }).click()
  const duplicar = page.getByRole('button', { name: 'Duplicar a otro grupo' }).first()
  await expect(duplicar).toBeVisible({ timeout: 30_000 })
  const tarjeta = page.locator('li').filter({ has: duplicar }).first()
  const original = (await tarjeta.locator('h3, p').first().textContent())?.trim() ?? ''
  await duplicar.click()

  const mandar = page.getByRole('dialog', { name: 'Mandar la tarea' })
  await expect(mandar).toBeVisible({ timeout: 30_000 })
  const elegirGrupo = mandar.getByRole('button', { name: /Lengua/ }).first()
  if (await elegirGrupo.isVisible({ timeout: 5000 }).catch(() => false)) await elegirGrupo.click()
  await expect(mandar.getByText(/Preparando el grupo/)).toHaveCount(0, { timeout: 30_000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `docs/capturas/ronda-w/w2/mandar-copia-${info.project.name}.png` })
  await mandar.getByRole('button', { name: 'Mandar la tarea' }).click()
  await expect(page.getByText('La tarea ya está en el grupo.')).toBeVisible({ timeout: 30_000 })

  const sql = await sqlDeStaging()
  const [copia] = (await sql`
    SELECT q.id, q.title, q.question_count, a.id AS asignacion
    FROM teacher_quizzes q JOIN classroom_assignments a ON a.teacher_quiz_id = q.id
    WHERE q.user_id = 'stg-user-0008' AND q.title LIKE '%(copia%' AND a.classroom_id = ${GRUPO_LENGUA.id}
    ORDER BY q.id DESC LIMIT 1
  `) as { id: number; title: string; question_count: number; asignacion: number }[]
  expect(copia?.title).toMatch(/\(copia( \d+)?\)$/)
  expect(copia.question_count).toBeGreaterThan(0)
  expect(original.length).toBeGreaterThan(0)
  expect(generaciones).toBe(0)
  // Limpieza: la copia se quita del grupo (queda guardada en Mis tareas).
  await sql`DELETE FROM classroom_assignments WHERE id = ${copia.asignacion}`
})
