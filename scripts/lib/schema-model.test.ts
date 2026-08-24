import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { buildSchemaModel, buildSchemaModelFromDir, diffAgainstDatabase } from './schema-model'

/** Arma un modelo a partir de SQL en memoria, sin tocar el disco. */
function modelFrom(files: Record<string, string>) {
  return buildSchemaModel(Object.keys(files).sort(), (f) => files[f])
}

describe('buildSchemaModel', () => {
  it('registra las tablas que crea y las columnas que agrega', () => {
    const model = modelFrom({
      '001-base.sql': 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);',
      '002-extra.sql': 'ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;',
    })

    expect([...model.keys()]).toEqual(['users'])
    expect(model.get('users')!.migration).toBe('001')
    expect([...model.get('users')!.columns.keys()]).toEqual(['role'])
    expect(model.get('users')!.columns.get('role')).toBe('002')
  })

  it('toma varios ADD COLUMN de un mismo ALTER', () => {
    const model = modelFrom({
      '001-base.sql': 'CREATE TABLE IF NOT EXISTS users (id TEXT);',
      '002-extra.sql': `
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS claimed_by_user_id TEXT REFERENCES users(id);`,
    })

    expect([...model.get('users')!.columns.keys()]).toEqual(['is_guest', 'claimed_by_user_id'])
  })

  /**
   * La regresión que motivó el módulo. El primer prototipo sólo acumulaba
   * CREATE/ADD y reportó `ai_generation_log` como faltante en producción: no
   * falta, la 016 la renombró. Un detector que grita por algo que está bien
   * deja de leerse, y entonces no sirve para nada.
   */
  it('sigue un RENAME TO en vez de reclamar el nombre viejo', () => {
    const model = modelFrom({
      '015-classrooms.sql': 'CREATE TABLE IF NOT EXISTS ai_generation_log (id SERIAL PRIMARY KEY);',
      '016-ai-usage-log.sql': 'ALTER TABLE IF EXISTS ai_generation_log RENAME TO ai_usage_log;',
    })

    expect(model.has('ai_generation_log')).toBe(false)
    expect(model.has('ai_usage_log')).toBe(true)
    // La migración que manda pasa a ser la del rename: es el runner que hay que
    // correr si el nombre nuevo no está.
    expect(model.get('ai_usage_log')!.migration).toBe('016')
  })

  it('conserva las columnas al renombrar la tabla', () => {
    const model = modelFrom({
      '001-a.sql': 'CREATE TABLE IF NOT EXISTS vieja (id SERIAL);',
      '002-b.sql': 'ALTER TABLE vieja ADD COLUMN IF NOT EXISTS marca TEXT;',
      '003-c.sql': 'ALTER TABLE vieja RENAME TO nueva;',
    })

    expect([...model.get('nueva')!.columns.keys()]).toEqual(['marca'])
  })

  it('aplica RENAME COLUMN', () => {
    const model = modelFrom({
      '001-a.sql': 'CREATE TABLE IF NOT EXISTS t (id SERIAL);',
      '002-b.sql': 'ALTER TABLE t ADD COLUMN IF NOT EXISTS vieja TEXT;',
      '003-c.sql': 'ALTER TABLE t RENAME COLUMN vieja TO nueva;',
    })

    expect([...model.get('t')!.columns.keys()]).toEqual(['nueva'])
    expect(model.get('t')!.columns.get('nueva')).toBe('003')
  })

  it('aplica DROP COLUMN y DROP TABLE', () => {
    const model = modelFrom({
      '001-a.sql': 'CREATE TABLE IF NOT EXISTS t (id SERIAL);\nCREATE TABLE IF NOT EXISTS efimera (id SERIAL);',
      '002-b.sql': 'ALTER TABLE t ADD COLUMN IF NOT EXISTS temporal TEXT;',
      '003-c.sql': 'ALTER TABLE t DROP COLUMN temporal;\nDROP TABLE IF EXISTS efimera;',
    })

    expect(model.get('t')!.columns.size).toBe(0)
    expect(model.has('efimera')).toBe(false)
  })

  /**
   * `ALTER COLUMN x DROP NOT NULL` y `DROP DEFAULT` aparecen en las migraciones
   * 006, 013, 015, 016 y 021. No borran ninguna columna, y confundirlos con un
   * DROP COLUMN haría desaparecer del modelo columnas que sí existen — el
   * falso NEGATIVO, que es peor que el positivo porque no se ve.
   */
  it('no confunde ALTER COLUMN ... DROP NOT NULL con DROP COLUMN', () => {
    const model = modelFrom({
      '001-a.sql': 'CREATE TABLE IF NOT EXISTS quiz_answers (id SERIAL);',
      '002-b.sql': 'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;',
      '003-c.sql': 'ALTER TABLE quiz_answers ALTER COLUMN is_correct DROP NOT NULL;',
      '004-d.sql': 'ALTER TABLE quiz_answers ALTER COLUMN is_correct DROP DEFAULT;',
    })

    expect(model.get('quiz_answers')!.columns.has('is_correct')).toBe(true)
  })

  it('no se deja engañar por un ALTER INDEX ... RENAME TO', () => {
    const model = modelFrom({
      '001-a.sql': 'CREATE TABLE IF NOT EXISTS t (id SERIAL);',
      '002-b.sql': 'ALTER INDEX IF EXISTS idx_viejo RENAME TO idx_nuevo;',
    })

    expect(model.has('t')).toBe(true)
    expect(model.has('idx_nuevo')).toBe(false)
  })

  /**
   * Este repo documenta las decisiones en prosa arriba de cada migración, y esa
   * prosa nombra DDL: la 022 explica en un comentario qué haría meter la
   * carrera en otro lado. Tomar eso por sentencias inventa objetos que nadie
   * creó nunca, y el chequeo pasa a fallar siempre.
   */
  it('ignora el DDL que aparece dentro de comentarios', () => {
    const model = modelFrom({
      '001-a.sql': [
        '-- CREATE TABLE IF NOT EXISTS jamas_existio (id SERIAL);',
        '-- ALTER TABLE users ADD COLUMN fantasma TEXT;',
        'CREATE TABLE IF NOT EXISTS users (id TEXT);',
      ].join('\n'),
    })

    expect([...model.keys()]).toEqual(['users'])
    expect(model.get('users')!.columns.has('fantasma')).toBe(false)
  })
})

describe('diffAgainstDatabase', () => {
  const model = modelFrom({
    '001-a.sql': 'CREATE TABLE IF NOT EXISTS presente (id SERIAL);\nCREATE TABLE IF NOT EXISTS ausente (id SERIAL);',
    '002-b.sql': 'ALTER TABLE presente ADD COLUMN IF NOT EXISTS falta TEXT;',
  })

  it('señala la migración que hay que correr para cada objeto faltante', () => {
    const missing = diffAgainstDatabase(model, new Set(['presente']), new Set(['presente.id']))

    expect(missing).toEqual([
      { migration: '001', kind: 'tabla', table: 'ausente' },
      { migration: '002', kind: 'columna', table: 'presente', column: 'falta' },
    ])
  })

  it('no lista las columnas de una tabla que falta entera', () => {
    // Si no existe la tabla, sus columnas no son N hallazgos más: la falta es
    // una sola y el runner a correr también.
    const missing = diffAgainstDatabase(model, new Set([]), new Set([]))

    expect(missing.filter((m) => m.kind === 'columna')).toHaveLength(0)
    expect(missing.map((m) => m.table).sort()).toEqual(['ausente', 'presente'])
  })

  it('no reporta nada cuando la base tiene todo', () => {
    const missing = diffAgainstDatabase(
      model,
      new Set(['presente', 'ausente']),
      new Set(['presente.falta']),
    )

    expect(missing).toEqual([])
  })
})

describe('sobre las migraciones reales del repo', () => {
  const model = buildSchemaModelFromDir(join(process.cwd(), 'scripts'))

  it('no reclama ai_generation_log, que la 016 renombró', () => {
    expect(model.has('ai_generation_log')).toBe(false)
    expect(model.get('ai_usage_log')?.migration).toBe('016')
  })

  it('modela las tablas y columnas que motivaron el chequeo', () => {
    // 019 y 023: las dos migraciones que quedaron sin correr en producción.
    expect(model.has('feedback_reports')).toBe(true)
    expect(model.get('curriculum')?.columns.has('tipos_pregunta_sugeridos')).toBe(true)
    expect(model.get('curriculum')?.columns.get('tipos_pregunta_sugeridos')).toBe('023')
  })
})
