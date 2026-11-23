import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, entrarComo, sqlDeStaging } from './ayudas'

/**
 * Ronda T · F2 a F7: los tipos de pregunta "como en Moodle", respondidos por
 * una alumna de punta a punta. La práctica sale de una materia personal de
 * Sofía con el pase (de las pruebas de E2), con la IA simulada: la ruta de
 * generación devuelve las preguntas de cada prueba. Al final se mira que la
 * respuesta se guardó con su tipo (migración 042).
 */
async function practicarCon(page: Page, preguntas: Record<string, unknown>[]) {
  const sql = await sqlDeStaging()
  const [materia] = (await sql`
    SELECT id FROM teacher_programs
    WHERE user_id = 'stg-demo-sofia' AND personal = TRUE AND status = 'active' AND pase_hasta >= CURRENT_DATE
    ORDER BY id DESC LIMIT 1
  `) as { id: number }[]
  expect(materia, 'Hace falta una materia personal de Sofía con el pase (la deja e2e/autodidacta-pase.spec.ts)').toBeTruthy()
  await page.route('**/api/generate-quiz', (ruta) => ruta.fulfill({ json: { questions: preguntas } }))
  await page.goto(`/autodidacta/${materia.id}`)
  await page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' }).click()
  return sql
}

async function verificarYSeguir(page: Page) {
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ }).click()
}

test('F2 · varias correctas: se marcan varias, se corrige todo o nada y se guarda con su tipo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  const base = { topic: 't1', topicName: 'Rasgos de la cultura', explanation: 'Se aprende, se comparte y es simbólica.' }
  const opciones = ['Se aprende', 'Es innata', 'Se comparte', 'Es individual', 'Es simbólica']
  const sql = await practicarCon(page, [
    { ...base, id: 'v1', type: 'multiple_response', question: '¿Cuáles son rasgos de la cultura? Marcá todas las que correspondan.', options: opciones, correctAnswers: [0, 2, 4] },
    { ...base, id: 'v2', type: 'multiple_response', question: '¿Cuáles NO son rasgos de la cultura? Marcá todas las que correspondan.', options: opciones, correctAnswers: [1, 3] },
  ])

  // La primera, bien: las tres correctas.
  await expect(page.getByText('Marcá todas las correctas.')).toBeVisible({ timeout: 30_000 })
  for (const nombre of ['Se aprende', 'Se comparte', 'Es simbólica']) await page.getByRole('checkbox', { name: nombre }).click()
  await expect(page.getByRole('checkbox', { name: 'Se comparte' })).toHaveAttribute('aria-checked', 'true')
  await verificarYSeguir(page)

  // La segunda, a medias: falta una, así que está mal (todo o nada).
  await page.getByRole('checkbox', { name: 'Es innata' }).click()
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await expect(page.getByText('Era correcta y no la marcaste.')).toBeVisible()
  await page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ }).click()

  // Resultados: 1 de 2, y en las incorrectas lo que marcó y lo correcto, en texto.
  await expect(page.getByText('1 de 2 correctas')).toBeVisible({ timeout: 30_000 })
  // La barra de acciones fija tapa la tarjeta: el clic va directo.
  await page.getByText('Incorrectas', { exact: true }).dispatchEvent('click')
  await expect(page.getByText('B) Es innata · D) Es individual').first()).toBeVisible()

  // Guardada con su tipo y su payload.
  await expect
    .poll(async () => {
      const [fila] = (await sql`
        SELECT a.question_type, a.is_correct, a.answer_payload FROM quiz_answers a
        JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
        WHERE t.user_id = 'stg-demo-sofia' AND a.question_id = 'v2'
        ORDER BY a.id DESC LIMIT 1
      `) as { question_type: string; is_correct: boolean; answer_payload: { selectedAnswers: number[] } }[]
      return fila ? { tipo: fila.question_type, bien: fila.is_correct, elegidas: fila.answer_payload.selectedAnswers } : null
    }, { timeout: 30_000 })
    .toEqual({ tipo: 'multiple_response', bien: false, elegidas: [1] })
})

test('F3 · emparejamiento: se elige la pareja de cada uno y se guarda con su tipo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  const pares = [
    { left: 'Geertz', right: 'Descripción densa' },
    { left: 'Lévi-Strauss', right: 'Estructuralismo' },
    { left: 'Malinowski', right: 'Observación participante' },
  ]
  const sql = await practicarCon(page, [
    { id: 'e1', type: 'matching', topic: 't1', topicName: 'Autores', question: 'Uní cada autor con su concepto.', pairs: pares, distractors: ['Evolucionismo'], explanation: 'Cada autor con lo suyo.' },
  ])
  await expect(page.getByText('Elegí la pareja de cada uno.')).toBeVisible({ timeout: 30_000 })
  // Sin elegir todas, no se puede verificar.
  await page.getByRole('combobox', { name: 'Pareja de: Geertz' }).selectOption('Descripción densa')
  await expect(page.getByRole('button', { name: /^Verificar/ })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Pareja de: Lévi-Strauss' }).selectOption('Evolucionismo')
  await page.getByRole('combobox', { name: 'Pareja de: Malinowski' }).selectOption('Observación participante')
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await expect(page.getByText('Correcta: Estructuralismo')).toBeVisible()
  await page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ }).click()
  await expect(page.getByText('0 de 1 correctas')).toBeVisible({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const [fila] = (await sql`
        SELECT a.question_type, a.answer_payload FROM quiz_answers a
        JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
        WHERE t.user_id = 'stg-demo-sofia' AND a.question_id = 'e1'
        ORDER BY a.id DESC LIMIT 1
      `) as { question_type: string; answer_payload: { selectedRights: string[] } }[]
      return fila ? { tipo: fila.question_type, elegidas: fila.answer_payload.selectedRights } : null
    }, { timeout: 30_000 })
    .toEqual({ tipo: 'matching', elegidas: ['Descripción densa', 'Evolucionismo', 'Observación participante'] })
})

test('F4 · ordenamiento: se ordena con las flechas y se guarda con su tipo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  const items = ['Paleolítico', 'Neolítico', 'Edad de los metales']
  const sql = await practicarCon(page, [
    { id: 'o1', type: 'ordering', topic: 't1', topicName: 'Etapas', question: 'Ordená de la más antigua a la más reciente.', items, explanation: 'Primero la piedra tallada, después la pulida, después los metales.' },
  ])
  await expect(page.getByText('Ordená con las flechas.')).toBeVisible({ timeout: 30_000 })
  // Ordenarlo de verdad: mientras algún elemento no esté en su lugar, subirlo.
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const textos = await page.locator('[data-elemento-orden]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-elemento-orden'))))
    const lugar = textos.findIndex((indice, i) => indice !== i)
    if (lugar === -1) break
    const queVa = textos.indexOf(lugar)
    await page.getByRole('button', { name: `Subir: ${items[lugar]}` }).click()
    expect(queVa).toBeGreaterThan(lugar)
  }
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ }).click()
  await expect(page.getByText('1 de 1 correctas')).toBeVisible({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const [fila] = (await sql`
        SELECT a.question_type, a.is_correct, a.answer_payload FROM quiz_answers a
        JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
        WHERE t.user_id = 'stg-demo-sofia' AND a.question_id = 'o1'
        ORDER BY a.id DESC LIMIT 1
      `) as { question_type: string; is_correct: boolean; answer_payload: { selectedOrder: number[] } }[]
      return fila ? { tipo: fila.question_type, bien: fila.is_correct, orden: fila.answer_payload.selectedOrder } : null
    }, { timeout: 30_000 })
    .toEqual({ tipo: 'ordering', bien: true, orden: [0, 1, 2] })
})

test('F5 · huecos: seleccionar en cada hueco y arrastrar desde el banco, guardados con su tipo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  const comun = { topic: 't1', topicName: 'Mercado', explanation: 'Ley de la demanda.' }
  const texto = 'Si sube el [[1]], baja la [[2]] demandada; la curva de [[3]] tiene pendiente negativa.'
  const choices = ['precio', 'cantidad', 'demanda', 'oferta']
  const sql = await practicarCon(page, [
    { ...comun, id: 'h1', type: 'gapselect', question: 'Completá el texto.', text: texto, choices },
    { ...comun, id: 'h2', type: 'ddwtos', question: 'Poné cada palabra en su hueco.', text: texto, choices },
  ])

  // Seleccionar: bien.
  await expect(page.getByText('Elegí la palabra de cada hueco.')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('combobox', { name: 'Hueco 1' }).selectOption({ label: 'precio' })
  await page.getByRole('combobox', { name: 'Hueco 2' }).selectOption({ label: 'cantidad' })
  await expect(page.getByRole('button', { name: /^Verificar/ })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Hueco 3' }).selectOption({ label: 'demanda' })
  await verificarYSeguir(page)

  // Arrastrar (tocar la palabra y el hueco): uno mal.
  await expect(page.getByText('Tocá una palabra y después el hueco donde va.')).toBeVisible()
  for (const [palabra, hueco] of [['precio', 1], ['oferta', 2], ['demanda', 3]] as const) {
    await page.getByRole('button', { name: palabra, exact: true }).click()
    await page.getByRole('button', { name: `Hueco ${hueco}: vacío` }).click()
  }
  await page.getByRole('button', { name: /^Verificar/ }).click()
  await expect(page.getByText('Correctas, en orden: precio · cantidad · demanda')).toBeVisible()
  await page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ }).click()
  await expect(page.getByText('1 de 2 correctas')).toBeVisible({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const filas = (await sql`
        SELECT a.question_id, a.question_type, a.is_correct, a.answer_payload FROM quiz_answers a
        JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
        WHERE t.user_id = 'stg-demo-sofia' AND a.question_id IN ('h1', 'h2')
        ORDER BY a.id DESC LIMIT 2
      `) as { question_id: string; question_type: string; is_correct: boolean; answer_payload: { selectedChoices: number[] } }[]
      return filas.map((f) => [f.question_id, f.question_type, f.is_correct, f.answer_payload.selectedChoices]).sort()
    }, { timeout: 30_000 })
    .toEqual([
      ['h1', 'gapselect', true, [0, 1, 2]],
      ['h2', 'ddwtos', false, [0, 3, 2]],
    ])
})

test('F6 · la palabra faltante: lo elegido aparece en la oración y se guarda con su tipo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarComo(page, ALUMNA)
  const sql = await practicarCon(page, [
    {
      id: 'p1',
      type: 'missing_word',
      topic: 't1',
      topicName: 'Cultura',
      question: 'Elegí la palabra que falta.',
      text: 'Juzgar otras culturas con los valores propios se llama [[1]].',
      options: ['etnocentrismo', 'relativismo', 'evolucionismo', 'difusionismo'],
      correctAnswer: 0,
      explanation: 'Es etnocentrismo.',
    },
  ])
  const oracion = page.locator('[data-oracion-con-hueco]')
  await expect(oracion).toBeVisible({ timeout: 30_000 })
  await page.getByRole('radio', { name: /etnocentrismo/ }).click()
  await expect(oracion).toContainText('se llama etnocentrismo')
  await verificarYSeguir(page)
  await expect(page.getByText('1 de 1 correctas')).toBeVisible({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const [fila] = (await sql`
        SELECT a.question_type, a.is_correct FROM quiz_answers a
        JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
        WHERE t.user_id = 'stg-demo-sofia' AND a.question_id = 'p1'
        ORDER BY a.id DESC LIMIT 1
      `) as { question_type: string; is_correct: boolean }[]
      return fila ? [fila.question_type, fila.is_correct] : null
    }, { timeout: 30_000 })
    .toEqual(['missing_word', true])
})
