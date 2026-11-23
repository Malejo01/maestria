import { expect, test } from '@playwright/test'
import { ALUMNA, capturarSinRecargar, entrarComo, marca, sqlDeStaging } from './ayudas'

/**
 * Ronda X · X2 — "Repasar hoy":
 *   1. una pregunta que Sofía erró hace 100 días (sembrada) aparece en Mis aulas;
 *   2. el repaso arranca sin IA, con esa pregunta primero;
 *   3. al acertarla, sale del repaso de hoy (vuelve en 3 días).
 * Borra el intento sembrado y el del repaso.
 */
test('X2 · repasar hoy: vuelve lo que costó y, al acertarlo, se aleja', async ({ page }) => {
  test.setTimeout(150_000)
  const sql = await sqlDeStaging()
  const pregunta = `E2E · Repaso ${marca()}: ¿qué tipo de texto busca convencer al lector?`
  const [intento] = (await sql`
    INSERT INTO quiz_attempts (user_id, subject, mode, topics, total_questions, correct_answers, incorrect_answers, score, passed, completed_at)
    VALUES ('stg-demo-sofia', 'Lengua', 'teorico', ARRAY['Textos'], 1, 0, 1, 0, false, NOW() - INTERVAL '100 days')
    RETURNING id
  `) as { id: number }[]
  await sql`
    INSERT INTO quiz_answers (quiz_attempt_id, question_index, question_id, question_text, question_type, options, selected_answer, correct_answer, is_correct, explanation, topic_name, created_at)
    VALUES (${intento.id}, 0, 'e2e-repaso', ${pregunta}, 'multiple_choice', ${JSON.stringify(['Narrativo', 'Argumentativo', 'Descriptivo', 'Instructivo'])},
            0, 1, false, 'El argumentativo defiende una postura.', 'Textos', NOW() - INTERVAL '100 days')
  `
  let generaciones = 0
  await page.route('**/api/generate-quiz', (r) => {
    generaciones++
    return r.abort()
  })
  try {
    await entrarComo(page, ALUMNA)
    await page.goto('/aulas')
    const tarjeta = page.locator('[data-repasar-hoy]')
    await expect(tarjeta).toBeVisible({ timeout: 30_000 })
    await capturarSinRecargar(page, 'docs/capturas/ronda-x/x2', 'mis-aulas', tarjeta)
    await tarjeta.getByRole('button', { name: 'Empezar el repaso' }).click()
    await expect(page.getByRole('heading', { name: pregunta })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('radio', { name: /Argumentativo/ }).click()
    await page.getByRole('button', { name: /^Verificar/ }).click()
    // Sale del cuestionario: el intento se guarda al ver los resultados.
    for (let i = 0; i < 10; i++) {
      const terminar = page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ })
      if (!(await terminar.isVisible({ timeout: 3000 }).catch(() => false))) break
      const texto = await terminar.textContent()
      await terminar.click()
      if (texto?.includes('Ver resultados')) break
      // Las demás del repaso: la primera opción, sin importar.
      const opcion = page.getByRole('radio').first()
      if (await opcion.isVisible({ timeout: 3000 }).catch(() => false)) await opcion.click()
      else await page.locator('input[inputmode="decimal"], input[inputmode="text"], textarea').first().fill('1')
      await page.getByRole('button', { name: /^Verificar/ }).click()
    }
    await expect(page.getByText('Guardado', { exact: true })).toBeVisible({ timeout: 30_000 })

    const repaso = (await (await page.request.get('/api/student/repaso')).json()) as { preguntas: { question: string }[] }
    expect(repaso.preguntas.map((q) => q.question)).not.toContain(pregunta)
    expect(generaciones).toBe(0)
  } finally {
    await sql`DELETE FROM quiz_attempts WHERE id IN (SELECT quiz_attempt_id FROM quiz_answers WHERE question_text = ${pregunta})`
  }
})
