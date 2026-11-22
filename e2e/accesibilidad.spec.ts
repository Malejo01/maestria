import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, DOCENTE, GRUPO_LENGUA, entrarComo, responderUna } from './ayudas'

/**
 * O17 · Accesibilidad con axe-core en las pantallas que más se usan: el panel
 * del docente, la página del grupo, una pregunta del cuestionario y los
 * resultados (WCAG 2.1 A y AA).
 *
 * P8: falla también con lo `moderate` (antes, sólo `serious` y `critical`); lo
 * `minor` se anota en el reporte de la prueba, con dónde está. Y se audita en
 * claro y en oscuro (el chip de avance no llegaba a 4,5:1 sólo en oscuro), la
 * alumna a 390 px y con la pregunta ya respondida ("Siguiente").
 */
const FALLAN = new Set(['critical', 'serious', 'moderate'])

async function auditar(page: Page, pantalla: string) {
  const { violations } = await new AxeBuilder({ page })
    // P8: también las buenas prácticas de axe (landmarks, títulos): ahí estaba
    // el <main> duplicado detrás del cuestionario.
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    // El botón de Next en desarrollo no es parte de la app.
    .exclude('nextjs-portal')
    .analyze()
  const detalle = (v: (typeof violations)[number]) =>
    `${v.impact} · ${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} → ${n.html.slice(0, 140)}`).slice(0, 4).join(' | ')}`
  const graves = violations.filter((v) => FALLAN.has(String(v.impact))).map(detalle)
  const leves = violations.filter((v) => !FALLAN.has(String(v.impact))).map(detalle)
  if (leves.length) test.info().annotations.push({ type: `axe minor (${pantalla})`, description: leves.join(' || ') })
  if (process.env.AXE_DETALLE) console.log(`[${pantalla}] ` + [...graves, ...leves].join(' || '))
  expect.soft(graves, `${pantalla}: problemas de accesibilidad`).toEqual([])
}

const MODOS = ['claro', 'oscuro'] as const

async function ponerModo(page: Page, modo: (typeof MODOS)[number]) {
  await page.evaluate((m) => localStorage.setItem('maestria-tema', m), modo)
}

for (const modo of MODOS) {
  test(`docente (${modo}): el panel y la página del grupo`, async ({ page }) => {
    await entrarComo(page, DOCENTE)
    await ponerModo(page, modo)
    for (const ruta of ['/teacher', '/teacher?seccion=materias', '/teacher?seccion=tareas', `/teacher/grupos/${GRUPO_LENGUA.id}`]) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      await auditar(page, `${modo} ${ruta}`)
    }
  })
}

/** Una tarea sin tope de intentos del grupo de Lengua: hacerla no le quita nada a la alumna. */
const TAREA = 'Lengua · 4to Año · 11/7/2026'

for (const modo of MODOS) {
  test(`alumna (${modo}, 390 px): una pregunta, respondida, y los resultados`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await entrarComo(page, ALUMNA)
    await ponerModo(page, modo)
    await page.goto('/aulas')
    const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: TAREA }) })
    await tarjeta.getByRole('button').first().click()
    const empezado = page.getByText('Tenés un cuestionario empezado')
    if (await empezado.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Empezar de nuevo' }).click()
      await page.getByRole('button', { name: 'Sí, empezar de nuevo' }).click()
    }
    await expect(page.getByText(/^1\/\d+$/)).toBeVisible()
    await auditar(page, `${modo} pregunta`)

    // Respondida: aparece "Siguiente" (con el mouse encima, como queda al tocar "Verificar").
    const radio = page.getByRole('radio').first()
    if (await radio.isVisible().catch(() => false)) await radio.click()
    else await page.locator('input[inputmode="decimal"], input[inputmode="text"], textarea').first().fill('1')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByRole('button', { name: /Siguiente|Ver resultados/ })).toBeVisible()
    await page.getByRole('button', { name: /Siguiente|Ver resultados/ }).hover()
    await auditar(page, `${modo} pregunta respondida`)
    await page.getByRole('button', { name: /Siguiente|Ver resultados/ }).click()

    const guardado = page.getByText('Guardado', { exact: true })
    // Se responde mientras esté la barra de avance del cuestionario: en los resultados ya no está
    // (el contador "2/10" no sirve: la nota de los resultados se escribe igual).
    const contador = page.getByRole('progressbar', { name: 'Avance del cuestionario' })
    for (let i = 0; i < 40 && (await contador.isVisible().catch(() => false)); i++) await responderUna(page)
    await expect(guardado).toBeVisible()
    await auditar(page, `${modo} resultados`)
  })
}
