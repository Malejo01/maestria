import { expect, test } from '@playwright/test'
import { entrarConId, sqlDeStaging } from './ayudas'

/**
 * Ronda V · V5 — Las capturas de la portada (`public/portada/*.png`), con la
 * materia de ejemplo (V2) y un alumno autodidacta de prueba: nada real. No
 * corre con `npm run e2e`; sólo para regenerarlas:
 *
 *   CAPTURAS_PORTADA=1 npx playwright test e2e/capturas-portada.spec.ts
 *
 * Deja el ejemplo borrado al final; el alumno `stg-v5-autodidacta` queda con
 * su materia personal de prueba.
 */
test.skip(!process.env.CAPTURAS_PORTADA, 'Sólo para regenerar las capturas de la portada')

const DOCENTE = 'stg-v2-ejemplo'
const ALUMNO = 'stg-v5-autodidacta'

test.use({ viewport: { width: 900, height: 900 } })

test('capturas de la portada', async ({ page, browser }) => {
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
  const creado = (await (await page.request.post('/api/teacher/ejemplo', { data: { area: 'matematica' } })).json()) as { grupoId: number }

  // Curso: el diagnóstico del grupo, tema por tema.
  await page.goto(`/teacher/grupos/${creado.grupoId}?pestana=diagnosticos`)
  await page.getByRole('link', { name: 'Diagnósticos (1)' }).click()
  const diag = page.locator('section').filter({ hasText: 'Por tema' }).first()
  await expect(diag).toContainText('la acertaron')
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await diag.screenshot({ path: 'public/portada/curso.png' })

  // Particulares: la ficha de un alumno ficticio.
  await page.getByRole('link', { name: /^Alumnos \(/ }).click()
  await page.getByText('Joaquín Benítez', { exact: true }).first().click()
  const ficha = page.getByRole('dialog')
  await expect(ficha.getByText(/Cargando ficha/)).toHaveCount(0, { timeout: 30_000 })
  await ficha.screenshot({ path: 'public/portada/particulares.png' })
  await page.keyboard.press('Escape')
  await page.request.delete('/api/teacher/ejemplo')

  // Examen: el plan de un alumno autodidacta de prueba.
  await sql`
    INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
    VALUES (${ALUMNO}, ${`${ALUMNO}@staging.invalid`}, 'Alumno V5 Autodidacta', 'ALUMNO', true, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
  await sql`UPDATE users SET mayor_de_18_el = COALESCE(mayor_de_18_el, NOW()) WHERE id = ${ALUMNO}`
  const contexto = await browser.newContext({ viewport: { width: 900, height: 1000 } })
  const alumno = await contexto.newPage()
  await alumno.goto('/')
  await entrarConId(alumno, ALUMNO)
  const [previa] = (await sql`SELECT id FROM teacher_programs WHERE user_id = ${ALUMNO} AND personal = TRUE AND status = 'active' ORDER BY id LIMIT 1`) as { id: number }[]
  let materia = previa?.id
  if (!materia) {
    const fecha = new Date(Date.now() + 18 * 86_400_000).toISOString().slice(0, 10)
    const r = await alumno.request.post('/api/autodidacta/materias', {
      data: {
        nombre: 'Introducción a la Economía',
        fechaExamen: fecha,
        unidades: [
          { name: 'Unidad 1: Mercados', topics: [{ name: 'Oferta y demanda' }, { name: 'Elasticidad' }] },
          { name: 'Unidad 2: Macroeconomía', topics: [{ name: 'Inflación' }, { name: 'Producto bruto' }] },
        ],
      },
    })
    materia = ((await r.json()) as { id: number }).id
    await sql`
      INSERT INTO autodidacta_resultados (user_id, program_id, tipo, por_tema, nota)
      VALUES (${ALUMNO}, ${materia}, 'diagnostico',
              ${JSON.stringify([
                { tema: 'Oferta y demanda', correctas: 2, total: 2 },
                { tema: 'Elasticidad', correctas: 0, total: 2 },
                { tema: 'Inflación', correctas: 1, total: 2 },
                { tema: 'Producto bruto', correctas: 2, total: 2 },
              ])}, 6.25)
    `
  }
  await alumno.goto(`/autodidacta/${materia}`)
  await expect(alumno.getByRole('heading', { name: 'Tu plan hasta el examen' })).toBeVisible({ timeout: 30_000 })
  // Sin la insignia de desarrollo de Next; de la materia hasta la práctica de hoy.
  await alumno.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  const desde = await alumno.getByRole('heading', { name: 'Introducción a la Economía' }).boundingBox()
  const hasta = await alumno.getByRole('button', { name: 'Práctica de hoy (10 preguntas)' }).boundingBox()
  const columna = await alumno.locator('[data-materia-autodidacta]').boundingBox()
  if (!desde || !hasta || !columna) throw new Error('no se encontró el plan')
  await alumno.screenshot({
    path: 'public/portada/examen.png',
    clip: { x: columna.x - 16, y: desde.y - 16, width: columna.width + 32, height: hasta.y + hasta.height + 32 - (desde.y - 16) },
  })
  await contexto.close()
})
