import { readFileSync, readdirSync } from 'node:fs'

/**
 * Modelo del esquema que las migraciones del repo DECLARAN, para poder
 * compararlo con el que la base realmente tiene.
 *
 * ─── Por qué existe ─────────────────────────────────────────────────────────
 *
 * Este repo no tiene framework de migraciones: los `scripts/0NN-*.sql` se
 * aplican a mano con su runner. `tests/migrations.test.ts` vigila la numeración
 * dentro del repo, pero nadie chequeaba si la BASE está al día — y ya pasó dos
 * veces que no lo estuviera:
 *
 *   019  `feedback_reports` no existía en producción → el botón de reportar
 *        problemas tiraba 500 (visible en Sentry como MAESTRIA-Z).
 *   023  `curriculum.tipos_pregunta_sugeridos` no existía → /api/curriculum/topics
 *        fallaba al parsear la consulta y /practicar mostró "no hay temas
 *        cargados" durante NUEVE DÍAS, para todos los niveles, sin un evento.
 *
 * Las dos son la misma falla: el código se mergeó y se desplegó, la migración
 * quedó sin correr, y nada lo dijo.
 *
 * ─── Por qué se aplican RENAME y DROP, y no se acumulan CREATE y ADD ────────
 *
 * El primer prototipo sólo juntaba lo que las migraciones crean, y reportó como
 * faltante `ai_generation_log` (migración 015) — que NO falta: la 016 la
 * renombró a `ai_usage_log`. Un detector que grita por algo que está bien deja
 * de leerse a las dos semanas, y entonces no sirve para nada. Por eso las
 * sentencias se aplican EN ORDEN sobre un modelo mutable, igual que las
 * aplicaría Postgres.
 *
 * ─── Qué NO modela, a propósito ─────────────────────────────────────────────
 *
 * No se parsean las columnas de un `CREATE TABLE`. Su cuerpo trae constraints,
 * CHECKs y REFERENCES con comas adentro, y un parser aproximado de eso genera
 * falsos positivos — el veneno de esta herramienta. Se modela la TABLA que crea
 * y las columnas que después agrega un `ADD COLUMN`, que es exactamente la
 * forma de las dos fallas reales. Índices, constraints, COMMENT y backfills
 * tampoco entran: para eso está `schema_migrations`, que registra la corrida en
 * vez de deducirla.
 */

export interface DeclaredTable {
  /** Nombre actual, después de aplicar los RENAME que haya. */
  name: string
  /** Migración que le dio ese nombre: la que la creó, o la que la renombró. */
  migration: string
  /** Sólo las columnas agregadas por un ADD COLUMN posterior. Ver arriba. */
  columns: Map<string, string>
}

export interface MissingObject {
  migration: string
  kind: 'tabla' | 'columna'
  table: string
  column?: string
}

/** Saca los comentarios de línea. Este repo tiene mucha prosa con DDL adentro. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

/**
 * Parte en sentencias. Es el mismo criterio que usan los runners (`;` como
 * separador) y alcanza porque ninguna migración tiene un `;` dentro de un
 * literal — la única con cuerpo `$$` es la 001, cuya función no declara tablas.
 */
function statements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function migrationFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^\d{3}-.*\.sql$/.test(f))
    .sort()
}

/**
 * Aplica las migraciones en orden y devuelve el esquema resultante.
 *
 * `readFile` se inyecta para que el test no necesite escribir archivos.
 */
export function buildSchemaModel(
  files: string[],
  readFile: (file: string) => string,
): Map<string, DeclaredTable> {
  const tables = new Map<string, DeclaredTable>()

  for (const file of files) {
    const version = file.slice(0, 3)

    for (const stmt of statements(stripComments(readFile(file)))) {
      // ── DROP TABLE ──
      const dropTable = /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i.exec(stmt)
      if (dropTable) {
        tables.delete(dropTable[1].toLowerCase())
        continue
      }

      // ── CREATE TABLE ──
      const createTable = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i.exec(stmt)
      if (createTable) {
        const name = createTable[1].toLowerCase()
        // Un CREATE TABLE IF NOT EXISTS sobre algo que el modelo ya tiene no
        // reclama la autoría: la 016 renombra y después crea, y la migración
        // que manda es la del rename.
        if (!tables.has(name)) {
          tables.set(name, { name, migration: version, columns: new Map() })
        }
        continue
      }

      // ── ALTER TABLE ──
      // `IF EXISTS` va entre ALTER TABLE y el nombre (lo usa la 016).
      const alter = /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)([\s\S]*)$/i.exec(stmt)
      if (!alter) continue

      const tableName = alter[1].toLowerCase()
      const body = alter[2]

      // RENAME TO — sólo de tabla. `ALTER INDEX ... RENAME TO` no entra acá
      // porque no matcheó el ALTER TABLE de arriba.
      const renameTable = /^\s*RENAME\s+TO\s+([a-z_][a-z0-9_]*)/i.exec(body)
      if (renameTable) {
        const nuevo = renameTable[1].toLowerCase()
        const actual = tables.get(tableName)
        if (actual) {
          tables.delete(tableName)
          tables.set(nuevo, { ...actual, name: nuevo, migration: version })
        }
        continue
      }

      const renameColumn = /^\s*RENAME\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+TO\s+([a-z_][a-z0-9_]*)/i.exec(body)
      if (renameColumn) {
        const tabla = tables.get(tableName)
        const [, viejo, nuevo] = renameColumn.map((s) => (s ? s.toLowerCase() : s))
        if (tabla?.columns.has(viejo)) {
          tabla.columns.delete(viejo)
          tabla.columns.set(nuevo, version)
        }
        continue
      }

      const tabla = tables.get(tableName)
      if (!tabla) continue

      // DROP COLUMN. El `\bCOLUMN\b` es lo que separa esto de
      // `ALTER COLUMN x DROP NOT NULL` y `ALTER COLUMN x DROP DEFAULT`, que
      // aparecen en las migraciones 006, 013, 015, 016 y 021 y no borran nada.
      for (const m of body.matchAll(/\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
        tabla.columns.delete(m[1].toLowerCase())
      }

      // ADD COLUMN. Un solo ALTER puede traer varios, separados por coma.
      for (const m of body.matchAll(/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
        const col = m[1].toLowerCase()
        if (!tabla.columns.has(col)) tabla.columns.set(col, version)
      }
    }
  }

  return tables
}

/** Lee las migraciones de un directorio y arma el modelo. */
export function buildSchemaModelFromDir(dir: string): Map<string, DeclaredTable> {
  return buildSchemaModel(migrationFiles(dir), (file) => readFileSync(`${dir}/${file}`, 'utf8'))
}

/** Qué declara el repo y la base no tiene. */
export function diffAgainstDatabase(
  model: Map<string, DeclaredTable>,
  actualTables: Set<string>,
  actualColumns: Set<string>,
): MissingObject[] {
  const missing: MissingObject[] = []

  for (const table of model.values()) {
    if (!actualTables.has(table.name)) {
      missing.push({ migration: table.migration, kind: 'tabla', table: table.name })
      // Sin la tabla, listar sus columnas es ruido: la falta es una sola.
      continue
    }

    for (const [column, migration] of table.columns) {
      if (!actualColumns.has(`${table.name}.${column}`)) {
        missing.push({ migration, kind: 'columna', table: table.name, column })
      }
    }
  }

  return missing.sort((a, b) => a.migration.localeCompare(b.migration) || a.table.localeCompare(b.table))
}
