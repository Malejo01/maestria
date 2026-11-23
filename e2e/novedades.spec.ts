import { expect, test } from '@playwright/test'
import { ALUMNA, capturarSinRecargar, DOCENTE, entrarComo } from './ayudas'

/**
 * Ronda Y · Y3 — /novedades (pública) y la novedad en la campanita del docente
 * y del alumno, una vez por novedad.
 */
test('Y3 · /novedades se lee sin cuenta', async ({ page }) => {
  await page.goto('/novedades')
  await expect(page.getByRole('heading', { name: 'Novedades de MaestrIA' })).toBeVisible({ timeout: 30_000 })
  const entrada = page.getByRole('link', { name: /Lo nuevo de noviembre/ })
  await expect(entrada).toBeVisible()
  await capturarSinRecargar(page, 'docs/capturas/ronda-y/y3', 'novedades')
  await entrada.click()
  await expect(page.locator('[data-novedad="lo-nuevo-de-noviembre"]')).toContainText('Para docentes')
  await expect(page.getByRole('heading', { name: 'Para alumnos' })).toBeVisible()
  await capturarSinRecargar(page, 'docs/capturas/ronda-y/y3', 'novedad')
})

for (const [quien, ruta] of [
  [DOCENTE, '/api/teacher/avisos'],
  [ALUMNA, '/api/avisos'],
] as const) {
  test(`Y3 · la novedad en la campanita de ${quien}, una sola vez`, async ({ page }) => {
    await entrarComo(page, quien)
    const { avisos } = (await (await page.request.get(ruta)).json()) as { avisos: { tipo: string; clave: string; titulo: string; href: string }[] }
    const novedades = avisos.filter((a) => a.tipo === 'novedad')
    expect(novedades.filter((a) => a.clave === 'novedad|lo-nuevo-de-noviembre')).toHaveLength(1)
    expect(novedades[0]).toMatchObject({ titulo: 'Novedades de MaestrIA: Lo nuevo de noviembre', href: '/novedades/lo-nuevo-de-noviembre' })
  })
}
