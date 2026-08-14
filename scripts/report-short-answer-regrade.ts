/**
 * Reporte de SÓLO LECTURA: qué respuestas cortas ya guardadas cambiarían de
 * veredicto si la corrección determinista (`gradeShortAnswerLocally`) hubiera
 * existido cuando se rindieron.
 *
 * No escribe nada. Por eso pasa `destructive: false` a `resolveDbTarget`, que
 * es lo que le saca la confirmación de producción: no hay nada que confirmar
 * cuando el script sólo hace SELECT.
 *
 * Sirve para dos cosas a la vez, y la segunda es la que importa más:
 *
 *  1. Listar qué alumnos respondieron bien y quedaron marcados mal.
 *  2. **Validar los módulos contra datos reales antes de enchufarlos.** Un
 *     falso positivo acá es un falso positivo en producción: si el reporte
 *     resuelve alguna respuesta que NO corresponde, los módulos no están listos.
 *     Por eso imprime también la muestra de las que deja sin resolver — un
 *     reporte que sólo muestra sus aciertos no valida nada.
 *
 * Uso:
 *   npx tsx scripts/report-short-answer-regrade.ts
 *   npx tsx scripts/report-short-answer-regrade.ts --fecha=2026-08-10
 *   npx tsx scripts/report-short-answer-regrade.ts --sin-resolver=40
 */
import { resolveDbTarget } from './lib/db-target'
import { gradeShortAnswerLocally } from '../lib/short-answer-autograde'

interface Row {
  id: number
  attempt_id: number
  student_name: string | null
  student_id: string
  is_guest: boolean
  question_text: string
  selected_text: string | null
  accepted_answers: unknown
  is_correct: boolean
  created_at: Date | null
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

/** Las `acceptedAnswers` salen de un LLM: pueden venir con cualquier forma. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function run() {
  const { sql, environment, host } = await resolveDbTarget({
    action: 'reporte de recalificación de respuestas cortas (sólo lectura)',
    destructive: false,
  })

  const fecha = readFlag('fecha')
  const sinResolverLimite = Number.parseInt(readFlag('sin-resolver') ?? '25', 10)

  console.log(`\n→ Leyendo de ${environment} · ${host}${fecha ? ` · sólo ${fecha}` : ' · todas las fechas'}\n`)

  const rows = (await sql`
    SELECT
      qa.id,
      qa.quiz_attempt_id           AS attempt_id,
      u.name                       AS student_name,
      u.id                         AS student_id,
      COALESCE(u.is_guest, false)  AS is_guest,
      qa.question_text,
      qa.answer_payload->>'selectedText'    AS selected_text,
      qa.answer_payload->'acceptedAnswers'  AS accepted_answers,
      qa.is_correct,
      qa.created_at
    FROM quiz_answers qa
    JOIN quiz_attempts at ON at.id = qa.quiz_attempt_id
    LEFT JOIN users u ON u.id = at.user_id
    WHERE qa.question_type = 'short_answer'
      AND (${fecha}::date IS NULL OR qa.created_at::date = ${fecha}::date)
    ORDER BY qa.created_at, qa.id
  `) as unknown as Row[]

  const recuperables: (Row & { via: string })[] = []
  const sinResolver: Row[] = []
  let yaCorrectas = 0
  let resueltasQueYaEstabanBien = 0

  for (const row of rows) {
    const grade = gradeShortAnswerLocally(row.selected_text ?? '', toStringArray(row.accepted_answers))

    if (row.is_correct) {
      yaCorrectas += 1
      // Control de coherencia: de las que la IA dio por buenas, ¿cuántas habría
      // resuelto el determinista? Alto es señal de que el módulo está alineado
      // con el criterio humano, no de que sea laxo.
      if (grade.resolved) resueltasQueYaEstabanBien += 1
      continue
    }

    if (grade.resolved) recuperables.push({ ...row, via: grade.via })
    else sinResolver.push(row)
  }

  const incorrectas = rows.length - yaCorrectas

  console.log('═'.repeat(78))
  console.log(`  TOTAL respuestas cortas            ${rows.length}`)
  console.log(`  Ya marcadas correctas             ${yaCorrectas}  (el determinista habría resuelto ${resueltasQueYaEstabanBien})`)
  console.log(`  Marcadas incorrectas              ${incorrectas}`)
  console.log(`    ├─ RECUPERABLES                 ${recuperables.length}`)
  console.log(`    │    por texto                  ${recuperables.filter((r) => r.via === 'text').length}`)
  console.log(`    │    por equivalencia numérica  ${recuperables.filter((r) => r.via === 'numeric').length}`)
  console.log(`    └─ sin resolver (van a la IA)   ${sinResolver.length}`)
  console.log('═'.repeat(78))

  console.log(`\n▼ RECUPERABLES — respondieron bien y quedaron mal (${recuperables.length})\n`)
  for (const row of recuperables) {
    const quien = row.is_guest ? `${row.student_name ?? 'Invitado'} (invitado)` : (row.student_name ?? row.student_id)
    console.log(`  [${row.via.toUpperCase().padEnd(7)}] ${quien}`)
    console.log(`      escribió : "${truncate(row.selected_text ?? '', 60)}"`)
    console.log(`      aceptadas: ${JSON.stringify(toStringArray(row.accepted_answers))}`)
    console.log(`      pregunta : ${truncate(row.question_text, 70)}`)
    console.log(`      fila     : quiz_answers.id=${row.id} · intento=${row.attempt_id}\n`)
  }

  // La otra mitad de la validación: si acá aparece algo que evidentemente
  // debería haberse resuelto, falta una regla. Si aparece algo que NO debería
  // resolverse nunca, el módulo está bien y este es su trabajo.
  console.log(`\n▼ MUESTRA DE NO RESUELTAS — deberían ir a la IA (${Math.min(sinResolverLimite, sinResolver.length)} de ${sinResolver.length})\n`)
  for (const row of sinResolver.slice(0, sinResolverLimite)) {
    console.log(`  "${truncate(row.selected_text ?? '', 45)}"  ↔  ${JSON.stringify(toStringArray(row.accepted_answers)).slice(0, 90)}`)
  }

  console.log('\nNada fue modificado: este script sólo hace SELECT.\n')
}

run().catch((err) => {
  console.error('❌ Error en el reporte:', err)
  process.exit(1)
})
