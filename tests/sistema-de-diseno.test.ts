/**
 * Reglas del sistema de diseño que se pueden comprobar leyendo el repo.
 *
 * Son chequeos léxicos, mismo enfoque que tests/migrations.test.ts: no prueban
 * que una pantalla se vea bien, prueban que no se cuele lo que el sistema
 * prohíbe (design-reference/README.md, "Las tres reglas que más se incumplen").
 *
 * Desde el bloque 6 el alcance es toda la app: `app/` y `components/` enteros,
 * menos los primitivos vendored de `components/ui/`. El pase que llevó las
 * pantallas viejas a los tokens está en scripts/codemod-tokens.py.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLOR_DE_BARRA_DEL_NAVEGADOR } from '@/lib/tema'

const RAIZ = join(__dirname, '..')

const ZONAS_REDISENADAS = ['app', 'components', 'lib/textos.ts', 'lib/navegacion.ts']

/** Los primitivos de shadcn son vendored: no se reescriben ni se revisan acá. */
const VENDORED = 'components/ui/'

/**
 * Lo que queda afuera, y por qué. La lista no crece sin un motivo escrito.
 */
const FUERA_DE_ALCANCE = [
  // Es la paleta: el único lugar donde los hexadecimales son el contenido.
  'app/tokens.css',
  // Conecta roles con tokens y anula las sombras del tema; tiene su propio test abajo.
  'app/globals.css',
  // Se muestra cuando la hoja de estilos no cargó: no hay variables que leer.
  'app/global-error.tsx',
]

/** Las rutas de la API no dibujan nada: sus cadenas son prompts y mensajes, no interfaz. */
const NO_ES_INTERFAZ = 'app/api/'

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
const TODAVIA_VIEJOS: string[] = [
]

const FUENTES = ZONAS_REDISENADAS.flatMap(archivosDe)
  // En Windows `join` devuelve barras invertidas.
  .map((ruta) => ruta.split('\\').join('/'))
  .filter(
    (ruta) =>
      /\.(tsx?|css)$/.test(ruta) &&
      !/\.test\.tsx?$/.test(ruta) &&
      !TODAVIA_VIEJOS.includes(ruta) &&
      !FUERA_DE_ALCANCE.includes(ruta) &&
      !ruta.startsWith(VENDORED) &&
      !ruta.startsWith(NO_ES_INTERFAZ),
  )

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

  // Lo que se mueve SIN pasar por Framer Motion no puede consultar
  // useReducedMotion(): tiene su propia forma de respetar la preferencia, y
  // estos dos tests son los que la sostienen (accesibilidad.md, "Movimiento").
  it('el papel picado no se dispara con prefers-reduced-motion', () => {
    const conConfetti = FUENTES.filter((ruta) => /\bconfetti\(/.test(sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'))))
    expect(conConfetti.length).toBeGreaterThan(0)
    for (const ruta of conConfetti) {
      const codigo = sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'))
      const llamadas = codigo.match(/\bconfetti\(\{[\s\S]*?\}\)/g) ?? []
      expect(llamadas.length, ruta).toBeGreaterThan(0)
      for (const llamada of llamadas) expect(llamada, ruta).toContain('disableForReducedMotion: true')
    }
  })

  it('globals.css apaga las transiciones y animaciones de CSS con prefers-reduced-motion', () => {
    const css = sinComentarios(readFileSync(join(RAIZ, 'app/globals.css'), 'utf8'))
    const bloque = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(bloque).toContain('transition-duration: 0.01ms !important')
    expect(bloque).toContain('animation-duration: 0.01ms !important')
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

/**
 * H2: la regla de emojis de B3 ("en la interfaz, ninguno; sólo dentro del
 * contenido que genera la IA para Primario") miraba `app/` y `components/`,
 * pero hay textos de interfaz que se arman en `lib/`: el aviso de tope de la
 * IA (lib/ai-rate-limit.ts), los cortes, los textos. Por ahí se coló el 🌱 del
 * tope de Primario, con un test que lo exigía.
 *
 * Acá se mira todo `lib/` y `hooks/`, menos lo que es contenido o pedido a la
 * IA —los prompts, que sí llevan emojis de ejemplo para Primario— y las
 * herramientas de QA, que no le muestran nada a nadie.
 */
const LIB_QUE_NO_ES_INTERFAZ = [
  // Arma los prompts por nivel (con los emojis de ejemplo de Primario) y
  // `quitarEmojis`, que los nombra para sacarlos.
  'lib/education-context.ts',
  // Prompts de generación.
  'lib/quiz-generation.ts',
  // Agentes y reportes de QA: corren a mano, no llegan a la interfaz.
  'lib/qa/',
]

/** Símbolos que son contenido y no emoji para esta regla (voz-y-textos.md, "Emojis"). */
const SIMBOLOS_DE_CONTENIDO = /[↔©™]/gu

const FUENTES_LIB = ['lib', 'hooks']
  .flatMap(archivosDe)
  .map((ruta) => ruta.split('\\').join('/'))
  .filter(
    (ruta) =>
      /\.tsx?$/.test(ruta) &&
      !/\.test\.tsx?$/.test(ruta) &&
      !LIB_QUE_NO_ES_INTERFAZ.some((fuera) => ruta === fuera || (fuera.endsWith('/') && ruta.startsWith(fuera))),
  )

describe('emojis — los textos de interfaz que viven en lib/ (H2)', () => {
  it('hay archivos que revisar', () => {
    expect(FUENTES_LIB).toContain('lib/ai-rate-limit.ts')
    expect(FUENTES_LIB).toContain('lib/textos.ts')
  })

  it('ninguno, tampoco en lib/ ni en hooks/', () => {
    const conEmoji = FUENTES_LIB.filter((ruta) =>
      /\p{Extended_Pictographic}/u.test(
        sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8')).replace(SIMBOLOS_DE_CONTENIDO, ''),
      ),
    )
    expect(conEmoji).toEqual([])
  })
})
