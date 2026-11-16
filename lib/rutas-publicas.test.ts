import { describe, expect, it } from 'vitest'
import { esRutaPublica } from './rutas-publicas'

describe('esRutaPublica', () => {
  it('precios y los legales se ven sin cuenta', () => {
    for (const ruta of ['/precios', '/terminos', '/privacidad', '/', '/sign-in', '/aula/ABC234']) {
      expect(esRutaPublica(ruta)).toBe(true)
    }
  })

  it('el panel, el admin y la API del docente piden sesión', () => {
    for (const ruta of ['/teacher', '/admin/planes', '/api/teacher/plan', '/history', '/preciosos']) {
      expect(esRutaPublica(ruta)).toBe(false)
    }
  })
})
