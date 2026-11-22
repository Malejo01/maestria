import { expect, test, type Locator, type Page } from '@playwright/test'
import { ALUMNA, DOCENTE, GRUPO_LENGUA, entrarComo } from './ayudas'

/**
 * P6 · El botón flotante de "Reportar un problema" no tapa "Siguiente" (ni
 * "Verificar") en el cuestionario, ni los botones de resultados, a 360 y 390
 * px y con una pregunta larga. Se comparan las cajas (`boundingBox`).
 *
 * La tarea es "Prueba M1" de Sofía, pero con las preguntas cambiadas en el
 * camino (una consigna muy larga y sólo dos preguntas) y el guardado simulado:
 * no gasta intentos ni escribe nada en staging.
 */
const TAREA = 'Prueba M1 · sin conexión'
const LARGA =
  'Leé con atención el siguiente enunciado antes de responder. ' +
  'En una clase de geometría, la docente dibuja en el pizarrón dos triángulos y explica que son semejantes porque sus ángulos correspondientes son iguales y sus lados son proporcionales. '.repeat(6) +
  '¿Cuál es la razón de semejanza?'

function seSuperponen(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function noTapa(boton: Locator, otros: Locator, que: string) {
  const caja = await boton.boundingBox()
  expect(caja, 'el botón de reportar está en pantalla').not.toBeNull()
  for (const otro of await otros.all()) {
    if (!(await otro.isVisible())) continue
    const otra = await otro.boundingBox()
    if (!otra) continue
    const nombre = (await otro.textContent())?.trim()
    expect(seSuperponen(caja!, otra), `${que}: "Reportar" tapa "${nombre}" (${JSON.stringify(caja)} / ${JSON.stringify(otra)})`).toBe(false)
  }
}

async function preguntasLargas(page: Page) {
  await page.route(/\/api\/student\/assignments\/\d+$/, async (ruta) => {
    const respuesta = await ruta.fetch()
    const datos = await respuesta.json()
    const preguntas = (datos.assignment?.questions ?? []).slice(0, 2)
    if (preguntas[0]) preguntas[0] = { ...preguntas[0], question: LARGA }
    await ruta.fulfill({ response: respuesta, json: { ...datos, assignment: { ...datos.assignment, questions: preguntas } } })
  })
  await page.route('**/api/quiz/save-result', (ruta) =>
    ruta.fulfill({ json: { success: true, quizAttemptId: 1, classroomId: GRUPO_LENGUA.id, assignmentId: null, attemptNumber: null } }),
  )
}

for (const ancho of [360, 390]) {
  test(`a ${ancho} px: "Reportar" no tapa la barra del cuestionario ni la de resultados`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 740 })
    await entrarComo(page, ALUMNA)
    await preguntasLargas(page)
    await page.goto('/aulas')
    await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: TAREA }) }).getByRole('button').first().click()
    const empezado = page.getByText('Tenés un cuestionario empezado')
    if (await empezado.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Empezar de nuevo' }).click()
      await page.getByRole('button', { name: 'Sí, empezar de nuevo' }).click()
    }

    const reportar = page.getByRole('button', { name: 'Reportar un problema' })
    const barra = page.locator('[data-quiz-action-bar]').getByRole('button')
    await expect(page.getByText(/^1\/2$/)).toBeVisible()
    await expect(reportar).toBeVisible()
    await noTapa(reportar, barra, `pregunta larga sin responder (${ancho})`)
    await page.screenshot({ path: `docs/capturas/p6-reportar/pregunta-larga-${ancho}.png` })

    // Responder: aparece "Siguiente" (y la explicación hace crecer la barra).
    for (let i = 1; i <= 2; i++) {
      const radio = page.getByRole('radio').first()
      if (await radio.isVisible().catch(() => false)) await radio.click()
      else await page.locator('input[inputmode="decimal"], input[inputmode="text"], textarea').first().fill('1')
      await page.getByRole('button', { name: /Verificar|Comprobar/ }).click()
      await expect(page.getByRole('button', { name: /Siguiente|Ver resultados|Terminar/ })).toBeVisible()
      await noTapa(reportar, barra, `pregunta ${i} respondida (${ancho})`)
      if (i === 1) await page.screenshot({ path: `docs/capturas/p6-reportar/siguiente-${ancho}.png` })
      await page.getByRole('button', { name: /Siguiente|Ver resultados|Terminar/ }).click()
    }

    // Resultados (F2): tampoco tapa sus botones.
    await expect(page.locator('[data-quiz-action-bar]')).toBeVisible()
    await noTapa(reportar, page.locator('[data-quiz-action-bar]').getByRole('button'), `resultados (${ancho})`)
    await page.screenshot({ path: `docs/capturas/p6-reportar/resultados-${ancho}.png` })
  })
}

test('a 390 px: en la ficha del alumno, "Reportar" no tapa los botones del diálogo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 })
  await entrarComo(page, DOCENTE)
  await page.goto(`/teacher/grupos/${GRUPO_LENGUA.id}`)
  await page.getByRole('row').nth(1).getByRole('button').first().click()
  const ficha = page.getByRole('dialog')
  await expect(ficha).toBeVisible()
  const reportar = page.getByRole('button', { name: 'Reportar un problema' })
  if (await reportar.isVisible().catch(() => false)) {
    await noTapa(reportar, ficha.getByRole('button'), 'ficha del alumno')
  }
  await page.screenshot({ path: 'docs/capturas/p6-reportar/ficha-390.png' })
})
