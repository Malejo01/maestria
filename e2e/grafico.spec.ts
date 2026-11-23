import { expect, test } from '@playwright/test'
import { ALUMNA, capturarSinRecargar, entrarComo, sqlDeStaging } from './ayudas'

/**
 * Ronda X · X3 — Una pregunta con gráfico de funciones, en la práctica del día
 * (generación simulada): el SVG se dibuja, es accesible (role="img" con la
 * descripción) y la respuesta se corrige como siempre.
 */
test('X3 · la pregunta con gráfico se dibuja y se lee', async ({ page }) => {
  test.setTimeout(120_000)
  const sql = await sqlDeStaging()
  const [materia] = (await sql`
    SELECT id FROM teacher_programs
    WHERE user_id = 'stg-demo-sofia' AND personal = TRUE AND status = 'active' AND pase_hasta >= CURRENT_DATE
      AND EXISTS (SELECT 1 FROM autodidacta_resultados r WHERE r.program_id = teacher_programs.id AND r.tipo = 'diagnostico')
    ORDER BY id DESC LIMIT 1
  `) as { id: number }[]
  expect(materia).toBeTruthy()
  const base = { topic: 't1', topicName: 'Función cuadrática', explanation: 'Corta al eje x en -2 y en 2.' }
  const preguntas = [
    {
      ...base,
      id: 'g1',
      type: 'numeric',
      question: 'Observá el gráfico de f. ¿Cuál es su raíz positiva?',
      correctAnswer: 2,
      grafico: { expresiones: ['x^2 - 4', '2x - 1'], dominio: [-4, 4], puntos: [{ x: 0, y: -4, etiqueta: 'B' }] },
    },
    { ...base, id: 'g2', type: 'true_false', question: 'La parábola y = x^2 - 4 tiene el vértice en (0; -4).', correctAnswer: true },
  ]
  await entrarComo(page, ALUMNA)
  await page.route('**/api/generate-quiz', (r) => r.fulfill({ json: { questions: preguntas } }))
  await page.goto(`/autodidacta/${materia.id}`)
  await page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' }).click()

  const grafico = page.getByRole('img', { name: /^Gráfico de y = x\^2 - 4; y = 2x - 1, con x entre -4 y 4/ })
  await expect(grafico).toBeVisible({ timeout: 30_000 })
  await expect(grafico.locator('path')).toHaveCount(2)
  await expect(page.locator('[data-grafico] figcaption')).toContainText('y = 2x - 1')
  await capturarSinRecargar(page, 'docs/capturas/ronda-x/x3', 'pregunta-con-grafico', grafico)

  await page.locator('input[inputmode="decimal"]').first().fill('2')
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await expect(page.getByText(/correct/i).first()).toBeVisible()
})
