import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { DOCENTE, entrarComo, sqlDeStaging } from './ayudas'
import { importarMoodleXml } from '../lib/importar-moodle'

/**
 * Ronda W · W4 — Una tarea impresa en temas A y B: los dos temas con todas las
 * preguntas, en otro orden, y la hoja de respuestas aparte. La tarea es la
 * muestra de U5 (todos los tipos), importada con W3 como tarea de Irina, y se
 * borra al final.
 */
test('W4 · el examen impreso con temas A y B', async ({ page }, info) => {
  test.setTimeout(120_000)
  await entrarComo(page, DOCENTE)
  const sql = await sqlDeStaging()
  await sql`DELETE FROM teacher_quizzes WHERE user_id = 'stg-user-0008' AND title = 'E2E · Examen A y B'`
  // La muestra de U5 (los 11 tipos, con LaTeX y caracteres difíciles), importada con el lector de W3.
  const { preguntas } = importarMoodleXml(readFileSync('docs/moodle/muestra-ronda-t.xml', 'utf8'))
  const [programa] = (await sql`SELECT id, subject_name FROM teacher_programs WHERE user_id = 'stg-user-0008' AND status = 'active' ORDER BY id LIMIT 1`) as { id: number; subject_name: string }[]
  const [quiz] = (await sql`
    INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, created_at, updated_at)
    VALUES ('stg-user-0008', ${programa.id}, 'E2E · Examen A y B', ${programa.subject_name}, 'practico', 'saved', ${JSON.stringify([{ id: 't', name: 'Muestra' }])},
            ${preguntas.length}, ${JSON.stringify(preguntas)}, NOW(), NOW())
    RETURNING id, question_count
  `) as { id: number; question_count: number }[]

  await page.goto(`/teacher/tareas/${quiz.id}/imprimir`)
  const a = page.locator('[data-tema="A"]')
  const b = page.locator('[data-tema="B"]')
  await expect(a).toBeVisible({ timeout: 30_000 })
  await expect(a.locator(':scope > ol > li')).toHaveCount(quiz.question_count)
  await expect(b.locator(':scope > ol > li')).toHaveCount(quiz.question_count)
  const respuestas = page.locator('[data-hoja-de-respuestas]')
  await expect(respuestas).toContainText('Tema A')
  await expect(respuestas).toContainText('Tema B')
  // B no es una copia de A.
  const textosA = await a.locator(':scope > ol > li').allInnerTexts()
  const textosB = await b.locator(':scope > ol > li').allInnerTexts()
  expect(textosB).not.toEqual(textosA)

  await page.emulateMedia({ media: 'print' })
  await page.screenshot({ path: `docs/capturas/ronda-w/w4/examen-${info.project.name}.png`, fullPage: true })
  // En papel no sale la barra de la app ni el botón de imprimir.
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
  await sql`DELETE FROM teacher_quizzes WHERE id = ${quiz.id}`
})
