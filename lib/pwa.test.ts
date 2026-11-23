import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { debeGuardarse, debeOfrecerInstalar, RUTA_SIN_CONEXION, VERSION_DEL_CACHE } from './pwa'

const O = 'https://maestria.app'
const u = (p: string, origen = O) => new URL(p, origen)

describe('debeGuardarse: sólo la cáscara y lo estático', () => {
  it('guarda lo estático con hash, los íconos, el manifiesto y la página sin conexión', () => {
    expect(debeGuardarse(u('/_next/static/chunks/app.js'), O)).toBe(true)
    expect(debeGuardarse(u('/icono-pwa/512'), O)).toBe(true)
    expect(debeGuardarse(u('/manifest.webmanifest'), O)).toBe(true)
    expect(debeGuardarse(u(RUTA_SIN_CONEXION), O)).toBe(true)
  })
  it('nunca la API, nunca una página con datos, nunca otro origen ni otro método', () => {
    expect(debeGuardarse(u('/api/student/repaso'), O)).toBe(false)
    expect(debeGuardarse(u('/api/quiz/save-result'), O)).toBe(false)
    expect(debeGuardarse(u('/aulas'), O)).toBe(false)
    expect(debeGuardarse(u('/history'), O)).toBe(false)
    expect(debeGuardarse(u('/'), O)).toBe(false)
    expect(debeGuardarse(u('/_next/static/x.js', 'https://otro.com'), O)).toBe(false)
    expect(debeGuardarse(u('/_next/static/x.js'), O, 'POST')).toBe(false)
    expect(debeGuardarse(u('/monitoring'), O)).toBe(false)
  })
  it('public/sw.js repite la misma regla y la misma versión', () => {
    const sw = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8')
    expect(sw).toContain(`'${VERSION_DEL_CACHE}'`)
    expect(sw).toContain(`'${RUTA_SIN_CONEXION}'`)
    expect(sw).toContain("p.startsWith('/api/')")
    expect(sw).toContain("p.startsWith('/_next/static/')")
  })
})

describe('debeOfrecerInstalar', () => {
  const base = { practicas: 2, yaOfrecido: false, instalable: true, instalada: false }
  it('después de la segunda práctica, una vez', () => {
    expect(debeOfrecerInstalar(base)).toBe(true)
    expect(debeOfrecerInstalar({ ...base, practicas: 1 })).toBe(false)
    expect(debeOfrecerInstalar({ ...base, yaOfrecido: true })).toBe(false)
  })
  it('no si el navegador no lo permite o ya está instalada', () => {
    expect(debeOfrecerInstalar({ ...base, instalable: false })).toBe(false)
    expect(debeOfrecerInstalar({ ...base, instalada: true })).toBe(false)
  })
})
