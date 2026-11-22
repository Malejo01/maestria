/**
 * O2 · Cerrar el ciclo de "A reforzar".
 *
 * `student_misconceptions.resolved` no lo ponía en TRUE ningún camino de
 * código (lección del roadmap: la columna que describe un final sin escritor).
 * Mauro decidió (22/11): un tema sale con **3 aciertos seguidos en ese tema
 * del programa**, en intentos posteriores al error; el docente además lo puede
 * marcar como superado a mano.
 *
 * El problema era la clave: el `topic_name` de cada respuesta lo escribe la IA
 * por pregunta (358 valores distintos en 1.680 respuestas de producción). Lo
 * estable es `quiz_attempts.topics[]`, los temas del programa que se eligieron
 * para ese intento (salen de `teacher_programs` / `curriculum`). El puente es
 * puro y conservador: una respuesta se ubica en un tema del programa sólo con
 * certeza, y si no, NO CUENTA (ni suma ni corta la racha).
 */

/** Minúsculas, sin tildes, sin signos: "Números Reales: concepto." → "numeros reales concepto". */
export function normalizarTema(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Una contención sólo vale si el texto más corto dice algo: 2 palabras y 8 letras. */
function contieneConSentido(largo: string, corto: string): boolean {
  if (corto.length < 8 || corto.split(' ').length < 2) return false
  return ` ${largo} `.includes(` ${corto} `)
}

/**
 * El tema del programa (tal como figura en `candidatos`) que corresponde a
 * `nombre`, o null si no hay certeza:
 *   1. igual, normalizado;
 *   2. uno contiene al otro (palabras enteras), y hay UN solo candidato así.
 */
export function temaDelPrograma(nombre: string | null | undefined, candidatos: readonly string[]): string | null {
  const n = normalizarTema(nombre)
  if (!n) return null
  const unicos = [...new Set(candidatos.filter((c) => normalizarTema(c)))]
  const exacto = unicos.find((c) => normalizarTema(c) === n)
  if (exacto) return exacto
  const contenidos = unicos.filter((c) => {
    const nc = normalizarTema(c)
    return contieneConSentido(nc, n) || contieneConSentido(n, nc)
  })
  return contenidos.length === 1 ? contenidos[0] : null
}

/**
 * Una respuesta, ubicada en un tema del programa: primero por su `topic_name`
 * contra los temas del intento; si no se puede y el intento tenía UN solo
 * tema, ése (todo el intento era sobre él). Si no, null: no cuenta.
 */
export function ubicarRespuesta(topicNameDeLaRespuesta: string | null | undefined, temasDelIntento: readonly string[]): string | null {
  const porNombre = temaDelPrograma(topicNameDeLaRespuesta, temasDelIntento)
  if (porNombre) return porNombre
  const temas = [...new Set(temasDelIntento.filter((t) => normalizarTema(t)))]
  return temas.length === 1 ? temas[0] : null
}

/** La clave estable de un tema: la materia y el tema del programa, normalizados. */
export const claveDeTema = (materia: string, tema: string) => `${normalizarTema(materia)}|${normalizarTema(tema)}`

export const ACIERTOS_PARA_SUPERAR = 3

export interface TemaAReforzar {
  id: number
  materia: string
  /** `topic_name` de la misconception. */
  tema: string
  /** Cuándo se registró el error (ISO). */
  desde: string
}

export interface RespuestaParaRacha {
  materia: string
  /** `quiz_attempts.topics`. */
  temasDelIntento: readonly string[]
  topicName: string | null
  /** null: sin corregir (respuesta corta pendiente): no cuenta. */
  correcta: boolean | null
  /**
   * Cuándo EMPEZÓ el intento (ISO). Es lo que decide si es posterior al error:
   * el error se registra en medio de un intento que termina después, y ese
   * intento no cuenta.
   */
  empezadoEl: string
  /** Cuándo se terminó (ISO): el orden de las respuestas. */
  terminadoEl: string
  /** Orden dentro del intento. */
  indice: number
}

/**
 * Los ids de los temas "a reforzar" que ya se superaron: hay 3 aciertos
 * seguidos en ese tema del programa, en intentos terminados DESPUÉS del error.
 * Un error en ese tema corta la racha; las respuestas de otros temas, o que no
 * se pudieron ubicar, no la cortan ni la suman.
 *
 * El tema de la misconception se ubica contra todos los temas del programa que
 * aparecen en los intentos de esa materia; si no se ubica con certeza, no se
 * resuelve solo (queda para el docente).
 */
export function temasSuperados(pendientes: readonly TemaAReforzar[], respuestas: readonly RespuestaParaRacha[]): number[] {
  const ordenadas = [...respuestas].sort((a, b) => a.terminadoEl.localeCompare(b.terminadoEl) || a.indice - b.indice)
  const temasPorMateria = new Map<string, Set<string>>()
  for (const r of ordenadas) {
    const m = normalizarTema(r.materia)
    const set = temasPorMateria.get(m) ?? new Set<string>()
    r.temasDelIntento.forEach((t) => set.add(t))
    temasPorMateria.set(m, set)
  }

  const superados: number[] = []
  for (const p of pendientes) {
    const materia = normalizarTema(p.materia)
    const tema = temaDelPrograma(p.tema, [...(temasPorMateria.get(materia) ?? [])])
    if (!tema) continue
    const clave = claveDeTema(p.materia, tema)
    let racha = 0
    for (const r of ordenadas) {
      if (r.empezadoEl <= p.desde || normalizarTema(r.materia) !== materia || r.correcta === null) continue
      const ubicado = ubicarRespuesta(r.topicName, r.temasDelIntento)
      if (!ubicado || claveDeTema(r.materia, ubicado) !== clave) continue
      racha = r.correcta ? racha + 1 : 0
      if (racha >= ACIERTOS_PARA_SUPERAR) {
        superados.push(p.id)
        break
      }
    }
  }
  return superados
}

/** Un tema superado, para "Ya lo dominás" de /history. */
export interface TemaDominado {
  materia: string
  tema: string
  /** Cuándo se superó (ISO), si se sabe (sin la 031, no). */
  superadoEl: string | null
}

/**
 * Los puntos débiles que guarda el navegador (`weakPoints`) no se enteran de
 * que un tema se superó en el servidor: se sacan de "A reforzar" los que
 * coinciden con un tema dominado de la misma materia. Un tema que volvió a
 * fallarse después (sigue pendiente en el servidor) no figura como dominado.
 */
export function separarDominados<T extends { subject: string; topicName: string }>(
  debiles: readonly T[],
  dominados: readonly TemaDominado[],
): { pendientes: T[]; dominados: TemaDominado[] } {
  const pendientes = debiles.filter(
    (d) =>
      !dominados.some(
        (t) => normalizarTema(t.materia) === normalizarTema(d.subject) && temaDelPrograma(d.topicName, [t.tema]) !== null,
      ),
  )
  return { pendientes, dominados: [...dominados] }
}

/**
 * O14 · Anclar el tema de cada pregunta generada a uno de los temas pedidos.
 * El prompt pide copiar el nombre textual, pero el modelo lo reformula
 * ("Cuerpos geométricos" por "Cuerpos geométricos: características…") e
 * inventa el `topic`. Con el mismo puente que "A reforzar": si el nombre se
 * ubica con certeza entre los pedidos (o se pidió uno solo), la pregunta queda
 * con el id y el nombre del tema pedido; si no, como vino. Así "A reforzar" y
 * el reporte de temas leen la clave del programa y no la de la IA.
 */
/**
 * El modelo suele acortar el nombre del tema ("Cuerpos" por "Cuerpos:
 * Elementos y clasificación…", "Números Reales: Operaciones"). Vale si TODAS
 * las palabras con contenido (4 letras o más) del nombre están en UNO SOLO de
 * los temas pedidos. Sólo para anclar lo generado: el modelo tenía que elegir
 * entre esos temas, así que no es el puente estricto de "A reforzar".
 */
function pedidoPorPalabras<P extends { name: string }>(nombre: string, pedidos: readonly P[]): P | undefined {
  const palabras = normalizarTema(nombre).split(' ').filter((p) => p.length >= 4)
  if (palabras.length === 0) return undefined
  const candidatos = pedidos.filter((t) => {
    const delPedido = new Set(normalizarTema(t.name).split(' '))
    return palabras.every((p) => delPedido.has(p))
  })
  return candidatos.length === 1 ? candidatos[0] : undefined
}

export function anclarTema<T extends { topic?: string; topicName?: string }>(pregunta: T, pedidos: readonly { id: string; name: string }[]): T {
  if (pedidos.length === 0) return pregunta
  const porId = pedidos.find((t) => t.id === pregunta.topic)
  if (porId) return { ...pregunta, topic: porId.id, topicName: porId.name }
  const nombre = pregunta.topicName ? temaDelPrograma(pregunta.topicName, pedidos.map((t) => t.name)) : null
  const porPalabras = !nombre && pregunta.topicName ? pedidoPorPalabras(pregunta.topicName, pedidos) : undefined
  const elegido = nombre ? pedidos.find((t) => t.name === nombre) : (porPalabras ?? (pedidos.length === 1 ? pedidos[0] : undefined))
  return elegido ? { ...pregunta, topic: elegido.id, topicName: elegido.name } : pregunta
}
