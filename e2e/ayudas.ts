import { expect, type Page } from '@playwright/test'

/**
 * Ayudas de las pruebas de punta a punta (O1). Usuarios de staging:
 *   - Irina Álvarez (`stg-user-0008`): docente con materias y grupos.
 *   - Sofía Ramírez (`stg-demo-sofia`): alumna con cuenta, en el grupo Lengua de Irina.
 */
export const DOCENTE = 'Irina'
export const ALUMNA = 'Sofía'
/** Grupo Lengua de Irina (id 2), con la tarea "Prueba M1 · sin conexión". */
export const GRUPO_LENGUA = { id: 2, codigo: 'ADVU7B' }

/** Entra por el ingreso de desarrollo como el usuario cuyo nombre contiene `nombre`. */
export async function entrarComo(page: Page, nombre: string) {
  await page.goto('/sign-in/dev')
  const boton = page.getByRole('button', { name: new RegExp(nombre) }).first()
  await expect(boton, 'El ingreso de desarrollo sólo existe con `npm run dev:staging`').toBeVisible()
  await boton.click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 60_000 })
}

/** Un sufijo para que los datos de cada corrida no choquen: "E2E · 22/11 03:15:07". */
export function marca(): string {
  const ahora = new Date()
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(ahora.getDate())}/${dos(ahora.getMonth() + 1)} ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}:${dos(ahora.getSeconds())}`
}

/**
 * La IA simulada: `/api/generate-quiz` devuelve preguntas fijas, tantas como
 * se pidieron (el cliente descarta una tanda incompleta). Correr las pruebas no gasta.
 */
export async function simularGeneracion(page: Page) {
  await page.route('**/api/generate-quiz', async (ruta) => {
    const pedido = ruta.request().postDataJSON() as { questionCount?: number } | null
    await ruta.fulfill({ json: { questions: preguntasSimuladas(Number(pedido?.questionCount) || 3) } })
  })
}

/** Las preguntas que devuelve la IA simulada. */
export function preguntasSimuladas(cantidad = 3) {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `e2e-${i + 1}`,
    type: 'multiple_choice',
    topic: 'e2e',
    topicName: 'Tema de prueba',
    question: `Pregunta de prueba ${i + 1}: ¿cuánto es ${i + 2} + ${i + 2}?`,
    options: [String((i + 2) * 2), String((i + 2) * 2 + 1), String((i + 2) * 2 + 2), String((i + 2) * 2 + 3)],
    correctAnswer: 0,
    explanation: `${i + 2} + ${i + 2} = ${(i + 2) * 2}.`,
  }))
}

/**
 * Responde la pregunta que está en pantalla, sin importar si está bien: elige
 * la primera opción o escribe "1", toca Verificar y después Siguiente.
 */
export async function responderUna(page: Page) {
  const opciones = page.getByRole('radio')
  const campo = page.locator('input[inputmode="decimal"], input[inputmode="text"], textarea').first()
  if (await opciones.first().isVisible().catch(() => false)) {
    await opciones.first().click()
  } else {
    await campo.fill('1')
  }
  await page.getByRole('button', { name: /^(Verificar|Siguiente|Terminar)/ }).first().click()
  const siguiente = page.getByRole('button', { name: /^(Siguiente|Ver resultados)$/ })
  if (await siguiente.isVisible().catch(() => false)) await siguiente.click()
}

/**
 * Entra por el ingreso de desarrollo con el id del usuario, sin pasar por la
 * lista de /sign-in/dev (que muestra sólo doce): para un usuario recién
 * creado en staging (O13).
 */
export async function entrarConId(page: Page, userId: string) {
  const { csrfToken } = (await (await page.request.get('/api/auth/csrf')).json()) as { csrfToken: string }
  const res = await page.request.post('/api/auth/callback/dev', { form: { csrfToken, userId, callbackUrl: '/' } })
  expect(res.ok(), 'el ingreso de desarrollo sólo existe con `npm run dev:staging`').toBe(true)
}

/**
 * Ronda T · E2: la base de STAGING para un e2e que necesita dejarla en un
 * estado (por ejemplo, lo que contó el servidor cuando la IA está simulada en
 * el navegador). Se niega si la base no está marcada staging.
 */
export async function sqlDeStaging() {
  const { readFileSync } = await import('node:fs')
  const { neon } = await import('@neondatabase/serverless')
  const url = readFileSync('.env.staging.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.replace(/^["']|["']$/g, '')
  if (!url) throw new Error('Falta DATABASE_URL en .env.staging.local')
  const sql = neon(url)
  const [env] = (await sql`SELECT environment FROM deployment_env LIMIT 1`) as { environment: string }[]
  if (env?.environment !== 'staging') throw new Error('Sólo contra una base marcada staging')
  return sql
}
