import { expect, test, type Page } from '@playwright/test'
import { ALUMNA, DOCENTE, GRUPO_LENGUA, entrarComo } from './ayudas'

/**
 * O16 · La barra y la página no se salen de la pantalla en los anchos chicos.
 * El breakpoint `xs:` ya no se usa (no existía en el @theme y no emitía nada);
 * lo que queda es comprobar que, sin él, nada desborda a 360, 390 y 768 px en
 * los cuatro contextos de navegación.
 */
const ANCHOS = [360, 390, 768]

async function desborde(page: Page) {
  return page.evaluate(() => {
    const ancho = document.documentElement.clientWidth
    const pagina = document.documentElement.scrollWidth - ancho
    const fuera = [...document.querySelectorAll('header *, nav *')]
      .filter((el) => {
        // Un carril con scroll propio (las pestañas del grupo) puede tener cosas fuera: es a propósito.
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false
        }
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.right > ancho + 1 || r.left < -1)
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`)
    return { pagina, fuera }
  })
}

const CASOS: { contexto: string; quien?: string; rutas: string[] }[] = [
  { contexto: 'visitante', rutas: ['/'] },
  { contexto: 'alumno', quien: ALUMNA, rutas: ['/aulas', '/practicar', '/history'] },
  { contexto: 'docente', quien: DOCENTE, rutas: ['/teacher', '/teacher?seccion=materias', '/teacher?seccion=tareas', `/teacher/grupos/${GRUPO_LENGUA.id}`] },
]

for (const caso of CASOS) {
  test(`${caso.contexto}: nada se sale de la pantalla a ${ANCHOS.join(', ')} px`, async ({ page }) => {
    if (caso.quien) await entrarComo(page, caso.quien)
    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: 800 })
      for (const ruta of caso.rutas) {
        await page.goto(ruta)
        await page.waitForLoadState('networkidle')
        const { pagina, fuera } = await desborde(page)
        expect.soft(fuera, `${ruta} a ${ancho} px: elementos de la barra fuera de la pantalla`).toEqual([])
        expect.soft(pagina, `${ruta} a ${ancho} px: scroll horizontal de la página`).toBeLessThanOrEqual(0)
      }
    }
  })
}
