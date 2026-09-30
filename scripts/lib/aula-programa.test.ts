import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Sql } from './db-target'
import {
  aplicar,
  relevar,
  revertir,
  type BackupAula,
  type ProgramaSpec,
  type Relevamiento,
} from './aula-programa'

const raiz = join(__dirname, '..', '..')
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8')

/**
 * Lista de columnas de un `INSERT INTO <tabla> (...)`, normalizada. Sacar esto
 * del TEXTO de la ruta —y no de una constante compartida— es a propósito: la
 * ruta no importa nada del script, así que la única forma de que una columna
 * nueva en la ruta haga fallar algo acá es leer la ruta misma.
 */
function columnasInsert(fuente: string, tabla: string): string[] {
  const match = fuente.match(new RegExp(`INSERT INTO ${tabla}\\s*\\(([^)]*)\\)`))
  if (!match) throw new Error(`No hay INSERT INTO ${tabla}`)
  return match[1]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

/** Columnas que el `ON CONFLICT ... DO UPDATE SET` reescribe. */
function columnasUpsert(fuente: string, tabla: string): string[] {
  const desde = fuente.indexOf(`INSERT INTO ${tabla}`)
  const bloque = fuente.slice(desde, fuente.indexOf('`', desde))
  return [...bloque.matchAll(/^\s*(\w+)\s*=/gm)].map((m) => m[1]).sort()
}

describe('la réplica del SQL coincide con las rutas', () => {
  const script = leer('scripts/lib/aula-programa.ts')

  it('teacher_programs: mismas columnas y en el mismo orden que POST /api/teacher/programs', () => {
    const ruta = leer('app/api/teacher/programs/route.ts')
    expect(columnasInsert(script, 'teacher_programs')).toEqual(columnasInsert(ruta, 'teacher_programs'))
  })

  it('teacher_programs: mismos literales de estado y vencimiento que la ruta', () => {
    const ruta = leer('app/api/teacher/programs/route.ts')
    for (const literal of ["NOW() + INTERVAL '24 hours'", "'active'"]) {
      expect(ruta).toContain(literal)
      expect(script).toContain(literal)
    }
  })

  it('subjects: mismas columnas y mismo DO UPDATE que upsertTeacherSubject', () => {
    const lib = leer('lib/subjects.ts')
    expect(columnasInsert(script, 'subjects')).toEqual(columnasInsert(lib, 'subjects'))
    // El largo fija que el parser encontró el bloque: dos listas vacías serían iguales.
    expect(columnasUpsert(lib, 'subjects')).toEqual(['color_name', 'display_name', 'icon_name', 'nivel', 'updated_at'])
    expect(columnasUpsert(script, 'subjects')).toEqual(columnasUpsert(lib, 'subjects'))
    expect(lib).toContain('`teacher-${params.programId}-${slugifySubject(params.subjectName)}`')
    expect(script).toContain('`teacher-${programaId}-${slugifySubject(spec.materia)}`')
  })

  it("classrooms: mismas columnas que POST /api/teacher/classrooms, con status 'open'", () => {
    const ruta = leer('app/api/teacher/classrooms/route.ts')
    expect(columnasInsert(script, 'classrooms')).toEqual(columnasInsert(ruta, 'classrooms'))
    expect(ruta).toContain("'open', NOW(), NOW()")
    expect(script).toContain("'open', NOW(), NOW()")
  })
})

// ─── Doble de la base ──────────────────────────────────────────────────────

interface Llamada {
  texto: string
  valores: unknown[]
}

/**
 * Tagged template que registra cada sentencia y contesta según una tabla de
 * respuestas por regex. Lo que importa acá es QUÉ sentencias se emiten (si
 * alguna escribe), no simular Postgres.
 */
function baseFalsa(respuestas: [RegExp, unknown[]][] = []) {
  const llamadas: Llamada[] = []
  const fn = (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ').trim()
    llamadas.push({ texto, valores })
    const respuesta = respuestas.find(([patron]) => patron.test(texto))
    return Promise.resolve(respuesta ? respuesta[1] : [])
  }
  const escrituras = () => llamadas.filter((l) => /^(INSERT|UPDATE|DELETE)\b/i.test(l.texto))
  return { sql: fn as unknown as Sql, llamadas, escrituras }
}

const SPEC: ProgramaSpec = {
  materia: 'Matemática y su Didáctica',
  nivel: 'Superior',
  grado: '1er Año',
  jurisdiccion: 'Salta',
  icono: 'sigma',
  color: 'teal',
  unidades: [{ id: 'tp-u-1', name: 'Unidad I', topics: [{ id: 'tp-u-1-t-1', name: 'Tema', origin: 'custom' }] }],
  nombreAula: 'Aula de prueba',
}

const PERFIL = {
  level: 'Superior',
  degree: 'Profesorado de Educación Primaria',
  academicYear: '1er Año',
  complexity: 'Intermedia',
  assessmentStyle: 'mixto' as const,
  methodology: 'Resolución de problemas con análisis de producciones de alumnos.',
}

const DOCENTE = [/FROM users/, [{ id: 'u-1', role: 'DOCENTE' }]] as [RegExp, unknown[]]

function backupVacio(): BackupAula {
  return {
    generado: '2026-09-30T00:00:00Z',
    host: 'test',
    materia: SPEC.materia,
    programa_creado: null,
    subject_slug_creado: null,
    aula_creada: null,
    codigo_aula: null,
  }
}

describe('relevar (lo único que corre en dry-run)', () => {
  it('no emite ninguna escritura', async () => {
    const base = baseFalsa([DOCENTE])
    const estado = await relevar(base.sql, 'docente@ejemplo.com', SPEC)

    expect(estado).toEqual({ docente: { id: 'u-1', role: 'DOCENTE' }, programa: null, aula: null })
    expect(base.escrituras()).toEqual([])
    expect(base.llamadas.every((l) => l.texto.startsWith('SELECT'))).toBe(true)
  })

  it('falla claro si el docente no existe', async () => {
    const base = baseFalsa()
    await expect(relevar(base.sql, 'nadie@ejemplo.com', SPEC)).rejects.toThrow(/No existe ningún usuario/)
  })

  it('no rechaza a un docente con otro role: lo devuelve para que el script avise', async () => {
    const base = baseFalsa([[/FROM users/, [{ id: 'u-1', role: 'ALUMNO' }]]])
    const estado = await relevar(base.sql, 'docente@ejemplo.com', SPEC)
    expect(estado.docente.role).toBe('ALUMNO')
    expect(base.escrituras()).toEqual([])
  })
})

describe('aplicar', () => {
  const vacio: Relevamiento = { docente: { id: 'u-1', role: 'DOCENTE' }, programa: null, aula: null }

  it('crea programa, materia y aula, y deja el backup al día después de cada paso', async () => {
    const base = baseFalsa([
      [/^INSERT INTO teacher_programs/, [{ id: 99 }]],
      [/^INSERT INTO classrooms/, [{ id: 7, join_code: 'ABC234' }]],
    ])
    const backup = backupVacio()
    const snapshots: BackupAula[] = []

    const resultado = await aplicar(base.sql, SPEC, PERFIL, vacio, backup, (b) => snapshots.push({ ...b }))

    expect(resultado).toEqual({ programaId: 99, aulaId: 7, codigo: 'ABC234' })
    expect(base.escrituras().map((l) => l.texto.slice(0, 30))).toEqual([
      'INSERT INTO teacher_programs (',
      'INSERT INTO subjects (slug, di',
      'INSERT INTO classrooms (teache',
    ])
    expect(snapshots.map((s) => [s.programa_creado, s.subject_slug_creado, s.aula_creada])).toEqual([
      [99, null, null],
      [99, 'teacher-99-matematica-y-su-didactica', null],
      [99, 'teacher-99-matematica-y-su-didactica', 7],
    ])
  })

  it('manda el perfil y las unidades como JSON, con created_from manual', async () => {
    const base = baseFalsa([
      [/^INSERT INTO teacher_programs/, [{ id: 1 }]],
      [/^INSERT INTO classrooms/, [{ id: 1, join_code: 'X' }]],
    ])
    await aplicar(base.sql, SPEC, PERFIL, vacio, backupVacio(), () => {})
    const insert = base.escrituras()[0]

    expect(insert.valores).toContain(JSON.stringify(PERFIL))
    expect(insert.valores).toContain(JSON.stringify(SPEC.unidades))
    expect(insert.valores).toContain('manual')
  })

  it('es idempotente: con programa y aula existentes no escribe nada', async () => {
    const base = baseFalsa()
    const estado: Relevamiento = {
      ...vacio,
      programa: { id: 5 },
      aula: { id: 3, teacher_program_id: 5, name: SPEC.nombreAula, join_code: 'QWE789' },
    }
    const backup = backupVacio()

    const resultado = await aplicar(base.sql, SPEC, PERFIL, estado, backup, () => {})

    expect(resultado).toEqual({ programaId: 5, aulaId: 3, codigo: 'QWE789' })
    expect(base.escrituras()).toEqual([])
    expect(backup).toEqual(backupVacio())
  })

  it('con programa existente sólo crea el aula y no toca subjects', async () => {
    const base = baseFalsa([[/^INSERT INTO classrooms/, [{ id: 8, join_code: 'ZXC456' }]]])
    const backup = backupVacio()
    await aplicar(base.sql, SPEC, PERFIL, { ...vacio, programa: { id: 5 } }, backup, () => {})

    expect(base.escrituras().map((l) => l.texto.split(' (')[0])).toEqual(['INSERT INTO classrooms'])
    expect(backup.programa_creado).toBeNull()
    expect(backup.aula_creada).toBe(8)
  })

  it('no crea un programa sin metodología', async () => {
    const base = baseFalsa()
    await expect(
      aplicar(base.sql, SPEC, { ...PERFIL, methodology: '  ' }, vacio, backupVacio(), () => {}),
    ).rejects.toThrow(/metodología/)
    expect(base.escrituras()).toEqual([])
  })
})

describe('revertir', () => {
  const creado: BackupAula = {
    ...backupVacio(),
    programa_creado: 99,
    subject_slug_creado: 'teacher-99-matematica-y-su-didactica',
    aula_creada: 7,
    codigo_aula: 'ABC234',
  }
  const sinUso: [RegExp, unknown[]] = [/classroom_members/, [{ miembros: 0, asignaciones: 0, intentos: 0, cuestionarios: 0 }]]

  it('deshace lo creado en orden inverso (aula, materia, programa)', async () => {
    const base = baseFalsa([sinUso])
    await revertir(base.sql, creado)

    expect(base.escrituras().map((l) => [l.texto, l.valores])).toEqual([
      ['DELETE FROM classrooms WHERE id = ?', [7]],
      ['DELETE FROM subjects WHERE slug = ?', ['teacher-99-matematica-y-su-didactica']],
      ['DELETE FROM teacher_programs WHERE id = ?', [99]],
    ])
  })

  it('no toca lo que la corrida reutilizó', async () => {
    const base = baseFalsa([sinUso])
    await revertir(base.sql, { ...backupVacio(), aula_creada: 7 })
    expect(base.escrituras().map((l) => l.texto)).toEqual(['DELETE FROM classrooms WHERE id = ?'])
  })

  it('se niega si el aula ya tiene alumnos: las FK borrarían en cascada', async () => {
    const base = baseFalsa([[/classroom_members/, [{ miembros: 12, asignaciones: 0, intentos: 3, cuestionarios: 0 }]]])
    await expect(revertir(base.sql, creado)).rejects.toThrow(/12 miembro\(s\)[\s\S]*--forzar/)
    expect(base.escrituras()).toEqual([])
  })

  it('con --forzar revierte igual', async () => {
    const base = baseFalsa([[/classroom_members/, [{ miembros: 12, asignaciones: 0, intentos: 3, cuestionarios: 0 }]]])
    await revertir(base.sql, creado, { forzar: true })
    expect(base.escrituras()).toHaveLength(3)
  })
})
