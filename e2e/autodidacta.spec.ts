import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, entrarComo, marca, responderUna, simularGeneracion } from './ayudas'

/**
 * Ronda T · E1: el alumno que se prepara solo. Declara que es mayor de 18 (si
 * no lo había hecho), sube un programa (la lectura, simulada: no gasta), pone
 * la fecha del examen, hace el diagnóstico, ve el plan, hace la práctica de
 * hoy y un simulacro cronometrado, y vuelve a ver su plan. IA simulada.
 *
 * Deja en staging una materia personal "E2E · Antropología …" de Sofía.
 */
const UNIDADES = [
  { name: 'Unidad 1: La perspectiva antropológica', topics: [{ name: 'El concepto de cultura' }, { name: 'Etnocentrismo y relativismo' }] },
  { name: 'Unidad 2: Parentesco y rituales', topics: [{ name: 'Familia y parentesco' }, { name: 'Ritos de paso' }] },
]

/** Sin devolución hasta el final (diagnóstico y simulacro): elegir y pasar. */
async function responderAlFinal(page: Page, ultima: boolean) {
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: ultima ? 'Terminar' : 'Siguiente', exact: true }).click()
}

test('autodidacta: programa, diagnóstico, plan, práctica y simulacro', async ({ page }) => {
  test.setTimeout(180_000)
  await entrarComo(page, ALUMNA)
  await simularGeneracion(page)
  await page.route('**/api/curriculum/parse-program', (ruta) => ruta.fulfill({ json: { units: UNIDADES, area: 'sociales', areaConfianza: 0.9, extractionMethod: 'ai' } }))

  await page.goto('/practicar')
  await page.getByRole('link', { name: /Me preparo solo para un examen/ }).click()
  await expect(page.getByRole('heading', { name: 'Me preparo solo para un examen', level: 1 })).toBeVisible()

  const declaracion = page.getByRole('checkbox', { name: 'Declaro que soy mayor de 18 años.' })
  if (await declaracion.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Sin la casilla no sigue.
    await expect(page.getByRole('button', { name: 'Seguir' })).toBeDisabled()
    await declaracion.check()
    await page.getByRole('button', { name: 'Seguir' }).click()
  }

  const nombre = `E2E · Antropología ${marca()}`
  await page.locator('input[type="file"]').setInputFiles({ name: 'programa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 programa de prueba') })
  await expect(page.getByText('Leímos 2 unidades y 4 temas.')).toBeVisible()
  await page.getByLabel('Nombre de la materia').fill(nombre)
  const examen = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('Fecha del examen').fill(examen)
  await page.getByRole('button', { name: 'Crear mi materia' }).click()

  // La materia: primero el diagnóstico.
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Hacer el diagnóstico' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  for (let i = 0; i < 5; i++) await responderAlFinal(page, i === 4)
  await page.getByRole('link', { name: 'Volver a mi plan' }).click()

  // El plan, con lo que tiene que reforzar y la práctica de hoy.
  await expect(page.getByRole('heading', { name: 'Tu plan hasta el examen' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' }).click()
  for (let i = 0; i < 10; i++) await responderUna(page)
  await page.getByRole('link', { name: 'Volver a mi plan' }).click()

  // El simulacro: cronometrado y con el aviso de que nunca usa exámenes reales.
  await expect(page.getByText('Nunca usamos preguntas de exámenes reales.')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '10 preguntas en 15 minutos' }).click()
  await expect(page.getByRole('heading', { name: 'Simulacro de examen', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByRole('timer')).toHaveAccessibleName(/Tiempo restante: 1[45]:/)
  for (let i = 0; i < 10; i++) await responderAlFinal(page, i === 9)
  await expect(page.getByRole('link', { name: 'Volver a mi plan' })).toBeVisible()
  await page.getByRole('link', { name: 'Volver a mi plan' }).click()
  await expect(page.getByText('Lo que tenés que reforzar')).toBeVisible({ timeout: 30_000 })
})
