import { resolveDbTarget } from './lib/db-target'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  aplicar,
  relevar,
  revertir,
  type BackupAula,
  type ProgramaSpec,
} from './lib/aula-programa'
import {
  CARRERA,
  COLOR,
  GRADO,
  ICONO,
  INSTITUCION,
  JURISDICCION,
  MATERIA,
  NIVEL,
  NOMBRE_AULA,
  construirPerfil,
  construirUnidades,
} from './data/programa-matematica-didactica-profesorado-primaria'

/**
 * Crea el programa y el aula de Matemática y su Didáctica (Profesorado de
 * Educación Primaria, 1º año) para que los alumnos entren con el código y
 * practiquen todo el programa.
 *
 * Se hace por script porque el autocompletar con IA del wizard
 * (/api/teacher/programs/extract) venía fallando por falta de crédito en
 * Gemini, no por código. Mismo patrón que inscribir-diagnostico-2026-08-10.ts,
 * pero sin inscribir a nadie: los alumnos se unen solos con el código.
 *
 * El contenido sale de scripts/data/programa-matematica-didactica-profesorado-primaria.ts.
 * La lógica de base, de scripts/lib/aula-programa.ts (testeada, y con las
 * columnas de cada INSERT atadas a las de las rutas).
 *
 * `--metodologia` es obligatorio para crear el programa, igual que en
 * inscribir-diagnostico: el texto va derecho al prompt de generación, y acá
 * además es el ÚNICO canal por el que el enfoque didáctico llega a la práctica
 * de aula (ver el comentario de `construirPerfil`). Tiene que escribirlo el
 * docente, no un default.
 *
 * Uso:
 *   npx tsx scripts/crear-aula-matematica-didactica.ts --docente=mail@ejemplo.com
 *   npx tsx scripts/crear-aula-matematica-didactica.ts --docente=... --metodologia="..." --apply
 *   npx tsx scripts/crear-aula-matematica-didactica.ts --revert=<archivo.json> [--forzar]
 *   (cualquiera de los tres acepta --env=staging)
 */

const BACKUP_DIR = join(process.cwd(), 'scripts', 'backups')
const URL_APP = 'https://maestria-edu.vercel.app'

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

const SPEC: ProgramaSpec = {
  materia: MATERIA,
  nivel: NIVEL,
  grado: GRADO,
  jurisdiccion: JURISDICCION,
  icono: ICONO,
  color: COLOR,
  unidades: construirUnidades(),
  nombreAula: NOMBRE_AULA,
}

async function run() {
  const revertFile = readFlag('revert')
  const apply = process.argv.includes('--apply')
  const forzar = process.argv.includes('--forzar')
  const email = readFlag('docente')
  const metodologia = (readFlag('metodologia') ?? '').trim()

  const target = await resolveDbTarget({
    action: revertFile
      ? `revertir el programa y el aula de ${MATERIA}`
      : `crear el programa y el aula de ${MATERIA}`,
    destructive: apply || Boolean(revertFile),
  })
  const sql = target.sql

  if (revertFile) {
    const backup = JSON.parse(readFileSync(revertFile, 'utf8')) as BackupAula
    console.log(`\nRevirtiendo desde ${revertFile}`)
    console.log(`  (generado el ${backup.generado} contra ${backup.host})\n`)
    await revertir(sql, backup, { forzar, log: (linea) => console.log(linea) })
    console.log('\n✔ Revertido.')
    return
  }

  if (!email) {
    throw new Error('Falta --docente=<email>. Es el dueño del programa y del aula.')
  }

  const estado = await relevar(sql, email, SPEC)
  const totalTemas = SPEC.unidades.reduce((n, u) => n + u.topics.length, 0)

  console.log('\n══════ QUÉ SE VA A HACER ══════\n')
  console.log(`  Docente     : ${email} (${estado.docente.id}) · role ${estado.docente.role}`)
  if (estado.docente.role !== 'DOCENTE') {
    console.log(
      `  ⚠  El role en users es "${estado.docente.role}", no DOCENTE. El script NO lo cambia.\n` +
        '     getTeacherViewer() lee el rol de la base: sin DOCENTE, el aula no aparece en el panel.',
    )
  }
  console.log(`  Carrera     : ${CARRERA} (va en pedagogy_profile.degree)`)
  console.log(`  Institución : ${INSTITUCION} (no hay columna; no se guarda)`)
  console.log(
    `  Programa    : ${
      estado.programa
        ? `ya existe (id ${estado.programa.id}) — se reutiliza, no se duplica`
        : `CREAR — "${MATERIA}" · ${NIVEL} · ${GRADO} · ${JURISDICCION} · created_from manual`
    }`,
  )
  console.log(
    `  Aula        : ${
      estado.aula
        ? `ya existe "${estado.aula.name}" (id ${estado.aula.id}, código ${estado.aula.join_code}) — se reutiliza`
        : `CREAR — "${NOMBRE_AULA}"`
    }`,
  )
  if (estado.aula && estado.programa && estado.aula.teacher_program_id !== estado.programa.id) {
    console.log(
      `  ⚠  El aula existente cuelga del programa ${estado.aula.teacher_program_id}, no del ${estado.programa.id}.`,
    )
  }
  console.log(`  Unidades    : ${SPEC.unidades.length} (${totalTemas} temas)`)
  for (const unidad of SPEC.unidades) {
    console.log(`                · ${unidad.name} (${unidad.topics.length} temas)`)
    for (const tema of unidad.topics) console.log(`                    - ${tema.name}`)
  }

  const filas: string[] = []
  if (!estado.programa) {
    filas.push('teacher_programs : 1 fila (status active, source_expires_at NOW()+24h, como la ruta)')
    filas.push(`subjects         : 1 fila (slug teacher-<id>-…, source teacher, nivel ${NIVEL})`)
  }
  if (!estado.aula) filas.push('classrooms       : 1 fila (status open, código de 6 caracteres generado)')
  console.log('\n  Filas a insertar:')
  if (filas.length === 0) console.log('    ninguna — ya está todo creado')
  for (const fila of filas) console.log(`    ${fila}`)

  if (!apply) {
    console.log('\n  DRY-RUN — no se modificó nada.')
    console.log('  Volvé a correr con --apply (y --metodologia="...") para aplicarlo.\n')
    return
  }

  if (!estado.programa && !metodologia) {
    throw new Error(
      'Falta --metodologia="...". Hay que crear el programa y ese texto va derecho\n' +
        '   al prompt de generación; el wizard lo pide explícitamente por eso mismo.',
    )
  }

  if (filas.length === 0) {
    const codigo = estado.aula!.join_code
    console.log(`\n✔ Nada que crear. Código: ${codigo} · ${URL_APP}/aula/${codigo}\n`)
    return
  }

  const backup: BackupAula = {
    generado: new Date().toISOString(),
    host: target.host,
    materia: MATERIA,
    programa_creado: null,
    subject_slug_creado: null,
    aula_creada: null,
    codigo_aula: null,
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ruta = join(BACKUP_DIR, `aula-matematica-didactica-${Date.now()}.json`)
  const persistir = (b: BackupAula) => writeFileSync(ruta, JSON.stringify(b, null, 2), 'utf8')
  persistir(backup)
  console.log(`\n💾 Backup: ${ruta}`)

  const resultado = await aplicar(sql, SPEC, construirPerfil(metodologia), estado, backup, persistir)

  if (backup.programa_creado !== null) console.log(`✔ Programa creado: id ${backup.programa_creado}`)
  if (backup.subject_slug_creado !== null) console.log(`✔ Materia registrada: ${backup.subject_slug_creado}`)
  if (backup.aula_creada !== null) console.log(`✔ Aula creada: id ${backup.aula_creada}`)

  console.log(`\n  Código del aula : ${resultado.codigo}`)
  console.log(`  Link            : ${URL_APP}/aula/${resultado.codigo}`)
  console.log('\n  Para revertir:')
  console.log(`    npx tsx scripts/crear-aula-matematica-didactica.ts --revert=${ruta}\n`)
}

run().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
