import { expect, test } from '@playwright/test'
import { GRUPO_LENGUA, marca, sqlDeStaging } from './ayudas'

/**
 * Ronda V · V1 — El link de un canal deja la cookie de la primera visita, y
 * quien se registra después queda anotado con ese canal. Un segundo link no
 * pisa al primero.
 *
 * Deja en staging un invitado "E2E · Origen …" en el grupo de Lengua de
 * Irina, que se saca del grupo al final (status 'removed') para no ocupar cupo.
 */
test('V1 · entra por el link de Instagram, se une como invitado y queda con origen "ig"', async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()

  await page.goto('/?origen=ig&ref=prueba-e2e')
  let cookie = (await contexto.cookies()).find((c) => c.name === 'maestria_origen')
  expect(decodeURIComponent(cookie?.value ?? '')).toMatch(/^ig\|PRUEBA-E2E\|\d{4}-\d{2}-\d{2}$/)
  expect(cookie?.httpOnly).toBe(true)

  // La primera visita manda.
  await page.goto('/?origen=tt')
  cookie = (await contexto.cookies()).find((c) => c.name === 'maestria_origen')
  expect(decodeURIComponent(cookie?.value ?? '')).toMatch(/^ig\|/)

  await page.goto(`/aula/${GRUPO_LENGUA.codigo}`)
  await page.getByRole('textbox').first().fill(`E2E · Origen ${marca()}`)
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL(/\/aulas/)
  const id = ((await (await page.request.get('/api/student/viewer')).json()) as { id: string }).id

  const sql = await sqlDeStaging()
  const [fila] = (await sql`SELECT origen, origen_ref FROM users WHERE id = ${id}`) as { origen: string; origen_ref: string }[]
  expect(fila).toEqual({ origen: 'ig', origen_ref: 'PRUEBA-E2E' })

  await sql`UPDATE classroom_members SET status = 'removed' WHERE user_id = ${id}`
  await contexto.close()
})
