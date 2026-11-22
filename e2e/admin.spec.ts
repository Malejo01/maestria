import { expect, test } from '@playwright/test'
import { ALUMNA, DOCENTE, entrarComo } from './ayudas'
import { SECCIONES_ADMIN } from '../lib/admin/secciones'

/**
 * P1 · El panel de admin no existe para quien no está en ADMIN_EMAILS: un
 * docente y una alumna reciben 404 (no un redirect ni un 403) en /admin, en
 * cada sección, en la ficha de un docente y en la API de admin.
 *
 * Requiere que la cuenta de la docente de prueba NO esté en ADMIN_EMAILS (no
 * correr con el `.env.development.local` que la hace admin para las capturas).
 */
const RUTAS = [...SECCIONES_ADMIN.map((s) => s.href), '/admin/docentes/cualquiera']

for (const quien of [DOCENTE, ALUMNA]) {
  test(`${quien}: 404 en /admin y cada subpágina`, async ({ page }) => {
    await entrarComo(page, quien)
    for (const ruta of RUTAS) {
      const respuesta = await page.goto(ruta)
      expect(respuesta?.status(), ruta).toBe(404)
      await expect(page, ruta).toHaveURL(new RegExp(`${ruta.replace(/\//g, '\/')}$`))
    }
    const api = await page.request.get('/api/admin/reportes?resumen=1')
    expect(api.status()).toBe(404)
    // Y el botón de la barra no está.
    await page.goto(quien === DOCENTE ? '/teacher' : '/aulas')
    await expect(page.getByRole('link', { name: 'Panel de administrador' })).toHaveCount(0)
  })
}
