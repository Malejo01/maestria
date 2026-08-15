import type { QuestionTypeMix } from '../../lib/question-mix'

/**
 * Programa oficial de Matemática de la Tecnicatura Superior en Análisis de
 * Sistemas — cátedra de la Prof. Mgtr. Ing. Cinthia Flores, instituto de nivel
 * terciario, régimen cuatrimestral, 6 horas semanales, año lectivo 2026.
 * Fuente: Programa_de_Matemática_2026.docx.
 *
 * Vive en su propio módulo, sin efectos de lado, porque el seeder que lo carga
 * ejecuta `seed()` al importarse: los tests del programa (proporciones
 * declaradas, unidades completas) no pueden importar el runner sin dispararlo
 * contra una base real.
 *
 * Lo consume scripts/seed-curriculum-superior-sistemas.ts.
 */

export const CARRERA = 'Tecnicatura Superior en Análisis de Sistemas'
export const MATERIA = 'Matemática'
export const GRADO = '1er Año'

export interface ContextoProfesional {
  /** Para qué sirve esta unidad en el ejercicio de la profesión. */
  aplicacion: string
  /** Herramientas digitales que la cátedra usa en esta unidad. */
  herramientas: string[]
}

export interface UnidadSuperior {
  eje: string
  temas: string[]
  contextoProfesional: ContextoProfesional
  /**
   * Proporción de tipos de pregunta de la unidad (migración 023). Ver
   * lib/question-mix.ts para el porqué del sesgo hacia numeric/short_answer y
   * MEZCLA_* acá abajo para el porqué de cada valor.
   */
  tiposPregunta: QuestionTypeMix
}

/**
 * Las tres mezclas del programa. Todas dejan al menos el 70% del peso en tipos
 * de producción (numeric, short_answer) y ninguna lleva los de reconocimiento a
 * cero: la opción múltiple con distractores diagnósticos sigue siendo útil para
 * detectar una confusión conceptual puntual, y verdadero/falso sirve para
 * validar una afirmación. Lo que se corrige es que fueran la mayoría.
 *
 * true_false queda en 5 y no en 0 por eso mismo: con 20 preguntas es una sola.
 */

/**
 * Unidades 1 y 2 (Lógica, Conjuntos). Casi todo lo que se evalúa acá es una
 * expresión, una tabla o una conclusión, no un número — de ahí el peso en
 * short_answer. Lo numérico existe pero es acotado (cantidad de filas de una
 * tabla de verdad, cardinales, inclusión-exclusión).
 */
const MEZCLA_SIMBOLICA: QuestionTypeMix = {
  short_answer: 45,
  numeric: 25,
  multiple_choice: 25,
  true_false: 5,
}

/**
 * Unidades 3, 4, 6 y 7 (Álgebra, Matrices, Límites, Derivadas). Son las
 * unidades donde el ejercicio termina en un número y donde el diagnóstico
 * midió lo peor: 8,7% a 23,9% de acierto en numeric. Resolver de verdad es
 * exactamente lo que no está pasando, así que es donde más se carga.
 */
const MEZCLA_CALCULO: QuestionTypeMix = {
  numeric: 50,
  short_answer: 25,
  multiple_choice: 20,
  true_false: 5,
}

/**
 * Unidad 5 (Funciones y modelización). Mitad cálculo, mitad interpretación:
 * "cuánto vale f(3)" y "qué significa esa pendiente para el crecimiento de
 * usuarios" pesan parecido, y la segunda no se responde con un número.
 */
const MEZCLA_MODELIZACION: QuestionTypeMix = {
  numeric: 40,
  short_answer: 35,
  multiple_choice: 20,
  true_false: 5,
}

export const UNIDADES: UnidadSuperior[] = [
  {
    eje: 'Unidad 1 — Fundamentos de Lógica y Razonamiento Matemático',
    temas: [
      'Concepto de lógica y su utilidad en informática y sistemas de información.',
      'Proposiciones simples y compuestas.',
      'Operadores lógicos: negación, conjunción, disyunción, condicional, bicondicional.',
      'Tablas de verdad, tautologías, contradicciones y contingencias.',
      'Equivalencias lógicas y reglas de inferencia.',
      'Introducción a la lógica computacional y su aplicación en programación y sistemas (lógica booleana en hardware y software).',
    ],
    contextoProfesional: {
      aplicacion: 'Diseño de algoritmos, validación de procesos',
      herramientas: ['GeoGebra', 'Simulador de lógica'],
    },
    tiposPregunta: MEZCLA_SIMBOLICA,
  },
  {
    eje: 'Unidad 2 — Teoría de Conjuntos y Aplicaciones en Sistemas',
    temas: [
      'Definición, notación y representación gráfica (diagramas de Venn).',
      'Clasificación de conjuntos: universales, vacíos, finitos e infinitos.',
      'Operaciones con conjuntos: unión, intersección, diferencia y complemento.',
      'Relaciones y funciones: pertenencia, inclusión, igualdad.',
      'Aplicación en bases de datos y estructuras de datos.',
    ],
    contextoProfesional: {
      aplicacion: 'Organización de datos, bases de datos',
      herramientas: ['GeoGebra', 'Diagrama de Venn online'],
    },
    tiposPregunta: MEZCLA_SIMBOLICA,
  },
  {
    eje: 'Unidad 3 — Álgebra y Ecuaciones para Sistemas de Información',
    temas: [
      'Expresiones algebraicas y polinomios.',
      'Productos notables.',
      'Resolución de ecuaciones lineales y cuadráticas.',
      'Sistemas de ecuaciones lineales: métodos de solución (sustitución, igualación, matrices).',
      'Inecuaciones y sistemas de inecuaciones.',
      'Aplicaciones en modelización y resolución de problemas reales.',
    ],
    contextoProfesional: {
      aplicacion: 'Modelado de procesos administrativos, problemas de inventario y costos',
      herramientas: ['GeoGebra', 'Hojas de cálculo'],
    },
    tiposPregunta: MEZCLA_CALCULO,
  },
  {
    eje: 'Unidad 4 — Matrices y Álgebra Lineal Aplicada',
    temas: [
      'Definición y tipos de matrices.',
      'Operaciones básicas: suma, multiplicación escalar y de matrices.',
      'Matriz traspuesta, inversa y matriz escalonada.',
      'Aplicación de matrices en sistemas de ecuaciones y modelización de procesos.',
    ],
    contextoProfesional: {
      aplicacion: 'Gestión de datos, análisis de información multidimensional',
      herramientas: ['GeoGebra', 'Excel'],
    },
    tiposPregunta: MEZCLA_CALCULO,
  },
  {
    eje: 'Unidad 5 — Funciones y Modelización Matemática',
    temas: [
      'Concepto y representación de funciones.',
      'Dominio, imagen, crecimiento, decrecimiento, continuidad.',
      'Tipos de funciones: polinómicas, racionales, irracionales, exponenciales, potenciales, logarítmicas y trigonométricas.',
      'Modelización de fenómenos y análisis de datos en sistemas.',
    ],
    contextoProfesional: {
      aplicacion:
        'Modelado de ingresos, costos, análisis de tendencias, proyección de ventas, crecimiento de usuarios',
      herramientas: ['GeoGebra', 'Gráficos interactivos'],
    },
    tiposPregunta: MEZCLA_MODELIZACION,
  },
  {
    eje: 'Unidad 6 — Límites y Continuidad',
    temas: [
      'Aplicaciones del cálculo diferencial en situaciones cotidianas.',
      'Tasa de variación y límites funcionales.',
      'Límites de las funciones.',
      'Análisis de límites en diferentes registros.',
      'Límites indeterminados.',
      'Límites e infinitos.',
      'Funciones continuas.',
      'Funciones discontinuas.',
    ],
    contextoProfesional: {
      aplicacion: 'Optimización de recursos, análisis marginal',
      herramientas: ['GeoGebra', 'Simuladores de cálculo'],
    },
    tiposPregunta: MEZCLA_CALCULO,
  },
  {
    eje: 'Unidad 7 — Derivadas',
    temas: [
      'Derivada: definición, interpretación geométrica y aplicaciones.',
      'Reglas básicas de derivación y tablas de derivadas elementales.',
      'Aplicaciones prácticas: tasas de cambio, optimización y análisis de sistemas.',
    ],
    contextoProfesional: {
      // El programa agrupa 6 y 7 bajo la misma aplicación profesional.
      aplicacion: 'Optimización de recursos, análisis marginal',
      herramientas: ['GeoGebra', 'Simuladores de cálculo'],
    },
    tiposPregunta: MEZCLA_CALCULO,
  },
]
