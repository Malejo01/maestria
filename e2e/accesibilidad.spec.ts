import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, DOCENTE, GRUPO_LENGUA, entrarComo, responderUna } from './ayudas'

/**
 * O17 · Accesibilidad con axe-core en las pantallas que más se usan: el panel
 * del docente, la página del grupo, una pregunta del cuestionario y los
 * resultados. Falla con lo `serious` o `critical` (WCAG 2.1 A y AA); lo
 * `moderate` y `minor` se anota en el reporte de la prueba pero no la frena.
 */
async function auditar(page: Page, pantalla: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // El botón de Next en desarrollo no es parte de la app.
    .exclude('nextjs-portal')
    .analyze()
  const graves = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} · ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 160)).slice(0, 4).join(' | ')}`)
  const leves = violations.filter((v) => !graves.some((g) => g.includes(v.id))).map((v) => `${v.impact} · ${v.id}`)
  if (leves.length) test.info().annotations.push({ type: `axe leves (${pantalla})`, description: leves.join(', ') })
  expect.soft(graves, `${pantalla}: problemas graves de accesibilidad`).toEqual([])
}

test('docente: el panel y la página del grupo', async ({ page }) => {
  await entrarComo(page, DOCENTE)
  for (const ruta of ['/teacher', '/teacher?seccion=materias', '/teacher?seccion=tareas', `/teacher/grupos/${GRUPO_LENGUA.id}`]) {
    await page.goto(ruta)
    await page.waitForLoadState('networkidle')
    await auditar(page, ruta)
  }
})

/** Una tarea sin tope de intentos del grupo de Lengua: hacerla no le quita nada a la alumna. */
const TAREA = 'Lengua · 4to Año · 11/7/2026'

test('alumna: una pregunta y los resultados', async ({ page }) => {
  test.setTimeout(180_000)
  await entrarComo(page, ALUMNA)
  await page.goto('/aulas')
  const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: TAREA }) })
  await tarjeta.getByRole('button').first().click()
  const empezado = page.getByText('Tenés un cuestionario empezado')
  if (await empezado.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click()
    await page.getByRole('button', { name: 'Sí, empezar de nuevo' }).click()
  }
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible()
  await auditar(page, 'pregunta')

  const guardado = page.getByText('Guardado', { exact: true })
  // Se responde mientras esté la barra de avance del cuestionario: en los resultados ya no está
  // (el contador "2/10" no sirve: la nota de los resultados se escribe igual).
  const contador = page.getByRole('progressbar', { name: 'Avance del cuestionario' })
  for (let i = 0; i < 40 && (await contador.isVisible().catch(() => false)); i++) await responderUna(page)
  await expect(guardado).toBeVisible()
  await auditar(page, 'resultados')
})
