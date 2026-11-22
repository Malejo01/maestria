import { defineConfig, devices } from '@playwright/test'

/**
 * O1 · Pruebas de punta a punta contra el servidor de desarrollo de STAGING.
 *
 *   npm run e2e
 *
 * Necesitan `npm run dev:staging` (lo levanta solo si no está corriendo) y el
 * ingreso de desarrollo `/sign-in/dev`, que sólo existe con `next dev`,
 * `DEV_LOGIN=1` y una base marcada `staging` (lib/dev-login.ts). Por eso NO
 * entran al CI: no hay base de staging en GitHub Actions. Contra producción no
 * pueden correr: sin `/sign-in/dev` la primera prueba falla al entrar.
 *
 * Escriben datos de prueba en staging con el prefijo "E2E ·" (materias, grupos,
 * tareas, invitados). La IA está simulada en las pruebas que generan
 * (`e2e/ayudas.ts`, `simularGeneracion`): correrlas no gasta nada.
 *
 * El navegador es el Chromium que ya está instalado en la máquina (el de
 * Playwright 1.63.0): no hace falta `playwright install`.
 */
export default defineConfig({
  testDir: process.env.E2E_DIR ?? './e2e',
  // Una a la vez: comparten la base de staging y el mismo servidor de desarrollo.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://localhost:3000',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npm run dev:staging',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
