import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `useSession().update()` sin argumento no refresca el JWT en Auth.js v5: hace
 * un GET y devuelve el token viejo. El único lugar que puede llamar a `update`
 * es el hook, que le pasa un argumento. Ver hooks/use-refrescar-sesion.ts.
 */
const RAIZ = join(__dirname, '..')

function fuentes(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((nombre) => {
    const ruta = `${carpeta}/${nombre}`
    if (nombre === 'node_modules' || nombre === 'ui') return []
    if (statSync(join(RAIZ, ruta)).isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : []
  })
}

describe('refrescar la sesión', () => {
  const archivos = ['app', 'components', 'hooks', 'lib'].flatMap(fuentes)

  it('nadie saca `update` de useSession fuera del hook', () => {
    const infractores = archivos.filter(
      (ruta) =>
        ruta !== 'hooks/use-refrescar-sesion.ts' &&
        /\bupdate\b[^}]*\}\s*=\s*useSession\(\)/.test(readFileSync(join(RAIZ, ruta), 'utf8')),
    )
    expect(infractores).toEqual([])
  })

  it('el hook llama a update CON argumento: sin él, Auth.js no dispara el trigger', () => {
    // Sin comentarios: el del hook nombra la llamada pelada para explicar el problema.
    const hook = readFileSync(join(RAIZ, 'hooks/use-refrescar-sesion.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(hook).toMatch(/await ultima\.current\(\{\}\)/)
    expect(hook).not.toMatch(/update\(\)/)
  })

  it('usa la update del último render, no la del primero', () => {
    // La del primer render nace con `loading: true` y no hace nada al llamarla.
    const hook = readFileSync(join(RAIZ, 'hooks/use-refrescar-sesion.ts'), 'utf8')
    expect(hook).toMatch(/ultima\.current = update/)
  })

  it('auth.ts sigue re-leyendo la base ante ese trigger', () => {
    const auth = readFileSync(join(RAIZ, 'auth.ts'), 'utf8')
    expect(auth).toMatch(/trigger === 'update'/)
  })
})
