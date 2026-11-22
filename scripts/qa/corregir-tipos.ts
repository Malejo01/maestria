/**
 * N2: corrige en lote las preguntas guardadas cuyo tipo no encaja con la
 * consigna (las que lista `scripts/qa/tipos-incoherentes.ts`). Por cada una,
 * lo mismo que el botón "Corregir N preguntas" de *Mis tareas*: primero la
 * regla sin IA, después el modelo, verificado (sin marcas, mismo tema, mismo
 * valor de verdad).
 *
 * Uso:
 *   npx tsx scripts/qa/corregir-tipos.ts --env=staging --desde=2026-11-20
 *   npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20             (producción, dry-run: lo corre Mauro)
 *   npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20 --aplicar   (producción, escribe)
 *
 * POR DEFECTO ES --dry-run: imprime antes → después y no escribe nada (la IA
 * sí se llama, para mostrar la propuesta: ~US$0,001 por pregunta).
 *
 * Con --aplicar escribe lo mismo que el endpoint con el docente:
 *   - sin intentos: reemplaza las preguntas en el lugar;
 *   - con intentos: crea una COPIA con las preguntas corregidas y mueve las
 *     asignaciones a la copia (como el PATCH de *Revisar y editar*). Los
 *     intentos y las respuestas viejas quedan con el original, sin cambios.
 * Una propuesta rechazada (por ejemplo, la IA cambió el valor de verdad) deja
 * esa pregunta como estaba y se informa.
 *
 * Pasa por scripts/lib/db-target.ts: sin --env apunta a producción y pide el id
 * del proyecto; CONFIRM_PRODUCTION=<id> lo hace sin preguntar.
 *
 * La key de Gemini: la del entorno, o la de `.env.local` (lo mismo que hace
 * `npm run dev:staging`). Sólo se lee esa variable.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolveDbTarget, type Sql } from '../lib/db-target'
import { estimateCostUsd, type AiSdkUsage } from '../../lib/ai-usage'
import { AI_MODEL } from '../../lib/ai-model'
import { aplicables, aplicarPropuestas, type PropuestaDeCorreccion } from '../../lib/corregir-tipos'
import { generarConGemini, proponerCorrecciones } from '../../lib/corregir-tipos-server'
import { MOTIVO_DE_PROBLEMA } from '../../lib/validar-tipo-de-pregunta'
import type { Question } from '../../lib/types'
import { inferirArea } from '../../lib/inferir-area'

interface Fila {
  id: number
  user_id: string
  title: string
  questions: Question[]
  subject_name?: string | null
}

function cargarKeyDeGemini() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || !existsSync('.env.local')) return
  const linea = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('GOOGLE_GENERATIVE_AI_API_KEY='))
  if (linea) process.env.GOOGLE_GENERATIVE_AI_API_KEY = linea.slice(linea.indexOf('=') + 1).replace(/^["']|["']$/g, '')
}

const enUnaLinea = (texto: string) => texto.replace(/\s+/g, ' ').trim()

function describir(q: Question): string {
  const base = enUnaLinea(q.question)
  if (q.type === 'multiple_choice') return `${base}\n        opciones: ${q.options.map((o, i) => (i === q.correctAnswer ? `[${o}]` : o)).join(' | ')}`
  if (q.type === 'true_false') return `${base}  (${q.correctAnswer ? 'V' : 'F'})`
  if (q.type === 'short_answer') return `${base}\n        aceptadas: ${q.acceptedAnswers.join(' · ')}`
  return base
}

function imprimir(fila: Fila, propuestas: PropuestaDeCorreccion[]) {
  console.log(`\n■ Cuestionario ${fila.id} «${fila.title}»`)
  for (const p of propuestas) {
    console.log(`  Pregunta ${p.indice + 1} · ${MOTIVO_DE_PROBLEMA[p.problema]} · ${p.despues ? (p.via === 'regla' ? 'regla (sin IA)' : 'IA') : 'SIN CAMBIOS'}`)
    console.log(`    antes:   ${describir(p.antes)}`)
    if (p.despues) console.log(`    después: ${describir(p.despues)}`)
    else console.log(`    motivo:  ${p.motivo}`)
  }
}

/** Escribe como el PATCH: en el lugar, o copia + asignaciones si ya hay intentos. */
async function guardar(sql: Sql, fila: Fila, preguntas: Question[]): Promise<string> {
  const intentos = (await sql`
    SELECT COUNT(att.id)::int AS n
    FROM classroom_assignments a
    JOIN quiz_attempts att ON att.assignment_id = a.id
    WHERE a.teacher_quiz_id = ${fila.id}
  `) as { n: number }[]
  if (Number(intentos[0]?.n ?? 0) === 0) {
    await sql`
      UPDATE teacher_quizzes
      SET questions = ${JSON.stringify(preguntas)}, question_count = ${preguntas.length}, updated_at = NOW()
      WHERE id = ${fila.id}
    `
    return 'guardado en el lugar (sin intentos)'
  }
  const copia = (await sql`
    INSERT INTO teacher_quizzes (
      user_id, teacher_program_id, title, subject_name, mode, status,
      selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
    )
    SELECT user_id, teacher_program_id, title, subject_name, mode, status,
           selected_topics, ${preguntas.length}, ${JSON.stringify(preguntas)}, pedagogy_context, NOW(), NOW()
    FROM teacher_quizzes WHERE id = ${fila.id}
    RETURNING id
  `) as { id: number }[]
  const copiaId = Number(copia[0].id)
  const movidas = (await sql`
    UPDATE classroom_assignments SET teacher_quiz_id = ${copiaId}, updated_at = NOW()
    WHERE teacher_quiz_id = ${fila.id}
    RETURNING id
  `) as { id: number }[]
  // L1: la copia de un cuestionario de diagnóstico sigue siendo del diagnóstico (sin la 027, nada que heredar).
  try {
    const tipo = (await sql`
      UPDATE teacher_quizzes c SET tipo = o.tipo, diagnostico_id = o.diagnostico_id, unidad_id = o.unidad_id
      FROM teacher_quizzes o WHERE c.id = ${copiaId} AND o.id = ${fila.id}
      RETURNING c.diagnostico_id
    `) as { diagnostico_id: number | null }[]
    if (tipo[0]?.diagnostico_id !== null && tipo[0]?.diagnostico_id !== undefined) {
      await sql`UPDATE teacher_quizzes SET diagnostico_id = NULL WHERE id = ${fila.id}`
      await sql`UPDATE diagnostico_resultados_impresos SET teacher_quiz_id = ${copiaId} WHERE teacher_quiz_id = ${fila.id}`
    }
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code !== '42703' && code !== '42P01') throw error
  }
  return `ya tenía intentos: copia ${copiaId}, ${movidas.length} asignación(es) movidas`
}

async function run() {
  const aplicar = process.argv.includes('--aplicar')
  const desde = process.argv.find((a) => a.startsWith('--desde='))?.slice('--desde='.length) ?? null
  const target = await resolveDbTarget({
    action: aplicar
      ? 'corregir en lote las preguntas cuyo tipo no encaja (ESCRIBE: --aplicar)'
      : 'propuestas de corrección de tipos de pregunta (dry-run, no escribe)',
    destructive: aplicar,
  })
  cargarKeyDeGemini()

  const filas = (await target.sql`
    SELECT id, user_id, title, questions, subject_name FROM teacher_quizzes
    WHERE ${desde}::date IS NULL OR created_at >= ${desde}::date
    ORDER BY id
  `) as Fila[]

  const usos: (AiSdkUsage | undefined)[] = []
  let marcadas = 0
  let corregibles = 0
  let rechazadas = 0
  console.log(`Base: ${target.environment} (${target.host})${desde ? ` · desde ${desde}` : ''} · ${aplicar ? 'APLICAR' : 'dry-run'}`)

  for (const fila of filas) {
    const preguntas = Array.isArray(fila.questions) ? fila.questions : []
    // Ronda T · A4: el área se infiere del nombre de la materia (sin leer el programa).
    const area = inferirArea(String(fila.subject_name ?? '')).area
    const propuestas = await proponerCorrecciones(preguntas, generarConGemini, (u) => usos.push(u), area)
    if (propuestas.length === 0) continue
    marcadas += propuestas.length
    corregibles += aplicables(propuestas).length
    rechazadas += propuestas.length - aplicables(propuestas).length
    imprimir(fila, propuestas)
    if (aplicar && aplicables(propuestas).length > 0) {
      const todas = new Set(aplicables(propuestas).map((p) => p.indice))
      console.log(`  → ${await guardar(target.sql, fila, aplicarPropuestas(preguntas, propuestas, todas))}`)
    }
  }

  const entrada = usos.reduce((n, u) => n + (u?.inputTokens ?? 0), 0)
  const salida = usos.reduce((n, u) => n + (u?.outputTokens ?? 0), 0)
  console.log(`\nCuestionarios: ${filas.length} · marcadas: ${marcadas} · con corrección: ${corregibles} · sin corrección: ${rechazadas}`)
  console.log(`IA: ${usos.length} llamadas · ${entrada} tokens de entrada, ${salida} de salida · ~US$${estimateCostUsd(AI_MODEL, entrada, salida).toFixed(4)}`)
  if (!aplicar && corregibles > 0) console.log('Dry-run: no se escribió nada. Para guardar, el mismo comando con --aplicar.')
}

run().catch((error) => {
  console.error('❌', error)
  process.exit(1)
})
