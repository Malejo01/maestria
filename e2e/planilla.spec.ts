import { expect, test } from '@playwright/test'
import { DOCENTE, GRUPO_LENGUA, entrarComo } from './ayudas'

/** Recorrido 4: el docente abre la página del grupo (M3) y ordena la planilla (M4). */
test('el docente ordena la planilla del grupo', async ({ page }) => {
  await entrarComo(page, DOCENTE)
  await page.goto(`/teacher/grupos/${GRUPO_LENGUA.id}`)
  await expect(page.getByRole('heading', { name: /Lengua/ }).first()).toBeVisible()

  const porPromedio = page.getByRole('button', { name: 'Ordenar por Promedio' }).first()
  await porPromedio.click()
  await expect(page).toHaveURL(/orden=promedio/)
  const th = page.locator('th', { has: porPromedio })
  const primero = await th.getAttribute('aria-sort')
  expect(['ascending', 'descending']).toContain(primero)

  // El segundo toque invierte, y la URL lo dice.
  await porPromedio.click()
  await expect(th).toHaveAttribute('aria-sort', primero === 'ascending' ? 'descending' : 'ascending')

  // La URL manda: al recargar sigue ordenada.
  await page.reload()
  await expect(page.locator('th', { has: page.getByRole('button', { name: 'Ordenar por Promedio' }) }).first()).toHaveAttribute(
    'aria-sort',
    primero === 'ascending' ? 'descending' : 'ascending',
  )
})
