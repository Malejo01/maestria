// Relativo: lo importa scripts/qa/areas-de-programas.ts, que corre bajo tsx.
import { esAreaId, esCaracter, type AreaId, type Caracter } from './areas'
import { CONFIANZA_BAJA, inferirArea, inferirCaracterDeUnidad, type UnidadParaInferir } from './inferir-area'

/**
 * Ronda T · A2 — Completar el área de un programa (puro).
 *
 * Un solo lugar decide qué área y qué carácter por unidad quedan guardados,
 * para todos los caminos: lo que devolvió la IA al leer el programa, un
 * programa armado a mano o desde el plan oficial, y los programas guardados
 * antes de la ronda T. Va en `pedagogy_profile.area` y `units[].caracter`,
 * dentro del jsonb de siempre: sin migración.
 *
 * Qué manda:
 *   - el área que eligió el docente (`areaOrigen: 'manual'`) no se toca;
 *   - la de la IA, si vino con confianza suficiente;
 *   - si no, la inferida por palabras clave (`inferirArea`), salvo que no
 *     reconozca nada y la IA sí haya dicho algo: entonces queda la de la IA,
 *     con su confianza baja;
 *   - por unidad: el carácter a mano, el detectado, o el inferido.
 */

export interface PerfilConArea {
  area?: unknown
  areaConfianza?: unknown
  areaOrigen?: unknown
}

export interface UnidadConCaracter extends UnidadParaInferir {
  caracter?: unknown
  caracterManual?: unknown
}

export interface AreaCompleta {
  area: AreaId
  areaConfianza: number
  areaOrigen: 'ia' | 'inferida' | 'manual'
}

export function completarAreaDelPrograma<P extends object, U extends UnidadConCaracter>({
  materia,
  carrera,
  perfil,
  unidades,
}: {
  materia: string
  carrera?: string | null
  perfil: P | null | undefined
  unidades: readonly U[]
}): { perfil: P & AreaCompleta; unidades: (U & { caracter: Caracter })[]; cambio: boolean } {
  const base = (perfil ?? {}) as P
  const leido = base as PerfilConArea
  const area = decidirArea(materia, carrera, leido, unidades)

  const cambioDeArea =
    leido.area !== area.area || leido.areaConfianza !== area.areaConfianza || leido.areaOrigen !== area.areaOrigen

  let cambioDeUnidades = false
  const conCaracter = unidades.map((unidad) => {
    if (esCaracter(unidad.caracter)) return unidad as U & { caracter: Caracter }
    cambioDeUnidades = true
    return { ...unidad, caracter: inferirCaracterDeUnidad(area.area, unidad) }
  })

  return { perfil: { ...base, ...area }, unidades: conCaracter, cambio: cambioDeArea || cambioDeUnidades }
}

function decidirArea(
  materia: string,
  carrera: string | null | undefined,
  perfil: PerfilConArea,
  unidades: readonly UnidadParaInferir[],
): AreaCompleta {
  const confianzaGuardada = typeof perfil.areaConfianza === 'number' && Number.isFinite(perfil.areaConfianza)
    ? Math.min(1, Math.max(0, perfil.areaConfianza))
    : null

  if (esAreaId(perfil.area) && perfil.areaOrigen === 'manual') {
    return { area: perfil.area, areaConfianza: 1, areaOrigen: 'manual' }
  }
  if (esAreaId(perfil.area) && confianzaGuardada !== null && confianzaGuardada >= CONFIANZA_BAJA) {
    return { area: perfil.area, areaConfianza: confianzaGuardada, areaOrigen: perfil.areaOrigen === 'inferida' ? 'inferida' : 'ia' }
  }

  const inferida = inferirArea(materia, carrera, unidades)
  const deLaIA = esAreaId(perfil.area) ? perfil.area : null
  if (deLaIA && perfil.areaOrigen !== 'inferida' && (inferida.area === 'otra' || inferida.confianza < (confianzaGuardada ?? 0))) {
    return { area: deLaIA, areaConfianza: confianzaGuardada ?? 0.4, areaOrigen: 'ia' }
  }
  return { area: inferida.area, areaConfianza: inferida.confianza, areaOrigen: 'inferida' }
}

/** El carácter que vale para la unidad (A3: lo manual manda). */
export function caracterDeLaUnidad(unidad: UnidadConCaracter, area: AreaId): Caracter {
  if (esCaracter(unidad.caracterManual)) return unidad.caracterManual
  if (esCaracter(unidad.caracter)) return unidad.caracter
  return inferirCaracterDeUnidad(area, unidad)
}
