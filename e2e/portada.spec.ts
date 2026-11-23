import { expect, test } from '@playwright/test'

/**
 * Ronda V · V5 — La portada pública: el titular, los tres caminos con su
 * captura y su botón, la entrada de siempre, y lo de los buscadores. El video
 * y los testimonios no se muestran sin contenido.
 */
test('V5 · la portada para los tres públicos', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Tu alumno llega a la mesa sabiendo qué le falta' })).toBeVisible()
  for (const [camino, boton] of [
    ['Doy clases particulares', 'Empezar con mis alumnos'],
    ['Doy clases en un curso', 'Empezar con mi curso'],
    ['Me preparo solo para un examen', 'Armar mi plan'],
  ]) {
    const tarjeta = page.locator('li').filter({ has: page.getByRole('heading', { name: camino }) })
    await expect(tarjeta.getByRole('img')).toBeVisible()
    await expect(tarjeta.getByRole('link', { name: boton })).toHaveAttribute('href', /^\/sign-in\?rol=/)
  }
  // La entrada de siempre sigue ahí.
  await expect(page.getByRole('heading', { name: '¿Cómo entrás?' })).toBeVisible()
  // Sin contenido, ni video ni testimonios.
  await expect(page.locator('[data-video-demo]')).toHaveCount(0)
  await expect(page.locator('[data-testimonios]')).toHaveCount(0)
  // Lo de los buscadores, sin pasar por el ingreso.
  expect((await page.request.get('/robots.txt')).status()).toBe(200)
  expect(await (await page.request.get('/sitemap.xml')).text()).toContain('<loc>')
  const og = await page.request.get('/opengraph-image')
  expect(og.headers()['content-type']).toContain('image/png')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /sabiendo qué le falta/)
})
