import { expect, test } from '@playwright/test'
import { capturarSinRecargar, DOCENTE, entrarComo } from './ayudas'

/**
 * Ronda Y · Y2 — /admin/salud dice si el respaldo diario está configurado. En
 * el dev de staging falta RESPALDO_SECRETO: tiene que decir que no se está
 * haciendo (la válvula). Como e2e/salud.spec.ts, necesita a Irina admin:
 *
 *   ADMIN_E2E=1 npx playwright test e2e/respaldo.spec.ts
 */
test.skip(!process.env.ADMIN_E2E, 'Hace falta ADMIN_E2E=1 (Irina admin en staging)')

test('Y2 · sin configurar, /admin/salud avisa que el respaldo no se está haciendo', async ({ page }) => {
  await entrarComo(page, DOCENTE)
  await page.goto('/admin/salud')
  const seccion = page.locator('[data-respaldo]')
  await expect(seccion).toHaveAttribute('data-respaldo', 'sin-configurar', { timeout: 30_000 })
  await expect(seccion).toContainText('No está configurado: no se está haciendo.')
  await expect(seccion).toContainText('RESPALDO_SECRETO')
  await capturarSinRecargar(page, 'docs/capturas/ronda-y/y2', 'respaldo-sin-configurar', seccion)
  // La ruta del cron, sin configurar, no hace nada.
  const res = await page.request.get('/api/cron/respaldo')
  expect(res.status()).toBe(503)
})
