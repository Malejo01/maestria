import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo } from './ayudas'

/**
 * Ronda V · V4 — El informe para la familia: Irina lo arma desde la ficha de
 * Sofía, el link se abre sin sesión (sólo lectura, sin datos de otros
 * alumnos) y, al revocarlo, deja de abrir. Deja en staging un link revocado.
 */
test('V4 · compartir el informe de un alumno con su familia y revocarlo', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  await entrarComo(page, DOCENTE)
  await page.goto('/teacher/alumnos/stg-demo-sofia')
  await page.getByRole('button', { name: 'Compartir informe' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Próximos pasos (los lee la familia)').fill('Repasar los textos argumentativos.\nLeer 15 minutos por día.')
  await dialogo.getByRole('button', { name: 'Armar el link' }).click()
  const link = (await dialogo.locator('[data-link-del-informe] p.break-all').textContent())?.trim() ?? ''
  expect(link).toMatch(/\/informe\/[A-Za-z0-9_-]{43}$/)
  await expect(dialogo.getByRole('link', { name: 'Mandarlo por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
  await page.screenshot({ path: `docs/capturas/ronda-v/v4/compartir-${info.project.name}.png` })

  // Sin sesión, en otro navegador. El link apunta al sitio público: se abre la ruta acá.
  const ruta = new URL(link).pathname
  const familia = await browser.newContext()
  const otra = await familia.newPage()
  const respuesta = await otra.goto(ruta)
  expect(respuesta?.status()).toBe(200)
  const informe = otra.locator('[data-informe-familia]')
  await expect(informe).toContainText('Cómo viene Sofía')
  await expect(informe).toContainText('Leer 15 minutos por día.')
  await expect(informe).toContainText('Lo que ya domina')
  // Nada de otros alumnos ni de la ficha del docente.
  await expect(informe).not.toContainText('@')
  expect(await otra.locator('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/)
  await otra.screenshot({ path: `docs/capturas/ronda-v/v4/informe-${info.project.name}-1280.png`, fullPage: true })
  await otra.setViewportSize({ width: 390, height: 844 })
  await otra.screenshot({ path: `docs/capturas/ronda-v/v4/informe-${info.project.name}-390.png`, fullPage: true })

  // Se revoca y deja de abrir.
  const activos = dialogo.locator('li').filter({ hasText: 'vence el' })
  const cuantos = await activos.count()
  await activos.first().getByRole('button', { name: 'Revocar' }).click()
  await expect(activos).toHaveCount(cuantos - 1)
  await otra.reload()
  await expect(otra.getByText('Este link no existe, venció o el docente lo revocó.')).toBeVisible()
  // Un token inventado tampoco.
  await otra.goto('/informe/no-es-un-token')
  await expect(otra.getByText('Este link no existe, venció o el docente lo revocó.')).toBeVisible()
  await familia.close()
})
