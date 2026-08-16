import { resolveDbTarget, type Sql } from './lib/db-target'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateJoinCode } from '../lib/classrooms'

/**
 * Inscribe a los alumnos del diagnóstico del 2026-08-10 en el aula de
 * Matemática de la Tecnicatura Superior en Análisis de Sistemas, creando de
 * paso el programa y el aula si no existen.
 *
 * Contexto — por qué el script hace tres cosas y no una:
 *
 * El pedido original era sólo inscribir. Al mirar producción resultó que el
 * docente no tiene ningún programa ni aula de Análisis de Sistemas: sus tres
 * programas son Lengua/Primario, Ciencias Naturales/Primario y
 * Matemática/Secundario 3er Año, y su única aula cuelga del último. Inscribir
 * a los 31 ahí les serviría contenido de Secundario 3er Año — el mismo error
 * del 10/08 con otra cara, porque el contenido del aula sale del programa del
 * aula. Así que el aula hay que crearla, y para crearla hace falta el programa.
 *
 * Dónde vive la carrera: `teacher_programs` no tiene columna `carrera` (la
 * migración 022 la agregó sólo a `curriculum`). No hace falta: el prompt la lee
 * de `pedagogy_profile.degree`, que es el campo que `pedagogyProfileToContext`
 * emite como "Carrera: ...". Ese es el lugar canónico para Superior.
 *
 * Las unidades se copian de las 7 filas de `curriculum` de la carrera. Se
 * copian y no se referencian porque `teacher_programs.units` es un snapshot:
 * así funciona el resto del producto, y así el programa no cambia bajo los pies
 * del docente si alguien edita el currículum oficial.
 *
 * `--metodologia` es obligatorio a propósito. El wizard blanquea las
 * metodologías autocompletadas (ver AUTOFILLED_METHODOLOGIES en
 * components/teacher-subject-wizard.tsx) justamente para que ese texto lo
 * escriba una persona: va derecho al prompt de generación. Un default inventado
 * acá sería exactamente lo que ese mecanismo existe para evitar.
 *
 * Uso:
 *   npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=mail@ejemplo.com
 *   npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=... --metodologia="..." --apply
 *   npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --revert=<archivo.json>
 */

const FECHA_DIAGNOSTICO = '2026-08-10'
const CARRERA = 'Tecnicatura Superior en Análisis de Sistemas'
const NIVEL = 'Superior'
const GRADO = '1er Año'
const MATERIA = 'Matemática'
const JURISDICCION = 'Salta'
const NOMBRE_AULA = 'Matemática — 1er Año Análisis de Sistemas'
const BACKUP_DIR = join(process.cwd(), 'scripts', 'backups')

let sql!: Sql

interface CurriculumRow {
  id: number
  eje: string
  temas: string[]
}

interface AlumnoRow {
  id: string
  nombre: string | null
  es_invitado: boolean
  intentos: number
  ya_miembro: boolean
  estado_actual: string | null
}

/** Qué creó esta corrida. Es exactamente lo que `--revert` deshace. */
interface BackupFile {
  generado: string
  host: string
  fecha_diagnostico: string
  programa_creado: number | null
  aula_creada: number | null
  subject_slug_creado: string | null
  membresias_creadas: { classroom_id: number; user_id: string }[]
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

function slugifySubject(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Las 7 unidades del programa, tal como las guardaría el wizard: una unidad por
 * fila de `curriculum`, un topic por tema, marcados `origin: 'curriculum'` con
 * su `sourceEje` para que la UI pueda mostrar la procedencia.
 */
function construirUnidades(filas: CurriculumRow[]) {
  return filas.map((fila, indice) => ({
    id: `tp-u-${indice + 1}`,
    name: fila.eje,
    topics: (fila.temas ?? []).map((tema, temaIndice) => ({
      id: `tp-u-${indice + 1}-t-${temaIndice + 1}`,
      name: tema,
      origin: 'curriculum' as const,
      sourceEje: fila.eje,
    })),
  }))
}

async function cargarCurriculum(): Promise<CurriculumRow[]> {
  const filas = (await sql`
    SELECT id, eje, temas
    FROM curriculum
    WHERE carrera = ${CARRERA} AND nivel = ${NIVEL} AND grado = ${GRADO} AND materia = ${MATERIA}
    ORDER BY id
  `) as CurriculumRow[]

  if (filas.length === 0) {
    throw new Error(
      `No hay filas de curriculum para "${CARRERA}".\n` +
        '   Corré primero: npx tsx scripts/seed-curriculum-superior-sistemas.ts',
    )
  }

  return filas
}

async function resolverDocente(email: string): Promise<{ id: string; role: string }> {
  const filas = (await sql`
    SELECT id, role FROM users WHERE email = ${email} LIMIT 1
  `) as { id: string; role: string }[]

  const docente = filas[0]
  if (!docente) throw new Error(`No existe ningún usuario con email ${email}.`)
  if (docente.role !== 'DOCENTE') {
    throw new Error(`El usuario ${email} tiene role "${docente.role}", no DOCENTE.`)
  }

  return docente
}

/**
 * Busca el programa por (docente, nivel, grado, materia) y no por nombre: el
 * nombre es editable desde la UI y no sirve como clave. Si ya existe, se
 * reutiliza — correr el script dos veces no puede dejar dos programas.
 */
async function buscarPrograma(docenteId: string): Promise<{ id: number; subject_name: string } | null> {
  const filas = (await sql`
    SELECT id, subject_name
    FROM teacher_programs
    WHERE user_id = ${docenteId}
      AND nivel = ${NIVEL} AND grado = ${GRADO}
      AND subject_name = ${MATERIA}
      AND status = 'active'
    ORDER BY id
    LIMIT 1
  `) as { id: number; subject_name: string }[]

  return filas[0] ?? null
}

async function buscarAula(programaId: number): Promise<{ id: number; name: string; join_code: string } | null> {
  const filas = (await sql`
    SELECT id, name, join_code FROM classrooms WHERE teacher_program_id = ${programaId} ORDER BY id LIMIT 1
  `) as { id: number; name: string; join_code: string }[]

  return filas[0] ?? null
}

/**
 * Los alcanzados: quienes tienen un intento del día del diagnóstico. Igual que
 * en fix-perfiles-diagnostico, se identifica por el intento y no por el perfil
 * actual, así la segunda corrida los sigue encontrando.
 */
async function cargarAlumnos(aulaId: number | null): Promise<AlumnoRow[]> {
  return (await sql`
    SELECT u.id,
           u.name                                     AS nombre,
           COALESCE(u.is_guest, false)                AS es_invitado,
           COUNT(DISTINCT at.id)::int                 AS intentos,
           (m.id IS NOT NULL)                         AS ya_miembro,
           m.status                                   AS estado_actual
    FROM users u
    JOIN quiz_attempts at ON at.user_id = u.id
    LEFT JOIN classroom_members m
      ON m.user_id = u.id AND m.classroom_id = ${aulaId}
    WHERE at.completed_at::date = ${FECHA_DIAGNOSTICO}::date
    GROUP BY u.id, u.name, u.is_guest, m.id, m.status
    ORDER BY u.id
  `) as AlumnoRow[]
}

async function crearPrograma(docenteId: string, metodologia: string, unidades: unknown[]): Promise<number> {
  // `degree` es donde vive la carrera para Superior; el resto de los campos
  // pedagógicos replican lo que el wizard derivaría de nivel/grado.
  const perfil = {
    level: NIVEL,
    degree: CARRERA,
    academicYear: GRADO,
    complexity: 'Intermedia',
    assessmentStyle: 'mixto',
    methodology: metodologia,
  }

  const filas = (await sql`
    INSERT INTO teacher_programs (
      user_id, subject_name, icon_name, color_name, pedagogy_profile, units,
      nivel, grado, jurisdiccion, created_from, status, created_at, updated_at
    )
    VALUES (
      ${docenteId}, ${MATERIA}, 'book-open', 'teal',
      ${JSON.stringify(perfil)}, ${JSON.stringify(unidades)},
      ${NIVEL}, ${GRADO}, ${JURISDICCION}, 'curriculum', 'active', NOW(), NOW()
    )
    RETURNING id
  `) as { id: number }[]

  return Number(filas[0].id)
}

/**
 * Mismo upsert que hace POST /api/teacher/programs. Sin esto el programa existe
 * pero la materia no aparece en el índice de `subjects`.
 */
async function registrarMateria(programaId: number): Promise<string> {
  const slug = `teacher-${programaId}-${slugifySubject(MATERIA)}`

  await sql`
    INSERT INTO subjects (slug, display_name, source, icon_name, color_name, nivel, teacher_program_id)
    VALUES (${slug}, ${MATERIA}, 'teacher', 'book-open', 'teal', ${NIVEL}, ${programaId})
    ON CONFLICT (slug) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      icon_name    = EXCLUDED.icon_name,
      color_name   = EXCLUDED.color_name,
      nivel        = COALESCE(EXCLUDED.nivel, subjects.nivel),
      updated_at   = NOW()
  `

  return slug
}

async function crearAula(docenteId: string, programaId: number): Promise<{ id: number; join_code: string }> {
  // Mismo probe-y-reintento que createUniqueJoinCode, replicado acá porque
  // lib/classrooms-server.ts importa el cliente `sql` de la app y este script
  // tiene que hablar con el target que eligió db-target.
  let codigo = ''
  for (let intento = 0; intento < 8; intento += 1) {
    const candidato = generateJoinCode()
    const existentes = await sql`SELECT 1 FROM classrooms WHERE join_code = ${candidato} LIMIT 1`
    if (existentes.length === 0) {
      codigo = candidato
      break
    }
  }
  if (!codigo) throw new Error('No se pudo generar un código de aula único')

  const filas = (await sql`
    INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status, created_at, updated_at)
    VALUES (${docenteId}, ${programaId}, ${NOMBRE_AULA}, ${codigo}, 'open', NOW(), NOW())
    RETURNING id, join_code
  `) as { id: number; join_code: string }[]

  return filas[0]
}

function mostrarAlumnos(alumnos: AlumnoRow[]): void {
  console.log('\n  id                                     intentos  invitado  estado en el aula')
  console.log('  ' + '─'.repeat(78))
  for (const alumno of alumnos) {
    const estado = alumno.ya_miembro ? `ya es miembro (${alumno.estado_actual})` : '—'
    console.log(
      `  ${alumno.id.padEnd(38)} ${String(alumno.intentos).padStart(4)}      ` +
        `${(alumno.es_invitado ? 'sí' : 'no').padEnd(9)} ${estado}`,
    )
  }
  console.log('  ' + '─'.repeat(78))
}

async function revertir(archivo: string): Promise<void> {
  const backup = JSON.parse(readFileSync(archivo, 'utf8')) as BackupFile
  console.log(`\nRevirtiendo desde ${archivo}`)
  console.log(`  (generado el ${backup.generado} contra ${backup.host})\n`)

  // Orden inverso al de creación: primero las membresías, después el aula,
  // después el programa. Al revés chocaría contra las foreign keys.
  for (const membresia of backup.membresias_creadas) {
    await sql`
      DELETE FROM classroom_members
       WHERE classroom_id = ${membresia.classroom_id} AND user_id = ${membresia.user_id}
    `
  }
  console.log(`  ← ${backup.membresias_creadas.length} membresía(s) borrada(s)`)

  if (backup.aula_creada !== null) {
    await sql`DELETE FROM classrooms WHERE id = ${backup.aula_creada}`
    console.log(`  ← aula ${backup.aula_creada} borrada`)
  }

  if (backup.subject_slug_creado !== null) {
    await sql`DELETE FROM subjects WHERE slug = ${backup.subject_slug_creado}`
    console.log(`  ← materia ${backup.subject_slug_creado} borrada del índice`)
  }

  if (backup.programa_creado !== null) {
    await sql`DELETE FROM teacher_programs WHERE id = ${backup.programa_creado}`
    console.log(`  ← programa ${backup.programa_creado} borrado`)
  }

  console.log('\n✔ Revertido.')
}

async function run() {
  const revertFile = readFlag('revert')
  const apply = process.argv.includes('--apply')
  const email = readFlag('docente')
  const metodologia = (readFlag('metodologia') ?? '').trim()

  const target = await resolveDbTarget({
    action: revertFile
      ? 'revertir el aula y las inscripciones del diagnóstico 2026-08-10'
      : 'crear el aula e inscribir a los alumnos del diagnóstico 2026-08-10',
    destructive: apply || Boolean(revertFile),
  })
  sql = target.sql

  if (revertFile) {
    await revertir(revertFile)
    return
  }

  if (!email) {
    throw new Error('Falta --docente=<email>. Es el dueño del programa y del aula.')
  }

  const docente = await resolverDocente(email)
  const filasCurriculum = await cargarCurriculum()
  const unidades = construirUnidades(filasCurriculum)

  let programa = await buscarPrograma(docente.id)
  let aula = programa ? await buscarAula(programa.id) : null
  const alumnos = await cargarAlumnos(aula?.id ?? null)
  const aInscribir = alumnos.filter((a) => !a.ya_miembro || a.estado_actual !== 'active')

  console.log('\n══════ QUÉ SE VA A HACER ══════\n')
  console.log(`  Docente     : ${email} (${docente.id})`)
  console.log(`  Carrera     : ${CARRERA}`)
  console.log(
    `  Programa    : ${programa ? `reutiliza el existente (id ${programa.id})` : `CREAR — ${MATERIA} · ${NIVEL} · ${GRADO}`}`,
  )
  console.log(`  Aula        : ${aula ? `reutiliza "${aula.name}" (id ${aula.id}, código ${aula.join_code})` : `CREAR — "${NOMBRE_AULA}"`}`)
  console.log(`  Unidades    : ${unidades.length} (${unidades.reduce((n, u) => n + u.topics.length, 0)} temas) desde curriculum`)
  for (const unidad of unidades) {
    console.log(`                · ${unidad.name} (${unidad.topics.length} temas)`)
  }

  console.log(`\n  Alumnos con intentos del ${FECHA_DIAGNOSTICO}: ${alumnos.length}`)
  mostrarAlumnos(alumnos)
  console.log(`\n  Se insertarían ${aInscribir.length} fila(s) en classroom_members.`)
  console.log(`  Ya activas, se saltean: ${alumnos.length - aInscribir.length}`)

  if (!apply) {
    console.log('\n  DRY-RUN — no se modificó nada.')
    console.log('  Volvé a correr con --apply (y --metodologia="...") para aplicarlo.\n')
    return
  }

  if (!programa && !metodologia) {
    throw new Error(
      'Falta --metodologia="...". Hay que crear el programa y ese texto va derecho\n' +
        '   al prompt de generación; el wizard lo pide explícitamente por eso mismo.\n' +
        '   Ejemplo: --metodologia="Resolución de problemas con apoyo de software, ' +
        'partiendo de casos de sistemas de información."',
    )
  }

  const backup: BackupFile = {
    generado: new Date().toISOString(),
    host: target.host,
    fecha_diagnostico: FECHA_DIAGNOSTICO,
    programa_creado: null,
    aula_creada: null,
    subject_slug_creado: null,
    membresias_creadas: [],
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ruta = join(BACKUP_DIR, `inscripcion-${FECHA_DIAGNOSTICO}-${Date.now()}.json`)

  // El backup se reescribe después de cada paso, no sólo al final: si el
  // proceso muere en la mitad, el archivo ya describe lo que alcanzó a crearse
  // y --revert lo puede deshacer. Un backup escrito sólo al final dejaría filas
  // huérfanas sin registro de dónde salieron.
  const persistir = () => writeFileSync(ruta, JSON.stringify(backup, null, 2), 'utf8')
  persistir()
  console.log(`\n💾 Backup: ${ruta}`)

  if (!programa) {
    const programaId = await crearPrograma(docente.id, metodologia, unidades)
    backup.programa_creado = programaId
    persistir()
    backup.subject_slug_creado = await registrarMateria(programaId)
    persistir()
    programa = { id: programaId, subject_name: MATERIA }
    console.log(`✔ Programa creado: id ${programaId}`)
  }

  if (!aula) {
    const creada = await crearAula(docente.id, programa.id)
    backup.aula_creada = creada.id
    persistir()
    aula = { id: creada.id, name: NOMBRE_AULA, join_code: creada.join_code }
    console.log(`✔ Aula creada: id ${creada.id} · código ${creada.join_code}`)
  }

  for (const alumno of aInscribir) {
    const nombre = alumno.nombre?.trim() || 'Alumno/a'
    await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      VALUES (${aula.id}, ${alumno.id}, ${nombre}, ${!alumno.es_invitado}, 'active', NOW(), NOW())
      ON CONFLICT (classroom_id, user_id) DO UPDATE
        SET status = 'active', updated_at = NOW()
    `
    backup.membresias_creadas.push({ classroom_id: aula.id, user_id: alumno.id })
  }
  persistir()

  console.log(`✔ ${aInscribir.length} alumno(s) inscripto(s) en el aula ${aula.id}.`)
  console.log(`\n  Para revertir:`)
  console.log(`    npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --revert=${ruta}`)
  console.log(
    '\n⚠  nivel/grado viajan cacheados en el JWT. El contenido del AULA sale del\n' +
      '   programa del aula, así que no depende del JWT — pero /practicar sí. Un\n' +
      '   useSession().update() en el cliente refresca el token sin cerrar sesión\n' +
      '   (auth.ts re-lee la base cuando trigger === "update").\n',
  )
}

run().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
