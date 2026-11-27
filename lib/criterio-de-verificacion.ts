/**
 * Tanda AA · AA2 — El criterio de verificación del análisis Founder
 * (docs/founder/summary.md): «≥ 15 profes activados y ≥ 5 pagando, 3 fuera de
 * la red de Mauro, al 31/1». Hasta cumplirlo, la pauta de MaestrIA en Meta
 * queda en $0. Esto lo cuenta, con los datos que ya existen; puro (la lectura
 * de la base está en lib/criterio-de-verificacion-server.ts).
 *
 * ACTIVADO: tiene una materia propia (ni de ejemplo ni personal) y al menos 2
 * alumnos distintos practicaron en sus grupos dentro de sus primeros 7 días
 * desde el registro. «Practicaron» es el primer intento de cada alumno en una
 * tarea de un grupo del docente (la misma fuente que /admin/embudo).
 *
 * CON 3.ER ALUMNO: tiene 3 o más alumnos distintos en sus grupos abiertos.
 * PAGANDO: un plan pago vigente (nivel ≥ 1 con vencimiento futuro).
 *
 * «Fuera de la red de Mauro» no se puede saber desde la base: lo decide él.
 */

import { esCanal, esCampana, normalizarRef, type Canal } from '@/lib/origen'

export const DIAS_PARA_ACTIVARSE = 7
export const ALUMNOS_PARA_ACTIVARSE = 2
export const META_ACTIVADOS = 15
export const META_PAGANDO = 5

const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface DocenteParaElCriterio {
  /** `users.origen` (V1). */
  origen: string | null
  /** `users.origen_ref`: un referido o, si empieza con `AD-`, el anuncio (AA2). */
  origenRef: string | null
  registro: string | Date | null
  tieneMateria: boolean
  /** El primer intento de cada alumno distinto en sus grupos. */
  primerasPracticas: readonly (string | Date)[]
  /** Alumnos distintos en sus grupos abiertos. */
  alumnos: number
  pagando: boolean
}

function aMs(valor: string | Date | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const t = (valor instanceof Date ? valor : new Date(valor)).getTime()
  return Number.isFinite(t) ? t : null
}

/** Programa + 2 alumnos que practicaron en sus primeros 7 días. */
export function estaActivado(
  d: Pick<DocenteParaElCriterio, 'registro' | 'tieneMateria' | 'primerasPracticas'>,
  dias: number = DIAS_PARA_ACTIVARSE,
): boolean {
  if (!d.tieneMateria) return false
  const desde = aMs(d.registro)
  if (desde === null) return false
  const hasta = desde + dias * MS_POR_DIA
  const dentro = d.primerasPracticas.filter((p) => {
    const t = aMs(p)
    return t !== null && t >= desde && t <= hasta
  })
  return dentro.length >= ALUMNOS_PARA_ACTIVARSE
}

export interface ConteoDelCriterio {
  docentes: number
  /** Con al menos 1 alumno en sus grupos. */
  conAlumno: number
  activados: number
  conTercerAlumno: number
  pagando: number
}

export function contarCriterio(docentes: readonly DocenteParaElCriterio[]): ConteoDelCriterio {
  return {
    docentes: docentes.length,
    conAlumno: docentes.filter((d) => d.alumnos >= 1).length,
    activados: docentes.filter((d) => estaActivado(d)).length,
    conTercerAlumno: docentes.filter((d) => d.alumnos >= 3).length,
    pagando: docentes.filter((d) => d.pagando).length,
  }
}

/** El canal del docente, como lo cuenta /admin/embudo. */
export function canalDe(d: Pick<DocenteParaElCriterio, 'origen'>): Canal | 'sin-dato' {
  return esCanal(d.origen) ? d.origen : 'sin-dato'
}

/** AA2: el anuncio que lo trajo (`AD-…`), o null. */
export function campanaDe(d: Pick<DocenteParaElCriterio, 'origenRef'>): string | null {
  return esCampana(d.origenRef) ? normalizarRef(d.origenRef) : null
}

export interface FilaDeCampana extends ConteoDelCriterio {
  /** El nombre del anuncio, o null para los de Meta sin `ref=AD-…`. */
  campana: string | null
}

/**
 * La fila del canal Meta y, debajo, una por anuncio. Las visitas no están:
 * la app no las registra (se miran en el administrador de anuncios de Meta).
 */
export function resumenDeMeta(docentes: readonly DocenteParaElCriterio[]): { total: ConteoDelCriterio; porCampana: FilaDeCampana[] } {
  const deMeta = docentes.filter((d) => canalDe(d) === 'meta' || campanaDe(d) !== null)
  const grupos = new Map<string | null, DocenteParaElCriterio[]>()
  for (const d of deMeta) {
    const clave = campanaDe(d)
    grupos.set(clave, [...(grupos.get(clave) ?? []), d])
  }
  const porCampana = [...grupos.entries()]
    .map(([campana, lista]) => ({ campana, ...contarCriterio(lista) }))
    .sort((a, b) => (a.campana === null ? 1 : b.campana === null ? -1 : a.campana.localeCompare(b.campana)))
  return { total: contarCriterio(deMeta), porCampana }
}
