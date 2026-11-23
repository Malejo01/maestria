import { expect, test } from '@playwright/test'

/**
 * Ronda X · X4 — MaestrIA instalable. Corre contra un build de PRODUCCIÓN
 * (el service worker no se registra en `next dev`), servido contra staging:
 *
 *   PWA_URL=http://localhost:3100 npx playwright test e2e/pwa.spec.ts
 *
 * Mira el manifiesto, los íconos, que el service worker guarde sólo la cáscara
 * (nunca /api/ ni una página) y que sin internet se vea "Sin conexión".
 */
const URL_PWA = process.env.PWA_URL
test.skip(!URL_PWA, 'Hace falta PWA_URL (un build de producción servido contra staging)')

test('X4 · manifiesto, íconos y service worker que guarda sólo la cáscara', async ({ page, context }) => {
  test.setTimeout(120_000)
  const manifiesto = await (await page.request.get(`${URL_PWA}/manifest.webmanifest`)).json()
  expect(manifiesto).toMatchObject({ name: 'MaestrIA', display: 'standalone', start_url: '/' })
  expect(manifiesto.icons.map((i: { purpose: string }) => i.purpose)).toEqual(['any', 'any', 'maskable'])
  for (const icono of manifiesto.icons as { src: string }[]) {
    const res = await page.request.get(`${URL_PWA}${icono.src}`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  }
  const sw = await page.request.get(`${URL_PWA}/sw.js`)
  expect(sw.headers()['cache-control']).toContain('no-cache')

  await page.goto(`${URL_PWA}/`)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Una vuelta más, ya con el service worker al mando.
  await page.reload()
  await page.waitForLoadState('networkidle')
  const guardado = await page.evaluate(async () => {
    const claves: string[] = []
    for (const nombre of await caches.keys()) for (const req of await (await caches.open(nombre)).keys()) claves.push(new URL(req.url).pathname)
    return claves
  })
  expect(guardado).toContain('/sin-conexion')
  expect(guardado.some((p) => p.startsWith('/_next/static/'))).toBe(true)
  expect(guardado.filter((p) => p.startsWith('/api/'))).toEqual([])
  expect(guardado.filter((p) => !p.startsWith('/_next/static/') && !['/sin-conexion', '/icon.svg', '/manifest.webmanifest'].includes(p) && !p.startsWith('/icono-pwa/'))).toEqual([])

  // Sin internet: una navegación muestra "Sin conexión".
  await context.setOffline(true)
  await page.goto(`${URL_PWA}/aulas`).catch(() => {})
  await expect(page.locator('[data-sin-conexion]')).toBeVisible({ timeout: 15_000 })
  for (const modo of ['claro', 'oscuro'] as const) {
    await page.evaluate((m) => {
      if (m === 'oscuro') document.documentElement.dataset.theme = 'oscuro'
      else document.documentElement.dataset.theme = 'claro'
    }, modo)
    for (const ancho of [360, 390, 1280]) {
      await page.setViewportSize({ width: ancho, height: 800 })
      await page.waitForTimeout(200)
      await page.screenshot({ path: `docs/capturas/ronda-x/x4/sin-conexion-${ancho}-${modo}.png` })
    }
  }
  await context.setOffline(false)
})
