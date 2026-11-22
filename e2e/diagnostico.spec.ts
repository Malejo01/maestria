import { expect, test } from '@playwright/test'
import { DOCENTE, entrarComo } from './ayudas'

/**
 * Recorrido 5: el docente arma un diagnóstico para un grupo eligiendo temas
 * (L4). La generación está SIMULADA (las dos rutas que escriben): la prueba
 * verifica que al servidor le llegue exactamente lo elegido —una unidad
 * destildada no viaja, un tema destildado tampoco— y que el diálogo termine en
 * "Listo". No escribe nada en staging ni gasta IA.
 */
test('el docente arma un diagnóstico para un grupo eligiendo temas', async ({ page }) => {
  const pedidos: { unidadId: unknown; temas: { id: string }[] }[] = []
  await page.route('**/api/teacher/diagnosticos', async (ruta) => {
    if (ruta.request().method() !== 'POST') return ruta.continue()
    await ruta.fulfill({ json: { diagnosticoId: 999_001 } })
  })
  await page.route('**/api/teacher/diagnosticos/999001/cuestionarios', async (ruta) => {
    pedidos.push(ruta.request().postDataJSON())
    await ruta.fulfill({ json: { quizId: 999_100 + pedidos.length } })
  })

  await entrarComo(page, DOCENTE)
  await page.goto('/teacher/grupos/1')
  await page.getByRole('button', { name: 'Armar diagnóstico o práctica' }).click()
  const d = page.getByRole('dialog', { name: 'Armar diagnóstico' })

  // Afuera una unidad entera, y un tema de otra.
  await d.getByRole('checkbox', { name: 'Números y Operaciones' }).click()
  await d.getByRole('button', { name: /^Unidad V · Estadística/ }).click()
  const temasEstadistica = d.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Unidad V · Estadística' }) })
  await temasEstadistica.getByRole('checkbox').nth(1).click()
  await expect(d.getByText(/^3 cuestionarios · /)).toBeVisible()

  await d.getByRole('button', { name: 'Generar y asignar' }).click()
  await expect(d.getByText('Listo. Quedaron guardados y asignados al grupo.')).toBeVisible()

  expect(pedidos).toHaveLength(3)
  const temasPorPedido = pedidos.map((p) => p.temas.length)
  // Estadística tenía 2 temas y quedó 1.
  expect(temasPorPedido).toContain(1)
})
