/**
 * Reglas del sistema de diseño que se pueden comprobar leyendo el repo.
 *
 * Son chequeos léxicos, mismo enfoque que tests/migrations.test.ts: no prueban
 * que una pantalla se vea bien, prueban que no se cuele lo que el sistema
 * prohíbe (design-reference/README.md, "Las tres reglas que más se incumplen").
 *
 * El alcance es lo que el rediseño ya rehízo. Las pantallas viejas todavía
 * tienen hexadecimales y sombras propias; cada bloque que rehace una pantalla
 * suma su carpeta a ZONAS_REDISENADAS.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLOR_DE_BARRA_DEL_NAVEGADOR } from '@/lib/tema'

const RAIZ = join(__dirname, '..')

const ZONAS_REDISENADAS = [
  'components/sistema',
  'components/entrada',
  'components/caparazon',
  'components/docente',
  'components/teacher-onboarding-modal.tsx',
  'app/(entrada)',
  'app/(app)/layout.tsx',
  'app/layout.tsx',
  'components/legal-notice.tsx',
  'components/onboarding-gate.tsx',
  'lib/textos.ts',
  'lib/navegacion.ts',
]

function archivosDe(ruta: string): string[] {
  const absoluta = join(RAIZ, ruta)
  if (statSync(absoluta).isFile()) return [ruta]
  return readdirSync(absoluta).flatMap((nombre) => archivosDe(join(ruta, nombre)))
}

/**
 * Archivos que viven en una zona rediseñada pero todavía traen la presentación
 * vieja, movida tal cual al partir app/(app)/teacher/page.tsx. Cada uno sale
 * de esta lista cuando su bloque lo rehace; la lista sólo puede achicarse.
 */
const TODAVIA_VIEJOS = [
  'components/docente/mis-tareas.tsx', // bloque 5
]

const FUENTES = ZONAS_REDISENADAS.flatMap(archivosDe)
  // En Windows `join` devuelve barras invertidas.
  .map((ruta) => ruta.split('\\').join('/'))
  .filter((ruta) => /\.(tsx?|css)$/.test(ruta) && !/\.test\.tsx?$/.test(ruta) && !TODAVIA_VIEJOS.includes(ruta))

/** Saca comentarios: una regla citada en un comentario no es una violación. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function infractores(patron: RegExp): string[] {
  return FUENTES.filter((ruta) => patron.test(sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'))))
}

describe('sistema de diseño — lo ya rediseñado', () => {
  it('hay fuentes que revisar (si esto da 0, el test no está mirando nada)', () => {
    expect(FUENTES.length).toBeGreaterThan(10)
  })

  it('ningún hexadecimal suelto: todo color es un token', () => {
    expect(infractores(/#[0-9a-fA-F]{3,8}\b/)).toEqual([])
  })

  it('ningún color en rgb(), hsl() u oklch() escrito a mano', () => {
    expect(infractores(/\b(rgba?|hsla?|oklch)\(/)).toEqual([])
  })

  it('bordes, no sombras', () => {
    expect(infractores(/\bshadow-(?!none)|box-shadow|drop-shadow/)).toEqual([])
  })

  it('sin degradés', () => {
    expect(infractores(/bg-gradient|bg-linear|linear-gradient|radial-gradient/)).toEqual([])
  })

  it('nunca rojo: lo flojo es naranja y sale del token', () => {
    expect(infractores(/\b(text|bg|border)-(red|rose|pink)-\d/)).toEqual([])
  })

  it('toda animación es de Framer Motion: ni animate-* de Tailwind ni @keyframes', () => {
    expect(infractores(/\banimate-(spin|pulse|bounce|ping|shake|in|out)\b|@keyframes/)).toEqual([])
  })

  it('nada de role="button" sobre un div o un span', () => {
    expect(infractores(/role=["']button["']/)).toEqual([])
  })

  it('nunca emojis en la interfaz', () => {
    expect(infractores(/\p{Extended_Pictographic}/u)).toEqual([])
  })
})

describe('tokens', () => {
  const tokens = readFileSync(join(RAIZ, 'app/tokens.css'), 'utf8')

  /** Valor de un token dentro del bloque que arranca en `selector`. */
  function valor(selector: string, token: string): string | undefined {
    const desde = tokens.indexOf(selector)
    const bloque = tokens.slice(desde, tokens.indexOf('}', desde))
    return bloque.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]?.trim()
  }

  it('el color de la barra del navegador es el espejo de superficie-base en cada modo', () => {
    expect(COLOR_DE_BARRA_DEL_NAVEGADOR.claro).toBe(valor('[data-theme="claro"]', 'superficie-base'))
    expect(COLOR_DE_BARRA_DEL_NAVEGADOR.oscuro).toBe(valor('[data-theme="oscuro"]', 'superficie-base'))
  })

  it('app/tokens.css sigue siendo el archivo generado, sin ediciones a mano encima', () => {
    expect(tokens.startsWith('/* MaestrIA — generado desde tokens.json.')).toBe(true)
  })

  it('globals.css no define ningún color propio: sólo conecta roles con tokens', () => {
    const globals = sinComentarios(readFileSync(join(RAIZ, 'app/globals.css'), 'utf8'))
    expect(globals).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(globals).not.toMatch(/\boklch\(/)
  })
})
