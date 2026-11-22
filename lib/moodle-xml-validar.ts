/**
 * Ronda T · F1 — Validar un archivo Moodle XML antes de bajarlo (puro, sin
 * DOM: corre en el navegador y en los tests de Node).
 *
 * Dos pasos:
 *  1. que sea XML bien formado (etiquetas que cierran, entidades conocidas,
 *     CDATA y comentarios cerrados);
 *  2. que Moodle lo importe: cada `<question>` con un tipo que Moodle conoce y
 *     lo que ese tipo exige (las fracciones que acepta, al menos una correcta,
 *     verdadero y falso, el número de la numérica, los huecos del
 *     seleccionar/arrastrar, los pares del emparejamiento, los ítems del
 *     ordenamiento, los comodines de la calculada).
 *
 * Devuelve la lista de problemas en palabras; vacía = se puede importar.
 */

export interface NodoXml {
  nombre: string
  atributos: Record<string, string>
  hijos: NodoXml[]
  texto: string
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodificar(texto: string, problemas: string[]): string {
  const suelto = texto.match(/&(?!(?:#x[0-9a-f]+|#\d+|[a-z]+);)/i)
  if (suelto) problemas.push(`Hay un "&" suelto: "${texto.slice(suelto.index, (suelto.index ?? 0) + 8)}" (va como &amp;).`)
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (todo, ent: string) => {
    if (!todo.endsWith(';')) {
      problemas.push(`Hay un "&" suelto: "${todo}" (va como &amp;).`)
      return todo
    }
    if (ent.startsWith('#x')) return String.fromCodePoint(parseInt(ent.slice(2), 16))
    if (ent.startsWith('#')) return String.fromCodePoint(parseInt(ent.slice(1), 10))
    if (ent in ENTIDADES) return ENTIDADES[ent]
    problemas.push(`Entidad desconocida: &${ent};`)
    return todo
  })
}

/** El árbol del XML, o los problemas de forma. */
export function leerXml(xml: string): { raiz: NodoXml | null; problemas: string[] } {
  const problemas: string[] = []
  const pila: NodoXml[] = [{ nombre: '#documento', atributos: {}, hijos: [], texto: '' }]
  let i = 0
  const n = xml.length
  while (i < n && problemas.length < 20) {
    const lt = xml.indexOf('<', i)
    const tope = pila[pila.length - 1]
    if (lt === -1) {
      tope.texto += decodificar(xml.slice(i), problemas)
      break
    }
    if (lt > i) tope.texto += decodificar(xml.slice(i, lt), problemas)
    if (xml.startsWith('<![CDATA[', lt)) {
      const fin = xml.indexOf(']]>', lt + 9)
      if (fin === -1) {
        problemas.push('Un CDATA no se cierra.')
        break
      }
      tope.texto += xml.slice(lt + 9, fin)
      i = fin + 3
    } else if (xml.startsWith('<!--', lt)) {
      const fin = xml.indexOf('-->', lt + 4)
      if (fin === -1) {
        problemas.push('Un comentario no se cierra.')
        break
      }
      i = fin + 3
    } else if (xml.startsWith('<?', lt)) {
      const fin = xml.indexOf('?>', lt + 2)
      if (fin === -1) {
        problemas.push('La declaración <?xml … ?> no se cierra.')
        break
      }
      i = fin + 2
    } else if (xml.startsWith('</', lt)) {
      const fin = xml.indexOf('>', lt)
      const nombre = xml.slice(lt + 2, fin).trim()
      const abierto = pila.pop()
      if (!abierto || abierto.nombre !== nombre) {
        problemas.push(`Se cierra </${nombre}> pero estaba abierta <${abierto?.nombre ?? '—'}>.`)
        break
      }
      i = fin + 1
    } else {
      const fin = xml.indexOf('>', lt)
      if (fin === -1) {
        problemas.push('Una etiqueta no se cierra.')
        break
      }
      let crudo = xml.slice(lt + 1, fin)
      const sola = crudo.endsWith('/')
      if (sola) crudo = crudo.slice(0, -1)
      const nombre = crudo.match(/^[A-Za-z_][\w.-]*/)?.[0]
      if (!nombre) {
        problemas.push(`Etiqueta inválida: <${crudo.slice(0, 30)}>`)
        break
      }
      const atributos: Record<string, string> = {}
      const resto = crudo.slice(nombre.length)
      for (const m of resto.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g)) atributos[m[1]] = decodificar(m[2], problemas)
      if (resto.replace(/([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g, '').trim()) problemas.push(`Atributos mal escritos en <${nombre}>.`)
      const nodo: NodoXml = { nombre, atributos, hijos: [], texto: '' }
      pila[pila.length - 1].hijos.push(nodo)
      if (!sola) pila.push(nodo)
      i = fin + 1
    }
  }
  if (problemas.length === 0 && pila.length > 1) problemas.push(`Quedó abierta <${pila[pila.length - 1].nombre}>.`)
  const documento = pila[0]
  const raices = documento.hijos
  if (problemas.length === 0 && raices.length !== 1) problemas.push('El archivo tiene que tener un solo elemento raíz.')
  return { raiz: problemas.length === 0 ? raices[0] : null, problemas }
}

const hijo = (nodo: NodoXml | undefined, nombre: string) => nodo?.hijos.find((h) => h.nombre === nombre)
const hijos = (nodo: NodoXml | undefined, nombre: string) => nodo?.hijos.filter((h) => h.nombre === nombre) ?? []
const textoDe = (nodo: NodoXml | undefined) => (hijo(nodo, 'text')?.texto ?? '').trim()
const sinHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

/** Las fracciones que Moodle acepta en una respuesta (y sus negativas). */
export const FRACCIONES_DE_MOODLE = [100, 90, 83.33333, 80, 75, 70, 66.66667, 60, 50, 40, 33.33333, 30, 25, 20, 16.66667, 14.28571, 12.5, 11.11111, 10, 5, 0]

export function fraccionValida(valor: number): boolean {
  return FRACCIONES_DE_MOODLE.some((f) => Math.abs(Math.abs(valor) - f) < 0.001)
}

export const TIPOS_DE_MOODLE = [
  'category',
  'multichoice',
  'truefalse',
  'numerical',
  'shortanswer',
  'matching',
  'ordering',
  'gapselect',
  'ddwtos',
  'calculated',
  'calculatedsimple',
  'description',
  'essay',
] as const

function validarPregunta(q: NodoXml, n: number, problemas: string[]): void {
  const tipo = q.atributos.type
  const p = (texto: string) => problemas.push(`Pregunta ${n}: ${texto}`)
  if (!tipo || !(TIPOS_DE_MOODLE as readonly string[]).includes(tipo)) {
    p(`tipo desconocido para Moodle: "${tipo ?? ''}".`)
    return
  }
  if (tipo === 'category') {
    const ruta = textoDe(hijo(q, 'category'))
    if (!ruta) p('la categoría está vacía.')
    for (const tramo of ruta.split('/')) if (tramo.length > 255) p('un tramo de la categoría pasa de 255 caracteres.')
    return
  }
  if (!textoDe(hijo(q, 'name'))) p('no tiene nombre.')
  const enunciado = hijo(q, 'questiontext')
  if (!enunciado || !enunciado.atributos.format) p('no tiene enunciado (questiontext con format).')
  else if (!sinHtml(textoDe(enunciado))) p('el enunciado está vacío.')
  const nota = hijo(q, 'defaultgrade')
  if (nota && !Number.isFinite(Number(nota.texto))) p('el puntaje no es un número.')

  const respuestas = hijos(q, 'answer')
  const fracciones = respuestas.map((r) => Number(r.atributos.fraction))
  const conFraccionesValidas = () => {
    fracciones.forEach((f, i) => {
      if (!Number.isFinite(f) || !fraccionValida(f)) p(`la respuesta ${i + 1} tiene una fracción que Moodle no acepta (${respuestas[i].atributos.fraction}).`)
    })
  }
  const enunciadoTexto = textoDe(enunciado)

  switch (tipo) {
    case 'multichoice': {
      if (respuestas.length < 2) p('una opción múltiple necesita al menos dos opciones.')
      conFraccionesValidas()
      respuestas.forEach((r, i) => !sinHtml(textoDe(r)) && p(`la opción ${i + 1} está vacía.`))
      const single = (hijo(q, 'single')?.texto ?? 'true').trim() !== 'false'
      if (single) {
        if (!fracciones.some((f) => Math.abs(f - 100) < 0.001)) p('ninguna opción vale 100 %.')
      } else {
        const suma = fracciones.filter((f) => f > 0).reduce((s, f) => s + f, 0)
        if (Math.abs(suma - 100) > 0.1) p(`con varias correctas, las fracciones positivas tienen que sumar 100 (suman ${Math.round(suma * 100) / 100}).`)
      }
      break
    }
    case 'truefalse': {
      const textos = respuestas.map((r) => textoDe(r).toLowerCase()).sort()
      if (textos.join(',') !== 'false,true') p('verdadero o falso necesita exactamente las respuestas "true" y "false".')
      if (fracciones.filter((f) => f === 100).length !== 1) p('verdadero o falso necesita exactamente una respuesta con 100.')
      break
    }
    case 'numerical': {
      if (respuestas.length === 0) p('la numérica no tiene respuesta.')
      conFraccionesValidas()
      respuestas.forEach((r, i) => {
        const t = textoDe(r)
        if (t !== '*' && !Number.isFinite(Number(t))) p(`la respuesta ${i + 1} no es un número con punto decimal ("${t}").`)
        const tol = hijo(r, 'tolerance')
        if (tol && !Number.isFinite(Number(tol.texto))) p(`la tolerancia de la respuesta ${i + 1} no es un número.`)
      })
      if (!fracciones.some((f) => f === 100)) p('ninguna respuesta vale 100 %.')
      break
    }
    case 'shortanswer': {
      if (respuestas.length === 0) p('la respuesta corta no tiene respuestas.')
      conFraccionesValidas()
      respuestas.forEach((r, i) => !textoDe(r) && p(`la respuesta ${i + 1} está vacía.`))
      if (!fracciones.some((f) => f === 100)) p('ninguna respuesta vale 100 %.')
      break
    }
    case 'matching': {
      const pares = hijos(q, 'subquestion')
      const conPregunta = pares.filter((s) => sinHtml(textoDe(s)))
      if (conPregunta.length < 2) p('el emparejamiento necesita al menos dos pares.')
      if (pares.length < 3) p('el emparejamiento necesita al menos tres respuestas (pares o distractores).')
      pares.forEach((s, i) => !textoDe(hijo(s, 'answer')) && p(`el par ${i + 1} no tiene respuesta.`))
      break
    }
    case 'ordering': {
      if (respuestas.length < 2) p('el ordenamiento necesita al menos dos elementos.')
      respuestas.forEach((r, i) => !sinHtml(textoDe(r)) && p(`el elemento ${i + 1} está vacío.`))
      break
    }
    case 'gapselect':
    case 'ddwtos': {
      const opciones = hijos(q, tipo === 'gapselect' ? 'selectoption' : 'dragbox')
      const huecos = [...enunciadoTexto.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]))
      if (huecos.length === 0) p('el texto no tiene huecos [[1]], [[2]]….')
      if (opciones.length < huecos.length) p('hay más huecos que opciones.')
      for (const h of huecos) if (h < 1 || h > opciones.length) p(`el hueco [[${h}]] no tiene su opción.`)
      opciones.forEach((o, i) => {
        if (!textoDe(o)) p(`la opción ${i + 1} está vacía.`)
        const grupo = Number(hijo(o, 'group')?.texto ?? 1)
        if (!Number.isInteger(grupo) || grupo < 1 || grupo > 20) p(`la opción ${i + 1} tiene un grupo inválido.`)
      })
      break
    }
    case 'calculated':
    case 'calculatedsimple': {
      if (respuestas.length === 0) p('la calculada no tiene fórmula.')
      const comodines = new Set([...enunciadoTexto.matchAll(/\{([a-z][a-z0-9_]*)\}/gi)].map((m) => m[1]))
      const definiciones = hijos(hijo(q, 'dataset_definitions'), 'dataset_definition')
      const definidos = new Set(definiciones.map((d) => textoDe(hijo(d, 'name'))))
      for (const c of comodines) if (!definidos.has(c)) p(`el comodín {${c}} no tiene su conjunto de datos.`)
      for (const r of respuestas) {
        for (const m of textoDe(r).matchAll(/\{([a-z][a-z0-9_]*)\}/gi)) if (!definidos.has(m[1])) p(`la fórmula usa {${m[1]}} sin definirlo.`)
      }
      definiciones.forEach((d) => {
        const items = hijos(hijo(d, 'dataset_items'), 'dataset_item')
        if (items.length === 0) p(`el comodín {${textoDe(hijo(d, 'name'))}} no tiene valores.`)
      })
      break
    }
  }
}

/** Valida el archivo entero. Vacío = Moodle lo importa. */
export function validarMoodleXml(xml: string): string[] {
  const { raiz, problemas } = leerXml(xml)
  if (!raiz) return problemas
  if (raiz.nombre !== 'quiz') return ['El elemento raíz tiene que ser <quiz>.']
  const preguntas = raiz.hijos.filter((h) => h.nombre === 'question')
  if (preguntas.filter((q) => q.atributos.type !== 'category').length === 0) return ['El archivo no tiene preguntas.']
  const salida: string[] = []
  let numero = 0
  for (const q of preguntas) {
    if (q.atributos.type !== 'category') numero++
    validarPregunta(q, numero, salida)
  }
  return salida
}
