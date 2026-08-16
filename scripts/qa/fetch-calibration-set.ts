/**
 * Arma el set de calibración desde `quiz_answers` de staging.
 *
 * El set es el CONTRATO de la rúbrica, por eso el archivo que sale de acá se
 * commitea (`qa-fixtures/`) y los reportes no. Un cambio en la rúbrica que
 * empeora la detección tiene que verse en un diff, no en una corrida que nadie
 * miró.
 *
 * Los casos vienen del diagnóstico del 2026-08-10, la corrida de 31 alumnos de
 * Análisis de Sistemas documentada en docs/plan-prueba-de-fuego.md. Buena parte
 * de las respuestas de ese día fueron sobre cónicas, sucesiones, combinatoria y
 * probabilidad: los cuatro ejes de curriculum(Secundario, 4to Año, Matemática),
 * servidos a alumnos de una tecnicatura donde ninguno de esos temas existe.
 *
 * El total de ese día es 1.680 respuestas en 84 intentos, medido contra
 * producción el 16/08/2026 y consistente por dos caminos
 * (SUM(quiz_attempts.total_questions) y el conteo de filas de quiz_answers).
 * Este archivo decía 1.792 y "30 alumnos"; los dos números eran falsos.
 *
 * LIMITACIÓN QUE HAY QUE TENER PRESENTE: las 1.680 respuestas son TODAS de
 * Matemática. Sólo la persona de Superior tiene evidencia real. Las otras cuatro
 * arrancan con casos sintéticos, marcados `provenance: 'synthetic'`, que se
 * miden y se reportan pero no habilitan a ningún agente (ver evaluateGate).
 *
 * Sólo lee. Nunca escribe en la base.
 *
 * Uso:
 *   npx tsx scripts/qa/fetch-calibration-set.ts --env=staging
 *   npx tsx scripts/qa/fetch-calibration-set.ts --env-file=../../../.env.staging.local
 *
 * El segundo flag existe porque los .env viven en la raíz del repo y este
 * script se corre a veces desde un worktree, donde el path relativo que resuelve
 * scripts/lib/db-target.ts no encuentra el archivo.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as dotenv from 'dotenv'
import { resolveDbTarget, type Sql } from '../lib/db-target'
import type { CalibrationCase } from '../../lib/qa/calibration'
import type { Question, QuestionType } from '../../lib/types'

const FECHA_DIAGNOSTICO = '2026-08-10'
const FIXTURE_PATH = join(process.cwd(), 'qa-fixtures', `calibration-${FECHA_DIAGNOSTICO}.json`)

/**
 * Los casos reales, con su `quiz_answers.id` y el defecto que sabemos que tienen.
 *
 * `mustNotFlag` no es decorativo: verifiqué la matemática de las seis preguntas
 * de cónicas a mano y está bien (foco (0,3) con directriz y=-3 da x²=12y;
 * x²+y²-6x+8y-11=0 da radio 6; x²/25+y²/16=1 da eje mayor 10). El agente tiene
 * que marcar que están fuera de programa y NO inventar un error disciplinar
 * para justificar la mala nota. Sin esa exigencia, marcar todo `critical` sacaría
 * recall 1,0.
 */
const CASOS_REALES: {
  answerId: number
  persona: string
  expected: CalibrationCase['expected']
  mustNotFlag?: CalibrationCase['mustNotFlag']
  note: string
}[] = [
  {
    answerId: 291,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['correccion_disciplinar'],
    note: 'Parábola por foco y directriz. Cónicas no está en ninguna de las 7 unidades de la Tecnicatura. La ecuación marcada ($x^2 = 12y$) es correcta.',
  },
  {
    answerId: 312,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['correccion_disciplinar'],
    note: 'Forma general de la parábola con vértice en el origen. Fuera de programa. La opción marcada ($y^2 = 4px$) es correcta.',
  },
  {
    answerId: 339,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['correccion_disciplinar'],
    note: 'Parábola que abre hacia abajo. Fuera de programa. La opción marcada ($x^2 = -4py$) es correcta.',
  },
  {
    answerId: 303,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['correccion_disciplinar'],
    note: 'Radio de la circunferencia desde la ecuación general. Fuera de programa. El radio 6 es correcto.',
  },
  {
    answerId: 682,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'higiene_formato', minSeverity: 'critical' },
    note: '"Mencioná un ejemplo de número irracional" con las CUATRO respuestas aceptadas en LaTeX ($\\sqrt{2}$, $\\pi$, $e$, $\\sqrt{3}$). El alumno escribe "raiz de 2" o "pi" y da incorrecto. 14 de las 235 short_answer del 10/08 tienen este defecto.',
  },
  {
    answerId: 1524,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'higiene_formato', minSeverity: 'critical' },
    note: 'Sucesos independientes: correctAnswer 0,3 con tolerance NULL. Se compara por igualdad exacta de flotantes, así que es ingandable. 9 de las 255 numeric del 10/08 están así. (El tema además está fuera de programa: eso NO se declara acá para no atar dos defectos a un solo caso.)',
  },
  {
    answerId: 1502,
    persona: 'superior-matematica-sistemas',
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['higiene_formato'],
    note: 'Probabilidad condicionada — fuera del programa de la Tecnicatura. Sus acceptedAnswers SÍ traen variantes en texto plano ("P(A|B) = P(A y B) / P(B)"), así que el formato está bien: es el caso real que verifica que el lint no dispara de más.',
  },

  // ── control negativo cruzado ───────────────────────────────────────────────
  // Las MISMAS preguntas, bajo una persona de Secundario 4to Año, donde cónicas
  // sí está en el diseño curricular. Tienen que pasar limpias. Si el agente las
  // marca acá también, no está evaluando adecuación al programa: está
  // reaccionando a que la pregunta parece difícil.
  {
    answerId: 291,
    persona: 'control-secundario-matematica',
    expected: null,
    note: 'CONTROL: la misma pregunta de 291, en el programa donde cónicas SÍ corresponde.',
  },
  {
    answerId: 303,
    persona: 'control-secundario-matematica',
    expected: null,
    note: 'CONTROL: la misma pregunta de 303, en el programa donde cónicas SÍ corresponde.',
  },
  {
    answerId: 339,
    persona: 'control-secundario-matematica',
    expected: null,
    note: 'CONTROL: la misma pregunta de 339, en el programa donde cónicas SÍ corresponde.',
  },
]

interface AnswerRow {
  id: number
  question_id: string
  question_text: string
  question_type: QuestionType
  topic_name: string
  options: unknown
  correct_answer: number | null
  answer_payload: Record<string, unknown> | null
  explanation: string | null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Reconstruye la `Question` original a partir de la respuesta guardada.
 *
 * `quiz_answers` guarda la respuesta del alumno, no la pregunta, así que hay
 * que armar la pregunta de vuelta. La forma de `answer_payload` por tipo está
 * documentada en scripts/013-question-types.sql; las filas anteriores a esa
 * migración sólo tienen las columnas legacy y son multiple_choice por defecto.
 */
function rowToQuestion(row: AnswerRow): Question {
  const base = {
    id: row.question_id,
    topic: row.topic_name,
    topicName: row.topic_name,
    question: row.question_text,
    explanation: row.explanation ?? '',
  }

  const payload = row.answer_payload ?? {}

  switch (row.question_type) {
    case 'short_answer':
      return {
        ...base,
        type: 'short_answer',
        acceptedAnswers: asStringArray(payload.acceptedAnswers),
      }
    case 'true_false':
      return {
        ...base,
        type: 'true_false',
        correctAnswer: Boolean(payload.correctAnswer),
      }
    case 'numeric':
      return {
        ...base,
        type: 'numeric',
        correctAnswer: Number(payload.correctAnswer),
        tolerance: typeof payload.tolerance === 'number' ? payload.tolerance : undefined,
      }
    case 'multiple_choice':
    default:
      return {
        ...base,
        type: 'multiple_choice',
        // Las columnas legacy siguen siendo la fuente para multiple_choice; el
        // payload es el respaldo para filas escritas después de la 013.
        options: asStringArray(row.options).length > 0
          ? asStringArray(row.options)
          : asStringArray(payload.options),
        correctAnswer:
          typeof row.correct_answer === 'number'
            ? row.correct_answer
            : Number(payload.correctAnswer ?? 0),
      }
  }
}

async function loadRows(sql: Sql, ids: number[]): Promise<Map<number, AnswerRow>> {
  const rows = (await sql`
    SELECT qa.id, qa.question_id, qa.question_text, qa.question_type, qa.topic_name,
           qa.options, qa.correct_answer, qa.answer_payload, qa.explanation
    FROM quiz_answers qa
    JOIN quiz_attempts at ON at.id = qa.quiz_attempt_id
    WHERE qa.id = ANY(${ids})
      AND at.completed_at::date = ${FECHA_DIAGNOSTICO}::date
    ORDER BY qa.id
  `) as AnswerRow[]

  return new Map(rows.map((row) => [row.id, row]))
}

async function run() {
  const envFileFlag = process.argv.find((arg) => arg.startsWith('--env-file='))
  if (envFileFlag) {
    // Pre-carga explícita: resolveDbTarget lee process.env.DATABASE_URL primero
    // y sólo cae al archivo si no está, así que esto lo deja apuntado sin tocar
    // el guardarraíl compartido.
    dotenv.config({ path: envFileFlag.slice('--env-file='.length) })
  }

  const target = await resolveDbTarget({
    action: 'leer quiz_answers para armar el set de calibración de los agentes de contenido',
    destructive: false,
  })

  if (target.isRealProduction) {
    throw new Error(
      'Este script sólo corre contra staging. El marcador dice PRODUCCIÓN.\n' +
        '  Volvé a correr con --env=staging (o --env-file=<ruta a .env.staging.local>).'
    )
  }

  const ids = [...new Set(CASOS_REALES.map((caso) => caso.answerId))]
  const rows = await loadRows(target.sql, ids)

  const faltantes = ids.filter((id) => !rows.has(id))
  if (faltantes.length > 0) {
    throw new Error(
      `No se encontraron en ${FECHA_DIAGNOSTICO} las filas de quiz_answers: ${faltantes.join(', ')}.\n` +
        '  El set de calibración referencia filas concretas: si la branch de staging se refrescó,\n' +
        '  los ids cambiaron y hay que volver a elegirlos antes de confiar en el fixture.'
    )
  }

  const cases: CalibrationCase[] = CASOS_REALES.map((caso) => {
    const row = rows.get(caso.answerId) as AnswerRow
    return {
      id: `quiz_answers.${caso.answerId}@${caso.persona}`,
      provenance: 'real',
      persona: caso.persona,
      question: rowToQuestion(row),
      expected: caso.expected,
      ...(caso.mustNotFlag ? { mustNotFlag: caso.mustNotFlag } : {}),
      note: caso.note,
    }
  })

  const fixture = {
    generado: new Date().toISOString(),
    fechaDiagnostico: FECHA_DIAGNOSTICO,
    host: target.host,
    entorno: target.environment,
    /**
     * Sin user_id, sin nombres, sin emails: el set es el texto de las preguntas
     * y nada más. Staging ya está anonimizado, pero el fixture se commitea y no
     * hay razón para que lleve nada de eso.
     */
    nota:
      'Casos del diagnóstico del 2026-08-10. Sólo la persona de Superior tiene evidencia real: ' +
      'las 1.680 respuestas de ese día son todas de Matemática. Las otras cuatro personas ' +
      'necesitan casos sintéticos, que se miden pero no habilitan.',
    cases,
  }

  mkdirSync(dirname(FIXTURE_PATH), { recursive: true })
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')

  const porPersona = new Map<string, { malos: number; buenos: number }>()
  for (const caso of cases) {
    const entry = porPersona.get(caso.persona) ?? { malos: 0, buenos: 0 }
    if (caso.expected) entry.malos += 1
    else entry.buenos += 1
    porPersona.set(caso.persona, entry)
  }

  console.log(`\n✔ ${cases.length} casos reales escritos en ${FIXTURE_PATH}\n`)
  for (const [persona, entry] of porPersona) {
    console.log(`   ${persona.padEnd(34)} ${entry.malos} malo(s), ${entry.buenos} bueno(s)`)
  }
  console.log(
    '\n   Las personas de Primario, Historia y Lengua no tienen casos reales:\n' +
      '   todo el diagnóstico del 10/08 fue de Matemática. Sus casos sintéticos\n' +
      '   se agregan aparte y no habilitan a ningún agente.\n'
  )
}

run().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
