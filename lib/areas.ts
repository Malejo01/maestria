// Relativo, no `@/lib/...`: lo importan scripts de QA que corren bajo tsx.
import type { QuestionType } from './types'
import type { QuestionTypeMix } from './question-mix'

/**
 * Ronda T · A1 — El área de conocimiento de una materia.
 *
 * El generador nació para matemática y lo era en cuatro lugares: los modos
 * ("práctico = ejercicios de cálculo"), la mezcla (`numeric` como el tipo de
 * producción preferido), el bloque de LaTeX siempre presente y un rol de
 * especialista que no conocía psicología, antropología ni marketing. El
 * reporte de Silvana (Temas de Antropología Cultural en Psicología) es el
 * síntoma: 15 generaciones, 2 guardadas, 40 de 40 preguntas de verdadero o
 * falso.
 *
 * Un perfil por área dice, para ese campo, qué significa cada modo, con qué
 * mezcla de tipos se evalúa, qué notación hace falta y qué validadores
 * aplican. El área se detecta sola al leer el programa (A2) y el docente sólo
 * la ve y la cambia si quiere (A3). Todo acá es puro.
 */

export const AREA_IDS = [
  'matematica',
  'estadistica',
  'fisica',
  'quimica',
  'biologia',
  'informatica',
  'contabilidad',
  'economia',
  'administracion',
  'salud',
  'psicologia',
  'sociales',
  'educacion',
  'derecho',
  'lengua',
  'artes',
  'otra',
] as const

export type AreaId = (typeof AREA_IDS)[number]

export const CARACTERES = ['cuantitativo', 'conceptual', 'mixto'] as const
export type Caracter = (typeof CARACTERES)[number]

/** Qué bloque de notación necesita el prompt. */
export type Notacion = 'latex' | 'codigo' | 'formulas' | 'ninguna'

export type Modo = 'teorico' | 'practico' | 'mixto'

/** Validadores que se corren sobre lo generado. Ver A5. */
export type Validador =
  /** L3: "descomponé en primos" lleva `forma: 'factorizacion'`. */
  | 'factorizacion'
  /** K2: la fracción manda sobre el decimal. */
  | 'fracciones'
  /** Coma decimal en el texto (Argentina). */
  | 'coma_decimal'
  /** En lo conceptual: ni LaTeX, ni `numeric`, ni consignas de cálculo. */
  | 'sin_latex_ni_calculo'
  /** Bloques de código bien cerrados. */
  | 'codigo'

export interface DescripcionDeModo {
  /** Lo que ve el docente en el selector: "Práctico: análisis de casos". */
  etiqueta: string
  /** Lo que lee la IA: 2 o 3 líneas. */
  descripcion: string
  /** 1 o 2 consignas de ejemplo, cortas. Nunca citas de autores reales. */
  ejemplos: string[]
}

export interface PerfilDeArea {
  id: AreaId
  nombre: string
  /** Para detectar el área (A2) y mostrar ejemplos en la interfaz. */
  ejemplosDeMaterias: string[]
  /** El valor por defecto del carácter de cada unidad. */
  caracter: Caracter
  /** Reemplaza a `getSpecialistRole`. */
  rolEspecialista: string
  modos: Record<Modo, DescripcionDeModo>
  /** Pesos relativos por tipo; `distribuirConTope` los reparte. */
  mezclaPorModo: Record<Modo, QuestionTypeMix>
  notacion: Notacion
  /** Contabilidad y economía: LaTeX sólo para números y fórmulas simples. */
  soloNumeros?: boolean
  /** Lo que antes elegía `estrategiaDeLaMateria` por palabra clave. */
  estrategiaDistractores: string
  validadores: Validador[]
}

// ── Las mezclas ────────────────────────────────────────────────────────────

/**
 * Conceptuales: la tabla del encargo de la ronda T. Ningún tipo pasa del 50 %
 * (lo garantiza `limitarMezcla` igual) y no hay `numeric`.
 */
const MEZCLA_CONCEPTUAL: Record<Modo, QuestionTypeMix> = {
  teorico: { multiple_choice: 40, short_answer: 25, true_false: 35 },
  practico: { multiple_choice: 50, short_answer: 35, true_false: 15 },
  mixto: { multiple_choice: 45, short_answer: 30, true_false: 25 },
}

/**
 * Cuantitativas: el práctico produce (numérica y respuesta corta), como pide
 * el diagnóstico del 10/08 (ver lib/question-mix.ts). El teórico no lleva
 * `numeric`, igual que `questionTypesForMode`.
 */
const MEZCLA_CUANTITATIVA: Record<Modo, QuestionTypeMix> = {
  teorico: { multiple_choice: 40, short_answer: 35, true_false: 25 },
  practico: { numeric: 45, short_answer: 25, multiple_choice: 20, true_false: 10 },
  mixto: { numeric: 25, short_answer: 30, multiple_choice: 30, true_false: 15 },
}

/** Mixtas: casos y conceptos, con algo de cálculo si la unidad lo tiene. */
const MEZCLA_MIXTA: Record<Modo, QuestionTypeMix> = {
  teorico: { multiple_choice: 40, short_answer: 30, true_false: 30 },
  practico: { multiple_choice: 40, short_answer: 30, numeric: 20, true_false: 10 },
  mixto: { multiple_choice: 40, short_answer: 30, numeric: 10, true_false: 20 },
}

export const MEZCLA_POR_CARACTER: Record<Caracter, Record<Modo, QuestionTypeMix>> = {
  conceptual: MEZCLA_CONCEPTUAL,
  cuantitativo: MEZCLA_CUANTITATIVA,
  mixto: MEZCLA_MIXTA,
}

// ── Las estrategias de distractores ─────────────────────────────────────────
// Las cuatro primeras son las que `estrategiaDeLaMateria` (education-context)
// elegía por palabra clave: viven acá y ella las usa, para no duplicarlas.

export const ESTRATEGIA_MATEMATICA = `ESTRATEGIA MATEMÁTICA:
- Prioriza ejemplos concretos, problemas contextualizados y representaciones claras.
- Distractores diagnósticos: Errores de operación inversa, confusión de propiedades, fallas de conteo/signo o aplicación de fórmulas fuera de contexto.
- Factorizar o descomponer en primos: si es "numeric", lleva "forma": "factorizacion" y correctAnswer es el número (60); el alumno responde el producto (2^2·3·5). Nunca una numérica que pide factorizar sin "forma".
- Inecuaciones: se pide "el conjunto solución", NUNCA "el valor de x" (la respuesta es un conjunto, no un número). En "short_answer", acceptedAnswers incluye las formas equivalentes: "x <= 2", "x ≤ 2", "2 >= x", "(-∞; 2]", "(-∞, 2]" y "x menor o igual que 2".`

export const ESTRATEGIA_NATURALES = `ESTRATEGIA CIENCIAS NATURALES:
- Basada en la observación directa de la naturaleza, seres vivos, cuerpo humano y fenómenos del entorno cotidiano.
- Distractores diagnósticos: Confusiones frecuentes entre procesos biológicos/físicos paralelos (ej: fotosíntesis vs respiración, fusión vs evaporación, masa vs peso).`

export const ESTRATEGIA_SOCIALES = `ESTRATEGIA CIENCIAS SOCIALES:
- Enfocada en narrativas claras, procesos históricos de causa-efecto, comprensión del espacio geográfico y la vida en sociedad.
- Distractores diagnósticos: Confusiones de causalidad (confundir causa con consecuencia), anacronismos o mezcla de actores sociales.`

export const ESTRATEGIA_LENGUA = `ESTRATEGIA LENGUA Y COMUNICACIÓN:
- Enfocada en comprensión lectora, funciones de la palabra, tipos de texto y comunicación cotidiana.
- Distractores diagnósticos: Interpretaciones literales de textos figurados, confusión de funciones gramaticales o de intención comunicativa.`

export const ESTRATEGIA_GENERAL = `ESTRATEGIA GENERAL DISCIPLINAR:
- Plantea preguntas claras con relación directa a los temas curriculares.
- Distractores diagnósticos: Confusiones conceptuales típicas del tema.`

// ── Los perfiles ───────────────────────────────────────────────────────────

const VALIDADORES_CUANTITATIVOS: Validador[] = ['factorizacion', 'fracciones', 'coma_decimal']
const VALIDADORES_CONCEPTUALES: Validador[] = ['sin_latex_ni_calculo']

export const PERFILES: Record<AreaId, PerfilDeArea> = {
  matematica: {
    id: 'matematica',
    nombre: 'Matemática',
    ejemplosDeMaterias: ['Matemática I', 'Álgebra', 'Análisis Matemático', 'Geometría', 'Cálculo'],
    caracter: 'cuantitativo',
    rolEspecialista: 'Sos especialista en evaluación de matemática.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: definiciones y propiedades',
        descripcion: 'Preguntas conceptuales sobre definiciones, teoremas y propiedades. Sin cálculos numéricos complejos.',
        ejemplos: ['¿Qué condición tiene que cumplir una función para ser inyectiva?'],
      },
      practico: {
        etiqueta: 'Práctico: ejercicios y problemas',
        descripcion: 'Ejercicios de cálculo y resolución de problemas numéricos.',
        ejemplos: ['Calculá el MCD entre 84 y 126.', 'Un tanque pierde 3,5 litros por hora: ¿cuántas horas tarda en vaciarse si tiene 42 litros?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y ejercicios',
        descripcion: 'Equilibrar preguntas teóricas y prácticas.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CUANTITATIVA,
    notacion: 'latex',
    estrategiaDistractores: ESTRATEGIA_MATEMATICA,
    validadores: VALIDADORES_CUANTITATIVOS,
  },
  estadistica: {
    id: 'estadistica',
    nombre: 'Estadística y probabilidad',
    ejemplosDeMaterias: ['Estadística', 'Probabilidad y Estadística', 'Bioestadística', 'Estadística Aplicada'],
    caracter: 'cuantitativo',
    rolEspecialista: 'Sos especialista en evaluación de estadística y probabilidad.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y supuestos',
        descripcion: 'Preguntas sobre conceptos, supuestos de los métodos y cuándo corresponde cada medida o prueba. Sin cuentas largas.',
        ejemplos: ['¿Qué medida de tendencia central conviene informar cuando hay valores extremos?'],
      },
      practico: {
        etiqueta: 'Práctico: cálculo e interpretación de datos',
        descripcion: 'Cálculos con datos concretos e interpretación de tablas, gráficos y resultados. El dato se da en el enunciado, en una tabla breve escrita en texto.',
        ejemplos: ['Con los datos 4, 7, 7, 9 y 13, calculá la mediana.', 'Si P(A) = 0,3 y A y B son independientes con P(B) = 0,5, ¿cuánto vale P(A y B)?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y cálculo',
        descripcion: 'Equilibrar preguntas conceptuales con cálculo e interpretación de datos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CUANTITATIVA,
    notacion: 'latex',
    estrategiaDistractores: `ESTRATEGIA ESTADÍSTICA:
- Situá los datos en contextos reales (encuestas, mediciones, ventas).
- Distractores diagnósticos: confundir media con mediana, sumar probabilidades de eventos no excluyentes, confundir correlación con causalidad, leer mal una frecuencia acumulada.`,
    validadores: VALIDADORES_CUANTITATIVOS,
  },
  fisica: {
    id: 'fisica',
    nombre: 'Física',
    ejemplosDeMaterias: ['Física I', 'Mecánica', 'Electromagnetismo', 'Termodinámica'],
    caracter: 'cuantitativo',
    rolEspecialista: 'Sos especialista en evaluación de física.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: leyes y conceptos',
        descripcion: 'Preguntas sobre leyes, principios y relaciones entre magnitudes, sin resolver cuentas.',
        ejemplos: ['Si se duplica la masa de un cuerpo y la fuerza neta no cambia, ¿qué pasa con su aceleración?'],
      },
      practico: {
        etiqueta: 'Práctico: problemas con magnitudes',
        descripcion: 'Problemas con magnitudes y unidades: se plantea la situación, se da cada dato con su unidad y se pide un resultado con unidad.',
        ejemplos: ['Un auto parte del reposo y acelera a 2 m/s². ¿Qué velocidad tiene a los 6 s, en m/s?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y problemas',
        descripcion: 'Equilibrar preguntas conceptuales con problemas con magnitudes y unidades.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CUANTITATIVA,
    notacion: 'latex',
    estrategiaDistractores: `${ESTRATEGIA_NATURALES}
- En problemas: errores de conversión de unidades, confundir velocidad con aceleración o masa con peso, olvidar un signo de dirección.`,
    validadores: VALIDADORES_CUANTITATIVOS,
  },
  quimica: {
    id: 'quimica',
    nombre: 'Química',
    ejemplosDeMaterias: ['Química General', 'Química Orgánica', 'Química Biológica'],
    caracter: 'mixto',
    rolEspecialista: 'Sos especialista en evaluación de química.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y propiedades',
        descripcion: 'Preguntas sobre conceptos, propiedades de la materia, enlaces y reacciones, sin cálculo.',
        ejemplos: ['¿Qué tipo de enlace se forma entre dos átomos con electronegatividades muy distintas?'],
      },
      practico: {
        etiqueta: 'Práctico: cálculos y fórmulas',
        descripcion: 'Cálculos estequiométricos, de concentración y de fórmulas, más la interpretación de reacciones.',
        ejemplos: ['¿Cuántos moles hay en 36 g de agua (masa molar 18 g/mol)?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y cálculos',
        descripcion: 'Equilibrar preguntas conceptuales con cálculos y fórmulas.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_MIXTA,
    notacion: 'formulas',
    estrategiaDistractores: `${ESTRATEGIA_NATURALES}
- En cálculos: no balancear la ecuación, confundir masa con moles, equivocar la masa molar.`,
    validadores: ['fracciones', 'coma_decimal'],
  },
  biologia: {
    id: 'biologia',
    nombre: 'Biología y ciencias naturales',
    ejemplosDeMaterias: ['Biología', 'Ciencias Naturales', 'Genética', 'Ecología', 'Anatomía'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de biología y ciencias naturales.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y procesos',
        descripcion: 'Preguntas sobre conceptos, estructuras y procesos biológicos.',
        ejemplos: ['¿En qué organela ocurre la respiración celular?'],
      },
      practico: {
        etiqueta: 'Práctico: casos y experimentos',
        descripcion: 'Interpretación de experimentos, de situaciones y de casos: qué pasa, por qué y qué se concluye. Sin cálculos.',
        ejemplos: ['Se tapa la luz de una planta durante una semana. ¿Qué proceso se ve afectado primero y por qué?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con interpretación de experimentos y casos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: ESTRATEGIA_NATURALES,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  informatica: {
    id: 'informatica',
    nombre: 'Informática y programación',
    ejemplosDeMaterias: ['Programación I', 'Algoritmos y Estructuras de Datos', 'Bases de Datos', 'Análisis de Sistemas', 'Redes'],
    caracter: 'mixto',
    rolEspecialista: 'Sos especialista en evaluación de informática y programación.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos',
        descripcion: 'Preguntas sobre conceptos, paradigmas, estructuras de datos y buenas prácticas.',
        ejemplos: ['¿Qué estructura de datos conviene para atender pedidos en el orden en que llegan?'],
      },
      practico: {
        etiqueta: 'Práctico: leer y predecir código',
        descripcion: 'Leer un fragmento de código breve y predecir qué hace o qué imprime; elegir la estructura o el algoritmo adecuado para una situación.',
        ejemplos: ['¿Qué imprime este código?\n```python\nx = 3\nfor i in range(2):\n    x = x * 2\nprint(x)\n```'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y código',
        descripcion: 'Equilibrar preguntas conceptuales con lectura de código y elección de estructuras.',
        ejemplos: [],
      },
    },
    mezclaPorModo: {
      teorico: { multiple_choice: 40, short_answer: 30, true_false: 30 },
      practico: { multiple_choice: 45, short_answer: 35, numeric: 10, true_false: 10 },
      mixto: { multiple_choice: 45, short_answer: 30, numeric: 5, true_false: 20 },
    },
    notacion: 'codigo',
    estrategiaDistractores: `ESTRATEGIA INFORMÁTICA:
- Situá las preguntas en sistemas reales (una tienda en línea, un sistema de turnos, un inventario).
- Distractores diagnósticos: errores de uno en los índices, confundir asignación con comparación, confundir pila con cola, suponer que una variable cambia fuera de su alcance.`,
    validadores: ['codigo'],
  },
  contabilidad: {
    id: 'contabilidad',
    nombre: 'Contabilidad y finanzas',
    ejemplosDeMaterias: ['Contabilidad Básica', 'Contabilidad de Costos', 'Matemática Financiera', 'Finanzas'],
    caracter: 'cuantitativo',
    rolEspecialista: 'Sos especialista en evaluación de contabilidad y finanzas.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y normas',
        descripcion: 'Preguntas sobre conceptos contables y financieros, cuentas, criterios y normas, sin cálculos.',
        ejemplos: ['¿La cuenta Proveedores es de activo, de pasivo o de patrimonio neto?'],
      },
      practico: {
        etiqueta: 'Práctico: asientos y cálculos',
        descripcion: 'Registrar asientos, calcular intereses, cuotas, costos o resultados, e interpretar estados contables breves dados en el enunciado.',
        ejemplos: ['Se compra mercadería por 120.000 pesos en cuenta corriente. ¿Qué cuenta se acredita?', 'Un capital de 50.000 pesos al 4 % mensual simple, ¿cuánto interés genera en 3 meses?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y cálculos',
        descripcion: 'Equilibrar preguntas conceptuales con asientos y cálculos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CUANTITATIVA,
    notacion: 'latex',
    soloNumeros: true,
    estrategiaDistractores: `ESTRATEGIA CONTABLE:
- Situá los casos en empresas y comercios concretos.
- Distractores diagnósticos: invertir debe y haber, confundir activo con pasivo, confundir interés simple con compuesto, imputar al período equivocado.`,
    validadores: ['coma_decimal'],
  },
  economia: {
    id: 'economia',
    nombre: 'Economía',
    ejemplosDeMaterias: ['Microeconomía', 'Macroeconomía', 'Economía Política', 'Introducción a la Economía'],
    caracter: 'mixto',
    rolEspecialista: 'Sos especialista en evaluación de economía.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y modelos',
        descripcion: 'Preguntas sobre conceptos, supuestos y conclusiones de los modelos económicos.',
        ejemplos: ['Según el modelo de oferta y demanda, ¿qué pasa con el precio de equilibrio si aumenta la oferta?'],
      },
      practico: {
        etiqueta: 'Práctico: casos, gráficos y cálculos simples',
        descripcion: 'Aplicar un modelo a un caso, interpretar gráficos y variaciones descriptos en el enunciado y hacer cálculos simples (elasticidad, variaciones porcentuales, PBI).',
        ejemplos: ['El precio de un bien sube 10 % y la cantidad demandada baja 20 %. ¿Cuánto vale la elasticidad precio de la demanda, en valor absoluto?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con casos, gráficos y cálculos simples.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_MIXTA,
    notacion: 'latex',
    soloNumeros: true,
    estrategiaDistractores: `ESTRATEGIA ECONOMÍA:
- Situá las preguntas en mercados y situaciones de Argentina y la región.
- Distractores diagnósticos: confundir desplazamiento de la curva con movimiento a lo largo de ella, confundir causa con consecuencia, confundir variables nominales con reales.`,
    validadores: ['coma_decimal'],
  },
  administracion: {
    id: 'administracion',
    nombre: 'Administración, marketing y gestión',
    ejemplosDeMaterias: ['Marketing I', 'Administración General', 'Gestión de Recursos Humanos', 'Comercialización'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de administración, marketing y gestión de organizaciones.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y modelos',
        descripcion: 'Preguntas sobre conceptos, modelos y herramientas de gestión.',
        ejemplos: ['¿Qué componente del análisis FODA describe factores externos favorables?'],
      },
      practico: {
        etiqueta: 'Práctico: casos de empresas',
        descripcion: 'Casos de empresas u organizaciones: decidir, diagnosticar o aplicar un modelo (FODA, 4P, segmentación). El caso se describe en 2 o 3 oraciones.',
        ejemplos: ['Una panadería de barrio pierde clientes frente a una cadena nueva con precios más bajos. ¿Qué variable de las 4P conviene trabajar primero y por qué?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con casos de organizaciones.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA GESTIÓN:
- Casos situados en organizaciones concretas y verosímiles (pymes, comercios, instituciones).
- Distractores diagnósticos: confundir lo interno con lo externo, elegir una acción que no responde al problema del caso, confundir estrategia con táctica.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  salud: {
    id: 'salud',
    nombre: 'Ciencias de la salud',
    ejemplosDeMaterias: ['Enfermería Comunitaria', 'Fundamentos de Enfermería', 'Kinesiología', 'Nutrición', 'Farmacología'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de ciencias de la salud.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos',
        descripcion: 'Preguntas sobre conceptos, signos, procedimientos y criterios.',
        ejemplos: ['¿Cuál es la primera medida ante una persona que no responde y no respira?'],
      },
      practico: {
        etiqueta: 'Práctico: casos clínicos y de cuidado',
        descripcion: 'Casos clínicos o de cuidado: identificar prioridades, elegir el procedimiento y anticipar riesgos. El caso se describe en 2 o 3 oraciones.',
        ejemplos: ['Un paciente posoperado refiere dolor y tiene fiebre de 38,5 °C. ¿Qué valorás primero?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con casos clínicos o de cuidado.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA SALUD:
- Casos verosímiles de atención, prevención y cuidado.
- Distractores diagnósticos: invertir prioridades de atención, confundir signo con síntoma, aplicar un procedimiento correcto en el momento equivocado.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  psicologia: {
    id: 'psicologia',
    nombre: 'Psicología',
    ejemplosDeMaterias: ['Psicología General', 'Psicología Evolutiva', 'Psicología Social', 'Psicoanálisis'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de psicología.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y enfoques',
        descripcion: 'Preguntas sobre conceptos, enfoques y diferencias entre corrientes.',
        ejemplos: ['¿Qué diferencia hay entre un enfoque conductual y uno cognitivo para explicar un aprendizaje?'],
      },
      practico: {
        etiqueta: 'Práctico: análisis de casos',
        descripcion: 'Situaciones y casos breves en los que hay que reconocer y aplicar un concepto o un enfoque del programa. El caso se describe en 2 o 3 oraciones.',
        ejemplos: ['Un niño de 4 años insiste en que la luna lo sigue cuando camina. ¿Qué característica del pensamiento de esa etapa se observa?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con análisis de casos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA PSICOLOGÍA:
- Casos y situaciones cotidianas verosímiles.
- Distractores diagnósticos: confundir conceptos de enfoques distintos, atribuir a una etapa rasgos de otra, confundir la descripción con la explicación.
- No atribuyas citas textuales a autores reales.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  sociales: {
    id: 'sociales',
    nombre: 'Ciencias sociales y humanidades',
    ejemplosDeMaterias: ['Antropología Cultural', 'Sociología', 'Historia Argentina', 'Filosofía', 'Geografía Humana', 'Comunicación Social'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de ciencias sociales y humanidades.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y posturas',
        descripcion: 'Preguntas sobre conceptos, categorías de análisis, posturas y procesos.',
        ejemplos: ['¿Qué distingue al relativismo cultural del etnocentrismo?'],
      },
      practico: {
        etiqueta: 'Práctico: análisis de casos',
        descripcion: 'Análisis de situaciones y de fragmentos breves escritos por vos (nunca citas de autores reales), comparación de posturas y aplicación de categorías a un caso.',
        ejemplos: ['Un grupo de turistas califica de "atrasada" una celebración local porque no la entiende. ¿Qué categoría del programa describe esa mirada?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con análisis de casos y fragmentos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `${ESTRATEGIA_SOCIALES}
- No atribuyas citas textuales a autores reales: los fragmentos que uses los escribís vos y lo aclarás ("Un texto plantea que…").`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  educacion: {
    id: 'educacion',
    nombre: 'Educación y didácticas',
    ejemplosDeMaterias: ['Didáctica General', 'Matemática y su Didáctica', 'Pedagogía', 'Práctica Docente', 'Psicología Educacional'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de educación y didácticas específicas.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y enfoques',
        descripcion: 'Preguntas sobre conceptos de la didáctica y la pedagogía, enfoques de enseñanza y criterios de evaluación. En las unidades de contenido disciplinar, sobre ese contenido.',
        ejemplos: ['¿Qué se entiende por obstáculo epistemológico en la enseñanza?'],
      },
      practico: {
        etiqueta: 'Práctico: situaciones de aula',
        descripcion: 'Situaciones de aula, intervenciones docentes y análisis de producciones de alumnos escritas por vos. En las unidades de contenido disciplinar (números, geometría…), problemas de ese contenido.',
        ejemplos: ['Una alumna de 4.º grado escribe que 0,25 es mayor que 0,3 "porque 25 es más que 3". ¿Qué intervención le propondrías?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y situaciones',
        descripcion: 'Equilibrar preguntas conceptuales con situaciones de aula.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA DIDÁCTICA:
- Situaciones de aula verosímiles, con producciones de alumnos escritas por vos.
- Distractores diagnósticos: intervenciones que dan la respuesta en lugar de hacer pensar, confundir el error del alumno con un descuido, elegir una consigna que no evalúa lo que se quiere.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  derecho: {
    id: 'derecho',
    nombre: 'Derecho',
    ejemplosDeMaterias: ['Derecho Civil', 'Derecho Constitucional', 'Derecho Penal', 'Derecho Laboral'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de derecho argentino.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos e institutos',
        descripcion: 'Preguntas sobre conceptos, institutos jurídicos, principios y requisitos.',
        ejemplos: ['¿Qué requisitos tiene que cumplir un acto jurídico para ser válido?'],
      },
      practico: {
        etiqueta: 'Práctico: casos',
        descripcion: 'Casos breves: encuadre normativo, plazos, a quién corresponde, qué acción procede. No inventes números de artículos: nombrá el instituto.',
        ejemplos: ['Una persona compra un auto usado y a la semana descubre un defecto oculto que el vendedor conocía. ¿Qué instituto encuadra el caso?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y casos',
        descripcion: 'Equilibrar preguntas conceptuales con casos.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA DERECHO:
- Casos verosímiles de la vida cotidiana en Argentina.
- Distractores diagnósticos: confundir institutos parecidos (nulidad y anulabilidad, prescripción y caducidad), aplicar la regla general donde hay una excepción, equivocar quién es el legitimado.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  lengua: {
    id: 'lengua',
    nombre: 'Lengua, literatura e idiomas',
    ejemplosDeMaterias: ['Lengua y Literatura', 'Inglés', 'Literatura Argentina', 'Prácticas del Lenguaje'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de lengua, literatura e idiomas.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos',
        descripcion: 'Preguntas sobre conceptos de gramática, tipos de texto, géneros y recursos.',
        ejemplos: ['¿Qué función cumple un conector causal en un texto argumentativo?'],
      },
      practico: {
        etiqueta: 'Práctico: textos y uso',
        descripcion: 'Comprensión, gramática en uso y análisis de un texto breve escrito por vos (nunca citas de obras reales).',
        ejemplos: ['En la oración "Llegó tarde, sin embargo aprobó", ¿qué relación expresa "sin embargo"?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y textos',
        descripcion: 'Equilibrar preguntas conceptuales con comprensión y análisis de textos breves.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: ESTRATEGIA_LENGUA,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  artes: {
    id: 'artes',
    nombre: 'Artes, diseño y comunicación visual',
    ejemplosDeMaterias: ['Diseño Gráfico', 'Historia del Arte', 'Comunicación Visual', 'Lenguaje Musical'],
    caracter: 'conceptual',
    rolEspecialista: 'Sos especialista en evaluación de artes, diseño y comunicación visual.',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos y movimientos',
        descripcion: 'Preguntas sobre conceptos, elementos del lenguaje visual o musical y movimientos.',
        ejemplos: ['¿Qué genera el contraste de complementarios en una composición?'],
      },
      practico: {
        etiqueta: 'Práctico: análisis de decisiones',
        descripcion: 'Análisis de decisiones de diseño o de una obra descripta en el enunciado, y aplicación de conceptos a un encargo concreto.',
        ejemplos: ['Una marca de productos para chicos usa tipografía serif fina y colores apagados. ¿Qué cambio propondrías y por qué?'],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y análisis',
        descripcion: 'Equilibrar preguntas conceptuales con análisis de decisiones y obras.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_CONCEPTUAL,
    notacion: 'ninguna',
    estrategiaDistractores: `ESTRATEGIA ARTES Y DISEÑO:
- Encargos y obras descriptos con precisión en el enunciado.
- Distractores diagnósticos: confundir elementos del lenguaje visual, atribuir a un movimiento rasgos de otro, elegir un recurso que contradice el objetivo del encargo.`,
    validadores: VALIDADORES_CONCEPTUALES,
  },
  otra: {
    id: 'otra',
    nombre: 'Otra',
    ejemplosDeMaterias: [],
    caracter: 'mixto',
    rolEspecialista: '',
    modos: {
      teorico: {
        etiqueta: 'Teórico: conceptos',
        descripcion: 'Preguntas conceptuales sobre definiciones, ideas centrales y relaciones entre conceptos.',
        ejemplos: [],
      },
      practico: {
        etiqueta: 'Práctico: aplicación a situaciones',
        descripcion: 'Aplicación del contenido a situaciones concretas. Si el tema no tiene cálculo, no lo inventes.',
        ejemplos: [],
      },
      mixto: {
        etiqueta: 'Mixto: conceptos y aplicación',
        descripcion: 'Equilibrar preguntas conceptuales con aplicación del contenido a situaciones.',
        ejemplos: [],
      },
    },
    mezclaPorModo: MEZCLA_MIXTA,
    notacion: 'ninguna',
    estrategiaDistractores: ESTRATEGIA_GENERAL,
    validadores: [],
  },
}

export function esAreaId(valor: unknown): valor is AreaId {
  return typeof valor === 'string' && (AREA_IDS as readonly string[]).includes(valor)
}

export function esCaracter(valor: unknown): valor is Caracter {
  return typeof valor === 'string' && (CARACTERES as readonly string[]).includes(valor)
}

export function perfilDeArea(area: AreaId | null | undefined): PerfilDeArea {
  return PERFILES[area && esAreaId(area) ? area : 'otra']
}

/** El rol de especialista con el nombre de la materia, como `getSpecialistRole`. */
export function rolEspecialista(area: AreaId | null | undefined, materia: string): string {
  const perfil = perfilDeArea(area)
  if (!perfil.rolEspecialista) return `Sos especialista en evaluación universitaria de ${materia}.`
  return `${perfil.rolEspecialista} La materia es ${materia}.`
}

// ── Qué manda (A3) ─────────────────────────────────────────────────────────

/**
 * El carácter que vale para una unidad. Prioridad:
 *
 *   1. lo que el docente eligió a mano en esa unidad,
 *   2. el carácter que se detectó para la unidad al leer el programa,
 *   3. el carácter del perfil del área,
 *   4. lo genérico: 'mixto'.
 */
export function caracterEfectivo(fuentes: {
  manual?: unknown
  unidad?: unknown
  area?: AreaId | null
}): Caracter {
  if (esCaracter(fuentes.manual)) return fuentes.manual
  if (esCaracter(fuentes.unidad)) return fuentes.unidad
  if (fuentes.area && esAreaId(fuentes.area)) return PERFILES[fuentes.area].caracter
  return 'mixto'
}

// ── La mezcla ──────────────────────────────────────────────────────────────

/**
 * La mezcla de un cuestionario con temas de varias unidades: el carácter de
 * cada unidad pesa por la cantidad de temas elegidos de ella. Las mezclas se
 * normalizan antes de sumarse, para que una unidad no pese más por tener
 * números más grandes.
 *
 * Si todo es del mismo carácter que el área, la mezcla es la del área (las
 * áreas con mezcla propia, como informática, la conservan).
 */
export function mezclaPonderada(
  area: AreaId | null | undefined,
  modo: Modo,
  unidades: { caracter: Caracter; temas: number }[],
): QuestionTypeMix {
  const perfil = perfilDeArea(area)
  const validas = unidades.filter((u) => u.temas > 0)
  if (validas.length === 0 || validas.every((u) => u.caracter === perfil.caracter)) {
    return { ...perfil.mezclaPorModo[modo] }
  }

  const total = validas.reduce((s, u) => s + u.temas, 0)
  const suma: QuestionTypeMix = {}
  for (const unidad of validas) {
    const base = unidad.caracter === perfil.caracter ? perfil.mezclaPorModo[modo] : MEZCLA_POR_CARACTER[unidad.caracter][modo]
    const pesoBase = sumaDePesos(base)
    if (pesoBase <= 0) continue
    for (const [tipo, peso] of Object.entries(base) as [QuestionType, number][]) {
      suma[tipo] = (suma[tipo] ?? 0) + (peso / pesoBase) * (unidad.temas / total) * 100
    }
  }
  return redondearMezcla(suma)
}

function sumaDePesos(mezcla: QuestionTypeMix): number {
  return Object.values(mezcla).reduce((s, p) => s + (p ?? 0), 0)
}

function redondearMezcla(mezcla: QuestionTypeMix): QuestionTypeMix {
  const salida: QuestionTypeMix = {}
  for (const [tipo, peso] of Object.entries(mezcla) as [QuestionType, number][]) {
    const redondo = Math.round(peso * 10) / 10
    if (redondo > 0) salida[tipo] = redondo
  }
  return salida
}

/** El tope: con más de un tipo, ninguno pasa de la mitad. */
export const TOPE_POR_TIPO = 0.5

/**
 * Ningún tipo pasa del 50 % si hay más de uno con peso. Es la regla que evita
 * los 40 de 40 verdadero o falso. Lo que sobra se reparte entre los demás en
 * proporción a su peso (si a uno de ellos lo pasa del tope, se vuelve a
 * recortar). Con un solo tipo no hay nada que limitar.
 */
export function limitarMezcla(mezcla: QuestionTypeMix): QuestionTypeMix {
  const tipos = (Object.keys(mezcla) as QuestionType[]).filter((t) => (mezcla[t] ?? 0) > 0)
  if (tipos.length < 2) return { ...mezcla }

  const total = tipos.reduce((s, t) => s + (mezcla[t] ?? 0), 0)
  const pesos = new Map(tipos.map((t) => [t, (mezcla[t] ?? 0) / total]))
  const topados = new Set<QuestionType>()

  for (let vuelta = 0; vuelta < tipos.length; vuelta++) {
    const excedidos = tipos.filter((t) => !topados.has(t) && (pesos.get(t) ?? 0) > TOPE_POR_TIPO + 1e-9)
    if (excedidos.length === 0) break
    for (const t of excedidos) {
      topados.add(t)
      pesos.set(t, TOPE_POR_TIPO)
    }
    const libres = tipos.filter((t) => !topados.has(t))
    const restante = 1 - topados.size * TOPE_POR_TIPO
    const pesoLibre = libres.reduce((s, t) => s + (pesos.get(t) ?? 0), 0)
    for (const t of libres) {
      pesos.set(t, pesoLibre > 0 ? ((pesos.get(t) ?? 0) / pesoLibre) * restante : restante / libres.length)
    }
  }

  const salida: QuestionTypeMix = {}
  for (const t of tipos) salida[t] = Math.round((pesos.get(t) ?? 0) * 1000) / 10
  return salida
}

/**
 * El tope en cantidades: con `total` preguntas y más de un tipo, ninguno pasa
 * de la mitad redondeada para arriba (con 5 preguntas y dos tipos, 3 y 2: la
 * mitad exacta no existe).
 */
export function maximoPorTipo(total: number, tipos: number): number {
  if (tipos < 2) return total
  return Math.ceil(total * TOPE_POR_TIPO)
}

// ── Qué tipos se permiten ──────────────────────────────────────────────────

/**
 * `numeric` sólo si alguna unidad elegida es cuantitativa, o si el docente la
 * tildó a mano. El resto de los tipos pasa igual. Si al sacar `numeric` no
 * queda nada, se devuelve opción múltiple: un cuestionario sin tipos no se
 * puede generar.
 */
export function tiposPermitidos(
  tipos: readonly QuestionType[],
  caracteres: readonly Caracter[],
  tildadosAMano: readonly QuestionType[] = [],
): QuestionType[] {
  const hayCuantitativa = caracteres.includes('cuantitativo')
  const salida = tipos.filter((t) => t !== 'numeric' || hayCuantitativa || tildadosAMano.includes('numeric'))
  return salida.length > 0 ? salida : ['multiple_choice']
}

// ── La notación ────────────────────────────────────────────────────────────

export interface BloquesDeNotacion {
  /** El bloque de LaTeX y coma decimal de siempre. */
  latex: boolean
  /** LaTeX sólo para números y fórmulas simples (contabilidad, economía). */
  latexSoloNumeros: boolean
  /** Fórmulas químicas. */
  formulas: boolean
  /** Bloques de código. */
  codigo: boolean
}

/**
 * Qué bloques de notación van al prompt. El de LaTeX y coma decimal, sólo si
 * alguna unidad elegida es cuantitativa (y en las mixtas de un área con LaTeX,
 * como economía); el de código, sólo en informática.
 */
export function bloquesDeNotacion(area: AreaId | null | undefined, caracteres: readonly Caracter[]): BloquesDeNotacion {
  const perfil = perfilDeArea(area)
  const hayCuantitativa = caracteres.includes('cuantitativo')
  const hayMixta = caracteres.includes('mixto')
  const latexDelArea = perfil.notacion === 'latex' && (hayCuantitativa || hayMixta)
  const latex = hayCuantitativa || latexDelArea
  return {
    latex,
    latexSoloNumeros: latex && perfil.soloNumeros === true,
    formulas: perfil.notacion === 'formulas' && (hayCuantitativa || hayMixta),
    codigo: perfil.notacion === 'codigo',
  }
}

/** Los validadores que aplican a una unidad de ese carácter, en esa área. */
export function validadoresDe(area: AreaId | null | undefined, caracter: Caracter): Validador[] {
  if (caracter === 'conceptual') {
    const delArea = perfilDeArea(area).validadores.filter((v) => v === 'codigo')
    return ['sin_latex_ni_calculo', ...delArea]
  }
  if (caracter === 'cuantitativo') {
    const delArea = perfilDeArea(area).validadores.filter((v) => !VALIDADORES_CUANTITATIVOS.includes(v) && v !== 'sin_latex_ni_calculo')
    return [...VALIDADORES_CUANTITATIVOS, ...delArea]
  }
  return perfilDeArea(area).validadores.filter((v) => v !== 'sin_latex_ni_calculo')
}
