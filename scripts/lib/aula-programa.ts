import type { Sql } from './db-target'
import { generateJoinCode } from '../../lib/classrooms'
import { slugifySubject } from '../../lib/subject-slug'
import type { PedagogyProfile, ProgramUnit, SubjectColorName, SubjectIconName } from '../../lib/types'

/**
 * Crear un programa + su aula desde un script, con el resultado indistinguible
 * de haberlo hecho desde la UI (wizard → POST /api/teacher/programs, después
 * "Crear aula" → POST /api/teacher/classrooms).
 *
 * Por qué el SQL está replicado y no importado: `upsertTeacherSubject`
 * (lib/subjects.ts) y `createUniqueJoinCode` (lib/classrooms-server.ts) usan el
 * cliente `sql` de la app, atado a DATABASE_URL, y un script tiene que hablar
 * con el target que eligió db-target. Es la misma razón que ya documenta
 * scripts/inscribir-diagnostico-2026-08-10.ts. Lo que sí se reusa es lo puro:
 * `generateJoinCode` y `slugifySubject`.
 *
 * Que la réplica no se desvíe de las rutas lo fija
 * scripts/lib/aula-programa.test.ts, que compara las columnas de cada INSERT
 * contra el texto de la ruta. Si alguien agrega una columna en la ruta, falla.
 *
 * Todas las funciones reciben `sql` para poder testearlas con un doble.
 */

export interface ProgramaSpec {
  materia: string
  nivel: 'Primario' | 'Secundario' | 'Superior'
  grado: string
  jurisdiccion: string
  icono: SubjectIconName
  color: SubjectColorName
  unidades: ProgramUnit[]
  nombreAula: string
}

export interface Docente {
  id: string
  role: string
}

export interface ProgramaExistente {
  id: number
}

export interface AulaExistente {
  id: number
  teacher_program_id: number
  name: string
  join_code: string
}

/** Lo que hay hoy en la base. Sale sólo de SELECTs: es todo lo que hace el dry-run. */
export interface Relevamiento {
  docente: Docente
  programa: ProgramaExistente | null
  aula: AulaExistente | null
}

/** Qué creó esta corrida. Es exactamente lo que `--revert` deshace. */
export interface BackupAula {
  generado: string
  host: string
  materia: string
  programa_creado: number | null
  subject_slug_creado: string | null
  aula_creada: number | null
  codigo_aula: string | null
}

export async function buscarDocente(sql: Sql, email: string): Promise<Docente | null> {
  const filas = (await sql`
    SELECT id, COALESCE(role, 'ALUMNO') AS role FROM users WHERE email = ${email} LIMIT 1
  `) as Docente[]
  return filas[0] ?? null
}

/**
 * Busca por (docente, materia, nivel, grado) y no por id: correr el script dos
 * veces no puede dejar dos programas. Sólo `active`, igual que las rutas.
 */
export async function buscarPrograma(
  sql: Sql,
  docenteId: string,
  spec: ProgramaSpec,
): Promise<ProgramaExistente | null> {
  const filas = (await sql`
    SELECT id
    FROM teacher_programs
    WHERE user_id = ${docenteId}
      AND subject_name = ${spec.materia}
      AND nivel = ${spec.nivel} AND grado = ${spec.grado}
      AND status = 'active'
    ORDER BY id
    LIMIT 1
  `) as { id: number }[]
  return filas[0] ? { id: Number(filas[0].id) } : null
}

/** El aula se identifica por (docente, nombre): es lo que el docente ve en su panel. */
export async function buscarAula(sql: Sql, docenteId: string, nombre: string): Promise<AulaExistente | null> {
  const filas = (await sql`
    SELECT id, teacher_program_id, name, join_code
    FROM classrooms
    WHERE teacher_id = ${docenteId} AND name = ${nombre}
    ORDER BY id
    LIMIT 1
  `) as AulaExistente[]
  return filas[0] ? { ...filas[0], id: Number(filas[0].id), teacher_program_id: Number(filas[0].teacher_program_id) } : null
}

export async function relevar(sql: Sql, email: string, spec: ProgramaSpec): Promise<Relevamiento> {
  const docente = await buscarDocente(sql, email)
  if (!docente) throw new Error(`No existe ningún usuario con email ${email}.`)

  const programa = await buscarPrograma(sql, docente.id, spec)
  const aula = await buscarAula(sql, docente.id, spec.nombreAula)
  return { docente, programa, aula }
}

/**
 * Mismo INSERT que POST /api/teacher/programs, columna por columna. Los tres
 * `source_*` van en NULL porque no hubo archivo subido, y `source_expires_at`
 * lleva el mismo NOW() + 24 h que la ruta pone siempre (hoy nadie lo lee, pero
 * la fila tiene que ser la misma). `created_from = 'manual'`: es lo que el
 * wizard manda cuando ningún tema sale de `curriculum`.
 */
export async function insertarPrograma(
  sql: Sql,
  docenteId: string,
  spec: ProgramaSpec,
  perfil: PedagogyProfile,
): Promise<number> {
  const filas = (await sql`
    INSERT INTO teacher_programs (
      user_id,
      subject_name,
      icon_name,
      color_name,
      pedagogy_profile,
      units,
      source_file_name,
      source_mime_type,
      source_file_size_bytes,
      source_expires_at,
      nivel,
      grado,
      jurisdiccion,
      created_from,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${docenteId},
      ${spec.materia},
      ${spec.icono},
      ${spec.color},
      ${JSON.stringify(perfil)},
      ${JSON.stringify(spec.unidades)},
      ${null},
      ${null},
      ${null},
      NOW() + INTERVAL '24 hours',
      ${spec.nivel},
      ${spec.grado},
      ${spec.jurisdiccion},
      ${'manual'},
      'active',
      NOW(),
      NOW()
    )
    RETURNING id
  `) as { id: number }[]
  return Number(filas[0].id)
}

/** Mismo upsert que `upsertTeacherSubject` (lib/subjects.ts). Devuelve el slug. */
export async function registrarMateria(sql: Sql, programaId: number, spec: ProgramaSpec): Promise<string> {
  const slug = `teacher-${programaId}-${slugifySubject(spec.materia)}`
  await sql`
    INSERT INTO subjects (slug, display_name, source, icon_name, color_name, nivel, teacher_program_id)
    VALUES (${slug}, ${spec.materia}, 'teacher', ${spec.icono}, ${spec.color}, ${spec.nivel}, ${programaId})
    ON CONFLICT (slug) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      icon_name = EXCLUDED.icon_name,
      color_name = EXCLUDED.color_name,
      nivel = COALESCE(EXCLUDED.nivel, subjects.nivel),
      updated_at = NOW()
  `
  return slug
}

/** Mismo sondeo-y-reintento que `createUniqueJoinCode`. */
export async function generarCodigoUnico(sql: Sql, intentos = 8): Promise<string> {
  for (let intento = 0; intento < intentos; intento += 1) {
    const candidato = generateJoinCode()
    const existentes = await sql`SELECT 1 FROM classrooms WHERE join_code = ${candidato} LIMIT 1`
    if (existentes.length === 0) return candidato
  }
  throw new Error('No se pudo generar un código de aula único')
}

/** Mismo INSERT que POST /api/teacher/classrooms. */
export async function insertarAula(
  sql: Sql,
  docenteId: string,
  programaId: number,
  nombre: string,
): Promise<{ id: number; join_code: string }> {
  const codigo = await generarCodigoUnico(sql)
  const filas = (await sql`
    INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status, created_at, updated_at)
    VALUES (${docenteId}, ${programaId}, ${nombre}, ${codigo}, 'open', NOW(), NOW())
    RETURNING id, join_code
  `) as { id: number; join_code: string }[]
  return { id: Number(filas[0].id), join_code: filas[0].join_code }
}

/**
 * Crea lo que falte. `persistir` se llama después de cada escritura, no sólo al
 * final: si el proceso muere en la mitad, el backup ya describe lo que alcanzó
 * a crearse y `--revert` lo puede deshacer.
 */
export async function aplicar(
  sql: Sql,
  spec: ProgramaSpec,
  perfil: PedagogyProfile,
  estado: Relevamiento,
  backup: BackupAula,
  persistir: (backup: BackupAula) => void,
): Promise<{ programaId: number; aulaId: number; codigo: string }> {
  let programaId = estado.programa?.id ?? null

  if (programaId === null) {
    if (!perfil.methodology.trim()) {
      throw new Error('Hace falta la metodología para crear el programa.')
    }
    programaId = await insertarPrograma(sql, estado.docente.id, spec, perfil)
    backup.programa_creado = programaId
    persistir(backup)

    backup.subject_slug_creado = await registrarMateria(sql, programaId, spec)
    persistir(backup)
  }

  if (estado.aula) {
    return { programaId, aulaId: estado.aula.id, codigo: estado.aula.join_code }
  }

  const aula = await insertarAula(sql, estado.docente.id, programaId, spec.nombreAula)
  backup.aula_creada = aula.id
  backup.codigo_aula = aula.join_code
  persistir(backup)

  return { programaId, aulaId: aula.id, codigo: aula.join_code }
}

/** Uso real que tendría el revert que llevarse puesto. */
export interface UsoAula {
  miembros: number
  asignaciones: number
  intentos: number
  cuestionarios: number
}

/**
 * Todas las FK que cuelgan de `classrooms` y `teacher_programs` son ON DELETE
 * CASCADE (migraciones 003 y 015): borrar el aula se lleva las membresías y las
 * asignaciones, y borrar el programa se lleva los cuestionarios del docente.
 * Los intentos quedan pero pierden el `classroom_id`. Sin este conteo, un
 * revert corrido una semana después borraría en silencio a los alumnos.
 */
export async function medirUso(sql: Sql, backup: BackupAula): Promise<UsoAula> {
  const aulaId = backup.aula_creada
  const programaId = backup.programa_creado
  const filas = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM classroom_members     WHERE classroom_id = ${aulaId})        AS miembros,
      (SELECT COUNT(*)::int FROM classroom_assignments WHERE classroom_id = ${aulaId})        AS asignaciones,
      (SELECT COUNT(*)::int FROM quiz_attempts         WHERE classroom_id = ${aulaId})        AS intentos,
      (SELECT COUNT(*)::int FROM teacher_quizzes       WHERE teacher_program_id = ${programaId}) AS cuestionarios
  `) as UsoAula[]
  return filas[0]
}

export function tieneUso(uso: UsoAula): boolean {
  return uso.miembros + uso.asignaciones + uso.intentos + uso.cuestionarios > 0
}

/**
 * Deshace exactamente lo que el backup dice que se creó, en orden inverso.
 * Lo que la corrida reutilizó (programa o aula preexistentes) no está en el
 * backup y no se toca.
 */
export async function revertir(
  sql: Sql,
  backup: BackupAula,
  opciones: { forzar?: boolean; log?: (linea: string) => void } = {},
): Promise<void> {
  const log = opciones.log ?? (() => {})

  const uso = await medirUso(sql, backup)
  if (tieneUso(uso) && !opciones.forzar) {
    throw new Error(
      `El aula/programa ya tiene uso: ${uso.miembros} miembro(s), ${uso.asignaciones} asignación(es), ` +
        `${uso.intentos} intento(s), ${uso.cuestionarios} cuestionario(s).\n` +
        '   Revertir los borraría en cascada. Si es eso lo que querés, agregá --forzar.',
    )
  }

  if (backup.aula_creada !== null) {
    await sql`DELETE FROM classrooms WHERE id = ${backup.aula_creada}`
    log(`  ← aula ${backup.aula_creada} borrada`)
  }

  if (backup.subject_slug_creado !== null) {
    await sql`DELETE FROM subjects WHERE slug = ${backup.subject_slug_creado}`
    log(`  ← materia ${backup.subject_slug_creado} borrada del índice`)
  }

  if (backup.programa_creado !== null) {
    await sql`DELETE FROM teacher_programs WHERE id = ${backup.programa_creado}`
    log(`  ← programa ${backup.programa_creado} borrado`)
  }
}
