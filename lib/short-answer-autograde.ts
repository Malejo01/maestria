/**
 * Compositor de los dos correctores deterministas de respuesta corta.
 *
 * Vive en su propio archivo y no dentro de `short-answer-grading.ts` por una
 * razón explícita: ese módulo declara en su encabezado que la equivalencia
 * numérica está fuera de su alcance y que **no importa** a `numeric-answer.ts`,
 * y `numeric-answer.ts` responde que "quien componga los dos correctores decide
 * el orden". Este es ese quien. Los dos módulos base siguen sin conocerse, y el
 * orden —que es la decisión de diseño que importa— queda en un solo lugar.
 */
import { matchesAcceptedAnswer } from './short-answer-grading'
import { isNumericallyEquivalent, parseNumericAnswer } from './numeric-answer'

/**
 * Resultado de la corrección determinista.
 *
 * Nótese que NO existe el caso "resuelto e incorrecto": este corrector sólo
 * sabe afirmar. No poder resolver una respuesta no es evidencia de que esté
 * mal — es ausencia de evidencia, y confundir las dos cosas es exactamente el
 * bug que este trabajo viene a arreglar.
 */
export type LocalGrade =
  | { resolved: true; isCorrect: true; via: 'text' | 'numeric' }
  | { resolved: false }

const UNRESOLVED: LocalGrade = { resolved: false }

/**
 * Corrección determinista previa a la llamada a Gemini.
 *
 * El orden no es negociable: primero texto, después número, y la IA sólo si
 * ninguno resolvió. Es la única secuencia que aprovecha la asimetría entre los
 * correctores — el determinista no produce falsos positivos (es la obligación
 * dura que se impone `short-answer-grading.ts`) y la IA sí. Al revés, un modelo
 * que alucina se comería el caso que el módulo puro resolvía con certeza.
 *
 * Pensada para correr en el CLIENTE, antes del `fetch`. El modo de falla que
 * origina todo esto es que la llamada de red se cae: en la prueba del
 * 2026-08-10 el endpoint falló ~224 veces y un "13" idéntico al esperado quedó
 * incorrecto. Resolviéndolo en el browser, ese caso deja de depender de que
 * haya red, que es la diferencia entre mitigar el bug y eliminarlo.
 */
export function gradeShortAnswerLocally(studentAnswer: string, acceptedAnswers: string[]): LocalGrade {
  if (typeof studentAnswer !== 'string' || !Array.isArray(acceptedAnswers)) return UNRESOLVED

  if (matchesAcceptedAnswer(studentAnswer, acceptedAnswers)) {
    return { resolved: true, isCorrect: true, via: 'text' }
  }

  const studentValue = parseNumericAnswer(studentAnswer)
  if (studentValue === null) return UNRESOLVED

  // Una aceptada que no es número no invalida el paso, sólo no participa: en
  // `["5 km", "5 kilómetros", "5"]` las dos primeras no parsean y la tercera sí,
  // y es la que decide.
  const matchesNumerically = acceptedAnswers.some((accepted) => {
    if (typeof accepted !== 'string') return false
    const expected = parseNumericAnswer(accepted)
    // Sin `tolerance` explícita: una `short_answer` no la lleva —es un campo de
    // `NumericQuestion`—, así que aplica `defaultToleranceFor`: 0 para enteros,
    // que es lo que mantiene "12" distinto de "13".
    return expected !== null && isNumericallyEquivalent(studentValue, expected)
  })

  return matchesNumerically ? { resolved: true, isCorrect: true, via: 'numeric' } : UNRESOLVED
}
