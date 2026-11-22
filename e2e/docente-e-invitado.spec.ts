import { expect, test, type Page } from '@playwright/test'
import { DOCENTE, entrarComo, marca, responderUna, simularGeneracion } from './ayudas'

/**
 * Recorridos 1 y 2, en serie porque el segundo usa lo que arma el primero:
 *   1. el docente crea una materia (del plan oficial), un grupo y una tarea
 *      (con la IA simulada) y la manda al grupo;
 *   2. un invitado entra por el código del grupo, con su nombre, y hace la tarea.
 *
 * Deja en staging una materia, un grupo, una tarea y un invitado "E2E · …".
 */
test.describe.configure({ mode: 'serial' })

const sello = marca()
const MATERIA = `E2E · Geografía ${sello}`
const GRUPO = `E2E · Grupo ${sello}`
let codigo = ''
let invitadoId = ''

async function crearMateria(page: Page) {
  await page.goto('/teacher?seccion=materias')
  await page.getByRole('button', { name: 'Crear materia' }).click()
  const d = page.getByRole('dialog', { name: 'Crear materia' })
  await d.getByRole('button', { name: /Nivel Secundario/ }).click()
  await d.getByRole('button', { name: '2do Año' }).click()
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('button', { name: 'Geografía', exact: true }).click()
  await d.getByRole('textbox', { name: 'Nombre de la materia' }).fill(MATERIA)
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('button', { name: /Crear una unidad con todos los temas de Dimensión Ambiental/ }).click()
  await expect(d.getByText('1 unidad · 3 temas')).toBeVisible()
  await d.getByRole('button', { name: 'Continuar' }).click()
  await d.getByRole('textbox', { name: 'Tu metodología de enseñanza' }).fill('Prueba automática: clases con mapas y casos.')
  await d.getByRole('button', { name: 'Crear materia' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByText(MATERIA, { exact: true }).first()).toBeVisible()
}

async function crearGrupo(page: Page) {
  await page.goto('/teacher?vista=grupos')
  await page.getByRole('button', { name: 'Crear grupo' }).first().click()
  const d = page.getByRole('dialog', { name: 'Crear un grupo' })
  await d.getByRole('button', { name: MATERIA }).click()
  await d.getByRole('textbox', { name: 'Nombre del grupo' }).fill(GRUPO)
  await d.getByRole('button', { name: 'Crear grupo' }).click()
  // Al crearlo, lleva a la página del grupo (M3).
  await expect(page.getByRole('heading', { name: GRUPO, level: 1 })).toBeVisible()
  await expect(page.getByText('Grupo creado. Copiá el link y mandáselo a tus alumnos.')).toBeVisible()
}

async function crearYMandarTarea(page: Page) {
  await simularGeneracion(page)
  await page.goto('/teacher?seccion=materias')
  const tarjeta = page
    .locator('div')
    .filter({ has: page.getByText(MATERIA, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Crear cuestionario' }) })
    .last()
  await tarjeta.getByRole('button', { name: 'Crear cuestionario' }).click()
  await page.getByRole('button', { name: /Unidad 1: Dimensión Ambiental/ }).click()
  await page.getByRole('button', { name: /^Generar cuestionario/ }).click()
  // 5 preguntas: el mínimo, para que el invitado termine rápido.
  await page.getByRole('spinbutton', { name: 'Cantidad de preguntas' }).fill('5')
  await page.getByRole('button', { name: /^Examen práctico/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Compartir' }).click()

  const mandar = page.getByRole('dialog', { name: 'Mandar la tarea' })
  await expect(mandar.getByText(/5 preguntas/)).toBeVisible()
  const elegirGrupo = mandar.getByRole('button', { name: new RegExp(GRUPO) })
  if (await elegirGrupo.isVisible({ timeout: 5000 }).catch(() => false)) await elegirGrupo.click()
  await mandar.getByRole('button', { name: 'Mandar la tarea' }).click()
  await expect(page.getByText('La tarea ya está en el grupo.')).toBeVisible()
  const link = await page.getByRole('dialog').getByText(/\/aula\/[A-Z0-9]+/).first().textContent()
  codigo = link?.match(/\/aula\/([A-Z0-9]+)/)?.[1] ?? ''
  expect(codigo, 'el link del grupo').toMatch(/^[A-Z0-9]{4,}$/)
}

test('1 · el docente crea materia, grupo y tarea, y la manda', async ({ page }) => {
  await entrarComo(page, DOCENTE)
  await crearMateria(page)
  await crearGrupo(page)
  await crearYMandarTarea(page)
})

test('2 · un invitado entra por código y hace la tarea', async ({ browser }) => {
  test.skip(!codigo, 'Sin el grupo del recorrido 1')
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  await page.goto(`/aula/${codigo}`)
  await page.getByRole('textbox').first().fill(`E2E · Invitado ${sello}`)
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL(/\/aulas/)
  invitadoId = ((await (await page.request.get('/api/student/viewer')).json()) as { id: string }).id

  const tarjeta = page.getByRole('listitem').filter({ hasText: MATERIA }).first()
  await tarjeta.getByRole('button', { name: 'Empezar tarea' }).click()
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(new RegExp(`^${i}/5$`))).toBeVisible()
    await responderUna(page)
  }
  // Esperar a que el resultado llegue al servidor antes de irse (si no, la
  // lista se lee antes de que termine el guardado).
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible()
  // El resultado se guardó: la tarjeta cuenta el intento.
  await page.goto('/aulas')
  await expect(page.getByRole('listitem').filter({ hasText: MATERIA }).first()).toContainText(/1 de|tu mejor nota|Volver a hacerla/)
  await contexto.close()
})

/**
 * Limpieza: el invitado sale del grupo, para que las corridas no llenen el
 * tope de alumnos del plan de prueba de Irina (10). Sus respuestas quedan.
 */
test('limpieza · el docente quita al invitado', async ({ page }) => {
  test.skip(!invitadoId, 'No hubo invitado')
  await entrarComo(page, DOCENTE)
  const res = await page.request.delete(`/api/teacher/alumnos/${encodeURIComponent(invitadoId)}`)
  expect(res.status()).toBe(200)
})
