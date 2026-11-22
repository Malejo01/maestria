import { expect, test } from '@playwright/test'
import { ALUMNA, entrarComo, responderUna } from './ayudas'

/**
 * Recorrido 3 (M1): la alumna responde dos preguntas, se corta la conexión,
 * responde una más, vuelve la conexión, recarga, y sigue desde la cuarta.
 * No termina la tarea: no gasta ninguno de sus intentos.
 */
const TAREA = 'Prueba M1 · sin conexión'

async function abrirTarea(page: import('@playwright/test').Page) {
  await page.goto('/aulas')
  const tarjeta = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: TAREA }) })
  await tarjeta.getByRole('button').first().click()
}

test('cortar la conexión a mitad, recargar y seguir', async ({ page, context }) => {
  await entrarComo(page, ALUMNA)
  await abrirTarea(page)

  // Un contexto nuevo no tiene borrador; si lo hubiera, se empieza de nuevo.
  const empezado = page.getByText('Tenés un cuestionario empezado')
  if (await empezado.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click()
    await page.getByRole('button', { name: 'Sí, empezar de nuevo' }).click()
  }

  await expect(page.getByText(/^1\/14$/)).toBeVisible()
  await responderUna(page)
  await responderUna(page)
  await expect(page.getByText(/^3\/14$/)).toBeVisible()

  await context.setOffline(true)
  await responderUna(page)
  await expect(page.getByText(/^4\/14$/)).toBeVisible()
  await context.setOffline(false)

  await page.reload()
  await abrirTarea(page)
  await expect(page.getByText('Tenés un cuestionario empezado')).toBeVisible()
  await expect(page.getByText('3 de 14 respondidas')).toBeVisible()
  await page.getByRole('button', { name: 'Seguir donde estaba' }).click()
  await expect(page.getByText(/^4\/14$/)).toBeVisible()
})
