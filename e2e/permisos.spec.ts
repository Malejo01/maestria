import { expect, test } from '@playwright/test'
import { ALUMNA, entrarComo } from './ayudas'

/**
 * Recorrido 6: un alumno no puede entrar a `/teacher` (proxy.ts) ni a la API
 * del docente. Cubre la parte del smoke test de Auth.js que no necesita Google.
 */
test('un alumno no puede entrar a /teacher', async ({ page }) => {
  await entrarComo(page, ALUMNA)
  await page.goto('/teacher')
  await expect(page).not.toHaveURL(/\/teacher/)

  const api = await page.request.get('/api/teacher/quizzes')
  expect([401, 403, 307, 308]).toContain(api.status())
})

test('sin sesión, /teacher manda a entrar', async ({ page }) => {
  await page.goto('/teacher')
  await expect(page).not.toHaveURL(/\/teacher(\?|$)/)
})
