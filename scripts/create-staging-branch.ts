/**
 * Crea la branch `staging` de Neon desde producción, la anonimiza y la verifica
 * — todo en una corrida, y sin dejarla viva si algo sale mal.
 *
 * Es el procedimiento de docs/staging.md §2.1-§2.2 y §5 encadenado. Los pasos
 * sueltos funcionaban, pero entre "cloné producción" y "la anonimicé" hay una
 * ventana en la que existe una copia exacta de los datos de 31 alumnos
 * identificables, con tokens de Google vivos. Esa ventana no puede depender de
 * que la persona siga con la terminal abierta.
 *
 * ─── La condición dura ──────────────────────────────────────────────────────
 * Todo lo que pasa después de crear la branch está dentro de un try/finally que
 * la BORRA ante cualquier fallo, incluido que la verificación encuentre un solo
 * dato real. La branch sobrevive únicamente si se llegó al final y todos los
 * chequeos dieron limpio. También se limpia ante Ctrl-C, porque el caso más
 * probable de interrupción es durante los 90 s de espera del endpoint — con la
 * copia de producción ya creada.
 *
 * ─── Por qué la verificación no le cree al anonimizador ─────────────────────
 * `anonymize-staging.ts` termina llamando a `markEnvironment`, que corre
 * `assertAnonymized`. Pero ese chequeo mira un PATRÓN: que todo email termine en
 * `@staging.invalid`. Un patrón no puede ver una tabla que el anonimizador no
 * conoce, ni una columna agregada por una migración posterior. Acá se hace la
 * pregunta al revés: se traen los valores REALES de producción y se verifica que
 * ninguno sobreviva en la branch nueva. Es la única forma de que un olvido en el
 * anonimizador falle en vez de pasar.
 *
 * ─── Uso ────────────────────────────────────────────────────────────────────
 *   npx tsx scripts/create-staging-branch.ts
 *
 * Requiere en `.env.local`: NEON_API_KEY, NEON_PROJECT_ID y la DATABASE_URL de
 * producción. Al terminar, recordá BORRAR NEON_API_KEY de `.env.local`: es una
 * credencial que puede borrar cualquier branch del proyecto, producción incluida.
 */
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { ANONYMIZED_EMAIL_DOMAIN, resolveDbTarget, type Sql } from './lib/db-target'
import { createBranchGuard, type BranchGuard } from './lib/branch-guard'
import { NeonApi } from './lib/neon-api'
import {
  comparisonSet,
  countLeaks,
  countOutsideDomain,
  hostOf,
  originHostMatches,
  parseConnectionParts,
  renderStagingEnvFile,
} from './lib/staging-branch'

const BRANCH_NAME = 'staging'
const ENDPOINT_TIMEOUT_MS = 90_000
const ENDPOINT_POLL_MS = 3_000
const ENV_FILE = '.env.staging.local'

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guardián de la branch. La lógica vive en scripts/lib/branch-guard.ts, con sus
 * tests: es la pieza que sostiene la condición dura del procedimiento —la branch
 * sobrevive si y sólo si `keep()` fue llamado— y no puede descansar en que el
 * `finally` "seguro anda".
 *
 * Es la única variable de módulo del script, y existe para que el manejador de
 * señales pueda alcanzarla: un Ctrl-C durante los 90 s de espera del endpoint
 * ocurre con la copia de producción ya creada.
 */
let guard: BranchGuard | null = null

function installSignalHandlers(): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      const exit = () => process.exit(130)
      void (guard?.destroy(`recibido ${signal}`) ?? Promise.resolve()).then(exit, exit)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 2 — esperar el endpoint con una consulta real
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Espera hasta que la branch responda `SELECT 1`.
 *
 * Deliberadamente NO se espera a que la API diga `ready`: ese estado describe el
 * compute, no la disponibilidad del endpoint para consultas. Un `ready` seguido
 * de un `ECONNREFUSED` en la primera migración es exactamente el modo de falla
 * que este bucle existe para evitar — y ahí la branch ya está creada, con datos
 * reales adentro.
 */
async function waitForEndpoint(sql: Sql, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let attempt = 0
  let lastError: unknown = null

  while (Date.now() < deadline) {
    attempt += 1
    try {
      await sql`SELECT 1`
      console.log(`   ✔ Endpoint respondiendo (intento ${attempt})`)
      return
    } catch (error) {
      lastError = error
      const restante = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      console.log(`   · intento ${attempt} sin respuesta todavía (quedan ${restante}s)`)
      await new Promise((resolve) => setTimeout(resolve, ENDPOINT_POLL_MS))
    }
  }

  throw new Error(
    `El endpoint no respondió SELECT 1 en ${timeoutMs / 1000}s. ` +
      `Último error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos 3 y 4 — correr los scripts que ya existen, contra la branch nueva
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corre un script del repo como proceso hijo, apuntándolo a la branch nueva.
 *
 * Proceso hijo y no import: `run-migration-017.ts` y `anonymize-staging.ts`
 * llaman a `process.exit()` cuando fallan, y un `process.exit()` en ESTE proceso
 * saltearía el `finally` que borra la branch. Aislarlos convierte su salida en
 * un código de retorno que sí podemos manejar.
 *
 * El `DATABASE_URL` inyectado gana sobre el archivo: `resolveDbTarget` sólo
 * llama a dotenv si el archivo existe, y dotenv nunca pisa una variable ya
 * presente en el entorno. Así los hijos apuntan a la branch nueva sin que
 * `.env.staging.local` exista todavía — que es justo lo que queremos, porque ese
 * archivo se escribe recién al final, con la branch ya verificada.
 */
function runChildScript(script: string, databaseUrl: string, label: string): void {
  console.log(`\n▸ ${label}`)

  // `shell: true` para que `npx` resuelva a `npx.cmd` en Windows, que es donde
  // se corre esto. Los paths son literales del repo, sin interpolación.
  const result = spawnSync('npx', ['tsx', script, '--env=staging'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${script} terminó con código ${result.status}.`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 5 — verificación independiente contra los datos reales
// ─────────────────────────────────────────────────────────────────────────────

interface Check {
  nombre: string
  ok: boolean
  detalle: string
}

/**
 * Compara la branch nueva contra producción.
 *
 * Los valores reales se traen a memoria y NUNCA se imprimen ni se escriben: se
 * usan sólo como conjunto de comparación y el resultado es un número. Tampoco se
 * mandan a la branch de staging para comparar del lado de Postgres, que sería
 * copiar los datos reales justo al lugar del que los estamos sacando.
 */
async function verify(prod: Sql, staging: Sql, stagingHost: string): Promise<Check[]> {
  const checks: Check[] = []
  const add = (nombre: string, ok: boolean, detalle: string) => checks.push({ nombre, ok, detalle })

  // ── Datos reales de producción, sólo lectura ──────────────────────────────
  const prodUsers = (await prod`SELECT id, name, email FROM users`) as {
    id: string | null
    name: string | null
    email: string | null
  }[]
  const prodMembers = (await prod`SELECT display_name FROM classroom_members`) as {
    display_name: string | null
  }[]
  const prodAccounts = (await prod`SELECT provider_account_id FROM accounts`) as {
    provider_account_id: string | null
  }[]

  const realEmails = comparisonSet(prodUsers.map((u) => u.email))
  const realIds = comparisonSet(prodUsers.map((u) => u.id))
  const realNames = comparisonSet([
    ...prodUsers.map((u) => u.name),
    ...prodMembers.map((m) => m.display_name),
  ])
  const realProviderIds = comparisonSet(prodAccounts.map((a) => a.provider_account_id))

  // ── Anti-falso-negativo ───────────────────────────────────────────────────
  // Sin esto, una branch vacía —o una consulta apuntada a la base equivocada—
  // pasaría TODOS los chequeos de fuga por no tener filas que comparar. Es el
  // primero a propósito: si esto falla, lo demás no significa nada.
  const stagingUserCount = (await staging`SELECT count(*)::int AS n FROM users`) as { n: number }[]
  const nStaging = stagingUserCount[0]?.n ?? 0
  add(
    'la branch tiene los datos clonados',
    nStaging > 0 && nStaging === prodUsers.length,
    `staging=${nStaging} usuarios · producción=${prodUsers.length}`,
  )

  // ── 1. Marcador de entorno ────────────────────────────────────────────────
  const marker = (await staging`
    SELECT environment, origin_host FROM deployment_env WHERE id = true LIMIT 1
  `) as { environment: string; origin_host: string | null }[]
  const env = marker[0]?.environment ?? '(sin fila)'
  const origin = marker[0]?.origin_host ?? null

  add('deployment_env.environment = staging', env === 'staging', `environment="${env}"`)
  add(
    'deployment_env.origin_host apunta a esta branch',
    originHostMatches(origin, stagingHost),
    `origin_host="${origin ?? '(null)'}" vs host="${stagingHost}"`,
  )

  // ── 2. Identidad ──────────────────────────────────────────────────────────
  const stagingUsers = (await staging`SELECT id, name, email, image FROM users`) as {
    id: string | null
    name: string | null
    email: string | null
    image: string | null
  }[]

  const emailLeaks = countLeaks(realEmails, stagingUsers.map((u) => u.email))
  add('users.email sin emails reales', emailLeaks === 0, `${emailLeaks} fuga(s)`)

  const outsideDomain = countOutsideDomain(
    stagingUsers.map((u) => u.email).filter((e): e is string => e !== null),
    ANONYMIZED_EMAIL_DOMAIN,
  )
  add(
    `users.email dentro de @${ANONYMIZED_EMAIL_DOMAIN}`,
    outsideDomain === 0,
    `${outsideDomain} fuera del dominio reservado`,
  )

  const nameLeaks = countLeaks(realNames, stagingUsers.map((u) => u.name))
  add('users.name sin nombres reales', nameLeaks === 0, `${nameLeaks} fuga(s)`)

  // users.id ES el `sub` de Google (auth.ts lo guarda tal cual): identificador
  // de una cuenta real, aunque el anonimizador ya lo reescriba.
  const idLeaks = countLeaks(realIds, stagingUsers.map((u) => u.id))
  add('users.id sin identificadores de Google reales', idLeaks === 0, `${idLeaks} fuga(s)`)

  const imagesLeft = stagingUsers.filter((u) => u.image !== null).length
  add('users.image en NULL', imagesLeft === 0, `${imagesLeft} foto(s) de perfil`)

  // ── 3. Copia denormalizada del nombre ─────────────────────────────────────
  const stagingMembers = (await staging`SELECT display_name FROM classroom_members`) as {
    display_name: string | null
  }[]
  const memberLeaks = countLeaks(realNames, stagingMembers.map((m) => m.display_name))
  add('classroom_members.display_name sin nombres reales', memberLeaks === 0, `${memberLeaks} fuga(s)`)

  // ── 4. Credenciales de Google vivas ───────────────────────────────────────
  const tokens = (await staging`
    SELECT count(*) FILTER (WHERE access_token  IS NOT NULL)::int AS access,
           count(*) FILTER (WHERE refresh_token IS NOT NULL)::int AS refresh,
           count(*) FILTER (WHERE id_token      IS NOT NULL)::int AS id_tok
    FROM accounts
  `) as { access: number; refresh: number; id_tok: number }[]
  const t = tokens[0] ?? { access: 0, refresh: 0, id_tok: 0 }
  add(
    'accounts sin tokens OAuth',
    t.access === 0 && t.refresh === 0 && t.id_tok === 0,
    `access=${t.access} refresh=${t.refresh} id_token=${t.id_tok}`,
  )

  const stagingAccounts = (await staging`SELECT provider_account_id FROM accounts`) as {
    provider_account_id: string | null
  }[]
  const providerLeaks = countLeaks(realProviderIds, stagingAccounts.map((a) => a.provider_account_id))
  add(
    'accounts.provider_account_id sin identificadores reales',
    providerLeaks === 0,
    `${providerLeaks} fuga(s)`,
  )

  // ── 5. Tablas que tienen que quedar vacías ────────────────────────────────
  for (const tabla of ['verification_tokens', 'teacher_program_uploads', 'feedback_reports'] as const) {
    const rows = (await staging.query(`SELECT count(*)::int AS n FROM ${tabla}`)) as { n: number }[]
    const n = rows[0]?.n ?? 0
    add(`${tabla} vacía`, n === 0, `${n} fila(s)`)
  }

  return checks
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestación
// ─────────────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  // Producción en sólo lectura: no se le escribe nada, así que no corresponde
  // el prompt de confirmación. Lo que se le pide son los datos reales contra los
  // que después se verifica la branch.
  const prod = await resolveDbTarget({
    action: 'lectura de producción para verificar staging',
    destructive: false,
  })

  if (!prod.isRealProduction) {
    throw new Error(
      'La DATABASE_URL de .env.local no apunta a producción real.\n' +
        '   Este script clona PRODUCCIÓN: correrlo contra otra cosa daría un staging ' +
        'que no se parece a nada.',
    )
  }

  const apiKey = process.env.NEON_API_KEY
  if (!apiKey) {
    throw new Error('Falta NEON_API_KEY en .env.local (se necesita para crear y borrar la branch).')
  }
  if (!prod.projectId) {
    throw new Error('Falta NEON_PROJECT_ID en .env.local.')
  }

  const api = new NeonApi(apiKey, prod.projectId)
  const parts = parseConnectionParts(prod.url)

  // Una branch `staging` que ya existe no se pisa: puede estar en uso, y el
  // procedimiento de refresco (docs/staging.md §5) empieza por borrarla a mano
  // justamente para que esa decisión sea de una persona.
  const existing = await api.findBranchByName(BRANCH_NAME)
  if (existing) {
    throw new Error(
      `Ya existe una branch "${BRANCH_NAME}" (${existing.id}).\n` +
        '   Borrala primero en la consola de Neon (docs/staging.md §5) y volvé a correr esto.\n' +
        '   No se borra sola a propósito: puede estar en uso.',
    )
  }

  const parent = await api.findDefaultBranch()
  console.log(`\n▸ Paso 1 · Creando "${BRANCH_NAME}" desde "${parent.name}" (${parent.id}), con datos al momento`)

  // El estado de limpieza y los manejadores de señales se arman ANTES de crear.
  // Entre `createBranch` y la primera línea que pudiera registrarlos hay un
  // await: un Ctrl-C ahí, o una respuesta perdida con la branch ya creada del
  // lado de Neon, dejaría viva una copia de producción sin que nadie la reclame.
  guard = createBranchGuard(api, BRANCH_NAME)
  installSignalHandlers()

  try {
    guard.markAttempted()
    const created = await api.createBranch(BRANCH_NAME, parent.id)

    const branchId = created.branch?.id
    if (!branchId) {
      // Tirar acá es seguro: `markAttempted()` ya corrió, así que el guardián
      // la va a buscar por nombre y borrar aunque nunca sepamos su id.
      throw new Error('La API de Neon creó la branch pero no devolvió su id.')
    }
    guard.setBranchId(branchId)
    console.log(`   ✔ Branch creada: ${branchId}`)

    const [pooledUrl, unpooledUrl] = await Promise.all([
      api.getConnectionUri({ branchId, database: parts.database, role: parts.role, pooled: true }),
      api.getConnectionUri({ branchId, database: parts.database, role: parts.role, pooled: false }),
    ])
    const stagingHost = hostOf(unpooledUrl)
    console.log(`   ✔ Endpoint: ${stagingHost}`)

    // La URL sale de la API, no de un archivo de entorno: `.env.staging.local`
    // todavía no existe (se escribe en el paso 6, ya verificada la branch), así
    // que `resolveDbTarget` no tiene de dónde leerla. Es la excepción a la regla
    // de CLAUDE.md, y es por eso.
    const staging = neon(unpooledUrl)

    console.log(`\n▸ Paso 2 · Esperando SELECT 1 (máx ${ENDPOINT_TIMEOUT_MS / 1000}s)`)
    await waitForEndpoint(staging, ENDPOINT_TIMEOUT_MS)

    // Paso 3. La branch clonada hereda `deployment_env` diciendo 'production'
    // con el `origin_host` de producción, así que ya se distingue del original.
    // Esto corre igual por idempotencia: si producción todavía no tuviera la 017,
    // el clon tampoco la tendría y nada de lo que sigue funcionaría.
    //
    // Marcarla como `staging` acá sería imposible y está bien que lo sea:
    // `markEnvironment` corre `assertAnonymized` primero y tiraría error con los
    // datos reales todavía puestos. La marca la pone `anonymize-staging.ts` al
    // final, recién cuando ya no hay nada real que proteger.
    runChildScript('scripts/run-migration-017.ts', unpooledUrl, 'Paso 3 · Marcador de entorno (migración 017)')

    // Paso 4.
    runChildScript('scripts/anonymize-staging.ts', unpooledUrl, 'Paso 4 · Anonimización')

    // Paso 5.
    console.log('\n▸ Paso 5 · Verificación independiente contra los datos reales de producción')
    const checks = await verify(prod.sql, staging, stagingHost)

    for (const check of checks) {
      console.log(`   ${check.ok ? '✔' : '✖'} ${check.nombre} — ${check.detalle}`)
    }

    const failed = checks.filter((check) => !check.ok)
    if (failed.length > 0) {
      throw new Error(
        `La verificación encontró ${failed.length} problema(s): ${failed.map((f) => f.nombre).join('; ')}`,
      )
    }
    console.log(`   ✔ ${checks.length} chequeos, todos limpios.`)

    // Paso 6. Recién ahora, con la branch verificada, se la deja escrita.
    if (fs.existsSync(ENV_FILE)) {
      const backup = `${ENV_FILE}.${Date.now()}.bak`
      fs.copyFileSync(ENV_FILE, backup)
      console.log(`\n▸ Paso 6 · ${ENV_FILE} ya existía → copia en ${backup}`)
    } else {
      console.log(`\n▸ Paso 6 · Escribiendo ${ENV_FILE}`)
    }

    fs.writeFileSync(
      ENV_FILE,
      renderStagingEnvFile({
        pooledUrl,
        unpooledUrl,
        projectId: prod.projectId,
        branchName: BRANCH_NAME,
        branchId,
        createdAt: new Date(),
      }),
      'utf8',
    )
    console.log(`   ✔ ${ENV_FILE} escrito (no se commitea: .gitignore cubre .env*.local)`)

    // Único punto del script que desarma al guardián. Todo lo anterior tuvo que
    // salir bien, verificación incluida, para llegar hasta acá.
    guard.keep()
  } finally {
    // Un throw en cualquier punto —incluida la verificación— borra la branch.
    // `destroy` no hace nada si ya se llamó a `keep`.
    await guard.destroy('la corrida no terminó verificada')
  }

  console.log('\n✅ Branch de staging creada, anonimizada y verificada.')
  console.log('')
  console.log('   Falta, y no lo hace este script (docs/staging.md §2.3-§2.5):')
  console.log('     · client de OAuth propio para staging en Google Cloud')
  console.log('     · AUTH_SECRET distinto, key de Gemini aparte, AUTH_URL de staging')
  console.log('     · cargar las variables en el proyecto maestria-staging de Vercel')
  console.log('')
  console.log('  ╔════════════════════════════════════════════════════════════╗')
  console.log('  ║  🔑  BORRÁ NEON_API_KEY DE .env.local AHORA                ║')
  console.log('  ╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('   Esa key puede borrar cualquier branch del proyecto, producción incluida.')
  console.log('   No hace falta para el día a día: los scripts usan DATABASE_URL.')
  console.log('')
}

run().catch(async (err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  // Red de seguridad: si algo tiró antes de que el try/finally tomara el
  // control, o si el propio finally falló, este es el último lugar donde se
  // puede borrar la branch antes de que el proceso muera.
  await guard?.destroy('la corrida terminó con error')
  process.exit(1)
})
