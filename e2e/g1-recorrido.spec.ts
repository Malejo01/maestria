import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { entrarConId, marca, sqlDeStaging } from './ayudas'
import { validarMoodleXml } from '../lib/moodle-xml-validar'

/**
 * Ronda T · G1 — El recorrido completo de la ronda, en staging, con dos
 * docentes de prueba: una de Antropología y uno de Economía.
 *
 *   1. crea la materia y el área se detecta sola;
 *   2. arma una tarea práctica con los tipos nuevos (como en Moodle), con la
 *      IA DE VERDAD (unos centavos): así se prueban los prompts;
 *   3. un invitado entra por código y la responde;
 *   4. la docente exporta la tarea a Moodle XML y el archivo pasa el validador;
 *   5. paga el plan con un código del 50 % (Mercado Pago simulado).
 *
 * Llama a la IA, así que NO corre con `npm run e2e`: sólo con G1_IA_REAL=1.
 *   $env:G1_IA_REAL="1"; npx playwright test e2e/g1-recorrido.spec.ts --project=escritorio
 *
 * Deja en staging: las dos docentes (stg-g1-antropologia, stg-g1-economia),
 * sus materias, grupos y tareas, los invitados, el código G1-FUNDADORA-50 y
 * el pago simulado.
 */
test.skip(!process.env.G1_IA_REAL, 'Llama a la IA de verdad: sólo con G1_IA_REAL=1')
test.describe.configure({ mode: 'serial' })

const CARPETA = 'docs/capturas/ronda-t/g1'
const foto = (page: Page, nombre: string) => page.screenshot({ path: `${CARPETA}/${nombre}.png`, fullPage: false })

const DOCENTES = [
  {
    id: 'stg-g1-antropologia',
    nombre: 'Docente G1 Antropología',
    materia: `Antropología Cultural · G1 ${marca()}`,
    carrera: 'Profesorado de Historia',
    area: 'Ciencias sociales y humanidades',
    unidades: [
      { id: 'u1', name: 'Unidad 1: La perspectiva antropológica', topics: [{ id: 't1', name: 'El concepto de cultura' }, { id: 't2', name: 'Etnocentrismo y relativismo cultural' }, { id: 't3', name: 'El trabajo de campo etnográfico' }] },
    ],
    tipos: ['Emparejamiento', 'Ordenamiento', 'Seleccionar la palabra', 'Palabra faltante', 'Varias correctas'],
  },
  {
    id: 'stg-g1-economia',
    nombre: 'Docente G1 Economía',
    materia: `Introducción a la Economía · G1 ${marca()}`,
    carrera: 'Contador Público',
    area: 'Economía',
    unidades: [
      { id: 'u1', name: 'Unidad 1: Oferta, demanda y precios', topics: [{ id: 't1', name: 'Ley de la demanda' }, { id: 't2', name: 'Elasticidad precio de la demanda' }, { id: 't3', name: 'Variaciones porcentuales de precios' }] },
    ],
    tipos: ['Calculada', 'Arrastrar al texto', 'Emparejamiento', 'Varias correctas', 'Ordenamiento'],
  },
] as const

async function prepararStaging() {
  const sql = await sqlDeStaging()
  for (const d of DOCENTES) {
    await sql`
      INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
      VALUES (${d.id}, ${`${d.id}@staging.invalid`}, ${d.nombre}, 'DOCENTE', true, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET role = 'DOCENTE', name = EXCLUDED.name
    `
  }
  await sql`
    INSERT INTO codigos_descuento (codigo, porcentaje, aplica, forma, meses, usos_maximos, fundadora, activo, nota, creado_por)
    VALUES ('G1-FUNDADORA-50', 50, 'particular', 'mensual', 6, 10, true, true, 'Prueba G1 (ronda T), sólo staging', 'G1')
    ON CONFLICT (codigo) DO NOTHING
  `
  return sql
}

/** Responde la pregunta que esté en pantalla, sea del tipo que sea (sin importar si está bien). */
async function responderCualquiera(page: Page) {
  const radio = page.getByRole('radio')
  const casilla = page.getByRole('checkbox')
  const lista = page.getByRole('combobox')
  const palabra = page.locator('[data-palabra]')
  const orden = page.locator('[data-elemento-orden]')
  const texto = page.locator('input[inputmode="decimal"], input[type="text"]').first()
  if ((await palabra.count()) > 0) {
    const huecos = await page.locator('[data-hueco]').count()
    for (let i = 0; i < huecos; i++) {
      await page.locator('[data-palabra]:not([disabled])').first().click()
      await page.getByRole('button', { name: /vacío$/ }).first().click()
    }
  } else if ((await lista.count()) > 0) {
    for (let i = 0; i < (await lista.count()); i++) await lista.nth(i).selectOption({ index: i + 1 })
  } else if ((await casilla.count()) > 0) {
    await casilla.first().click()
  } else if ((await radio.count()) > 0) {
    await radio.first().click()
  } else if ((await orden.count()) === 0 && (await texto.count()) > 0) {
    await texto.fill('1')
  }
  await page.getByRole('button', { name: /^(Verificar|Siguiente|Terminar)/ }).first().click()
  const siguiente = page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ })
  if (await siguiente.isVisible().catch(() => false)) await siguiente.click()
}

for (const [i, d] of DOCENTES.entries()) {
  test(`G1 · ${d.nombre}: materia con área, tarea con tipos de Moodle (IA real), invitado, Moodle XML y pago con código`, async ({ page, browser }) => {
    test.setTimeout(600_000)
    const sql = await prepararStaging()
    page.on('dialog', (dialogo) => dialogo.dismiss())
    await page.addLocatorHandler(page.getByRole('button', { name: 'Empezar los 30 días' }), async (boton) => {
      await boton.click()
    })
    await page.goto('/')
    await entrarConId(page, d.id)

    // 1. La materia: el área se detecta sola (sin IA: por el nombre).
    const creada = await page.request.post('/api/teacher/programs', {
      data: {
        subjectName: d.materia,
        units: d.unidades,
        nivel: 'Superior',
        pedagogyProfile: { level: 'Superior', degree: d.carrera, academicYear: '1º', complexity: 'intermedia', assessmentStyle: 'mixto', methodology: 'Clases con casos y lecturas.' },
        createdFrom: 'manual',
      },
    })
    expect(creada.ok()).toBe(true)
    await page.goto('/teacher?seccion=materias')
    const tarjeta = page.locator('div').filter({ has: page.getByText(d.materia, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Crear cuestionario' }) }).last()
    await expect(tarjeta).toContainText(d.area, { timeout: 30_000 })
    await foto(page, `${i + 1}a-materia-con-area`)

    // Un grupo para mandar la tarea.
    await page.goto('/teacher?vista=grupos')
    await page.getByRole('button', { name: 'Crear grupo' }).first().click()
    const nuevoGrupo = page.getByRole('dialog', { name: 'Crear un grupo' })
    await nuevoGrupo.getByRole('button', { name: d.materia }).click()
    await nuevoGrupo.getByRole('textbox', { name: 'Nombre del grupo' }).fill(`G1 · ${d.materia}`)
    await nuevoGrupo.getByRole('button', { name: 'Crear grupo' }).click()
    await expect(page.getByRole('heading', { name: `G1 · ${d.materia}`, level: 1 })).toBeVisible({ timeout: 30_000 })

    // 2. La tarea práctica con los tipos de Moodle, con la IA de verdad.
    await page.goto('/teacher?seccion=materias')
    await page.locator('div').filter({ has: page.getByText(d.materia, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Crear cuestionario' }) }).last().getByRole('button', { name: 'Crear cuestionario' }).click()
    await page.getByRole('button', { name: /Unidad 1/ }).first().click()
    await page.getByRole('button', { name: /^Generar cuestionario/ }).click()
    await page.getByRole('spinbutton', { name: 'Cantidad de preguntas' }).fill('5')
    await page.getByRole('button', { name: /Más tipos \(como en Moodle\)/ }).click()
    for (const tipo of d.tipos) await page.getByRole('button', { name: new RegExp(`^${tipo}`) }).click()
    // Los cuatro de siempre, afuera: sólo los de Moodle. (Opción múltiple viene marcada.)
    const opcionMultiple = page.getByRole('button', { name: /^Opción múltiple/ })
    if ((await opcionMultiple.getAttribute('aria-pressed')) === 'true') await opcionMultiple.click()
    await foto(page, `${i + 1}b-tipos-elegidos`)
    await page.getByRole('button', { name: /^(Examen práctico|Práctico:)/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Compartir' }).click()
    const mandar = page.getByRole('dialog', { name: 'Mandar la tarea' })
    await expect(mandar.getByText(/5 preguntas/)).toBeVisible({ timeout: 240_000 })
    await foto(page, `${i + 1}c-tarea-generada`)
    const elegirGrupo = mandar.getByRole('button', { name: new RegExp(`G1 · `) })
    if (await elegirGrupo.first().isVisible({ timeout: 5000 }).catch(() => false)) await elegirGrupo.first().click()
    await mandar.getByRole('button', { name: 'Mandar la tarea' }).click()
    await expect(page.getByText('La tarea ya está en el grupo.')).toBeVisible({ timeout: 30_000 })
    const link = await page.getByRole('dialog').getByText(/\/aula\/[A-Z0-9]+/).first().textContent()
    const codigo = link?.match(/\/aula\/([A-Z0-9]+)/)?.[1] ?? ''
    expect(codigo).toMatch(/^[A-Z0-9]{4,}$/)

    // Qué tipos salieron de verdad (para el informe).
    const [tarea] = (await sql`
      SELECT id, questions FROM teacher_quizzes WHERE user_id = ${d.id} ORDER BY id DESC LIMIT 1
    `) as { id: number; questions: { type: string }[] }[]
    const tipos = tarea.questions.map((q) => q.type)
    console.log(`[G1] ${d.nombre}: ${tipos.join(', ')}`)
    expect(tipos.every((t) => ['multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'calculated'].includes(t))).toBe(true)

    // 3. Un invitado entra por código y la responde.
    const otro = await browser.newContext()
    const invitado = await otro.newPage()
    await invitado.goto(`/aula/${codigo}`)
    await invitado.getByRole('textbox').first().fill(`Invitado G1 ${i + 1}`)
    await invitado.getByRole('button', { name: /^(Entrar|Seguir|Unirme)/ }).first().click()
    await invitado.waitForURL(/\/aulas/, { timeout: 30_000 })
    await invitado.getByRole('listitem').filter({ hasText: d.materia }).first().getByRole('button', { name: 'Empezar tarea' }).click()
    for (let n = 1; n <= 5; n++) {
      await expect(invitado.getByText(new RegExp(`^${n}/5$`))).toBeVisible({ timeout: 30_000 })
      if (n === 1) await invitado.screenshot({ path: `${CARPETA}/${i + 1}d-invitado-responde.png` })
      await responderCualquiera(invitado)
    }
    await expect(invitado.getByText('Guardado', { exact: true })).toBeVisible({ timeout: 30_000 })
    await invitado.screenshot({ path: `${CARPETA}/${i + 1}e-invitado-resultados.png` })
    await otro.close()

    // 4. La exportación a Moodle XML pasa el validador.
    await page.goto('/teacher?seccion=tareas')
    await page.getByRole('button', { name: 'Exportar a Moodle' }).first().click()
    const bajada = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /Moodle XML/ }).click()
    const archivo = await bajada
    const xml = readFileSync(await archivo.path(), 'utf8')
    expect(validarMoodleXml(xml)).toEqual([])
    await archivo.saveAs(`${CARPETA}/${i + 1}f-${d.id.replace("stg-g1-", "")}.xml`)

    // 5. El pago con el código del 50 %: el resumen y Mercado Pago simulado.
    await page.goto('/precios/pagar?plan=particular&forma=mensual&cantidad=1&codigo=G1-FUNDADORA-50')
    await expect(page.getByText(/50 ?%/).first()).toBeVisible({ timeout: 30_000 })
    await foto(page, `${i + 1}g-resumen-con-codigo`)
    // Sin los colores de la consola (FORCE_COLOR de Playwright).
    const salida = execFileSync('npx', ['tsx', 'scripts/qa/simular-pago.ts', '--env=staging', `--docente=${d.id}`, '--codigo=G1-FUNDADORA-50'], { encoding: 'utf8', shell: true }).replace(/\u001b\[[0-9;]*m/g, '')
    expect(salida).toContain("2. webhook (aprobado): acreditado")
    expect(salida).toContain('monto_lista: 20000')
    expect(salida).toContain('monto: 10000')
    expect(salida).toContain("codigo: 'G1-FUNDADORA-50'")
  })
}
