import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo } from './ayudas'

/**
 * Ronda W · W1 — El banco de preguntas: se busca en /teacher/banco y, al
 * armar una tarea, "Sumar del banco" pone las elegidas tal cual y la IA
 * (simulada) completa sólo las que faltan, sin repetirlas.
 */
test('W1 · el banco: buscar y sumar del banco al armar una tarea', async ({ page }, info) => {
  test.setTimeout(150_000)
  await entrarComo(page, DOCENTE)

  await page.goto('/teacher/banco')
  await expect(page.getByRole('heading', { level: 1, name: 'Banco de preguntas' })).toBeVisible()
  await expect(page.locator('[data-pregunta-del-banco]').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('searchbox', { name: 'Buscar en el texto' }).fill('zzz-no-existe-zzz')
  await expect(page.getByText('No hay preguntas con esos filtros.')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('searchbox', { name: 'Buscar en el texto' }).fill('')
  await expect(page.locator('[data-pregunta-del-banco]').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `docs/capturas/ronda-w/w1/banco-${info.project.name}.png` })

  let pedido: { questionCount?: number; previousQuestions?: { question: string }[] } | null = null
  await page.route('**/api/generate-quiz', async (ruta) => {
    pedido = ruta.request().postDataJSON()
    const cantidad = Number(pedido?.questionCount) || 1
    await ruta.fulfill({
      json: {
        questions: Array.from({ length: cantidad }, (_, i) => ({
          id: `n${i + 1}`,
          type: 'multiple_choice',
          topic: 't1',
          topicName: 'Tema',
          question: `Pregunta nueva de la IA ${i + 1}`,
          options: ['a', 'b', 'c', 'd'],
          correctAnswer: 0,
          explanation: '',
        })),
      },
    })
  })

  await page.goto('/teacher?seccion=materias')
  await page.getByRole('button', { name: 'Crear cuestionario' }).first().click()
  await page.getByRole('button', { name: /Unidad 1/ }).first().click()
  await page.locator('[data-sumar-del-banco]').click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('checkbox', { name: 'Sólo de los temas elegidos' }).uncheck()
  const casillas = dialogo.getByRole('checkbox', { name: /^Elegir:/ })
  await expect(casillas.first()).toBeVisible({ timeout: 30_000 })
  const primera = (await casillas.nth(0).getAttribute('aria-label'))!.replace(/^Elegir: /, '')
  await casillas.nth(0).check()
  await casillas.nth(1).check()
  await page.screenshot({ path: `docs/capturas/ronda-w/w1/elegir-${info.project.name}.png` })
  await dialogo.getByRole('button', { name: 'Listo' }).click()
  await expect(page.locator('[data-sumar-del-banco]')).toHaveText('Del banco: 2 preguntas')

  await page.getByRole('button', { name: /^Generar cuestionario/ }).click()
  await page.getByRole('button', { name: /^(Examen práctico|Práctico:)/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Realizar' }).click()
  // La IA recibe sólo las que faltan (10 − 2) y la lista de las del banco para no repetirlas.
  await expect.poll(() => (pedido as { questionCount?: number } | null)?.questionCount ?? null, { timeout: 30_000 }).toBe(8)
  expect((pedido as { previousQuestions?: unknown[] } | null)?.previousQuestions).toHaveLength(2)
  // La primera pregunta de la tarea es la del banco.
  await expect(page.getByRole('heading', { name: primera.slice(0, 40) }).first()).toBeVisible({ timeout: 30_000 })
})
