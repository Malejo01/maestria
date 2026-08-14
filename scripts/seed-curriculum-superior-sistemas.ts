import { resolveDbTarget, type Sql } from './lib/db-target'
import { DEFAULT_JURISDICTION } from '../lib/curriculum-config'

/**
 * Programa oficial de Matemática de la Tecnicatura Superior en Análisis de
 * Sistemas — cátedra de la Prof. Mgtr. Ing. Cinthia Flores, instituto de nivel
 * terciario, régimen cuatrimestral, 6 horas semanales, año lectivo 2026.
 * Fuente: Programa_de_Matemática_2026.docx.
 *
 * Se carga en `curriculum` (no en `teacher_programs`) para que cualquier alumno
 * de nivel Superior lo elija desde /practicar sin depender de un aula.
 *
 * Cada unidad del programa es una fila = un `eje`, y su aplicación profesional
 * viaja en `contexto_profesional` (migración 022). Eso último no es metadata
 * decorativa: es lo que hace que la generación produzca "modelá el crecimiento
 * de usuarios de una app" en vez de "hallá el dominio de f(x)".
 *
 * Idempotente vía la constraint `curriculum_fila_unica`: volver a correrlo
 * actualiza temas y contexto en vez de duplicar.
 *
 * Uso:
 *   npx tsx scripts/seed-curriculum-superior-sistemas.ts --env=staging
 *   npx tsx scripts/seed-curriculum-superior-sistemas.ts            # producción
 */

// Asignado al inicio de seed(), una vez que el guardrail confirmó el destino.
let sql!: Sql

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
  },
]

async function seed() {
  ;({ sql } = await resolveDbTarget({
    action: `seed del currículum Superior (${CARRERA})`,
  }))

  const jurisdiccion = DEFAULT_JURISDICTION
  console.log(`\nCargando ${UNIDADES.length} unidades de ${MATERIA} · ${CARRERA} · ${GRADO}\n`)

  let insertadas = 0
  let actualizadas = 0

  for (const unidad of UNIDADES) {
    // ON CONFLICT nombrando la constraint en vez de inferirla por columnas:
    // `curriculum_fila_unica` es UNIQUE NULLS NOT DISTINCT y la inferencia por
    // lista de columnas es más frágil de leer que el nombre explícito.
    const rows = (await sql`
      INSERT INTO curriculum (jurisdiccion, nivel, carrera, materia, grado, eje, temas, contexto_profesional)
      VALUES (
        ${jurisdiccion},
        'Superior',
        ${CARRERA},
        ${MATERIA},
        ${GRADO},
        ${unidad.eje},
        ${JSON.stringify(unidad.temas)}::jsonb,
        ${JSON.stringify(unidad.contextoProfesional)}::jsonb
      )
      ON CONFLICT ON CONSTRAINT curriculum_fila_unica DO UPDATE
        SET temas                = EXCLUDED.temas,
            contexto_profesional = EXCLUDED.contexto_profesional,
            updated_at           = NOW()
      RETURNING (xmax = 0) AS insertada
    `) as { insertada: boolean }[]

    if (rows[0]?.insertada) {
      insertadas += 1
      console.log(`  + ${unidad.eje}  (${unidad.temas.length} temas)`)
    } else {
      actualizadas += 1
      console.log(`  ~ ${unidad.eje}  (${unidad.temas.length} temas, actualizada)`)
    }
  }

  console.log(`\n✅ Listo.`)
  console.log(`   Insertadas  : ${insertadas}`)
  console.log(`   Actualizadas: ${actualizadas}`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeder falló:', err)
    process.exit(1)
  })
