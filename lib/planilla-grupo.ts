import { NOTA_DE_APROBACION } from './answer-grading'

/**
 * M4 · La planilla de un grupo, ordenable y filtrable.
 *
 * Reporte de Mauro (21/11): con 25 alumnos, la planilla de resultados se
 * necesita ordenar por nombre, por nota, por promedio. Todo lo que decide qué
 * filas se ven y en qué orden está acá, puro: la tabla sólo lo dibuja, el CSV
 * descarga exactamente lo mismo, y la URL guarda el estado
 * (`?orden=promedio&dir=desc&filtro=debajo`).
 */

/** Lo que una fila tiene que tener para ordenarse y filtrarse. */
export interface FilaDePlanilla {
  nombre: string
  resueltos: number
  promedio: number | null
  mejor: number | null
  /** ISO, o `null` si nunca hizo nada. */
  ultimaActividad: string | null
  temasFlojos: number
}

export const COLUMNAS = ['alumno', 'resueltos', 'promedio', 'mejor', 'actividad', 'temas'] as const
export type Columna = (typeof COLUMNAS)[number]
export type Direccion = 'asc' | 'desc'

export const FILTROS = ['todos', 'nada', 'debajo', 'flojos'] as const
export type Filtro = (typeof FILTROS)[number]

export interface EstadoDePlanilla {
  orden: Columna
  dir: Direccion
  filtro: Filtro
  busqueda: string
}

export const ESTADO_INICIAL: EstadoDePlanilla = { orden: 'alumno', dir: 'asc', filtro: 'todos', busqueda: '' }

/** Sin tildes ni mayúsculas: "Zolorza" y "zolorza", "Pérez" y "perez" son lo mismo. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cómo se ordena un nombre. "Apellido, Nombre" se separa por la coma; con dos
 * palabras o más, el apellido es la última ("Bruno Quiroga" → "quiroga
 * bruno"); con una sola, el nombre entero. Es una suposición: quien escribió
 * "ayarde sofia" queda ordenado por "sofia". No hay forma de saberlo desde el
 * texto, y un orden por el nombre completo sería peor para la mayoría.
 */
export function claveDeNombre(nombre: string): string {
  const limpio = normalizarTexto(nombre)
  const coma = limpio.indexOf(',')
  if (coma > 0) return `${limpio.slice(0, coma).trim()} ${limpio.slice(coma + 1).trim()}`.trim()
  const palabras = limpio.split(' ').filter(Boolean)
  if (palabras.length < 2) return limpio
  return [palabras[palabras.length - 1], ...palabras.slice(0, -1)].join(' ')
}

const comparadorDeTexto = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

function valorDe(fila: FilaDePlanilla, columna: Columna): number | string | null {
  switch (columna) {
    case 'alumno':
      return claveDeNombre(fila.nombre)
    case 'resueltos':
      return fila.resueltos
    case 'promedio':
      return fila.promedio
    case 'mejor':
      return fila.mejor
    case 'actividad':
      return fila.ultimaActividad ? Date.parse(fila.ultimaActividad) : null
    case 'temas':
      return fila.temasFlojos
  }
}

/**
 * Ordena por la columna. Los vacíos (sin promedio, sin actividad) van SIEMPRE
 * al final, en los dos sentidos: un alumno que no hizo nada no es "el peor" ni
 * "el mejor", y si quedaba arriba al ordenar de menor a mayor tapaba a los que
 * sí necesitan ayuda. Los empates se desempatan por nombre (A→Z).
 */
export function ordenar<T extends FilaDePlanilla>(filas: T[], orden: Columna, dir: Direccion): T[] {
  const signo = dir === 'asc' ? 1 : -1
  return [...filas].sort((a, b) => {
    const va = valorDe(a, orden)
    const vb = valorDe(b, orden)
    const vacioA = va === null || (typeof va === 'number' && !Number.isFinite(va))
    const vacioB = vb === null || (typeof vb === 'number' && !Number.isFinite(vb))
    if (vacioA !== vacioB) return vacioA ? 1 : -1
    if (!vacioA && !vacioB) {
      const diferencia =
        typeof va === 'string' && typeof vb === 'string' ? comparadorDeTexto.compare(va, vb) : (va as number) - (vb as number)
      if (diferencia !== 0) return signo * diferencia
    }
    return comparadorDeTexto.compare(claveDeNombre(a.nombre), claveDeNombre(b.nombre))
  })
}

/** ¿La fila pasa el filtro rápido? */
export function pasaElFiltro(fila: FilaDePlanilla, filtro: Filtro): boolean {
  switch (filtro) {
    case 'todos':
      return true
    case 'nada':
      return fila.resueltos === 0
    case 'debajo':
      return fila.promedio !== null && fila.promedio < NOTA_DE_APROBACION
    case 'flojos':
      return fila.temasFlojos > 0
  }
}

/** ¿El nombre coincide con lo que se busca? (sin tildes ni mayúsculas, por partes) */
export function coincideLaBusqueda(fila: FilaDePlanilla, busqueda: string): boolean {
  const buscado = normalizarTexto(busqueda)
  if (!buscado) return true
  const nombre = normalizarTexto(fila.nombre)
  return buscado.split(' ').every((parte) => nombre.includes(parte))
}

/** Lo que se ve, en el orden en que se ve. El CSV usa esto mismo. */
export function filasVisibles<T extends FilaDePlanilla>(filas: T[], estado: EstadoDePlanilla): T[] {
  return ordenar(
    filas.filter((f) => pasaElFiltro(f, estado.filtro) && coincideLaBusqueda(f, estado.busqueda)),
    estado.orden,
    estado.dir,
  )
}

/** Cuántas filas tiene cada filtro rápido (para el número del chip). */
export function cuantasPorFiltro(filas: FilaDePlanilla[]): Record<Filtro, number> {
  return {
    todos: filas.length,
    nada: filas.filter((f) => pasaElFiltro(f, 'nada')).length,
    debajo: filas.filter((f) => pasaElFiltro(f, 'debajo')).length,
    flojos: filas.filter((f) => pasaElFiltro(f, 'flojos')).length,
  }
}

/** El sentido con que arranca cada columna al tocarla: los nombres A→Z; los números, de mayor a menor. */
export function direccionInicial(columna: Columna): Direccion {
  return columna === 'alumno' ? 'asc' : 'desc'
}

/** Tocar un encabezado: la misma columna invierte; otra, arranca en su sentido. */
export function tocarEncabezado(estado: EstadoDePlanilla, columna: Columna): EstadoDePlanilla {
  if (estado.orden === columna) return { ...estado, dir: estado.dir === 'asc' ? 'desc' : 'asc' }
  return { ...estado, orden: columna, dir: direccionInicial(columna) }
}

/** Para `aria-sort` en el `th`. */
export function ariaSort(estado: EstadoDePlanilla, columna: Columna): 'ascending' | 'descending' | 'none' {
  if (estado.orden !== columna) return 'none'
  return estado.dir === 'asc' ? 'ascending' : 'descending'
}

type Consulta = { get(nombre: string): string | null }

/** El estado desde la URL; lo que no se entiende cae en el valor por defecto. */
export function estadoDesdeLaUrl(consulta: Consulta, prefijo = ''): EstadoDePlanilla {
  const orden = consulta.get(`${prefijo}orden`)
  const dir = consulta.get(`${prefijo}dir`)
  const filtro = consulta.get(`${prefijo}filtro`)
  const ordenValido = COLUMNAS.includes(orden as Columna) ? (orden as Columna) : ESTADO_INICIAL.orden
  return {
    orden: ordenValido,
    dir: dir === 'asc' || dir === 'desc' ? dir : direccionInicial(ordenValido),
    filtro: FILTROS.includes(filtro as Filtro) ? (filtro as Filtro) : ESTADO_INICIAL.filtro,
    busqueda: consulta.get(`${prefijo}buscar`) ?? '',
  }
}

/**
 * El estado a la URL, sobre la consulta que ya había (la pestaña del grupo,
 * por ejemplo). Lo que está en su valor por defecto no se escribe.
 */
export function estadoALaUrl(estado: EstadoDePlanilla, base: URLSearchParams, prefijo = ''): URLSearchParams {
  const params = new URLSearchParams(base)
  const poner = (clave: string, valor: string, porDefecto: string) => {
    if (valor && valor !== porDefecto) params.set(`${prefijo}${clave}`, valor)
    else params.delete(`${prefijo}${clave}`)
  }
  poner('orden', estado.orden, ESTADO_INICIAL.orden)
  poner('dir', estado.dir, direccionInicial(estado.orden))
  poner('filtro', estado.filtro, ESTADO_INICIAL.filtro)
  poner('buscar', estado.busqueda.trim(), '')
  return params
}
