import { expect, test } from '@playwright/test'
import { entrarConId } from './ayudas'

/**
 * Ronda V · V3 — El que recomendó ve su código y su link, y la campanita le
 * avisa el premio. Necesita el dev server con MAESTRIA_REFERIDOS_ACTIVO=1 y el
 * referido ya pagado (scripts/qa/simular-referido.ts + simular-pago.ts con el
 * código, sobre `stg-v3-referente`). Con los referidos apagados (lo normal) se
 * saltea: la válvula se prueba en lib/referidos-server.test.ts.
 */
test('V3 · el docente ve su código de referido y el aviso del premio', async ({ page }, info) => {
  await page.addLocatorHandler(page.getByRole('button', { name: 'Empezar los 30 días' }), async (b) => {
    await b.click()
  })
  await page.goto('/')
  await entrarConId(page, 'stg-v3-referente')
  const datos = (await (await page.request.get('/api/teacher/referidos')).json()) as { activo: boolean; codigo: string | null; link: string | null }
  test.skip(!datos.activo, 'Referidos apagados (MAESTRIA_REFERIDOS_ACTIVO no es 1)')

  await page.goto('/teacher')
  const tarjeta = page.locator('[data-recomendar]')
  await expect(tarjeta).toContainText(datos.codigo!)
  await expect(tarjeta).toContainText(`/?ref=${datos.codigo}`)
  await expect(tarjeta.getByRole('link', { name: 'Mandarlo por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
  await tarjeta.scrollIntoViewIfNeeded()
  await tarjeta.screenshot({ path: `docs/capturas/ronda-v/v3/recomendar-${info.project.name}.png` })

  await page.getByRole('button', { name: /^Avisos/ }).click()
  await expect(page.locator('[data-aviso="referidoPremio"]').first()).toContainText('Te sumamos 30 días')
  await page.screenshot({ path: `docs/capturas/ronda-v/v3/aviso-${info.project.name}.png` })
})
