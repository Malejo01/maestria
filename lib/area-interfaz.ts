import { perfilDeArea, type AreaId, type Caracter } from './areas'
import { CONFIANZA_BAJA } from './inferir-area'
import { AREA_DE_LA_MATERIA as T } from './textos'

/**
 * Ronda T · A3 — Lo que el docente ve del área (puro). Nunca bloquea nada: es
 * un renglón informativo con "Cambiar".
 */

/** "análisis de casos", "ejercicios y problemas": lo que va después de "Práctico:". */
export function queSonLasPracticas(area: AreaId | null | undefined): string {
  const etiqueta = perfilDeArea(area).modos.practico.etiqueta
  const corte = etiqueta.indexOf(':')
  return corte >= 0 ? etiqueta.slice(corte + 1).trim() : etiqueta
}

/** El renglón del área. Con confianza baja, "Nos parece que es…". */
export function renglonDeArea(area: AreaId | null | undefined, confianza: number | null | undefined, origen?: string | null): string {
  const nombre = perfilDeArea(area).nombre
  const practicas = queSonLasPracticas(area)
  const dudosa = origen !== 'manual' && typeof confianza === 'number' && confianza < CONFIANZA_BAJA
  return dudosa ? T.nosParece(nombre, practicas) : T.renglon(nombre, practicas)
}

/**
 * A4 · Lo que dicen las tarjetas de modo del selector, según el área. En
 * Antropología: "Práctico: análisis de casos", no "ejercicios y cuentas".
 */
export function tarjetaDeModo(area: AreaId, modo: 'teorico' | 'practico' | 'mixto'): { titulo: string; detalle: string } {
  const etiqueta = perfilDeArea(area).modos[modo].etiqueta
  const detalle =
    modo === 'teorico' ? T.modoTeorico : modo === 'practico' ? T.modoPractico(queSonLasPracticas(area)) : T.modoMixto
  return { titulo: etiqueta, detalle }
}

/** "Con cálculos" / "Conceptual" / "Mixta". */
export function etiquetaDeCaracter(caracter: Caracter): string {
  return T.caracter[caracter]
}
