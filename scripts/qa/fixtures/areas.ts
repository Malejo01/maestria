/**
 * Ronda T · A5 — Programas de prueba para medir la generación por área.
 *
 * Escritos para esta medición: NO son los programas reales de ningún docente
 * (en particular, no es el archivo de Silvana). Cada uno tiene las unidades y
 * los temas típicos de una materia de esa área en un instituto o una
 * universidad de Argentina, y `temas` elige 4 de dos unidades distintas.
 *
 * Sin dependencias: este archivo se copia tal cual a otra rama para medir el
 * "antes" (ver scripts/qa/medir-areas.ts).
 */
export type TipoDePregunta = 'multiple_choice' | 'true_false' | 'short_answer' | 'numeric'

export interface ProgramaDePrueba {
  id: string
  materia: string
  carrera: string
  grado: string
  unidades: { name: string; topics: { id: string; name: string }[] }[]
  temas: string[]
  tipos: TipoDePregunta[]
}

const CONCEPTUALES: TipoDePregunta[] = ['multiple_choice', 'true_false', 'short_answer']
const CON_NUMERICA: TipoDePregunta[] = ['multiple_choice', 'true_false', 'short_answer', 'numeric']

function u(n: number, name: string, temas: string[]) {
  return { name, topics: temas.map((t, i) => ({ id: `u${n}-t${i + 1}`, name: t })) }
}

export const PROGRAMAS: ProgramaDePrueba[] = [
  {
    id: 'antropologia',
    materia: 'Temas de Antropología Cultural en Psicología',
    carrera: 'Licenciatura en Psicología',
    grado: '1er Año',
    unidades: [
      u(1, 'Unidad 1: La antropología como disciplina', ['Objeto y método de la antropología', 'Trabajo de campo y observación participante']),
      u(2, 'Unidad 2: Cultura y diversidad', ['El concepto de cultura', 'Etnocentrismo y relativismo cultural', 'Identidad y alteridad']),
      u(3, 'Unidad 3: Parentesco y rituales', ['Familia y parentesco', 'Ritos de paso']),
    ],
    temas: ['El concepto de cultura', 'Etnocentrismo y relativismo cultural', 'Familia y parentesco', 'Ritos de paso'],
    tipos: CONCEPTUALES,
  },
  {
    id: 'microeconomia',
    materia: 'Microeconomía',
    carrera: 'Licenciatura en Economía',
    grado: '2do Año',
    unidades: [
      u(1, 'Unidad 1: Oferta y demanda', ['Determinantes de la demanda', 'Equilibrio de mercado', 'Elasticidad precio de la demanda']),
      u(2, 'Unidad 2: Teoría del consumidor', ['Preferencias y utilidad', 'Restricción presupuestaria']),
      u(3, 'Unidad 3: Estructuras de mercado', ['Competencia perfecta', 'Monopolio']),
    ],
    temas: ['Equilibrio de mercado', 'Elasticidad precio de la demanda', 'Competencia perfecta', 'Monopolio'],
    tipos: CON_NUMERICA,
  },
  {
    id: 'marketing',
    materia: 'Marketing I',
    carrera: 'Licenciatura en Administración',
    grado: '2do Año',
    unidades: [
      u(1, 'Unidad 1: El marketing en la organización', ['Concepto de marketing', 'Análisis FODA']),
      u(2, 'Unidad 2: Mercado y segmentación', ['Segmentación de mercados', 'Posicionamiento']),
      u(3, 'Unidad 3: Mezcla de marketing', ['Producto y precio', 'Plaza y promoción']),
    ],
    temas: ['Análisis FODA', 'Segmentación de mercados', 'Producto y precio', 'Plaza y promoción'],
    tipos: CONCEPTUALES,
  },
  {
    id: 'contabilidad',
    materia: 'Contabilidad Básica',
    carrera: 'Tecnicatura en Administración Contable',
    grado: '1er Año',
    unidades: [
      u(1, 'Unidad 1: El patrimonio', ['Activo, pasivo y patrimonio neto', 'La ecuación contable']),
      u(2, 'Unidad 2: Registración', ['Cuentas y plan de cuentas', 'Asientos contables', 'Libro diario y mayor']),
      u(3, 'Unidad 3: Operaciones habituales', ['Compras y ventas de mercadería', 'Cobros y pagos']),
    ],
    temas: ['La ecuación contable', 'Asientos contables', 'Compras y ventas de mercadería', 'Cobros y pagos'],
    tipos: CON_NUMERICA,
  },
  {
    id: 'enfermeria',
    materia: 'Enfermería Comunitaria',
    carrera: 'Tecnicatura Superior en Enfermería',
    grado: '2do Año',
    unidades: [
      u(1, 'Unidad 1: Salud comunitaria', ['Atención primaria de la salud', 'Promoción y prevención']),
      u(2, 'Unidad 2: Visita domiciliaria', ['Valoración familiar', 'Plan de cuidados en el domicilio']),
      u(3, 'Unidad 3: Programas de salud', ['Inmunizaciones', 'Control de niño sano']),
    ],
    temas: ['Atención primaria de la salud', 'Valoración familiar', 'Plan de cuidados en el domicilio', 'Inmunizaciones'],
    tipos: CONCEPTUALES,
  },
  {
    id: 'derecho-civil',
    materia: 'Derecho Civil I',
    carrera: 'Abogacía',
    grado: '2do Año',
    unidades: [
      u(1, 'Unidad 1: La persona humana', ['Capacidad de derecho y de ejercicio', 'Atributos de la persona']),
      u(2, 'Unidad 2: Hechos y actos jurídicos', ['Elementos del acto jurídico', 'Vicios de la voluntad', 'Nulidad']),
      u(3, 'Unidad 3: Prescripción', ['Prescripción liberatoria', 'Plazos de prescripción']),
    ],
    temas: ['Capacidad de derecho y de ejercicio', 'Vicios de la voluntad', 'Nulidad', 'Prescripción liberatoria'],
    tipos: CONCEPTUALES,
  },
  {
    id: 'matematica-i',
    materia: 'Matemática I',
    carrera: 'Tecnicatura Superior en Análisis de Sistemas',
    grado: '1er Año',
    unidades: [
      u(1, 'Unidad 1: Números reales', ['Operaciones con fracciones', 'Potencias y raíces']),
      u(2, 'Unidad 2: Ecuaciones', ['Ecuaciones lineales', 'Ecuaciones cuadráticas']),
      u(3, 'Unidad 3: Funciones', ['Función lineal', 'Función cuadrática']),
    ],
    temas: ['Operaciones con fracciones', 'Ecuaciones lineales', 'Ecuaciones cuadráticas', 'Función lineal'],
    tipos: CON_NUMERICA,
  },
  {
    id: 'matematica-didactica',
    materia: 'Matemática y su Didáctica',
    carrera: 'Profesorado de Educación Primaria',
    grado: '1er Año',
    unidades: [
      u(1, 'Unidad 1: Números naturales y sistema de numeración', ['Valor posicional', 'Divisibilidad: múltiplos y divisores']),
      u(2, 'Unidad 2: El campo de la didáctica de la matemática', ['Transposición didáctica', 'El error como oportunidad de aprendizaje', 'Obstáculos en el aprendizaje']),
      u(3, 'Unidad 3: Números racionales', ['Fracciones equivalentes', 'Expresiones decimales']),
    ],
    temas: ['Divisibilidad: múltiplos y divisores', 'Transposición didáctica', 'El error como oportunidad de aprendizaje', 'Fracciones equivalentes'],
    tipos: CON_NUMERICA,
  },
]
