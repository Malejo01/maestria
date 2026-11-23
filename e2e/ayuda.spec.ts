import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo } from './ayudas'

/** Ronda V · V6 — El centro de ayuda: público, con sus 8 guías, y el ícono "¿Cómo funciona esto?" desde la app. */
test('V6 · el centro de ayuda y "¿Cómo funciona esto?"', async ({ page, browser }, info) => {
  // Sin sesión: el índice y una guía.
  const visitante = await browser.newContext()
  const p = await visitante.newPage()
  await p.goto('/ayuda')
  await expect(p.locator('[data-guias] li')).toHaveCount(8)
  await p.getByRole('link', { name: /Exportar a Moodle/ }).click()
  await expect(p.getByRole('heading', { level: 1, name: 'Exportar a Moodle' })).toBeVisible()
  await expect(p.locator('[data-guia="exportar-a-moodle"]')).toContainText('Moodle XML')
  await p.goto('/ayuda/grupos-y-alumnos')
  await expect(p.getByRole('img', { name: 'El grupo, con la planilla de cada alumno' })).toBeVisible()
  await p.screenshot({ path: `docs/capturas/ronda-v/v6/guia-${info.project.name}.png`, fullPage: true })
  expect((await p.goto('/ayuda/no-existe'))?.status()).toBe(404)
  await visitante.close()

  // Desde la app.
  await entrarComo(page, DOCENTE)
  await page.goto('/teacher?seccion=tareas')
  await page.locator('[data-como-funciona="armar-una-tarea"]').click()
  await expect(page).toHaveURL(/\/ayuda\/armar-una-tarea$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Armar una tarea' })).toBeVisible()
})
