import { resolveDbTarget, type Sql } from './lib/db-target'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Corrige el nivel/grado de los alumnos que rindieron el diagnóstico del
 * 2026-08-10.
 *
 * Contexto — por qué existe este script:
 *
 * De las 1.792 respuestas de ese día, 872 fueron sobre cónicas, sucesiones,
 * combinatoria y probabilidad: temas que no están en el programa de Matemática
 * de la Tecnicatura Superior en Análisis de Sistemas. La causa NO fue un
 * currículum Superior genérico —no existía ninguna fila Superior en
 * `curriculum`— sino que estos alumnos están registrados como Secundario /
 * 4to Año. El selector hizo un lookup impecable contra un perfil equivocado y
 * les sirvió, palabra por palabra, los cuatro ejes de
 * curriculum(Secundario, 4to Año, Matemática).
 *
 * Va aparte de la migración 022 a propósito: la migración cambia el esquema
 * para todos, esto toca filas de 31 personas concretas y tiene que poder
 * revertirse solo.
 *
 * Alcance deliberadamente angosto: SÓLO los usuarios con un intento del
 * 2026-08-10. No todos los Secundario/4to Año — hay alumnos de otras materias
 * y de otros cursos con ese mismo perfil que son legítimamente de secundaria.
 *
 * Uso:
 *   npx tsx scripts/fix-perfiles-diagnostico-2026-08-10.ts             # dry-run: sólo muestra
 *   npx tsx scripts/fix-perfiles-diagnostico-2026-08-10.ts --apply     # aplica y guarda backup
 *   npx tsx scripts/fix-perfiles-diagnostico-2026-08-10.ts --revert=<archivo.json>
 */

const FECHA_DIAGNOSTICO = '2026-08-10'
const NIVEL_DESTINO = 'Superior'
const GRADO_DESTINO = '1er Año'
const BACKUP_DIR = join(process.cwd(), 'scripts', 'backups')

let sql!: Sql

interface PerfilRow {
  id: string
  nivel: string | null
  grado: string | null
  intentos: number
  es_invitado: boolean
}

interface BackupEntry {
  id: string
  nivel: string | null
  grado: string | null
}

interface BackupFile {
  generado: string
  fecha_diagnostico: string
  destino: { nivel: string; grado: string }
  host: string
  perfiles: BackupEntry[]
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

/**
 * Los usuarios alcanzados. Se identifica por "tuvo un intento ese día" y no por
 * su nivel actual: si el script se corre dos veces, la segunda ya los ve en
 * Superior y tiene que seguir encontrándolos igual para poder informarlos.
 */
async function cargarPerfiles(): Promise<PerfilRow[]> {
  return (await sql`
    SELECT
      u.id,
      u.nivel,
      u.grado,
      COUNT(at.id)::int             AS intentos,
      COALESCE(u.is_guest, false)   AS es_invitado
    FROM users u
    JOIN quiz_attempts at ON at.user_id = u.id
    WHERE at.completed_at::date = ${FECHA_DIAGNOSTICO}::date
    GROUP BY u.id, u.nivel, u.grado, u.is_guest
    ORDER BY u.nivel, u.grado, u.id
  `) as PerfilRow[]
}

/** Sin nombres ni emails: el id alcanza para auditar y no expone a nadie. */
function mostrar(perfiles: PerfilRow[]): void {
  console.log('\n  id                                    nivel actual  grado actual   intentos')
  console.log('  ' + '─'.repeat(78))
  for (const p of perfiles) {
    const nivel = (p.nivel ?? '(sin nivel)').padEnd(13)
    const grado = (p.grado ?? '(sin grado)').padEnd(14)
    const marca = p.nivel === NIVEL_DESTINO && p.grado === GRADO_DESTINO ? '  ← ya está en destino' : ''
    console.log(`  ${p.id.padEnd(37)} ${nivel} ${grado} ${String(p.intentos).padStart(3)}${marca}`)
  }
  console.log('  ' + '─'.repeat(78))
}

function resumirPorPerfil(perfiles: PerfilRow[]): void {
  const conteo = new Map<string, number>()
  for (const p of perfiles) {
    const clave = `${p.nivel ?? '(sin nivel)'} / ${p.grado ?? '(sin grado)'}`
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
  }
  console.log('\n  Resumen de perfiles actuales:')
  for (const [clave, n] of [...conteo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)} alumno(s)  ${clave}`)
  }
}

async function aplicar(perfiles: PerfilRow[], host: string): Promise<void> {
  const pendientes = perfiles.filter((p) => p.nivel !== NIVEL_DESTINO || p.grado !== GRADO_DESTINO)

  if (pendientes.length === 0) {
    console.log('\n✔ Nada que hacer: los 100% de los perfiles ya están en el destino.')
    return
  }

  // El backup se escribe ANTES del UPDATE. Si el proceso muere en la mitad, el
  // archivo ya existe y describe el estado previo completo — al revés, una
  // caída dejaría filas cambiadas sin forma de saber de dónde venían.
  const backup: BackupFile = {
    generado: new Date().toISOString(),
    fecha_diagnostico: FECHA_DIAGNOSTICO,
    destino: { nivel: NIVEL_DESTINO, grado: GRADO_DESTINO },
    host,
    perfiles: pendientes.map((p) => ({ id: p.id, nivel: p.nivel, grado: p.grado })),
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const nombre = `perfiles-${FECHA_DIAGNOSTICO}-${Date.now()}.json`
  const ruta = join(BACKUP_DIR, nombre)
  writeFileSync(ruta, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\n💾 Backup escrito: ${ruta}`)

  const ids = pendientes.map((p) => p.id)
  const rows = (await sql`
    UPDATE users
       SET nivel = ${NIVEL_DESTINO},
           grado = ${GRADO_DESTINO}
     WHERE id = ANY(${ids})
    RETURNING id
  `) as { id: string }[]

  console.log(`✔ Actualizados ${rows.length} de ${pendientes.length} perfiles.`)
  console.log(`\n  Para revertir:`)
  console.log(`    npx tsx scripts/fix-perfiles-diagnostico-2026-08-10.ts --revert=${ruta}`)
}

async function revertir(archivo: string): Promise<void> {
  const backup = JSON.parse(readFileSync(archivo, 'utf8')) as BackupFile
  console.log(`\nRevirtiendo ${backup.perfiles.length} perfiles desde ${archivo}`)
  console.log(`  (backup generado el ${backup.generado} contra ${backup.host})\n`)

  let revertidos = 0
  for (const perfil of backup.perfiles) {
    await sql`
      UPDATE users
         SET nivel = ${perfil.nivel},
             grado = ${perfil.grado}
       WHERE id = ${perfil.id}
    `
    revertidos += 1
    console.log(`  ← ${perfil.id}  →  ${perfil.nivel ?? 'NULL'} / ${perfil.grado ?? 'NULL'}`)
  }

  console.log(`\n✔ Revertidos ${revertidos} perfiles a su valor anterior.`)
}

async function run() {
  const revertFile = readFlag('revert')
  const apply = process.argv.includes('--apply')

  const target = await resolveDbTarget({
    action: revertFile
      ? 'revertir nivel/grado de los alumnos del diagnóstico 2026-08-10'
      : 'corregir nivel/grado de los alumnos del diagnóstico 2026-08-10',
    // El dry-run no escribe, así que no tiene sentido pedir la confirmación de
    // producción: leer para mostrar qué se tocaría es justamente el paso
    // seguro que precede a la decisión.
    destructive: apply || Boolean(revertFile),
  })
  sql = target.sql

  if (revertFile) {
    await revertir(revertFile)
    return
  }

  const perfiles = await cargarPerfiles()

  console.log(`\n${perfiles.length} alumnos con intentos del ${FECHA_DIAGNOSTICO}:`)
  mostrar(perfiles)
  resumirPorPerfil(perfiles)

  const pendientes = perfiles.filter((p) => p.nivel !== NIVEL_DESTINO || p.grado !== GRADO_DESTINO)
  console.log(`\n  Se cambiarían ${pendientes.length} perfiles a ${NIVEL_DESTINO} / ${GRADO_DESTINO}.`)

  if (!apply) {
    console.log('\n  DRY-RUN — no se modificó nada.')
    console.log('  Volvé a correr con --apply para aplicarlo.\n')
    return
  }

  await aplicar(perfiles, target.host)

  console.log(
    '\n⚠  nivel y grado viajan cacheados en el JWT (auth.ts). Los alumnos con\n' +
      '   sesión abierta van a seguir viendo el perfil viejo hasta cerrar sesión\n' +
      '   y volver a entrar, o hasta que el cliente llame a useSession().update().\n',
  )
}

run().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
