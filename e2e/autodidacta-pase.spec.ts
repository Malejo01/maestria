import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, entrarComo, marca, simularGeneracion, sqlDeStaging } from './ayudas'

/**
 * Ronda T · E2: el pase por materia. Gratis, el diagnóstico y dos prácticas;
 * la tercera práctica y los simulacros piden el pase. El pase se paga con
 * Mercado Pago SIMULADO (scripts/qa/simular-pago.ts, sólo staging) y abre todo
 * hasta el examen + 7. IA simulada.
 *
 * Deja en staging una materia personal "E2E · Economía …" de Sofía, con su
 * pago simulado y su pase.
 */
const UNIDADES = [
  { name: 'Unidad 1: Mercados', topics: [{ name: 'Oferta y demanda' }, { name: 'Elasticidad' }] },
  { name: 'Unidad 2: Macroeconomía', topics: [{ name: 'Inflación' }, { name: 'Política monetaria' }] },
]
const SOFIA_ID = 'stg-demo-sofia'

async function responderAlFinal(page: Page, cuantas: number) {
  for (let i = 0; i < cuantas; i++) {
    await page.getByRole('radio').first().click()
    await page.getByRole('button', { name: i === cuantas - 1 ? 'Terminar' : 'Siguiente', exact: true }).click()
  }
}

async function volverAlPlan(page: Page) {
  await page.getByRole('link', { name: 'Volver a mi plan' }).click()
  await expect(page.getByRole('heading', { name: 'Tu plan hasta el examen' })).toBeVisible({ timeout: 30_000 })
}

test('pase por materia: lo gratis, lo que pide el pase y el pase pagado', async ({ page }) => {
  test.setTimeout(240_000)
  await entrarComo(page, ALUMNA)
  await simularGeneracion(page)
  await page.route('**/api/curriculum/parse-program', (ruta) => ruta.fulfill({ json: { units: UNIDADES, area: 'economia', areaConfianza: 0.9, extractionMethod: 'ai' } }))

  await page.goto('/autodidacta')
  const declaracion = page.getByRole('checkbox', { name: 'Declaro que soy mayor de 18 años.' })
  if (await declaracion.isVisible({ timeout: 3000 }).catch(() => false)) {
    await declaracion.check()
    await page.getByRole('button', { name: 'Seguir' }).click()
  }
  const nombre = `E2E · Economía ${marca()}`
  await page.locator('input[type="file"]').setInputFiles({ name: 'programa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 programa de prueba') })
  await expect(page.getByText('Leímos 2 unidades y 4 temas.')).toBeVisible()
  await page.getByLabel('Nombre de la materia').fill(nombre)
  await page.getByLabel('Fecha del examen').fill(new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Crear mi materia' }).click()
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible({ timeout: 30_000 })
  const materia = Number(page.url().match(/autodidacta\/(\d+)/)?.[1])
  expect(materia).toBeGreaterThan(0)

  // Gratis: lo dice, y los simulacros están cerrados.
  await expect(page.getByText(/Gratis: el diagnóstico y 2 prácticas/)).toBeVisible()
  await expect(page.getByText('Los simulacros vienen con el pase.')).toBeVisible()
  await expect(page.getByRole('button', { name: '10 preguntas en 15 minutos' })).toBeDisabled()

  // El diagnóstico, gratis.
  await page.getByRole('button', { name: 'Hacer el diagnóstico' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await responderAlFinal(page, 5)
  await volverAlPlan(page)
  await expect(page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' })).toBeEnabled()

  // Las dos prácticas gratis: con la IA simulada en el navegador el servidor no
  // las cuenta, así que se anotan en staging como las anotaría él.
  const sql = await sqlDeStaging()
  await sql`INSERT INTO autodidacta_usos (user_id, program_id, tipo) VALUES (${SOFIA_ID}, ${materia}, 'diagnostico'), (${SOFIA_ID}, ${materia}, 'practica'), (${SOFIA_ID}, ${materia}, 'practica')`
  await page.reload()

  // La tercera práctica pide el pase.
  await expect(page.getByText('Ya usaste las dos prácticas gratis de esta materia.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' })).toBeDisabled()
  // Y el servidor frena el simulacro sin el pase (402, sin llamar a la IA).
  const res = await page.request.post('/api/generate-quiz', {
    data: { subject: nombre, topics: [{ id: 'x', name: 'Inflación' }], mode: 'mixto', questionCount: 10, nivel: 'Superior', teacherProgramId: materia, autodidactaTipo: 'simulacro' },
  })
  expect(res.status()).toBe(402)

  // "Sacar el pase" lleva al resumen de pago, como alumno.
  await page.getByRole('link', { name: /^Sacar el pase/ }).click()
  await expect(page).toHaveURL(/\/precios\/pagar\?plan=pase_alumno/)
  // El resumen, como alumno (no le pide entrar como docente). Sin
  // MAESTRIA_PRECIO_PASE_ALUMNO en staging dice que no hay precio: es la válvula.
  await expect(page.getByRole('heading', { name: 'Pagar', level: 1 })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('textbox', { name: '¿Tenés un código?' })).toBeVisible({ timeout: 30_000 })

  // El pago, con Mercado Pago simulado (sólo staging): acredita el pase.
  execFileSync('npx', ['tsx', 'scripts/qa/simular-pago.ts', '--env=staging', `--docente=${SOFIA_ID}`, `--materia=${materia}`], { stdio: 'pipe', shell: true })

  await page.goto(`/autodidacta/${materia}`)
  await expect(page.getByText(/Tenés el pase de esta materia hasta el/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' })).toBeEnabled()
  await page.getByRole('button', { name: '10 preguntas en 15 minutos' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
})
