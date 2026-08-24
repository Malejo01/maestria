import { resolveDbTarget, type Sql } from './lib/db-target'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CARRERA, GRADO, MATERIA, UNIDADES } from './data/curriculum-superior-sistemas'

/**
 * Desglosa el tema agrupado de la Unidad 5 ("Tipos de funciones: polinómicas,
 * racionales, ...") en un tema por tipo de función.
 *
 * Por qué hace falta un script y no alcanza con editar una tabla:
 *
 * El temario de esta carrera vive DOS veces en producción, y las dos copias son
 * independientes por diseño:
 *
 *   1. `curriculum` (fila 314, migración 022) — el diseño curricular oficial.
 *      Es lo que lee /api/curriculum/topics, o sea lo que ve cualquier alumno
 *      de la carrera que practica libre en /practicar.
 *   2. `teacher_programs.units` (programa 14) — el snapshot que copió
 *      scripts/inscribir-diagnostico-2026-08-10.ts al crear el programa del
 *      aula. Es lo que ve el docente al armar un cuestionario y lo que ve el
 *      alumno dentro del aula.
 *
 * NO se sincronizan. `units` es un snapshot deliberado (ver el comentario del
 * script de inscripción): el programa del docente no cambia bajo sus pies
 * porque alguien edite el currículum oficial. Consecuencia directa: tocar una
 * sola de las dos deja la otra vieja. Por eso este script escribe en las dos.
 *
 * La lista de temas nueva NO se define acá: sale de
 * scripts/data/curriculum-superior-sistemas.ts, que es la fuente en el repo, y
 * el script verifica al arrancar que el archivo y lo que espera encontrar en la
 * base coincidan. Si alguien edita el archivo y no corre esto, la base queda
 * atrás; si corre esto sin editar el archivo, no hay nada que aplicar.
 *
 * En `teacher_programs` el reemplazo es quirúrgico: se sustituye el topic cuyo
 * `name` es exactamente el tema viejo por los siete nuevos, en su lugar, y se
 * renumeran los ids de esa unidad. El resto del programa no se toca, porque un
 * docente puede haber agregado temas propios y esto no es un re-seed.
 *
 * Por qué no una migración numerada: las migraciones de este repo son DDL
 * (`scripts/0NN-*.sql` + su runner), y `tests/migrations.test.ts` vigila su
 * numeración. Esto es un cambio de DATOS de una carrera, reversible y de una
 * sola corrida — el mismo lugar que ocupan `fix-perfiles-diagnostico-*` o
 * `repair-program-metadata.ts`. Agregar una 024 mezclaría las dos cosas.
 *
 * Uso:
 *   npx tsx scripts/desglosar-tipos-de-funcion-unidad-5.ts
 *   npx tsx scripts/desglosar-tipos-de-funcion-unidad-5.ts --apply
 *   npx tsx scripts/desglosar-tipos-de-funcion-unidad-5.ts --revert=scripts/backups/desglose-....json
 */

const NIVEL = 'Superior'
const EJE = 'Unidad 5 — Funciones y Modelización Matemática'

/** El texto exacto que hay que hacer desaparecer, tal como está en producción. */
const TEMA_VIEJO =
  'Tipos de funciones: polinómicas, racionales, irracionales, exponenciales, potenciales, logarítmicas y trigonométricas.'

const TEMAS_NUEVOS = [
  'Funciones polinómicas',
  'Funciones racionales',
  'Funciones irracionales',
  'Funciones exponenciales',
  'Funciones potenciales',
  'Funciones logarítmicas',
  'Funciones trigonométricas',
]

const BACKUP_DIR = join(process.cwd(), 'scripts', 'backups')

let sql!: Sql

interface ProgramTopic {
  id: string
  name: string
  [extra: string]: unknown
}

interface ProgramUnit {
  id: string
  name: string
  topics: ProgramTopic[]
  [extra: string]: unknown
}

interface CurriculumRow {
  id: number
  eje: string
  temas: string[]
}

interface ProgramRow {
  id: number
  user_id: string
  subject_name: string
  nivel: string | null
  grado: string | null
  status: string
  units: ProgramUnit[]
}

interface BackupFile {
  generado: string
  host: string
  curriculum: { id: number; temas: string[] }[]
  programas: { id: number; units: ProgramUnit[] }[]
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

/**
 * El archivo del repo y este script tienen que contar la misma historia. Si no,
 * la corrida deja la base diciendo una cosa y el seeder — que puede volver a
 * correrse cualquier día — diciendo otra.
 */
function verificarFuenteEnRepo(): string[] {
  const unidad = UNIDADES.find((u) => u.eje === EJE)
  if (!unidad) {
    throw new Error(`scripts/data/curriculum-superior-sistemas.ts no tiene la unidad "${EJE}".`)
  }

  if (unidad.temas.includes(TEMA_VIEJO)) {
    throw new Error(
      'El archivo del repo todavía tiene el tema agrupado.\n' +
        '   Editá scripts/data/curriculum-superior-sistemas.ts primero: si no, el\n' +
        '   próximo seed-curriculum-superior-sistemas.ts revierte este cambio.',
    )
  }

  const faltantes = TEMAS_NUEVOS.filter((tema) => !unidad.temas.includes(tema))
  if (faltantes.length > 0) {
    throw new Error(
      `El archivo del repo no declara ${faltantes.length} de los temas nuevos:\n` +
        faltantes.map((t) => `     · ${t}`).join('\n'),
    )
  }

  return unidad.temas
}

/** Reemplaza el tema viejo por los nuevos, en su lugar. Idempotente. */
function desglosarTemas(temas: string[]): string[] {
  const indice = temas.indexOf(TEMA_VIEJO)
  if (indice === -1) return temas
  return [...temas.slice(0, indice), ...TEMAS_NUEVOS, ...temas.slice(indice + 1)]
}

/**
 * Ids de los topics de una unidad de `teacher_programs`.
 *
 * Si toda la unidad sigue el patrón que escribe el wizard (`<unidad>-t-<n>`),
 * se renumera entera y el programa queda idéntico a una copia fresca del
 * currículum. Si alguien metió ids con otra forma, no se renumera nada y los
 * siete nuevos cuelgan del id del viejo (`...-t-3-1`): mejor un id feo que
 * pisar el id de un tema que otra fila podría estar referenciando.
 */
function reasignarIds(unidad: ProgramUnit, viejo: ProgramTopic, nuevos: ProgramTopic[]): ProgramTopic[] {
  const indice = unidad.topics.findIndex((t) => t.id === viejo.id)
  const resultado = [...unidad.topics.slice(0, indice), ...nuevos, ...unidad.topics.slice(indice + 1)]

  const patron = new RegExp(`^${unidad.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-t-\\d+$`)
  const renumerable = unidad.topics.every((t) => patron.test(t.id))

  // Los siete nuevos ya llegan con `<id del viejo>-<n>`, que es lo que queda si
  // no se puede renumerar la unidad entera.
  if (!renumerable) return resultado

  return resultado.map((t, i) => ({ ...t, id: `${unidad.id}-t-${i + 1}` }))
}

function desglosarUnits(units: ProgramUnit[]): { units: ProgramUnit[]; cambiada: string | null } {
  let cambiada: string | null = null

  const nuevas = units.map((unidad) => {
    const viejo = unidad.topics?.find((t) => t.name === TEMA_VIEJO)
    if (!viejo) return unidad

    // Se conservan `origin` y `sourceEje` del tema viejo: los siete nuevos
    // vienen del mismo eje del mismo diseño curricular, y la UI muestra esa
    // procedencia.
    const heredado = Object.fromEntries(
      Object.entries(viejo).filter(([clave]) => clave !== 'id' && clave !== 'name'),
    )
    const nuevos: ProgramTopic[] = TEMAS_NUEVOS.map((nombre, i) => ({
      ...heredado,
      id: `${viejo.id}-${i + 1}`,
      name: nombre,
    }))

    cambiada = unidad.name
    return { ...unidad, topics: reasignarIds(unidad, viejo, nuevos) }
  })

  return { units: nuevas, cambiada }
}

async function revertir(archivo: string): Promise<void> {
  const backup = JSON.parse(readFileSync(archivo, 'utf8')) as BackupFile
  console.log(`\nRevirtiendo desde ${archivo}`)
  console.log(`  (generado el ${backup.generado} contra ${backup.host})\n`)

  for (const fila of backup.curriculum) {
    await sql`
      UPDATE curriculum SET temas = ${JSON.stringify(fila.temas)}::jsonb, updated_at = NOW()
       WHERE id = ${fila.id}
    `
    console.log(`  <- curriculum ${fila.id} restaurada (${fila.temas.length} temas)`)
  }

  for (const programa of backup.programas) {
    await sql`
      UPDATE teacher_programs SET units = ${JSON.stringify(programa.units)}::jsonb, updated_at = NOW()
       WHERE id = ${programa.id}
    `
    console.log(`  <- teacher_programs ${programa.id} restaurado`)
  }

  console.log('\nRevertido. Ojo: el archivo del repo sigue con los temas nuevos.')
}

async function run() {
  const revertFile = readFlag('revert')
  const apply = process.argv.includes('--apply')

  const target = await resolveDbTarget({
    action: revertFile
      ? 'revertir el desglose de tipos de función de la Unidad 5'
      : 'desglosar los tipos de función de la Unidad 5',
    destructive: apply || Boolean(revertFile),
  })
  sql = target.sql

  if (revertFile) {
    await revertir(revertFile)
    return
  }

  const temasEsperados = verificarFuenteEnRepo()

  const filasCurriculum = (await sql`
    SELECT id, eje, temas
    FROM curriculum
    WHERE nivel = ${NIVEL} AND carrera = ${CARRERA} AND grado = ${GRADO}
      AND materia = ${MATERIA} AND eje = ${EJE}
    ORDER BY id
  `) as CurriculumRow[]

  // A propósito no se filtra por docente ni por status: si el temario agrupado
  // se copió a más de un programa, los queremos ver todos.
  const programas = (await sql`
    SELECT id, user_id, subject_name, nivel, grado, status, units
    FROM teacher_programs
    WHERE units::text LIKE ${'%' + TEMA_VIEJO + '%'}
    ORDER BY id
  `) as ProgramRow[]

  console.log('\n====== QUÉ SE VA A CAMBIAR ======\n')
  console.log(`  Tema viejo : ${TEMA_VIEJO}`)
  console.log(`  Temas nuevos (${TEMAS_NUEVOS.length}):`)
  for (const tema of TEMAS_NUEVOS) console.log(`      · ${tema}`)

  console.log(`\n  curriculum — ${filasCurriculum.length} fila(s):`)
  const curriculumPendiente: { id: number; antes: string[]; despues: string[] }[] = []
  for (const fila of filasCurriculum) {
    const despues = desglosarTemas(fila.temas)
    const cambia = despues.length !== fila.temas.length
    console.log(`      · id ${fila.id} · "${fila.eje}" · ${fila.temas.length} -> ${despues.length} temas ${cambia ? '' : '(sin cambios)'}`)
    if (cambia) curriculumPendiente.push({ id: fila.id, antes: fila.temas, despues })

    // La fila resultante tiene que quedar igual al archivo del repo. Si no, el
    // próximo seeder va a mover temas otra vez y nadie va a saber por qué.
    const iguales =
      despues.length === temasEsperados.length && despues.every((t, i) => t === temasEsperados[i])
    if (cambia && !iguales) {
      console.log('        OJO: el resultado NO coincide con scripts/data/curriculum-superior-sistemas.ts')
      console.log(`             repo   : ${JSON.stringify(temasEsperados)}`)
      console.log(`             base   : ${JSON.stringify(despues)}`)
    }
  }

  console.log(`\n  teacher_programs — ${programas.length} programa(s):`)
  const programasPendientes: { id: number; antes: ProgramUnit[]; despues: ProgramUnit[] }[] = []
  for (const programa of programas) {
    const { units, cambiada } = desglosarUnits(programa.units)
    console.log(
      `      · id ${programa.id} · ${programa.subject_name} · ${programa.nivel} ${programa.grado ?? ''} · ${programa.status}`,
    )
    if (!cambiada) {
      console.log('        (sin cambios)')
      continue
    }
    const unidadVieja = programa.units.find((u) => u.name === cambiada)!
    const unidadNueva = units.find((u) => u.name === cambiada)!
    console.log(`        unidad "${cambiada}": ${unidadVieja.topics.length} -> ${unidadNueva.topics.length} temas`)
    for (const topic of unidadNueva.topics) {
      const nuevo = TEMAS_NUEVOS.includes(topic.name)
      console.log(`            ${nuevo ? '+' : ' '} ${topic.id}  ${topic.name}`)
    }
    programasPendientes.push({ id: programa.id, antes: programa.units, despues: units })
  }

  // Datos históricos que referencian el tema viejo por su texto. Si esto no da
  // cero, el desglose deja huérfano ese historial y hay que decidir qué hacer
  // con él ANTES de escribir, no después.
  const [historico] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM topic_mastery
        WHERE topic_name = ${TEMA_VIEJO} OR topic_id ILIKE ${'%tipos-de-funciones%'})            AS mastery,
      (SELECT COUNT(*)::int FROM quiz_answers   WHERE topic_name ILIKE ${'%tipos de funciones%'}) AS answers,
      (SELECT COUNT(*)::int FROM quiz_attempts
        WHERE array_to_string(topics, '||') ILIKE ${'%tipos de funciones%'})                      AS attempts,
      (SELECT COUNT(*)::int FROM student_misconceptions
        WHERE topic_name ILIKE ${'%tipos de funciones%'})                                         AS misconceptions,
      (SELECT COUNT(*)::int FROM teacher_quizzes
        WHERE selected_topics::text ILIKE ${'%tipos de funciones%'})                              AS quizzes
  `) as { mastery: number; answers: number; attempts: number; misconceptions: number; quizzes: number }[]

  console.log('\n  Datos históricos que nombran el tema viejo:')
  console.log(`      topic_mastery          : ${historico.mastery}`)
  console.log(`      quiz_answers.topic_name: ${historico.answers}`)
  console.log(`      quiz_attempts.topics   : ${historico.attempts}`)
  console.log(`      student_misconceptions : ${historico.misconceptions}`)
  console.log(`      teacher_quizzes        : ${historico.quizzes}`)
  const totalHistorico =
    historico.mastery + historico.answers + historico.attempts + historico.misconceptions + historico.quizzes
  console.log(
    totalHistorico === 0
      ? '      -> nada que migrar: ninguna fila histórica lo referencia.'
      : '      -> HAY historial apuntando al tema viejo. Ninguna FK se rompe (son textos\n' +
          '         sueltos, no claves foráneas), pero esas filas quedan nombrando un tema\n' +
          '         que ya no existe en el temario.',
  )

  if (curriculumPendiente.length === 0 && programasPendientes.length === 0) {
    console.log('\n  No hay nada que aplicar (ya estaba desglosado).\n')
    return
  }

  if (!apply) {
    console.log('\n  DRY-RUN — no se modificó nada.')
    console.log('  Para aplicarlo: npx tsx scripts/desglosar-tipos-de-funcion-unidad-5.ts --apply\n')
    return
  }

  const backup: BackupFile = {
    generado: new Date().toISOString(),
    host: target.host,
    curriculum: curriculumPendiente.map((c) => ({ id: c.id, temas: c.antes })),
    programas: programasPendientes.map((p) => ({ id: p.id, units: p.antes })),
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ruta = join(BACKUP_DIR, `desglose-unidad-5-${Date.now()}.json`)
  writeFileSync(ruta, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\nBackup: ${ruta}`)

  for (const fila of curriculumPendiente) {
    await sql`
      UPDATE curriculum SET temas = ${JSON.stringify(fila.despues)}::jsonb, updated_at = NOW()
       WHERE id = ${fila.id}
    `
    console.log(`  -> curriculum ${fila.id}: ${fila.antes.length} -> ${fila.despues.length} temas`)
  }

  for (const programa of programasPendientes) {
    await sql`
      UPDATE teacher_programs SET units = ${JSON.stringify(programa.despues)}::jsonb, updated_at = NOW()
       WHERE id = ${programa.id}
    `
    console.log(`  -> teacher_programs ${programa.id}: units actualizado`)
  }

  console.log('\nListo.')
  console.log('  Para revertir:')
  console.log(`    npx tsx scripts/desglosar-tipos-de-funcion-unidad-5.ts --revert=${ruta}\n`)
}

run().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
