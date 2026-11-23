import { expect, test } from '@playwright/test'
import { entrarConId, sqlDeStaging } from './ayudas'

/**
 * Ronda V · V6 — Las capturas del centro de ayuda (`public/ayuda/*.png`), con
 * la materia de ejemplo (V2): nada real. No corre con `npm run e2e`:
 *
 *   CAPTURAS_AYUDA=1 npx playwright test e2e/capturas-ayuda.spec.ts
 *
 * Deja el ejemplo borrado al final.
 */
test.skip(!process.env.CAPTURAS_AYUDA, 'Sólo para regenerar las capturas de la ayuda')
test.use({ viewport: { width: 1000, height: 800 } })

const DOCENTE = 'stg-v2-ejemplo'
const sinInsignia = 'nextjs-portal { display: none !important; }'

test('capturas de la ayuda', async ({ page }) => {
  test.setTimeout(240_000)
  const sql = await sqlDeStaging()
  await sql`
    INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
    VALUES (${DOCENTE}, ${`${DOCENTE}@staging.invalid`}, 'Docente V2 Ejemplo', 'DOCENTE', true, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
  await page.addLocatorHandler(page.getByRole('button', { name: 'Empezar los 30 días' }), (b) => b.click())
  await page.goto('/')
  await entrarConId(page, DOCENTE)
  await page.request.delete('/api/teacher/ejemplo')
  const { grupoId } = (await (await page.request.post('/api/teacher/ejemplo', { data: { area: 'economia' } })).json()) as { grupoId: number }

  await page.goto('/teacher?seccion=materias')
  await page.addStyleTag({ content: sinInsignia })
  await expect(page.getByText('Introducción a la Economía (ejemplo)').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 })
  await page.screenshot({ path: 'public/ayuda/mis-materias.png' })

  await page.goto('/teacher?seccion=tareas')
  await page.addStyleTag({ content: sinInsignia })
  await expect(page.getByText('Tarea 1 · Introducción a la Economía (ejemplo)').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 })
  await page.screenshot({ path: 'public/ayuda/mis-tareas.png' })

  await page.goto(`/teacher/grupos/${grupoId}`)
  await page.addStyleTag({ content: sinInsignia })
  await expect(page.getByText('Camila Ríos').first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: 'public/ayuda/grupo.png' })

  await page.getByRole('button', { name: 'Reportar un problema' }).click()
  await expect(page.getByLabel('Descripción del problema')).toBeVisible()
  await page.screenshot({ path: 'public/ayuda/reportar.png' })
  await page.keyboard.press('Escape')

  await page.request.delete('/api/teacher/ejemplo')

  await page.goto('/precios')
  await page.addStyleTag({ content: sinInsignia })
  await page.screenshot({ path: 'public/ayuda/precios.png' })
})
