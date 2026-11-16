/**
 * Las reglas del wizard de temario que no dependen de React: en qué orden van
 * los pasos según cómo se arma el temario, y cómo se interpreta lo que la IA
 * leyó del archivo.
 */
import type { Nivel } from '@/lib/nivel-options'

/** Los cuatro pasos, identificados por su contenido y no por su posición. */
export const PASO = { nivel: 1, materia: 2, temario: 3, ajustes: 4 } as const
export type PasoId = (typeof PASO)[keyof typeof PASO]

export type CaminoTemario = 'import' | 'curriculum' | 'manual'

/**
 * El orden de los pasos.
 *
 * Con el plan oficial, el nivel y el año van PRIMERO: hacen falta para saber
 * qué temario oficial mostrar.
 *
 * Subiendo un archivo o escribiéndolo a mano, van DESPUÉS del temario. Quien
 * eligió "subir mi archivo" quiere subir su archivo, no llenar un formulario
 * de nivel y año antes; y si subió un PDF, el nivel se puede leer de ahí y el
 * docente sólo lo confirma. Van antes de "Cómo das la materia" porque ese paso
 * pregunta la carrera sólo si el nivel es Superior.
 *
 * Al editar se conserva el orden de siempre: la materia ya tiene todo cargado
 * y el docente salta directo al paso que quiere tocar.
 */
export function ordenDePasos(camino: CaminoTemario | null, editando: boolean): PasoId[] {
  if (!editando && (camino === 'import' || camino === 'manual')) {
    return [PASO.materia, PASO.temario, PASO.nivel, PASO.ajustes]
  }
  return [PASO.nivel, PASO.materia, PASO.temario, PASO.ajustes]
}

/** Se puede ir a un paso si ninguno de los anteriores, en ese orden, tiene algo pendiente. */
export function puedeLlegarA(
  orden: PasoId[],
  pendientes: Record<PasoId, string | null>,
  destino: PasoId,
): boolean {
  const hasta = orden.indexOf(destino)
  if (hasta < 0) return false
  return orden.slice(0, hasta).every((paso) => !pendientes[paso])
}

export function pasoVecino(orden: PasoId[], paso: PasoId, direccion: -1 | 1): PasoId | null {
  return orden[orden.indexOf(paso) + direccion] ?? null
}

// ─── Lo que la IA leyó del archivo ────────────────────────────────────────────

export interface NivelSugerido {
  nivel: Nivel
  /** Tal como lo escribió la IA ("3er año", "tercero", "3°"). */
  grado: string
}

const NIVELES: Record<string, Nivel> = {
  primario: 'Primario',
  primaria: 'Primario',
  secundario: 'Secundario',
  secundaria: 'Secundario',
  superior: 'Superior',
  terciario: 'Superior',
  universitario: 'Superior',
}

/**
 * Valida lo que devolvió el modelo. Es una sugerencia para que el docente
 * confirme, así que ante cualquier duda se descarta: un nivel mal adivinado y
 * prellenado es peor que un campo vacío.
 */
export function leerNivelSugerido(valor: unknown): NivelSugerido | null {
  if (!valor || typeof valor !== 'object') return null
  const { nivel, grado } = valor as { nivel?: unknown; grado?: unknown }
  if (typeof nivel !== 'string') return null

  const reconocido = NIVELES[nivel.trim().toLowerCase()]
  if (!reconocido) return null

  return { nivel: reconocido, grado: typeof grado === 'string' ? grado.trim().slice(0, 40) : '' }
}

const ORDINALES: Record<string, number> = {
  primer: 1, primero: 1, primera: 1,
  segundo: 2, segunda: 2,
  tercer: 3, tercero: 3, tercera: 3,
  cuarto: 4, cuarta: 4,
  quinto: 5, quinta: 5,
  sexto: 6, sexta: 6,
  septimo: 7, septima: 7,
}

function numeroDeGrado(texto: string): number | null {
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const digito = limpio.match(/\d+/)
  if (digito) return Number(digito[0])
  const palabra = limpio.split(/[^a-z]+/).find((parte) => parte in ORDINALES)
  return palabra ? ORDINALES[palabra] : null
}

/**
 * De "tercero" o "3°" a la opción de la lista ("3er Año"). Sólo devuelve una
 * opción si hay exactamente una con ese número: si son varias o ninguna, null,
 * y el docente elige.
 */
export function elegirGrado(sugerido: string, opciones: string[]): string | null {
  const numero = numeroDeGrado(sugerido)
  if (numero === null) return null
  const candidatas = opciones.filter((opcion) => numeroDeGrado(opcion) === numero)
  return candidatas.length === 1 ? candidatas[0] : null
}

// ─── El progreso de la lectura del archivo ────────────────────────────────────

/**
 * Lo que el servidor va contando mientras procesa el archivo, una línea JSON
 * por evento. Son etapas que de verdad ocurren, en el orden en que ocurren: no
 * un porcentaje inventado.
 */
export type EventoDeLectura =
  | { etapa: 'leyendo' }
  /**
   * Ya se pudo leer el texto. No trae un conteo de unidades: una pasada rápida
   * sin IA daba 4 donde la IA después encontraba 3, y un número que se corrige
   * solo a los cinco segundos enseña a no creerle al siguiente.
   */
  | { etapa: 'leido' }
  | { etapa: 'ordenando' }
  | { etapa: 'listo'; resultado: Record<string, unknown> }
  | { etapa: 'error'; error: string; status: number }

export const TIPO_DE_PROGRESO = 'application/x-ndjson'
