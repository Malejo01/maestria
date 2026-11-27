import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Browser } from '@playwright/test'
import { entrarConId, marca, simularGeneracion } from './ayudas'

/**
 * Tanda AC · AC8 — Lo que suma la tanda AC al recorrido de AA4
 * (`e2e/aa4-registro.spec.ts`, que ya cubre al docente PARTICULAR de /profes):
 *
 *   1. Un docente de CURSO (elige «Doy clases en un curso» en la portada): su
 *      3.er alumno entra por el link (regla B1).
 *   2. «Compartir» después de generar pasa por «Revisá y aprobá» antes del
 *      diálogo de mandar (AC2).
 *
 * Necesita un docente recién creado en staging:
 *   npx tsx scripts/seed-staging-docente-nuevo.ts --env=staging
 *   $env:AC8_CURSO_ID="aa4-docente-…"; npx playwright test e2e/ac8-modalidad.spec.ts
 * La materia se crea por la API con unidades fijas (sin IA) y la generación
 * está simulada: no gasta. Sin AC8_CURSO_ID, se salta.
 */
const ID = process.env.AC8_CURSO_ID ?? ''
const DIR = 'docs/capturas/ac8-recorrido'
const sello = marca()

test.describe.configure({ mode: 'serial' })
test.skip(!ID, 'Falta AC8_CURSO_ID (un docente recién creado en staging)')
test.use({ viewport: { width: 390, height: 844 } })

const notas: Record<string, string> = {}

async function entraPorElLink(browser: Browser, codigo: string, nombre: string): Promise<{ entro: boolean; texto: string }> {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pa = await contexto.newPage()
  await pa.goto(`/aula/${codigo}`)
  const campo = pa.getByRole('textbox', { name: /Cómo te llamás|Nombre/ }).first()
  await campo.waitFor({ state: 'visible', timeout: 30_000 })
  await campo.fill(nombre)
  await pa.getByRole('button', { name: /Entrar/ }).first().click()
  const entro = await pa.waitForURL(/\/aulas/, { timeout: 30_000 }).then(() => true).catch(() => false)
  const texto = entro ? '' : (await pa.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)
  await contexto.close()
  return { entro, texto }
}

test('AC8 · el docente de curso: su 3.er alumno entra por el link; y «Compartir» pasa por la revisión', async ({ page, browser }) => {
  test.setTimeout(300_000)
  mkdirSync(DIR, { recursive: true })

  // ── La portada: «Doy clases en un curso» ────────────────────────────────
  await page.goto('/')
  await page.locator('[data-camino="curso"]').locator('..').getByRole('link').click()
  await page.waitForURL(/\/sign-in\?.*modalidad=curso/)
  await page.waitForTimeout(500) // la pantalla de ingreso guarda la modalidad elegida
  await page.evaluate(() => localStorage.setItem('maestria-rol-elegido', 'docente'))
  await entrarConId(page, ID)
  await page.goto('/teacher')
  await page.waitForURL(/\/teacher/)
  await expect(page.locator('[data-arranque]').first()).toBeVisible({ timeout: 60_000 })
  const plan = (await (await page.request.get('/api/teacher/plan')).json()) as { plan: { modalidad?: string | null } }
  notas.modalidad = String(plan.plan.modalidad)
  expect(plan.plan.modalidad).toBe('curso')

  // ── Una materia (por la API, sin IA) y el link de su grupo ──────────────
  const materia = await page.request.post('/api/teacher/programs', {
    data: {
      subjectName: `AC8 · Curso ${sello}`,
      units: [{ id: 'u1', name: 'Unidad 1: Números', topics: [{ id: 't1', name: 'Fracciones' }, { id: 't2', name: 'Decimales' }] }],
      pedagogyProfile: { level: 'Secundario', degree: 'Secundaria', academicYear: '1er Año', complexity: 'media', assessmentStyle: 'Ejercicios y problemas.', methodology: 'Clases con ejemplos y práctica guiada.' },
      nivel: 'Secundario',
      grado: '1er Año',
      createdFrom: 'manual',
    },
  })
  expect(materia.ok(), await materia.text()).toBe(true)
  const programaId = Number((await materia.json()).program?.id)
  const grupo = await page.request.post('/api/teacher/onboarding/grupo', { data: { teacherProgramId: programaId } })
  expect(grupo.ok(), await grupo.text()).toBe(true)
  const codigo = String((await grupo.json()).grupo?.codigo ?? '')
  expect(codigo).toMatch(/^[A-Z0-9]{4,}$/)

  // ── Tres alumnos por el link: los tres entran (curso, regla B1) ─────────
  const resultados = []
  for (const n of ['Uno', 'Dos', 'Tres']) resultados.push(await entraPorElLink(browser, codigo, `AC8 Alumno ${n} ${sello}`))
  notas.curso = resultados.map((r, i) => `${i + 1}.º ${r.entro ? 'entró' : `no entró (${r.texto})`}`).join(' · ')
  expect(resultados.every((r) => r.entro)).toBe(true)
  await page.goto('/teacher')
  const contador = page.locator('[data-lleno]')
  await expect(contador).toBeVisible({ timeout: 30_000 })
  notas.contador = await contador.innerText()
  await page.screenshot({ path: `${DIR}/01-curso-tres-alumnos-por-el-link.png` })

  // ── «Compartir» después de generar → «Revisá y aprobá» → mandar ─────────
  await simularGeneracion(page)
  await page.goto('/teacher?seccion=tareas&armar=1')
  await page.getByRole('button', { name: /Unidad 1:/ }).first().click()
  await page.getByRole('button', { name: /^Generar cuestionario/ }).click()
  await page.getByRole('spinbutton', { name: 'Cantidad de preguntas' }).fill('5')
  await page.getByRole('button', { name: /^(Examen práctico|Práctico:)/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Compartir' }).click()
  const revision = page.locator('[data-revision-al-compartir]')
  await expect(revision).toBeVisible({ timeout: 60_000 })
  // El diálogo de mandar todavía no está: primero la revisión.
  await expect(page.getByRole('dialog', { name: 'Mandar la tarea' })).toHaveCount(0)
  await expect(revision.locator('[data-contador-revisadas]')).toHaveText('0 de 5 revisadas')
  await page.screenshot({ path: `${DIR}/02-compartir-abre-la-revision.png` })
  await revision.getByRole('button', { name: /Aprobar todas y mandar/ }).click()
  await expect(page.getByRole('dialog', { name: 'Mandar la tarea' })).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${DIR}/03-aprobada-recien-ahi-mandar.png` })
  notas.compartir = 'Compartir → «Revisá y aprobá» (0 de 5 revisadas) → «Aprobar todas y mandar» → «Mandar la tarea»'

  writeFileSync(`${DIR}/notas.json`, JSON.stringify(notas, null, 1))
  console.log(JSON.stringify(notas, null, 1))
})
