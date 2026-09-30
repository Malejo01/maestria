import type { PedagogyProfile, ProgramUnit } from '../../lib/types'

/**
 * Programa de Matemática y su Didáctica — Profesorado de Educación Primaria,
 * 1º año, Instituto Jean Piaget Nº 8048, régimen anual, año lectivo 2026.
 * Fuente: programa de cátedra 2026 (documento de contenidos del docente).
 *
 * Es la fuente de verdad del programa y el aula que crea
 * scripts/crear-aula-matematica-didactica.ts. Vive en su propio módulo, sin
 * efectos de lado, por la misma razón que curriculum-superior-sistemas.ts: el
 * script corre al importarse y los tests no pueden dispararlo.
 *
 * Numeración: la del documento de contenidos, no la del cronograma (que pone
 * "El campo de la matemática" como I y corre el resto). Si cambia, se edita
 * acá y nada más.
 *
 * Correcciones respecto del documento original, y ninguna otra:
 *   - El Word decía "Máximo Común Divisor (MCM) y Divisor Común Mayor (DCM)":
 *     es MCD (Máximo Común Divisor) y MCM (Mínimo Común Múltiplo).
 *   - Tildes y typos evidentes.
 *
 * La Unidad V se llama "Estadística y probabilidad" pero el programa no lista
 * ningún tema de probabilidad. No se inventan: se deja como está el programa.
 *
 * Dónde van la carrera y la institución: `teacher_programs` no tiene columnas
 * para ninguna de las dos. La carrera va en `pedagogy_profile.degree`, que es
 * lo que `pedagogyProfileToContext` emite como "Carrera: ..." en el prompt. La
 * institución no tiene lugar y no se guarda.
 */

export const MATERIA = 'Matemática y su Didáctica'
export const NIVEL = 'Superior' as const
export const GRADO = '1er Año'
export const CARRERA = 'Profesorado de Educación Primaria'
export const INSTITUCION = 'Instituto Jean Piaget Nº 8048'
export const JURISDICCION = 'Salta'
export const NOMBRE_AULA = 'Matemática y su Didáctica — 1er Año Profesorado de Educación Primaria'
export const ICONO = 'sigma' as const
export const COLOR = 'teal' as const

export interface UnidadPrograma {
  nombre: string
  temas: string[]
}

export const UNIDADES: UnidadPrograma[] = [
  {
    nombre: 'Unidad I — Números y operaciones',
    temas: [
      'Sistemas de numeración: evolución histórica y vigencia',
      'Números naturales: función, contextos de uso, orden y discretitud',
      'Representación de los naturales en la recta numérica y propiedades',
      'Divisibilidad en los naturales: división por números enteros, múltiplos y divisores (método por tanteo y por factores)',
      'Máximo Común Divisor (MCD) y Mínimo Común Múltiplo (MCM)',
      'Números primos, compuestos y coprimos',
      'Criterios de divisibilidad',
      'Factorización de un número',
      'Situaciones problemáticas con múltiplos y divisores',
    ],
  },
  {
    nombre: 'Unidad II — El campo de la matemática y su didáctica',
    temas: [
      'La matemática y sus valores: instrumental, social, formativo y cultural',
      'Creencias y concepciones sobre la naturaleza de la Matemática, su aprendizaje y su enseñanza',
      'La noción de problema: diferentes concepciones',
      'Matrices de aprendizaje (Ana Quiroga) e interpretación pedagógica (Pichon-Rivière)',
      'Metodologías de resolución de un problema',
      'El error en matemática como oportunidad de aprendizaje; tolerancia a la frustración y aprender a aprender',
      'Teoría de las situaciones didácticas: acción, formulación, validación e institucionalización',
      'La validación en matemática',
      'Juegos interactivos para aplicar en el aula',
      'TIC en la dinámica del aula: conceptos y juegos matemáticos',
    ],
  },
  {
    nombre: 'Unidad III — Números racionales',
    temas: [
      'Concepto de fracción: numerador y denominador; representación circular y rectangular',
      'Fracciones propias e impropias; número mixto y su pasaje a fracción o número entero',
      'Suma y resta de fracciones con igual y distinto denominador',
      'Multiplicación y división de fracciones; el número entero como fracción',
      'Amplificación y simplificación de fracciones con criterios de divisibilidad',
      'Comparación de fracciones',
      'Operaciones combinadas con fracciones',
      'Situaciones problemáticas con fracciones, gráficos y proporciones directas',
      'Pasaje de fracción a decimal y viceversa',
      'Suma y resta de decimales; comparación de decimales y fracciones',
      'Cifras significativas y no significativas; redondeo y acotado',
      'Multiplicación y división de decimales',
      'Operaciones combinadas con decimales y fracciones',
      'Situaciones problemáticas con dinero',
      'Introducción a ecuaciones con situaciones problemáticas',
      'Porcentaje: cálculo de un porcentaje de un número, proporcionalidad directa, regla de tres simple y pasaje a decimal',
      'Situaciones problemáticas con descuento, recargo y cuotas',
    ],
  },
  {
    nombre: 'Unidad IV — Geometría y medida',
    temas: [
      'Elementos geométricos básicos: punto, recta y plano; rectas paralelas y perpendiculares',
      'Figuras geométricas sencillas: vértice, arista, lado y ángulo',
      'Ángulos: sistema sexagesimal; ángulos interiores y exteriores',
      'Clasificación de triángulos según lados y ángulos; propiedad triangular; suma de los ángulos interiores',
      'Clasificación de cuadriláteros según sus lados paralelos; propiedades de sus ángulos',
      'Círculo y circunferencia: radio, diámetro y cuerda',
      'Construcción de figuras con regla, escuadra y compás',
      'Perímetro y área de figuras planas; situaciones problemáticas',
      'Cuerpos geométricos: prismas, pirámides y cuerpos circulares; relación con la figura de base',
      'Volumen: deducción de las fórmulas a partir de las de área',
      'Medida: unidades de longitud (metro, kilómetro, centímetro) y su relación; unidades sexagesimales para ángulos',
    ],
  },
  {
    nombre: 'Unidad V — Estadística y probabilidad',
    temas: [
      'Estadística: población y muestra',
      'Formas de representación gráfica de datos estadísticos',
      'Parámetros de posición y dispersión: uso y significado',
      'Recolección y organización de datos; la información en distintos portadores',
      'Análisis y tratamiento estadístico: interpretar información y tomar decisiones',
      'Enseñanza de la estadística',
    ],
  },
]

/**
 * Las unidades tal como las guarda el wizard para un temario escrito a mano:
 * `origin: 'custom'` y sin `sourceEje`, porque no salen de la tabla
 * `curriculum` (no hay filas de esta carrera ahí). Ids con el mismo formato que
 * `normalizeUnits` le pondría a una unidad sin id.
 */
export function construirUnidades(unidades: UnidadPrograma[] = UNIDADES): ProgramUnit[] {
  return unidades.map((unidad, indice) => ({
    id: `tp-u-${indice + 1}`,
    name: unidad.nombre,
    topics: unidad.temas.map((tema, temaIndice) => ({
      id: `tp-u-${indice + 1}-t-${temaIndice + 1}`,
      name: tema,
      origin: 'custom' as const,
    })),
  }))
}

/**
 * El perfil que armaría el wizard con nivel Superior: `level`/`academicYear`
 * espejados de nivel/grado, y los defaults de complejidad y enfoque del wizard.
 *
 * `methodology` no tiene default a propósito — ver el comentario de
 * `--metodologia` en el script. Es hoy el ÚNICO canal por el que la lectura
 * didáctica ("un niño de 4º grado resolvió así...") llega al prompt dentro del
 * aula: `curriculum.contexto_profesional` y `tipos_pregunta_sugeridos` no se
 * aplican en la práctica de aula (SubjectContent no manda `carrera` y siempre
 * manda tipos explícitos). Ver docs/roadmap.md.
 */
export function construirPerfil(metodologia: string): PedagogyProfile {
  return {
    level: NIVEL,
    degree: CARRERA,
    academicYear: GRADO,
    complexity: 'Intermedia',
    assessmentStyle: 'mixto',
    methodology: metodologia,
  }
}
