/**
 * Siembra tres alumnos de ejemplo con actividad en la base de STAGING, para
 * poder mirar Mis alumnos y la ficha con algo adentro.
 *
 *   npx tsx scripts/seed-staging-alumnos.ts --env=staging
 *
 * Son los alumnos de la referencia de diseño (Sofía Ramírez, Tomás Villa,
 * Julieta Ocampo): nombres de ejemplo, no personas reales. Se suman al grupo
 * de la primera materia del docente con más materias, con intentos repartidos
 * en los temas de esa materia y un error recurrente cada uno.
 *
 * SE NIEGA A CORRER fuera de staging: no pide confirmación para producción,
 * directamente corta. Es idempotente: borra a sus tres usuarios (los ids
 * empiezan con `stg-demo-`) y los vuelve a crear.
 */
import { resolveDbTarget } from './lib/db-target'

const DIA = 86_400_000

interface Demo {
  id: string
  nombre: string
  contexto: string
  /** Con cuenta (se puede entrar como ella desde /sign-in/dev) o invitada sin cuenta. */
  conCuenta?: boolean
  /** Por tema (índice en el temario): [correctas, total, hace cuántos días]. */
  intentos: [tema: number, correctas: number, total: number, haceDias: number][]
  error: { tema: number; texto: string }
}

const DEMOS: Demo[] = [
  {
    id: 'stg-demo-sofia',
    nombre: 'Sofía Ramírez',
    conCuenta: true,
    contexto: 'Rinde el 12/12',
    intentos: [
      [0, 9, 10, 9],
      [0, 8, 10, 4],
      [1, 3, 10, 6],
      [1, 4, 10, 2],
    ],
    error: { tema: 1, texto: 'Aplica el procedimiento de memoria y no revisa si el resultado tiene sentido.' },
  },
  {
    id: 'stg-demo-tomas',
    nombre: 'Tomás Villa',
    contexto: 'Ingreso · marzo',
    intentos: [
      [0, 8, 10, 3],
      [2, 9, 10, 1],
    ],
    error: { tema: 2, texto: 'Se apura en el último paso y pierde un signo.' },
  },
  {
    id: 'stg-demo-julieta',
    nombre: 'Julieta Ocampo',
    contexto: '5.º año',
    intentos: [
      [1, 2, 10, 12],
      [1, 3, 10, 6],
      [2, 2, 4, 6],
    ],
    error: { tema: 1, texto: 'Confunde las dos magnitudes del problema y plantea la relación al revés.' },
  },
]

async function run() {
  const { sql, environment } = await resolveDbTarget({ action: 'sembrar alumnos de ejemplo' })
  if (environment !== 'staging') {
    console.error(`✖ Esto sólo corre en staging. La base dice ser "${environment}". No hago nada.`)
    process.exit(1)
  }

  const docentes = await sql.query(`
    SELECT p.user_id, p.id AS programa_id, p.subject_name, p.units
    FROM teacher_programs p
    WHERE p.status = 'active'
      AND p.user_id = (
        SELECT user_id FROM teacher_programs WHERE status = 'active'
        GROUP BY user_id ORDER BY COUNT(*) DESC, user_id LIMIT 1
      )
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT 1
  `)
  const programa = docentes[0]
  if (!programa) throw new Error('No hay ningún docente con materias en staging.')

  const temas: string[] = (Array.isArray(programa.units) ? programa.units : [])
    .flatMap((unidad: { topics?: { name?: string }[] }) => unidad.topics ?? [])
    .map((tema: { name?: string }) => String(tema.name ?? ''))
    .filter(Boolean)
  if (temas.length < 3) throw new Error(`La materia "${programa.subject_name}" tiene menos de 3 temas.`)

  let grupos = await sql.query(
    `SELECT id FROM classrooms WHERE teacher_id = $1 AND teacher_program_id = $2 AND status = 'open' ORDER BY id LIMIT 1`,
    [programa.user_id, programa.programa_id],
  )
  if (grupos.length === 0) {
    grupos = await sql.query(
      `INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [programa.user_id, programa.programa_id, programa.subject_name, 'DEMQ' + Math.floor(10 + Math.random() * 89)],
    )
  }
  const grupoId = grupos[0].id

  for (const demo of DEMOS) {
    await sql.query(`DELETE FROM users WHERE id = $1`, [demo.id])
    await sql.query(
      `INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
       VALUES ($1, $2, $3, 'ALUMNO', true, $4, NOW(), NOW())`,
      // El dominio @staging.invalid es el que exige el guardarraíl de staging.
      [demo.id, demo.conCuenta ? `${demo.id}@staging.invalid` : null, demo.nombre, !demo.conCuenta],
    )
    await sql.query(
      `INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, contexto)
       VALUES ($1, $2, $3, false, 'active', $4)`,
      [grupoId, demo.id, demo.nombre, demo.contexto],
    )

    for (const [tema, correctas, total, haceDias] of demo.intentos) {
      await sql.query(
        `INSERT INTO quiz_attempts
           (user_id, subject, mode, topics, total_questions, correct_answers, incorrect_answers,
            score, passed, completed_at, classroom_id)
         VALUES ($1, $2, 'practico', $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          demo.id,
          programa.subject_name,
          [temas[tema]],
          total,
          correctas,
          total - correctas,
          (correctas / total) * 10,
          correctas / total >= 0.6,
          new Date(Date.now() - haceDias * DIA).toISOString(),
          grupoId,
        ],
      )
    }

    await sql.query(
      `INSERT INTO student_misconceptions (user_id, subject, topic_id, topic_name, misconception_type, tip)
       VALUES ($1, $2, $3, $4, 'ejemplo', $5)`,
      [demo.id, programa.subject_name, temas[demo.error.tema], temas[demo.error.tema], demo.error.texto],
    )
  }

  // Una cuenta recién creada, sin rol: para mirar la bienvenida y el
  // onboarding del alumno entrando por /sign-in/dev.
  await sql.query(`DELETE FROM users WHERE id = 'stg-demo-nueva'`)
  await sql.query(
    `INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
     VALUES ('stg-demo-nueva', 'stg-demo-nueva@staging.invalid', 'Cuenta Nueva', NULL, false, false, NOW(), NOW())`,
  )

  console.log(`✔ ${DEMOS.length} alumnos de ejemplo en el grupo ${grupoId} de "${programa.subject_name}" (docente ${programa.user_id}).`)
}

run().catch((error) => {
  console.error('✖', error instanceof Error ? error.message : error)
  process.exit(1)
})
