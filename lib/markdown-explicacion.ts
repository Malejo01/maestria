/**
 * Markdown de las explicaciones que escribe la IA → árbol para renderizar.
 *
 * ─── Por qué un parser propio y no react-markdown + remark-math ─────────────
 *
 * Las explicaciones mezclan Markdown con fórmulas `$...$`, y las dos sintaxis
 * se pisan: en `$a_1 * b_2$` un parser de Markdown ve cursiva. Los plugins de
 * matemática resuelven eso, pero tratan TODO `$...$` como fórmula, y este
 * proyecto ya tiene decidido que no: `LaTeXRenderer` distingue "$texto entre
 * signos de pesos$" de una fórmula de verdad. Acá las fórmulas se apartan
 * primero, crudas y sin tocar, y se le entregan a ese mismo renderer.
 *
 * Cubre lo que el modelo usa: encabezados, negrita, cursiva, listas (con
 * anidado), código en línea y en bloque, citas y separadores. No cubre tablas,
 * links ni imágenes: el prompt no los pide y no hay imágenes en la app.
 *
 * ─── Texto a medio escribir ─────────────────────────────────────────────────
 *
 * El modal muestra la explicación con efecto de máquina de escribir, así que
 * este parser recibe prefijos del texto final ("…es **muy comú"). Un marcador
 * sin cierre NUNCA se imprime: se descarta y el contenido queda como texto
 * común. La excepción es el `*` suelto, que es una multiplicación legítima.
 */

export type NodoEnLinea =
  | { tipo: 'texto'; texto: string }
  /** Fórmula con sus delimitadores (`$…$` o `$$…$$`), para LaTeXRenderer. */
  | { tipo: 'formula'; crudo: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'negrita'; hijos: NodoEnLinea[] }
  | { tipo: 'cursiva'; hijos: NodoEnLinea[] }

export interface ItemDeLista {
  contenido: NodoEnLinea[]
  sublistas: BloqueLista[]
}

export interface BloqueLista {
  tipo: 'lista'
  ordenada: boolean
  /** Número del primer ítem de una lista ordenada. */
  inicio: number
  items: ItemDeLista[]
}

export type Bloque =
  | { tipo: 'encabezado'; nivel: 1 | 2 | 3 | 4; contenido: NodoEnLinea[] }
  | { tipo: 'parrafo'; contenido: NodoEnLinea[] }
  | BloqueLista
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'formula'; crudo: string }
  | { tipo: 'cita'; contenido: NodoEnLinea[] }
  | { tipo: 'separador' }

// ── En línea ────────────────────────────────────────────────────────────────

/** El mismo criterio de delimitadores que `components/latex-renderer.tsx`. */
const FORMULA = /\$\$([\s\S]*?)\$\$|\$((?:\\[$]|[^$])+?)\$/y

function formulaEn(texto: string, desde: number): string | null {
  FORMULA.lastIndex = desde
  const m = FORMULA.exec(texto)
  return m ? m[0] : null
}

/**
 * Posición del cierre de `marcador` a partir de `desde`, salteando fórmulas y
 * código (un `**` adentro de `$…$` no cierra nada). -1 si no cierra.
 */
function buscarCierre(texto: string, desde: number, marcador: string): number {
  let i = desde
  while (i < texto.length) {
    const c = texto[i]
    if (c === '\\' && i + 1 < texto.length) {
      i += 2
      continue
    }
    if (c === '$') {
      const formula = formulaEn(texto, i)
      if (formula) {
        i += formula.length
        continue
      }
    }
    if (c === '`') {
      const fin = texto.indexOf('`', i + 1)
      if (fin !== -1) {
        i = fin + 1
        continue
      }
    }
    if (texto.startsWith(marcador, i)) {
      // Un `*` que en realidad es parte de un `**` no cierra una cursiva.
      if (marcador.length === 1 && texto[i + 1] === marcador) {
        i += 2
        continue
      }
      return i
    }
    i++
  }
  return -1
}

const ES_LETRA_O_NUMERO = /[\p{L}\p{N}]/u

export function parsearEnLinea(texto: string): NodoEnLinea[] {
  const nodos: NodoEnLinea[] = []
  let pendiente = ''
  const volcar = () => {
    if (pendiente) nodos.push({ tipo: 'texto', texto: pendiente })
    pendiente = ''
  }

  let i = 0
  while (i < texto.length) {
    const c = texto[i]

    // Escape de Markdown: `\*` es un asterisco literal. Sólo para los
    // caracteres que acá significan algo; `\frac` suelto no se toca.
    if (c === '\\' && i + 1 < texto.length && '*_`#'.includes(texto[i + 1])) {
      pendiente += texto[i + 1]
      i += 2
      continue
    }

    if (c === '$') {
      const formula = formulaEn(texto, i)
      if (formula) {
        volcar()
        nodos.push({ tipo: 'formula', crudo: formula })
        i += formula.length
        continue
      }
    }

    if (c === '`') {
      const fin = texto.indexOf('`', i + 1)
      if (fin !== -1) {
        volcar()
        nodos.push({ tipo: 'codigo', texto: texto.slice(i + 1, fin) })
        i = fin + 1
        continue
      }
      // Sin cierre: el acento grave no se imprime.
      i++
      continue
    }

    if (texto.startsWith('**', i) || texto.startsWith('__', i)) {
      const marcador = texto.slice(i, i + 2)
      const fin = buscarCierre(texto, i + 2, marcador)
      if (fin > i + 2) {
        volcar()
        nodos.push({ tipo: 'negrita', hijos: parsearEnLinea(texto.slice(i + 2, fin)) })
        i = fin + 2
        continue
      }
      // Sin cierre (o vacío, `****`): el marcador se descarta.
      i += fin === i + 2 ? 4 : 2
      continue
    }

    if (c === '*' || c === '_') {
      const antes = texto[i - 1] ?? ' '
      const despues = texto[i + 1] ?? ' '
      // `snake_case` y `2_000` no son cursiva; `2 * 3` tampoco.
      const puedeAbrir =
        !/\s/.test(despues) && (c === '*' || !ES_LETRA_O_NUMERO.test(antes))
      if (puedeAbrir) {
        const fin = buscarCierre(texto, i + 1, c)
        const cierraBien =
          fin > i + 1 &&
          !/\s/.test(texto[fin - 1]) &&
          (c === '*' || !ES_LETRA_O_NUMERO.test(texto[fin + 1] ?? ' ')) &&
          !texto.slice(i + 1, fin).includes('\n\n')
        if (cierraBien) {
          volcar()
          nodos.push({ tipo: 'cursiva', hijos: parsearEnLinea(texto.slice(i + 1, fin)) })
          i = fin + 1
          continue
        }
      }
    }

    pendiente += c
    i++
  }
  volcar()
  return nodos
}

// ── Bloques ─────────────────────────────────────────────────────────────────

const ENCABEZADO = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/
const SEPARADOR = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/
const ITEM = /^(\s*)(?:([-*+•])|(\d{1,3})[.)])\s+(.*)$/
const CERCA = /^ {0,3}```/
const CITA = /^ {0,3}>\s?(.*)$/

interface LineaDeLista {
  sangria: number
  ordenada: boolean
  numero: number
  texto: string
}

function armarLista(lineas: LineaDeLista[], desde: number, sangria: number): [BloqueLista, number] {
  const primera = lineas[desde]
  const lista: BloqueLista = {
    tipo: 'lista',
    ordenada: primera.ordenada,
    inicio: primera.ordenada ? primera.numero : 1,
    items: [],
  }
  let i = desde
  while (i < lineas.length) {
    const linea = lineas[i]
    if (linea.sangria < sangria) break
    if (linea.sangria >= sangria + 2 && lista.items.length > 0) {
      const [sublista, siguiente] = armarLista(lineas, i, linea.sangria)
      lista.items[lista.items.length - 1].sublistas.push(sublista)
      i = siguiente
      continue
    }
    // Mismo nivel pero cambia de viñeta a número (o al revés): otra lista.
    if (linea.ordenada !== lista.ordenada) break
    lista.items.push({ contenido: parsearEnLinea(linea.texto), sublistas: [] })
    i++
  }
  return [lista, i]
}

export function parsearMarkdown(fuente: string): Bloque[] {
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n')
  const bloques: Bloque[] = []
  let i = 0

  const empiezaBloque = (linea: string) =>
    ENCABEZADO.test(linea) ||
    SEPARADOR.test(linea) ||
    ITEM.test(linea) ||
    CERCA.test(linea) ||
    CITA.test(linea) ||
    linea.trimStart().startsWith('$$')

  while (i < lineas.length) {
    const linea = lineas[i]

    if (linea.trim() === '') {
      i++
      continue
    }

    if (CERCA.test(linea)) {
      const cuerpo: string[] = []
      i++
      while (i < lineas.length && !CERCA.test(lineas[i])) cuerpo.push(lineas[i++])
      i++ // la cerca de cierre, si llegó
      bloques.push({ tipo: 'codigo', texto: cuerpo.join('\n') })
      continue
    }

    // Fórmula en bloque de varias líneas: se aparta entera para que un
    // renglón suyo que empiece con "-" no se lea como ítem de lista.
    const recortada = linea.trim()
    if (recortada.startsWith('$$') && recortada.indexOf('$$', 2) === -1) {
      const cuerpo = [linea]
      i++
      let cerro = false
      while (i < lineas.length) {
        cuerpo.push(lineas[i])
        if (lineas[i++].includes('$$')) {
          cerro = true
          break
        }
      }
      // A medio escribir todavía no cerró: no se muestra LaTeX crudo.
      if (cerro) bloques.push({ tipo: 'formula', crudo: cuerpo.join('\n').trim() })
      continue
    }

    if (SEPARADOR.test(linea)) {
      bloques.push({ tipo: 'separador' })
      i++
      continue
    }

    const encabezado = ENCABEZADO.exec(linea)
    if (encabezado) {
      const titulo = (encabezado[2] ?? '').trim()
      // "##" pelado: un encabezado que todavía no tiene texto.
      if (titulo) {
        bloques.push({
          tipo: 'encabezado',
          nivel: Math.min(encabezado[1].length, 4) as 1 | 2 | 3 | 4,
          contenido: parsearEnLinea(titulo),
        })
      }
      i++
      continue
    }

    if (ITEM.test(linea)) {
      const deLista: LineaDeLista[] = []
      while (i < lineas.length) {
        const actual = lineas[i]
        const item = ITEM.exec(actual)
        if (item) {
          deLista.push({
            sangria: item[1].replace(/\t/g, '  ').length,
            ordenada: item[3] !== undefined,
            numero: item[3] !== undefined ? Number(item[3]) : 1,
            texto: item[4],
          })
          i++
          continue
        }
        // Renglón de continuación de un ítem: viene con sangría.
        if (actual.trim() !== '' && /^\s+/.test(actual) && !empiezaBloque(actual)) {
          deLista[deLista.length - 1].texto += '\n' + actual.trim()
          i++
          continue
        }
        // Una línea en blanco entre ítems no corta la lista.
        if (actual.trim() === '' && i + 1 < lineas.length && ITEM.test(lineas[i + 1])) {
          i++
          continue
        }
        break
      }
      let j = 0
      while (j < deLista.length) {
        const [lista, siguiente] = armarLista(deLista, j, deLista[j].sangria)
        bloques.push(lista)
        j = siguiente
      }
      continue
    }

    if (CITA.test(linea)) {
      const cuerpo: string[] = []
      while (i < lineas.length && CITA.test(lineas[i])) {
        cuerpo.push(CITA.exec(lineas[i++])![1])
      }
      bloques.push({ tipo: 'cita', contenido: parsearEnLinea(cuerpo.join('\n')) })
      continue
    }

    const parrafo: string[] = [linea.trim()]
    i++
    while (i < lineas.length && lineas[i].trim() !== '' && !empiezaBloque(lineas[i])) {
      parrafo.push(lineas[i++].trim())
    }
    // Los saltos simples se conservan: el modelo los usa para separar pasos.
    bloques.push({ tipo: 'parrafo', contenido: parsearEnLinea(parrafo.join('\n')) })
  }

  return bloques
}

/** El texto que queda a la vista, sin fórmulas. Para tests y para resúmenes. */
export function textoVisible(bloques: Bloque[]): string {
  const deNodos = (nodos: NodoEnLinea[]): string =>
    nodos
      .map((n) =>
        n.tipo === 'texto' || n.tipo === 'codigo'
          ? n.texto
          : n.tipo === 'formula'
            ? ''
            : deNodos(n.hijos),
      )
      .join('')
  const deLista = (lista: BloqueLista): string =>
    lista.items.map((it) => deNodos(it.contenido) + '\n' + it.sublistas.map(deLista).join('')).join('')
  return bloques
    .map((b) => {
      switch (b.tipo) {
        case 'encabezado':
        case 'parrafo':
        case 'cita':
          return deNodos(b.contenido)
        case 'lista':
          return deLista(b)
        case 'codigo':
          return b.texto
        default:
          return ''
      }
    })
    .join('\n')
}
