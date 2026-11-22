import { expect, test, type Page } from '@playwright/test'
import { entrarConId, marca, responderUna, simularGeneracion } from './ayudas'

/**
 * O13 → P5 · El primer uso de un docente nuevo, de "¿Cómo entrás?" a la
 * primera tarea respondida, a 390 px, con las cuatro propuestas de O13:
 *   1. con una sola materia, "Armar la primera tarea" entra directo a ella;
 *   2. sin materia, la barra ofrece "Primero creá una materia" y no "+ Alumno";
 *   3. no se ofrece "Quitar a los que nunca respondieron" con un alumno recién llegado;
 *   4. con un intento, el "¡Listo!" ya no dice "cuando tus alumnos la resuelvan".
 *
 * Necesita un usuario RECIÉN creado en staging (sin rol ni onboarding):
 *   node scripts/backups/o13-usuario.mjs   → imprime el id
 *   $env:PRIMER_USO_ID="o13-docente-…"; npx playwright test e2e/primer-uso.spec.ts --project=escritorio
 * Sin la variable, se salta. Deja capturas en docs/capturas/p5-primer-uso/.
 */
const ID = process.env.PRIMER_USO_ID ?? ''
const DIR = 'docs/capturas/p5-primer-uso'
const sello = marca()
const MATERIA = `P5 · Geografía ${sello}`

test.describe.configure({ mode: 'serial' })
test.skip(!ID, 'Falta PRIMER_USO_ID (un docente recién creado en staging)')

const foto = (page: Page, nombre: string) => page.screenshot({ path: `${DIR}/${nombre}.png` })

test('primer uso de un docente nuevo, con las propuestas de O13', async ({ page, browser }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarConId(page, ID)

  // 01 · ¿Cómo entrás?
  await page.goto('/')
  await page.getByRole('button', { name: /Soy docente/ }).click()
  await page.waitForURL(/\/teacher/)

  // La bienvenida de la prueba aparece cuando carga el plan (puede ser tarde,
  // encima de otra cosa): se acepta cuando aparezca.
  await page.addLocatorHandler(page.getByRole('button', { name: 'Empezar los 30 días' }), async (boton) => {
    await boton.click()
  })

  // 02 · Propuesta 2: sin materia, la barra no ofrece "+ Alumno".
  const barra = page.getByRole('banner')
  await expect(barra.getByRole('link', { name: '+ Materia' })).toBeVisible()
  await expect(barra.getByRole('link', { name: '+ Alumno' })).toHaveCount(0)
  // Y entra en la pantalla (O16): nada de la barra se sale a 390.
  const ancho = await page.evaluate(() => Math.max(...[...document.querySelectorAll('header *')].map((el) => el.getBoundingClientRect().right)))
  expect(ancho).toBeLessThanOrEqual(391)
  await foto(page, '02-sin-materia-la-barra-ofrece-crearla')

  // 03 · La barra abre el asistente de materia (plan oficial).
  await barra.getByRole('link', { name: '+ Materia' }).click()
  await page.getByRole('button', { name: /Usar el plan oficial/ }).click()
  const d = page.getByRole('dialog', { name: 'Crear materia' })
  await d.getByRole('button', { name: /Nivel Secundario/ }).click()
  await d.getByRole('button', { name: '2do Año' }).click()
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('button', { name: 'Geografía', exact: true }).click()
  await d.getByRole('textbox', { name: 'Nombre de la materia' }).fill(MATERIA)
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('button', { name: /Crear una unidad con todos los temas de Dimensión Ambiental/ }).click()
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('textbox', { name: 'Tu metodología de enseñanza' }).fill('Clases con mapas y casos reales.')
  await d.getByRole('button', { name: 'Crear materia' }).click()
  await expect(d).toBeHidden()

  // 05 · Con la materia, vuelve "+ Alumno".
  await expect(barra.getByRole('link', { name: '+ Alumno' })).toBeVisible()
  await page.goto('/teacher')
  await foto(page, '05-con-materia-vuelve-mas-alumno')

  // 06 · El link para el primer alumno.
  await page.getByRole('button', { name: 'Invitar a mi primer alumno' }).click()
  const link = page.getByRole('dialog')
  const texto = await link.getByRole('textbox').first().inputValue()
  const codigo = texto.match(/\/aula\/([A-Z0-9]+)/)?.[1] ?? ''
  expect(codigo).toMatch(/^[A-Z0-9]{4,}$/)
  await page.keyboard.press('Escape')

  // 07 · El alumno entra con su nombre (otro navegador).
  const alumno = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pa = await alumno.newPage()
  await pa.goto(`/aula/${codigo}`)
  await pa.getByRole('textbox').first().fill(`P5 · Alumna ${sello}`)
  await pa.getByRole('button', { name: /Entrar/ }).first().click()
  await pa.waitForURL(/\/aulas/)

  // 09 · Propuesta 3: con su alumna recién llegada, no se ofrece quitarla.
  await page.goto('/teacher')
  await expect(page.getByText(`P5 · Alumna ${sello}`).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Quitar a los que nunca respondieron/ })).toHaveCount(0)
  await foto(page, '09-alumna-recien-llegada-sin-quitar')

  // 10 · Propuesta 1: con una sola materia, entra directo a ella.
  await simularGeneracion(page)
  await page.getByRole('button', { name: 'Armar la primera tarea' }).click()
  await expect(page.getByRole('heading', { name: 'Elegí una materia' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Unidad 1: Dimensión Ambiental/ })).toBeVisible()
  await foto(page, '10-armar-entra-directo-a-la-materia')

  // 11–14 · Armar y mandar la tarea (IA simulada).
  await page.getByRole('button', { name: /Unidad 1: Dimensión Ambiental/ }).click()
  await page.getByRole('button', { name: /^Generar cuestionario/ }).click()
  await page.getByRole('spinbutton', { name: 'Cantidad de preguntas' }).fill('5')
  await page.getByRole('button', { name: /^(Examen práctico|Práctico:)/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Compartir' }).click()
  const mandar = page.getByRole('dialog', { name: 'Mandar la tarea' })
  await mandar.getByRole('button', { name: 'Mandar la tarea' }).click()
  await expect(page.getByText('La tarea ya está en el grupo.')).toBeVisible()
  await page.keyboard.press('Escape')

  // 15–16 · La alumna la hace.
  await pa.goto('/aulas')
  await pa.getByRole('listitem').filter({ hasText: MATERIA }).first().getByRole('button', { name: 'Empezar tarea' }).click()
  for (let i = 1; i <= 5; i++) {
    await expect(pa.getByText(new RegExp(`^${i}/5$`))).toBeVisible()
    await responderUna(pa)
  }
  await expect(pa.getByText('Guardado', { exact: true })).toBeVisible()
  await alumno.close()

  // 17 · Propuesta 4: el "¡Listo!" ya habla de la resolución.
  await page.goto('/teacher')
  await expect(page.getByText('Ya mandaste tu primera tarea.')).toBeVisible()
  await expect(page.getByText('Ya hay una resolución. En Mis alumnos ves en qué se equivocó.')).toBeVisible()
  await foto(page, '17-listo-con-la-primera-resolucion')
})
