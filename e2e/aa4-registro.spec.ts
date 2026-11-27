import { writeFileSync, mkdirSync } from 'node:fs'
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { entrarConId, marca, responderUna, simularGeneracion } from './ayudas'

/**
 * Tanda AA · AA4 — El registro de un docente nuevo, de punta a punta, en
 * staging, con todo lo de la tanda AB puesto (rama `tanda-ab/integracion`):
 *
 *   1. /profes?origen=meta&ref=AD-prueba   2. «Empezar gratis»
 *   3. rol docente y entrar                4. el arranque guiado (AB4)
 *   5. la primera materia desde un PDF     6. un cuestionario de 5, «Revisá y aprobá» (AB7)
 *   7. el mensaje de WhatsApp e invitar a 2 alumnos de prueba
 *   8. que practiquen                      9. «Esta semana» (AB5) y la ficha
 *  10. el 3.er alumno: por el link y con «+ Alumno» (el muro de AB6)
 *
 * Cuenta los clics de cada paso y deja capturas (y el video) en
 * docs/capturas/aa4-registro/. Necesita un docente RECIÉN creado:
 *   npx tsx scripts/seed-staging-docente-nuevo.ts --env=staging [--fundador]
 *   $env:AA4_ID="aa4-docente-…"; $env:AA4_PDF="C:\…\programa.pdf"; npx playwright test e2e/aa4-registro.spec.ts
 * Con `AA4_IA_REAL=1`, la generación del cuestionario usa la IA de verdad
 * (≈ USD 0,002); si no, la simulada. La lectura del PDF es siempre real.
 * Sin AA4_ID, se salta.
 */
const ID = process.env.AA4_ID ?? ''
const PDF = process.env.AA4_PDF ?? ''
const IA_REAL = process.env.AA4_IA_REAL === '1'
const DIR = 'docs/capturas/aa4-registro'
const sello = marca()

test.describe.configure({ mode: 'serial' })
test.skip(!ID || !PDF, 'Faltan AA4_ID (un docente recién creado en staging) y AA4_PDF')
test.use({ viewport: { width: 390, height: 844 }, video: { mode: 'on', size: { width: 390, height: 844 } } })

interface Paso {
  numero: number
  nombre: string
  clics: number
  segundos: number
  nota: string
}
const pasos: Paso[] = []
let clics = 0
let inicioDelPaso = Date.now()

async function clic(objetivo: Locator) {
  clics++
  await objetivo.click()
}
async function cerrarPaso(page: Page, numero: number, nombre: string, nota = '') {
  await page.screenshot({ path: `${DIR}/${String(numero).padStart(2, '0')}-${nombre}.png`, fullPage: false })
  pasos.push({ numero, nombre, clics, segundos: Math.round((Date.now() - inicioDelPaso) / 1000), nota })
  clics = 0
  inicioDelPaso = Date.now()
}

async function alumnoEntraYPractica(browser: Browser, codigo: string, nombre: string, practicar: boolean) {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pa = await contexto.newPage()
  await pa.goto(`/aula/${codigo}`)
  const textoDeLaPagina = async () => (await pa.locator('main').innerText().catch(() => '')).slice(0, 300)
  const campo = pa.getByRole('textbox', { name: /Cómo te llamás|Nombre/ }).first()
  const hayCampo = await campo.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)
  if (!hayCampo) {
    await pa.screenshot({ path: `${DIR}/10-alumno-${nombre.split(' ').pop()}-sin-campo.png` })
    const texto = await textoDeLaPagina()
    await contexto.close()
    return { entro: false, texto }
  }
  await campo.fill(nombre)
  await pa.getByRole('button', { name: /Entrar/ }).first().click()
  const entro = await pa
    .waitForURL(/\/aulas/, { timeout: 30_000 })
    .then(() => true)
    .catch(() => false)
  if (!entro) {
    const texto = await textoDeLaPagina()
    await pa.screenshot({ path: `${DIR}/10-alumno-${nombre.split(' ').pop()}-no-entra.png` })
    await contexto.close()
    return { entro: false, texto }
  }
  if (practicar) {
    await pa.getByRole('button', { name: 'Empezar tarea' }).first().click()
    for (let i = 1; i <= 5; i++) {
      await expect(pa.getByText(new RegExp(`^${i}/5$`))).toBeVisible({ timeout: 60_000 })
      await responderUna(pa)
    }
    await expect(pa.getByText('Guardado', { exact: true })).toBeVisible({ timeout: 60_000 })
  }
  await contexto.close()
  return { entro: true, texto: '' }
}

test('AA4 · el registro de un docente nuevo, de /profes al muro del 3.er alumno', async ({ page, browser, context }) => {
  test.setTimeout(600_000)
  mkdirSync(DIR, { recursive: true })

  // ── 1 · Llega desde el anuncio ──────────────────────────────────────────
  await page.goto('/profes?origen=meta&ref=AD-prueba')
  await expect(page.getByRole('heading', { level: 1, name: 'Empezá gratis con 2 alumnos.' })).toBeVisible()
  const cookie = (await context.cookies()).find((c) => c.name === 'maestria_origen')?.value ?? ''
  await cerrarPaso(page, 1, 'profes', `cookie maestria_origen = ${decodeURIComponent(cookie)}`)

  // ── 2 · «Empezar gratis» ────────────────────────────────────────────────
  await clic(page.getByRole('link', { name: 'Empezar gratis con 2 alumnos' }))
  await page.waitForURL(/\/sign-in\?/)
  const urlDeIngreso = new URL(page.url())
  expect(urlDeIngreso.searchParams.get('rol')).toBe('docente')
  expect(urlDeIngreso.searchParams.get('origen')).toBe('meta')
  expect(urlDeIngreso.searchParams.get('ref')).toBe('AD-PRUEBA')
  await cerrarPaso(page, 2, 'ingreso', `URL: ${urlDeIngreso.pathname}${urlDeIngreso.search}`)

  // ── 3 · Rol docente y entrar ────────────────────────────────────────────
  // Con Google serían «Continuar con Google» + elegir la cuenta. Acá, el ingreso
  // de desarrollo (sin Google) y el rol elegido que deja ese botón.
  await page.evaluate(() => localStorage.setItem('maestria-rol-elegido', 'docente'))
  clics++ // el botón de Google
  await entrarConId(page, ID)
  await page.goto('/teacher')
  if (!/\/teacher/.test(page.url())) {
    // La bienvenida: el rol se confirma (si ya viene elegido, un clic).
    const soyDocente = page.getByRole('button', { name: /Soy docente/ })
    if (await soyDocente.isVisible().catch(() => false)) await clic(soyDocente)
    await page.waitForURL(/\/teacher/, { timeout: 60_000 })
  }
  await cerrarPaso(page, 3, 'entro', `llegó a ${new URL(page.url()).pathname}`)

  // ── 4 · El arranque guiado (AB4), sin aviso de prueba (AA1) ────────────
  const arranque = page.locator('[data-arranque="lista"]')
  await expect(arranque).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: /Empezar los/ })).toHaveCount(0)
  await cerrarPaso(page, 4, 'arranque', (await arranque.innerText()).replace(/\s+/g, ' ').slice(0, 200))

  // ── 5 · La primera materia desde un PDF ─────────────────────────────────
  await clic(arranque.getByRole('button', { name: 'Subir mi programa' }))
  await clic(page.getByRole('button', { name: /Subir el archivo que ya tengo/ }))
  const wizard = page.getByRole('dialog', { name: 'Crear materia' })
  await expect(wizard).toBeVisible()
  // Materia → Temario → Nivel y año → Cómo das la materia.
  const nombre = wizard.getByRole('textbox', { name: 'Nombre de la materia' })
  if (await nombre.isVisible().catch(() => false)) {
    await nombre.fill(`AA4 · Materia ${sello}`)
    await clic(wizard.getByRole('button', { name: 'Continuar' }))
  }
  await wizard.locator('#program-file').setInputFiles(PDF)
  await clic(wizard.getByRole('button', { name: 'Leer el archivo' }))
  await expect(wizard.getByText(/^Listo: \d+ unidad/)).toBeVisible({ timeout: 90_000 })
  const leido = await wizard.getByText(/^Listo: \d+ unidad/).innerText()
  await page.screenshot({ path: `${DIR}/05a-pdf-leido.png` })
  for (let i = 0; i < 6; i++) {
    const crear = wizard.getByRole('button', { name: 'Crear materia' })
    if (await crear.isVisible().catch(() => false)) {
      const metodologia = wizard.getByRole('textbox', { name: 'Tu metodología de enseñanza' })
      if (await metodologia.isVisible().catch(() => false)) await metodologia.fill('Clases con ejemplos y práctica guiada.')
      await clic(crear)
      break
    }
    const nombreTarde = wizard.getByRole('textbox', { name: 'Nombre de la materia' })
    if ((await nombreTarde.isVisible().catch(() => false)) && !(await nombreTarde.inputValue())) await nombreTarde.fill(`AA4 · Materia ${sello}`)
    await clic(wizard.getByRole('button', { name: 'Continuar' }))
    await page.waitForTimeout(500)
  }
  await expect(wizard).toBeHidden({ timeout: 60_000 })
  await page.goto('/teacher')
  await cerrarPaso(page, 5, 'materia-desde-pdf', leido)

  // ── 6 · Un cuestionario de 5, revisado y aprobado (AB7) ─────────────────
  if (!IA_REAL) await simularGeneracion(page)
  await clic(page.locator('[data-arranque="lista"]').getByRole('button', { name: 'Armar el cuestionario' }))
  await page.waitForURL(/seccion=tareas/)
  const primeraUnidad = page.getByRole('button', { name: /Unidad 1:/ }).first()
  await expect(primeraUnidad).toBeVisible({ timeout: 60_000 })
  await clic(primeraUnidad)
  await clic(page.getByRole('button', { name: /^Generar cuestionario/ }))
  await page.getByRole('spinbutton', { name: 'Cantidad de preguntas' }).fill('5')
  await clic(page.getByRole('button', { name: /^(Examen práctico|Práctico:)/ }).first())
  await clic(page.getByRole('dialog').getByRole('button', { name: 'Guardar' }))
  // Al guardar, la app vuelve sola a la lista de tareas.
  await expect(page.getByText('Guardadas (1)')).toBeVisible({ timeout: 120_000 })
  await clic(page.getByRole('button', { name: 'Revisá y aprobá' }).first())
  await expect(page.locator('[data-contador-revisadas]')).toHaveText('0 de 5 revisadas', { timeout: 30_000 })
  await clic(page.getByRole('button', { name: 'Aprobar la pregunta 1' }))
  await expect(page.locator('[data-contador-revisadas]')).toHaveText('1 de 5 revisadas')
  await page.screenshot({ path: `${DIR}/06a-revisa-y-aproba.png` })
  await clic(page.getByRole('button', { name: /Aprobar todas y mandar/ }))
  await cerrarPaso(page, 6, 'revisa-y-aproba', IA_REAL ? 'IA real' : 'IA simulada')

  // ── 7 · El mensaje para WhatsApp e invitar a 2 alumnos ──────────────────
  const mandar = page.getByRole('dialog', { name: 'Mandar la tarea' })
  await clic(mandar.getByRole('button', { name: 'Mandar la tarea' }))
  await expect(page.getByText('La tarea ya está en el grupo.')).toBeVisible({ timeout: 60_000 })
  const link = await page.getByRole('dialog').getByRole('textbox').first().inputValue()
  const codigo = link.match(/\/aula\/([A-Z0-9]+)/)?.[1] ?? ''
  expect(codigo).toMatch(/^[A-Z0-9]{4,}$/)
  const mensaje = await page.getByRole('dialog').getByRole('textbox').nth(1).inputValue().catch(() => '')
  clics++ // «Copiar el mensaje» (el portapapeles no se prueba acá)
  await cerrarPaso(page, 7, 'mensaje-whatsapp', mensaje.replace(/\n/g, ' / '))
  await page.keyboard.press('Escape')

  // ── 8 · Los 2 alumnos de prueba practican ───────────────────────────────
  const a1 = await alumnoEntraYPractica(browser, codigo, `AA4 Alumna Uno ${sello}`, true)
  const a2 = await alumnoEntraYPractica(browser, codigo, `AA4 Alumno Dos ${sello}`, true)
  expect(a1.entro && a2.entro).toBe(true)
  await page.goto('/teacher')
  await cerrarPaso(page, 8, 'practicaron')

  // ── 9 · «Esta semana» (AB5) y la ficha ──────────────────────────────────
  const semana = page.locator('[data-esta-semana]')
  await expect(semana).toBeVisible({ timeout: 60_000 })
  const frase = await semana.locator('[data-frase]').innerText()
  await semana.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/09a-esta-semana.png` })
  await clic(page.getByRole('link', { name: new RegExp(`AA4 Alumna Uno`) }).first())
  await page.waitForURL(/\/teacher\/alumnos\//, { timeout: 60_000 })
  await cerrarPaso(page, 9, 'esta-semana-y-ficha', frase)

  // ── 10 · El 3.er alumno ─────────────────────────────────────────────────
  // a) por el link del grupo, como lo propone el arranque
  const a3 = await alumnoEntraYPractica(browser, codigo, `AA4 Alumno Tres ${sello}`, false)
  // b) con «+ Alumno», hasta que aparezca el muro (AB6)
  await page.goto('/teacher')
  let muro = false
  const agregados: string[] = []
  for (let i = 1; i <= 3 && !muro; i++) {
    await clic(page.getByRole('banner').getByRole('link', { name: '+ Alumno' }))
    const dialogo = page.getByRole('dialog')
    await dialogo.getByRole('textbox').first().fill(`AA4 Particular ${i} ${sello}`)
    await clic(dialogo.getByRole('button', { name: /Agregar|Sumar/ }).last())
    await page.waitForTimeout(2500)
    muro = await page.locator('[data-muro]').isVisible().catch(() => false)
    agregados.push(muro ? `${i}: muro` : `${i}: entró`)
    if (!muro) await page.keyboard.press('Escape')
  }
  await page.waitForTimeout(1500)
  const evidencia = muro ? await page.locator('[data-evidencia]').innerText() : ''
  await cerrarPaso(
    page,
    10,
    'tercer-alumno',
    `por el link: ${a3.entro ? 'entró' : `no entró (${a3.texto.replace(/\s+/g, ' ').slice(0, 120)})`} · con «+ Alumno»: ${agregados.join(', ')} · ${evidencia}`,
  )

  writeFileSync(`${DIR}/pasos.json`, JSON.stringify(pasos, null, 1))
  console.log(JSON.stringify(pasos, null, 1))
})
