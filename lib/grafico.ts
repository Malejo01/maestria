import { evaluarFormula } from '@/lib/evaluar-formula'

/**
 * Ronda X · X3 — El gráfico de una o más funciones en una pregunta.
 *
 * `grafico: { expresiones, dominio, puntos }`, opcional en cualquier pregunta.
 * Las expresiones se escriben como en la calculadora (`x^2 - 1`, `2x + 3`,
 * `sqrt(x)`, `sin(x)`) y se evalúan con el evaluador seguro de F7 (sin
 * `eval`): acá se traducen a su sintaxis (`{x}`, `pow`). Todo puro: lo usan
 * el SVG de la app, la impresión y el Moodle XML.
 */
export interface PuntoDelGrafico {
  x: number
  y: number
  etiqueta?: string
}

export interface Grafico {
  expresiones: string[]
  dominio: [number, number]
  puntos?: PuntoDelGrafico[]
}

export const MAX_EXPRESIONES = 3
export const MAX_PUNTOS = 8
export const MUESTRAS = 241
const SPAN_MAXIMO = 1000

/** Termina en `i` (inclusive) el operando que arranca en `i` yendo hacia la izquierda; devuelve su inicio. */
function inicioDelOperando(s: string, fin: number): number {
  let i = fin
  if (s[i] === ')') {
    let nivel = 0
    for (; i >= 0; i--) {
      if (s[i] === ')') nivel++
      else if (s[i] === '(') {
        nivel--
        if (nivel === 0) break
      }
    }
    // Una función pegada al paréntesis: sqrt(...)^2.
    while (i > 0 && /[a-z0-9]/i.test(s[i - 1])) i--
    return i
  }
  if (s[i] === '}') return s.lastIndexOf('{', i)
  while (i > 0 && /[0-9.]/.test(s[i - 1])) i--
  return i
}

/** Termina el operando que arranca en `i` yendo hacia la derecha; devuelve su fin (inclusive). */
function finDelOperando(s: string, inicio: number): number {
  let i = inicio
  if (s[i] === '-' || s[i] === '+') i++
  if (s[i] === '{') return s.indexOf('}', i)
  if (/[a-z]/i.test(s[i])) while (/[a-z0-9]/i.test(s[i + 1] ?? '')) i++
  if (s[i] === '(' || s[i + 1] === '(') {
    if (s[i] !== '(') i++
    let nivel = 0
    for (; i < s.length; i++) {
      if (s[i] === '(') nivel++
      else if (s[i] === ')') {
        nivel--
        if (nivel === 0) return i
      }
    }
    return s.length - 1
  }
  while (/[0-9.]/.test(s[i + 1] ?? '')) i++
  return i
}

/**
 * De como se escribe (`2x^2 - 3x + 1`) a la sintaxis del evaluador
 * (`2*pow({x},2)-3*{x}+1`). Lanza si queda algo que no entiende.
 */
export function aFormula(expresion: string): string {
  let s = String(expresion ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/·|×/g, '*')
    .replace(/−/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/,/g, '.')
  // La variable: una x suelta (no la de "exp").
  s = s.replace(/(?<![a-z])x(?![a-z])/g, '{x}')
  // Multiplicación implícita: 2{x}, 2(…), 2sin(…), {x}(…), )(, ){x}, {x}{x}.
  s = s
    .replace(/(^|[^a-z0-9.])(\d+(?:\.\d+)?)(?=[{(a-z])/g, '$1$2*')
    .replace(/\}(?=[{(a-z0-9])/g, '}*')
    .replace(/\)(?=[{(a-z0-9])/g, ')*')
  // Potencias, de derecha a izquierda (x^2^3 = x^(2^3)).
  for (let vueltas = 0; s.includes('^') && vueltas < 20; vueltas++) {
    const k = s.lastIndexOf('^')
    const ini = inicioDelOperando(s, k - 1)
    const fin = finDelOperando(s, k + 1)
    if (ini < 0 || fin < k + 1) throw new Error(`Potencia mal escrita en "${expresion}"`)
    s = `${s.slice(0, ini)}pow(${s.slice(ini, k)},${s.slice(k + 1, fin + 1)})${s.slice(fin + 1)}`
  }
  return s
}

/** f(x), o null si ahí no está definida (raíz de un negativo, división por cero). */
export function evaluarEn(formula: string, x: number): number | null {
  try {
    const y = evaluarFormula(formula, { x })
    return Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

/** El gráfico limpio, o null si no sirve: 1 a 3 expresiones que se pueden dibujar, un dominio razonable. */
export function limpiarGrafico(crudo: unknown): Grafico | null {
  const g = crudo as { expresiones?: unknown; dominio?: unknown; puntos?: unknown } | null
  if (!g || !Array.isArray(g.expresiones) || !Array.isArray(g.dominio) || g.dominio.length !== 2) return null
  const [a, b] = g.dominio.map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b || b - a > SPAN_MAXIMO) return null
  const expresiones = g.expresiones
    .map((e) => String(e ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_EXPRESIONES)
  if (expresiones.length === 0) return null
  for (const e of expresiones) {
    let formula: string
    try {
      formula = aFormula(e)
    } catch {
      return null
    }
    // Que se pueda dibujar en al menos la mitad del dominio.
    let definidos = 0
    for (let i = 0; i < 41; i++) if (evaluarEn(formula, a + ((b - a) * i) / 40) !== null) definidos++
    if (definidos < 21) return null
  }
  const puntos = (Array.isArray(g.puntos) ? g.puntos : [])
    .map((p) => p as { x?: unknown; y?: unknown; etiqueta?: unknown })
    .map((p) => ({ x: Number(p?.x), y: Number(p?.y), ...(p?.etiqueta ? { etiqueta: String(p.etiqueta).slice(0, 20) } : {}) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= a && p.x <= b)
    .slice(0, MAX_PUNTOS)
  return { expresiones, dominio: [a, b], ...(puntos.length > 0 ? { puntos } : {}) }
}

export interface GeometriaDelGrafico {
  ancho: number
  alto: number
  /** Un camino SVG por expresión (cortado donde no está definida o salta). */
  caminos: string[]
  puntos: { cx: number; cy: number; etiqueta: string }[]
  /** Dónde cae y = 0 y x = 0 (null si quedan fuera). */
  ejeX: number | null
  ejeY: number | null
  marcasX: { px: number; valor: number }[]
  marcasY: { px: number; valor: number }[]
  rangoY: [number, number]
}

/** Un paso "lindo" para las marcas: 1, 2 o 5 por una potencia de 10. */
export function pasoDeMarcas(span: number, cuantas = 8): number {
  const crudo = span / cuantas
  const potencia = 10 ** Math.floor(Math.log10(crudo))
  const n = crudo / potencia
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * potencia
}

function marcas(min: number, max: number): number[] {
  const paso = pasoDeMarcas(max - min)
  const salida: number[] = []
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) salida.push(Math.round(v / paso) * paso)
  return salida.slice(0, 15)
}

const MARGEN = 28

/** Todo lo que hace falta para dibujarlo, en píxeles. El rango de y se ajusta solo (sin los valores extremos). */
export function armarGrafico(g: Grafico, ancho = 320, alto = 240): GeometriaDelGrafico {
  const [a, b] = g.dominio
  const formulas = g.expresiones.map(aFormula)
  const xs = Array.from({ length: MUESTRAS }, (_, i) => a + ((b - a) * i) / (MUESTRAS - 1))
  const ys = formulas.map((f) => xs.map((x) => evaluarEn(f, x)))
  const todos = [...ys.flat().filter((y): y is number => y !== null), ...(g.puntos ?? []).map((p) => p.y)].sort((p, q) => p - q)
  // Sin el 3 % de cada punta: una asíntota no aplasta el resto.
  const recorte = Math.floor(todos.length * 0.03)
  let ymin = todos[recorte] ?? -1
  let ymax = todos[todos.length - 1 - recorte] ?? 1
  for (const p of g.puntos ?? []) {
    ymin = Math.min(ymin, p.y)
    ymax = Math.max(ymax, p.y)
  }
  if (ymin > 0 && ymin < (ymax - ymin) * 0.5) ymin = 0
  if (ymax < 0 && -ymax < (ymax - ymin) * 0.5) ymax = 0
  if (ymax - ymin < 1e-9) {
    ymin -= 1
    ymax += 1
  }
  const pad = (ymax - ymin) * 0.08
  ymin -= pad
  ymax += pad

  const px = (x: number) => MARGEN + ((x - a) / (b - a)) * (ancho - 2 * MARGEN)
  const py = (y: number) => alto - MARGEN - ((y - ymin) / (ymax - ymin)) * (alto - 2 * MARGEN)
  const r = (v: number) => Math.round(v * 10) / 10
  const salto = (ymax - ymin) * 0.6

  const caminos = ys.map((serie) => {
    let d = ''
    let anterior: number | null = null
    serie.forEach((y, i) => {
      const dentro = y !== null && y >= ymin - salto && y <= ymax + salto
      if (!dentro || (anterior !== null && Math.abs(y - anterior) > salto)) {
        anterior = dentro ? y : null
        if (dentro) d += `M${r(px(xs[i]))},${r(py(Math.max(ymin - salto, Math.min(ymax + salto, y))))}`
        return
      }
      d += `${anterior === null ? 'M' : 'L'}${r(px(xs[i]))},${r(py(y))}`
      anterior = y
    })
    return d
  })

  return {
    ancho,
    alto,
    caminos,
    puntos: (g.puntos ?? []).map((p) => ({ cx: r(px(p.x)), cy: r(py(p.y)), etiqueta: p.etiqueta ?? `(${formatear(p.x)}; ${formatear(p.y)})` })),
    ejeX: ymin <= 0 && ymax >= 0 ? r(py(0)) : null,
    ejeY: a <= 0 && b >= 0 ? r(px(0)) : null,
    marcasX: marcas(a, b).map((v) => ({ px: r(px(v)), valor: v })),
    marcasY: marcas(ymin, ymax).map((v) => ({ px: r(py(v)), valor: v })),
    rangoY: [ymin, ymax],
  }
}

/** Un número para leer: coma decimal y sin ceros de más. */
export function formatear(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** La descripción para un lector de pantalla (y el texto que reemplaza al gráfico en GIFT). */
export function descripcionDelGrafico(g: Grafico): string {
  const funciones = g.expresiones.map((e) => `y = ${e}`).join('; ')
  const puntos = (g.puntos ?? []).map((p) => (p.etiqueta ? `${p.etiqueta} (${formatear(p.x)}; ${formatear(p.y)})` : `(${formatear(p.x)}; ${formatear(p.y)})`))
  return `Gráfico de ${funciones}, con x entre ${formatear(g.dominio[0])} y ${formatear(g.dominio[1])}${puntos.length ? `. Puntos marcados: ${puntos.join(', ')}` : ''}.`
}

/** Trazos para distinguir las curvas sin depender del color (y para la impresión en blanco y negro). */
export const TRAZOS = ['', '6 4', '2 3'] as const

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * El SVG como texto, para el Moodle XML (va como imagen en base64). Todo en
 * `currentColor`: dentro de Moodle se ve en negro, sin colores propios.
 */
export function svgDelGrafico(g: Grafico, ancho = 480, alto = 360): string {
  const geo = armarGrafico(g, ancho, alto)
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${escapar(descripcionDelGrafico(g))}" font-family="sans-serif" font-size="11">`,
    `<title>${escapar(descripcionDelGrafico(g))}</title>`,
    `<rect width="${ancho}" height="${alto}" fill="white"/>`,
    ...geo.marcasX.map((m) => `<line x1="${m.px}" y1="${MARGEN}" x2="${m.px}" y2="${alto - MARGEN}" stroke="currentColor" stroke-opacity="0.12"/>`),
    ...geo.marcasY.map((m) => `<line x1="${MARGEN}" y1="${m.px}" x2="${ancho - MARGEN}" y2="${m.px}" stroke="currentColor" stroke-opacity="0.12"/>`),
    geo.ejeX !== null ? `<line x1="${MARGEN}" y1="${geo.ejeX}" x2="${ancho - MARGEN}" y2="${geo.ejeX}" stroke="currentColor" stroke-opacity="0.6"/>` : '',
    geo.ejeY !== null ? `<line x1="${geo.ejeY}" y1="${MARGEN}" x2="${geo.ejeY}" y2="${alto - MARGEN}" stroke="currentColor" stroke-opacity="0.6"/>` : '',
    ...geo.marcasX.map((m) => `<text x="${m.px}" y="${alto - MARGEN + 14}" text-anchor="middle" fill="currentColor">${formatear(m.valor)}</text>`),
    ...geo.marcasY.map((m) => `<text x="${MARGEN - 4}" y="${m.px + 4}" text-anchor="end" fill="currentColor">${formatear(m.valor)}</text>`),
    ...geo.caminos.map((d, i) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2"${TRAZOS[i] ? ` stroke-dasharray="${TRAZOS[i]}"` : ''}/>`),
    ...geo.puntos.map((p) => `<circle cx="${p.cx}" cy="${p.cy}" r="4" fill="currentColor"/><text x="${p.cx + 6}" y="${p.cy - 6}" fill="currentColor">${escapar(p.etiqueta)}</text>`),
    '</svg>',
  ]
  return partes.filter(Boolean).join('')
}

/** ¿Los temas son de funciones? Ahí la IA puede sumar un gráfico. */
export function temasDeFunciones(temas: readonly string[]): boolean {
  return temas.some((t) =>
    /funci[oó]n|funciones|gr[aá]fic|par[aá]bola|lineal|cuadr[aá]tica|exponencial|logar[ií]tmica|trigonom[eé]trica|dominio|imagen de|ra[ií]ces|ordenada|pendiente|as[ií]ntota|derivada|l[ií]mite|crecimiento/i.test(
      t,
    ),
  )
}
