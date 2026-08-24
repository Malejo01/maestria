import { resolveDbTarget, type Sql } from './lib/db-target'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Borra un aula de prueba que quedó colgada en "Mis aulas".
 *
 * Por qué borrar y no archivar. `classrooms.status` sólo admite 'open' y
 * 'closed' (migración 015), y `closed` NO es "archivada": ni
 * GET /api/teacher/classrooms filtra por status ni la grilla de
 * components/teacher-classrooms.tsx la esconde — le pone un badge "Cerrada" y
 * la sigue mostrando. Cerrar apaga el aula; sacarla de la vista es otra cosa y
 * hoy sólo la hace el DELETE.
 *
 * Qué se lleva puesto el DELETE, por las FK de la migración 015:
 *   classroom_members        ON DELETE CASCADE  -> se borran
 *   classroom_assignments    ON DELETE CASCADE  -> se borran
 *   quiz_attempts.classroom_id / .assignment_id ON DELETE SET NULL
 *     -> los intentos SOBREVIVEN, con esas dos columnas en NULL. El alumno no
 *        pierde su historial; lo que se pierde es el vínculo con el aula, o sea
 *        el reporte docente por aula, que agrupa por classroom_id.
 *
 * El programa (`teacher_programs`) y su fila en `subjects` NO se tocan: el aula
 * cuelga del programa, no al revés.
 *
 * Por defecto se niega a borrar un aula con intentos o con asignaciones: eso ya
 * no es "residual de mis pruebas", y perder el vínculo sería una decisión y no
 * una limpieza. `--force` la habilita, a propósito con nombre feo.
 *
 * Uso:
 *   npx tsx scripts/borrar-aula-residual.ts --aula=1
 *   npx tsx scripts/borrar-aula-residual.ts --aula=1 --apply
 *   npx tsx scripts/borrar-aula-residual.ts --revert=scripts/backups/aula-1-....json
 */

const BACKUP_DIR = join(process.cwd(), 'scripts', 'backups')

let sql!: Sql

interface AulaRow {
  id: number
  teacher_id: string
  teacher_program_id: number
  name: string
  join_code: string
  status: string
  created_at: string
  subject_name: string
  nivel: string | null
  grado: string | null
}

interface MiembroRow {
  id: number
  user_id: string
  display_name: string
  is_verified: boolean
  status: string
  joined_at: string
}

interface AsignacionRow {
  id: number
  teacher_quiz_id: number
  opens_at: string | null
  due_at: string | null
  max_attempts: number | null
  created_at: string
}

/** Todo lo necesario para reconstruir el aula tal como estaba. */
interface BackupFile {
  generado: string
  host: string
  aula: AulaRow
  miembros: MiembroRow[]
  asignaciones: AsignacionRow[]
  /** Intentos que quedarían con classroom_id/assignment_id en NULL. */
  intentos_desvinculados: { id: number; user_id: string; assignment_id: number | null }[]
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

async function cargarAula(aulaId: number): Promise<AulaRow | null> {
  const filas = (await sql`
    SELECT c.id, c.teacher_id, c.teacher_program_id, c.name, c.join_code, c.status, c.created_at,
           p.subject_name, p.nivel, p.grado
    FROM classrooms c
    JOIN teacher_programs p ON p.id = c.teacher_program_id
    WHERE c.id = ${aulaId}
    LIMIT 1
  `) as AulaRow[]

  return filas[0] ?? null
}

async function revertir(archivo: string): Promise<void> {
  const backup = JSON.parse(readFileSync(archivo, 'utf8')) as BackupFile
  console.log(`\nRestaurando el aula ${backup.aula.id} desde ${archivo}`)
  console.log(`  (generado el ${backup.generado} contra ${backup.host})\n`)

  // Se reinserta con el id original para que los intentos puedan volver a
  // apuntarle. La columna es SERIAL, así que un id explícito se acepta — pero
  // la secuencia queda atrás, y por eso se la reajusta con setval.
  await sql`
    INSERT INTO classrooms (id, teacher_id, teacher_program_id, name, join_code, status, created_at, updated_at)
    VALUES (${backup.aula.id}, ${backup.aula.teacher_id}, ${backup.aula.teacher_program_id},
            ${backup.aula.name}, ${backup.aula.join_code}, ${backup.aula.status},
            ${backup.aula.created_at}, NOW())
  `
  await sql`SELECT setval('classrooms_id_seq', (SELECT MAX(id) FROM classrooms))`
  console.log(`  -> aula ${backup.aula.id} restaurada ("${backup.aula.name}", código ${backup.aula.join_code})`)

  for (const miembro of backup.miembros) {
    await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      VALUES (${backup.aula.id}, ${miembro.user_id}, ${miembro.display_name},
              ${miembro.is_verified}, ${miembro.status}, ${miembro.joined_at}, NOW())
      ON CONFLICT (classroom_id, user_id) DO NOTHING
    `
  }
  console.log(`  -> ${backup.miembros.length} membresía(s) restaurada(s)`)

  // Las asignaciones se restauran con id original por la misma razón que el
  // aula: quiz_attempts.assignment_id las referencia.
  for (const asignacion of backup.asignaciones) {
    await sql`
      INSERT INTO classroom_assignments (id, classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at, updated_at)
      VALUES (${asignacion.id}, ${backup.aula.id}, ${asignacion.teacher_quiz_id},
              ${asignacion.opens_at}, ${asignacion.due_at}, ${asignacion.max_attempts},
              ${asignacion.created_at}, NOW())
      ON CONFLICT (id) DO NOTHING
    `
  }
  if (backup.asignaciones.length > 0) {
    await sql`SELECT setval('classroom_assignments_id_seq', (SELECT MAX(id) FROM classroom_assignments))`
    console.log(`  -> ${backup.asignaciones.length} asignación(es) restaurada(s)`)
  }

  for (const intento of backup.intentos_desvinculados) {
    await sql`
      UPDATE quiz_attempts
         SET classroom_id = ${backup.aula.id}, assignment_id = ${intento.assignment_id}
       WHERE id = ${intento.id}
    `
  }
  if (backup.intentos_desvinculados.length > 0) {
    console.log(`  -> ${backup.intentos_desvinculados.length} intento(s) revinculado(s)`)
  }

  console.log('\nRevertido.')
}

async function run() {
  const revertFile = readFlag('revert')
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  const aulaId = Number(readFlag('aula'))

  const target = await resolveDbTarget({
    action: revertFile ? 'restaurar un aula borrada' : `borrar el aula ${aulaId}`,
    destructive: apply || Boolean(revertFile),
  })
  sql = target.sql

  if (revertFile) {
    await revertir(revertFile)
    return
  }

  if (!Number.isInteger(aulaId) || aulaId <= 0) {
    throw new Error('Falta --aula=<id>.')
  }

  const aula = await cargarAula(aulaId)
  if (!aula) throw new Error(`No existe el aula ${aulaId}.`)

  const miembros = (await sql`
    SELECT m.id, m.user_id, m.display_name, m.is_verified, m.status, m.joined_at
    FROM classroom_members m WHERE m.classroom_id = ${aulaId} ORDER BY m.id
  `) as MiembroRow[]

  const asignaciones = (await sql`
    SELECT id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at
    FROM classroom_assignments WHERE classroom_id = ${aulaId} ORDER BY id
  `) as AsignacionRow[]

  const intentos = (await sql`
    SELECT id, user_id, assignment_id FROM quiz_attempts WHERE classroom_id = ${aulaId} ORDER BY id
  `) as { id: number; user_id: string; assignment_id: number | null }[]

  console.log('\n====== QUÉ SE VA A BORRAR ======\n')
  console.log(`  Aula        : ${aula.id} · "${aula.name}" · código ${aula.join_code} · status ${aula.status}`)
  console.log(`  Programa    : ${aula.teacher_program_id} · ${aula.subject_name} · ${aula.nivel} ${aula.grado ?? ''}  (NO se toca)`)
  console.log(`  Creada      : ${aula.created_at}`)
  console.log('')
  console.log(`  classroom_members     : ${miembros.length} fila(s) — se BORRAN (cascade)`)
  for (const m of miembros) {
    console.log(`      · ${m.display_name} (${m.user_id}) · ${m.status}${m.is_verified ? ' · verificado' : ''}`)
  }
  console.log(`  classroom_assignments : ${asignaciones.length} fila(s) — se BORRAN (cascade)`)
  console.log(`  quiz_attempts         : ${intentos.length} intento(s) — SOBREVIVEN, con classroom_id y assignment_id a NULL`)
  for (const i of intentos) {
    console.log(`      · intento ${i.id} de ${i.user_id}`)
  }

  const peligroso = intentos.length > 0 || asignaciones.length > 0
  if (peligroso) {
    console.log('\n  OJO: esta aula tiene intentos o asignaciones. Borrarla rompe el reporte')
    console.log('       docente por aula para esos intentos (agrupa por classroom_id).')
    if (!force) console.log('       Hace falta --force además de --apply.')
  }

  if (!apply) {
    console.log('\n  DRY-RUN — no se modificó nada.')
    console.log(
      `  Para aplicarlo: npx tsx scripts/borrar-aula-residual.ts --aula=${aulaId} --apply${peligroso ? ' --force' : ''}\n`,
    )
    return
  }

  if (peligroso && !force) {
    throw new Error('El aula tiene intentos o asignaciones. Volvé a correr con --force si es lo que querés.')
  }

  const backup: BackupFile = {
    generado: new Date().toISOString(),
    host: target.host,
    aula,
    miembros,
    asignaciones,
    intentos_desvinculados: intentos,
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ruta = join(BACKUP_DIR, `aula-${aulaId}-${Date.now()}.json`)
  writeFileSync(ruta, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\nBackup: ${ruta}`)

  const borradas = await sql`DELETE FROM classrooms WHERE id = ${aulaId} RETURNING id`
  if (borradas.length === 0) throw new Error('El DELETE no borró nada (¿corrida concurrente?).')

  console.log(`Aula ${aulaId} borrada.`)
  console.log(`\n  Para revertir:`)
  console.log(`    npx tsx scripts/borrar-aula-residual.ts --revert=${ruta}\n`)
}

run().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
