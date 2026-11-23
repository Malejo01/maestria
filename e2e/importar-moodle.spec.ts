import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo, sqlDeStaging } from './ayudas'

/**
 * Ronda W · W3 — Importar de Moodle: la muestra de U5 (33 preguntas en Moodle
 * XML) entra entera como un cuestionario nuevo; un GIFT con un ensayo muestra
 * qué no se importa y por qué. Borra al final el cuestionario que crea.
 */
test('W3 · importar preguntas de Moodle (XML y GIFT)', async ({ page }, info) => {
  test.setTimeout(120_000)
  await entrarComo(page, DOCENTE)
  await page.goto('/teacher/importar')
  const materia = page.getByRole('combobox', { name: 'Materia' })
  await expect(materia.locator('option')).not.toHaveCount(1, { timeout: 30_000 })
  const valor = await materia.locator('option').nth(1).getAttribute('value')
  await materia.selectOption(valor!)

  // GIFT con un ensayo: se ve qué no entra y por qué.
  await page.getByLabel('Archivo (.gift, .txt o .xml)').setInputFiles({
    name: 'banco.gift',
    mimeType: 'text/plain',
    buffer: Buffer.from('::E1:: Explicá la fotosíntesis. {}\n\n::V1:: El agua hierve a 100 °C al nivel del mar. {T}\n'),
  })
  await expect(page.locator('[data-salteada]')).toContainText('respuesta larga (ensayo)')
  await expect(page.locator('[data-importable]')).toHaveCount(1)

  // La muestra de U5: las 33.
  await page.getByLabel('Archivo (.gift, .txt o .xml)').setInputFiles({
    name: 'muestra.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(readFileSync('docs/moodle/muestra-ronda-t.xml', 'utf8')),
  })
  await expect(page.getByText('Moodle XML: 33 preguntas se pueden importar.')).toBeVisible()
  await expect(page.locator('[data-salteada]')).toHaveCount(0)
  const titulo = `E2E · Importadas ${Date.now()}`
  await page.getByLabel('Nombre del cuestionario').fill(titulo)
  await page.screenshot({ path: `docs/capturas/ronda-w/w3/vista-previa-${info.project.name}.png` })
  await page.getByRole('button', { name: 'Importar 33 preguntas' }).click()
  await expect(page.locator('[data-importado]')).toBeVisible({ timeout: 30_000 })

  const sql = await sqlDeStaging()
  const [q] = (await sql`SELECT id, question_count FROM teacher_quizzes WHERE user_id = 'stg-user-0008' AND title = ${titulo}`) as { id: number; question_count: number }[]
  expect(q.question_count).toBe(33)
  await sql`DELETE FROM teacher_quizzes WHERE id = ${q.id}`
})
