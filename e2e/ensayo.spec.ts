import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, DOCENTE, entrarComo, GRUPO_LENGUA, marca, responderUna, sqlDeStaging } from './ayudas'

/** Capturas a 360, 390 y 1280 px, en claro y oscuro (el modo va en localStorage, como en scripts/capturas.mjs). */
async function capturarEnTodo(page: Page, nombre: string, preparar: () => Promise<void>) {
  for (const modo of ['claro', 'oscuro']) {
    await page.evaluate((m) => localStorage.setItem('maestria-tema', m), modo)
    await page.reload()
    await preparar()
    for (const ancho of [360, 390, 1280]) {
      await page.setViewportSize({ width: ancho, height: 800 })
      await page.waitForTimeout(300)
      await page.screenshot({ path: `docs/capturas/ronda-w/w5/${nombre}-${ancho}-${modo}.png` })
    }
  }
  await page.evaluate(() => localStorage.setItem('maestria-tema', 'claro'))
  await page.setViewportSize({ width: 1280, height: 800 })
}

/**
 * Ronda W · W5 — La respuesta larga con corrección asistida, de punta a punta
 * y sin IA (la sugerencia se prueba aparte; acá el docente corrige a mano):
 *   1. Sofía hace una tarea con una opción múltiple y un ensayo: el ensayo
 *      queda "En corrección" y la nota sale sin él.
 *   2. Irina lo ve en "Para corregir", elige los niveles, escribe la
 *      devolución y confirma.
 *   3. La respuesta queda corregida, el intento recalculado y el historial de
 *      Sofía muestra la nota y la devolución.
 * Deja todo limpio: borra la tarea, la asignación y el intento que crea.
 */
test('W5 · ensayo: en corrección, el docente confirma y el alumno ve la devolución', async ({ browser }) => {
  test.setTimeout(180_000)
  const sql = await sqlDeStaging()
  const titulo = `E2E · Ensayo ${marca()}`
  const [grupo] = (await sql`
    SELECT c.teacher_program_id, p.subject_name FROM classrooms c JOIN teacher_programs p ON p.id = c.teacher_program_id WHERE c.id = ${GRUPO_LENGUA.id}
  `) as { teacher_program_id: number; subject_name: string }[]
  const preguntas = [
    {
      id: 'q1',
      type: 'multiple_choice',
      topic: 't',
      topicName: 'Textos',
      question: '¿Qué tipo de texto busca convencer al lector?',
      options: ['Argumentativo', 'Narrativo', 'Descriptivo', 'Instructivo'],
      correctAnswer: 0,
      explanation: 'El argumentativo defiende una postura.',
    },
    {
      id: 'q2',
      type: 'essay',
      topic: 't',
      topicName: 'Textos',
      question: 'Explicá con tus palabras qué es un texto argumentativo y da un ejemplo de tu vida cotidiana.',
      rubrica: [{ criterio: 'Define el texto argumentativo' }, { criterio: 'Nombra la tesis y los argumentos' }, { criterio: 'Da un ejemplo propio' }],
      explanation: 'Una tesis, argumentos que la sostienen y una conclusión.',
    },
  ]
  const [quiz] = (await sql`
    INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, created_at, updated_at)
    VALUES ('stg-user-0008', ${grupo.teacher_program_id}, ${titulo}, ${grupo.subject_name}, 'teorico', 'saved', ${JSON.stringify([{ id: 't', name: 'Textos' }])},
            2, ${JSON.stringify(preguntas)}, NOW(), NOW())
    RETURNING id
  `) as { id: number }[]
  const [asignacion] = (await sql`
    INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id) VALUES (${GRUPO_LENGUA.id}, ${quiz.id}) RETURNING id
  `) as { id: number }[]

  try {
    // 1. La alumna hace la tarea.
    const alumna = await (await browser.newContext()).newPage()
    await entrarComo(alumna, ALUMNA)
    await alumna.goto('/aulas')
    const tarjeta = alumna.getByRole('listitem').filter({ hasText: titulo }).first()
    await tarjeta.getByRole('button', { name: 'Empezar tarea' }).click()
    await expect(alumna.getByText(/^1\/2$/)).toBeVisible({ timeout: 30_000 })
    await responderUna(alumna)
    await expect(alumna.getByText(/^2\/2$/)).toBeVisible()
    await expect(alumna.getByText('Lo que se va a mirar en tu respuesta:')).toBeVisible()
    const respuesta = 'Un texto argumentativo defiende una postura, la tesis, con argumentos. Por ejemplo, cuando le explico a mi familia por qué conviene adoptar un perro.'
    await alumna.locator('textarea').first().fill(respuesta)
    await alumna.screenshot({ path: 'docs/capturas/ronda-w/w5/alumno-ensayo-escritorio.png' })
    await alumna.getByRole('button', { name: /^(Verificar|Siguiente|Terminar)/ }).first().click()
    const verResultados = alumna.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ })
    if (await verResultados.isVisible({ timeout: 3000 }).catch(() => false)) await verResultados.click()
    await expect(alumna.locator('[data-en-correccion-resultados]')).toBeVisible({ timeout: 30_000 })
    await expect(alumna.getByText('Guardado', { exact: true })).toBeVisible({ timeout: 30_000 })
    await alumna.screenshot({ path: 'docs/capturas/ronda-w/w5/alumno-resultados-escritorio.png' })

    const [antes] = (await sql`
      SELECT att.id, att.ungraded_answers, a.id AS respuesta, a.is_correct, a.question_type, a.answer_payload ->> 'estadoDeCorreccion' AS estado
      FROM quiz_attempts att JOIN quiz_answers a ON a.quiz_attempt_id = att.id
      WHERE att.assignment_id = ${asignacion.id} AND a.question_index = 1
    `) as { id: string; ungraded_answers: number; respuesta: number; is_correct: boolean | null; question_type: string; estado: string }[]
    expect(antes).toMatchObject({ ungraded_answers: 1, is_correct: null, estado: 'pendiente' })

    // 2. La docente lo corrige.
    const docente = await (await browser.newContext()).newPage()
    await entrarComo(docente, DOCENTE)
    await docente.goto('/teacher?seccion=tareas')
    await expect(docente.locator('[data-para-corregir]')).toBeVisible({ timeout: 30_000 })
    await docente.locator('[data-para-corregir]').click()
    await expect(docente).toHaveURL(/\/teacher\/correcciones$/)
    const ensayo = docente.locator(`[data-ensayo="${antes.respuesta}"]`)
    await expect(ensayo).toContainText(respuesta)
    await capturarEnTodo(docente, 'correcciones', async () => {
      await expect(ensayo).toBeVisible({ timeout: 30_000 })
      await ensayo.locator('fieldset').first().scrollIntoViewIfNeeded()
    })
    const criterios = ensayo.locator('fieldset')
    await criterios.nth(0).getByText('Logrado', { exact: true }).click()
    await criterios.nth(1).getByText('Parcial', { exact: true }).click()
    await criterios.nth(2).getByText('Logrado', { exact: true }).click()
    await expect(ensayo.getByRole('textbox', { name: 'Nota (0 a 10)' })).toHaveValue('8.3')
    await ensayo.getByRole('textbox', { name: 'Devolución para el alumno' }).fill('Muy bien la definición y el ejemplo. Te faltó nombrar los argumentos.')
    await ensayo.screenshot({ path: 'docs/capturas/ronda-w/w5/docente-correccion-escritorio.png' })
    await ensayo.getByRole('button', { name: 'Confirmar y mostrar al alumno' }).click()
    await expect(docente.getByText('Listo: el alumno ya la ve.')).toBeVisible({ timeout: 30_000 })

    // 3. Corregida y recalculada.
    const [despues] = (await sql`
      SELECT att.ungraded_answers, att.correct_answers, att.score, a.is_correct, a.answer_payload -> 'correccion' ->> 'nota' AS nota
      FROM quiz_attempts att JOIN quiz_answers a ON a.quiz_attempt_id = att.id
      WHERE att.id = ${antes.id} AND a.question_index = 1
    `) as { ungraded_answers: number; correct_answers: number; score: string; is_correct: boolean; nota: string }[]
    expect(despues.ungraded_answers).toBe(0)
    expect(despues.is_correct).toBe(true)
    expect(Number(despues.nota)).toBe(8.3)
    expect(despues.correct_answers).toBe(2)

    // El historial de la alumna muestra la devolución.
    await alumna.goto('/history')
    await alumna.locator(`[data-intento="${antes.id}"]`).click({ timeout: 30_000 })
    const enHistorial = alumna.locator('[data-ensayo-historial="corregido"]')
    await expect(enHistorial).toContainText('Te faltó nombrar los argumentos.', { timeout: 30_000 })
    await expect(enHistorial).toContainText('Corregida: 8,3')
    await capturarEnTodo(alumna, 'historial', async () => {
      await alumna.locator(`[data-intento="${antes.id}"]`).click({ timeout: 30_000 })
      await expect(enHistorial).toBeVisible({ timeout: 30_000 })
      await enHistorial.scrollIntoViewIfNeeded()
    })
  } finally {
    await sql`DELETE FROM quiz_attempts WHERE assignment_id = ${asignacion.id}`
    await sql`DELETE FROM classroom_assignments WHERE id = ${asignacion.id}`
    await sql`DELETE FROM teacher_quizzes WHERE id = ${quiz.id}`
  }
})
