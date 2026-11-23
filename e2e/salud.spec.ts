import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo, sqlDeStaging } from './ayudas'

/**
 * Ronda Y · Y1 — La salud del sistema y sus alertas. Necesita que Irina sea
 * admin en el `next dev` de staging (un `.env.development.local` con
 * `ADMIN_EMAILS=usuario8@staging.invalid`, que se borra al terminar):
 *
 *   ADMIN_E2E=1 npx playwright test e2e/salud.spec.ts
 *
 * Siembra 6 generaciones de la última hora (3 fallidas) y un pago con el monto
 * distinto; mira /admin/salud y la campanita; borra lo sembrado.
 */
test.skip(!process.env.ADMIN_E2E, 'Hace falta ADMIN_E2E=1 (Irina admin en staging)')

test('Y1 · /admin/salud y las alertas en la campanita del admin', async ({ page }) => {
  test.setTimeout(120_000)
  const sql = await sqlDeStaging()
  const marca = `e2e-salud-${Date.now()}`
  const ids = (await sql`
    INSERT INTO ai_usage_log (user_id, is_guest, endpoint, model, status, created_at, preguntas_crudas, preguntas_descartadas)
    SELECT 'stg-user-0008', false, 'quiz_generation', ${marca}, CASE WHEN g <= 3 THEN 'error' ELSE 'ok' END, NOW() - make_interval(mins => g), 10, 2
    FROM generate_series(1, 6) g
    RETURNING id
  `) as { id: number }[]
  const [pago] = (await sql`
    INSERT INTO pagos (user_id, plan, forma, cantidad, monto_lista, monto, estado, mp_payment_id, detalle)
    VALUES ('stg-user-0008', 'particular', 'mensual', 1, 20000, 20000, 'pendiente', ${marca}, ${JSON.stringify({ descripcion: 'E2E salud', revisar: 'montoDistinto', montoCobrado: 15000 })})
    RETURNING id
  `) as { id: number }[]
  try {
    await entrarComo(page, DOCENTE)
    await page.goto('/admin/salud')
    await expect(page.getByRole('heading', { name: 'Salud del sistema' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-alerta-hora="true"]')).toBeVisible()
    await expect(page.locator('[data-pagos-a-revisar]')).toContainText(`Pago ${pago.id}`)
    await expect(page.getByText('Mercado Pago cobró otro monto').first()).toBeVisible()
    for (const modo of ['claro', 'oscuro'] as const) {
      await page.evaluate((m) => {
        document.documentElement.dataset.theme = m
      }, modo)
      for (const ancho of [360, 390, 1280]) {
        await page.setViewportSize({ width: ancho, height: 900 })
        await page.screenshot({ path: `docs/capturas/ronda-y/y1/salud-${ancho}-${modo}.png`, fullPage: true })
      }
    }
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'claro'
    })
    await page.setViewportSize({ width: 1280, height: 800 })

    const avisos = (await (await page.request.get('/api/teacher/avisos')).json()) as { avisos: { tipo: string; titulo: string; href: string }[] }
    const delSistema = avisos.avisos.filter((a) => a.tipo === 'alertaSistema')
    expect(delSistema.map((a) => a.titulo)).toEqual(expect.arrayContaining(['Fallan muchas generaciones', 'Hay un pago para revisar']))
    expect(delSistema.every((a) => a.href === '/admin/salud')).toBe(true)
  } finally {
    await sql`DELETE FROM ai_usage_log WHERE id = ANY(${ids.map((i) => i.id)})`
    await sql`DELETE FROM pagos WHERE id = ${pago.id}`
  }
})
