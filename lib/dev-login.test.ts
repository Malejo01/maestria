import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { devLoginConfigurado } from './dev-login'

describe('devLoginConfigurado — los dos candados que no tocan la base', () => {
  it('abre sólo con next dev Y DEV_LOGIN=1', () => {
    expect(devLoginConfigurado({ NODE_ENV: 'development', DEV_LOGIN: '1' })).toBe(true)
  })

  it('en producción no abre, aunque alguien haya dejado DEV_LOGIN=1 en Vercel', () => {
    expect(devLoginConfigurado({ NODE_ENV: 'production', DEV_LOGIN: '1' })).toBe(false)
  })

  it('en tests tampoco', () => {
    expect(devLoginConfigurado({ NODE_ENV: 'test', DEV_LOGIN: '1' })).toBe(false)
  })

  it('next dev contra .env.local (producción) no lo tiene: falta DEV_LOGIN', () => {
    expect(devLoginConfigurado({ NODE_ENV: 'development' })).toBe(false)
  })

  it('DEV_LOGIN tiene que ser exactamente "1"', () => {
    for (const valor of ['true', 'yes', '0', '', ' 1']) {
      expect(devLoginConfigurado({ NODE_ENV: 'development', DEV_LOGIN: valor })).toBe(false)
    }
  })
})

describe('el tercer candado está cableado', () => {
  const fuente = readFileSync(join(__dirname, 'dev-login.ts'), 'utf8')
  const auth = readFileSync(join(__dirname, '..', 'auth.ts'), 'utf8')
  const pagina = readFileSync(join(__dirname, '..', 'app/(entrada)/sign-in/dev/page.tsx'), 'utf8')

  it('entregar un usuario exige además que la base diga ser staging', () => {
    const cuerpo = fuente.slice(fuente.indexOf('export async function usuarioDeDesarrollo'))
    expect(cuerpo).toContain('devLoginHabilitado()')
    expect(fuente).toMatch(/environment === 'staging'/)
  })

  it('auth.ts sólo registra el proveedor detrás de devLoginConfigurado()', () => {
    expect(auth).toMatch(/\.\.\.\(devLoginConfigurado\(\)\s*\?\s*\[\s*Credentials\(/)
  })

  it('la página de ingreso de desarrollo responde 404 si los candados no abren', () => {
    expect(pagina).toMatch(/if \(!\(await devLoginHabilitado\(\)\)\) notFound\(\)/)
  })

  it('.env.local.example no trae DEV_LOGIN: no se habilita por copiar el ejemplo', () => {
    const ejemplo = readFileSync(join(__dirname, '..', '.env.local.example'), 'utf8')
    expect(ejemplo).not.toMatch(/^DEV_LOGIN=/m)
  })
})
