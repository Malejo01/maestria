import { describe, expect, it } from 'vitest'
import {
  comparisonSet,
  countLeaks,
  countOutsideDomain,
  hostOf,
  originHostMatches,
  parseConnectionParts,
  renderStagingEnvFile,
} from './staging-branch'

const PROD_URL =
  'postgresql://neondb_owner:npg_secreto@ep-twilight-smoke-am4b6vzf-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'

describe('parseConnectionParts', () => {
  it('saca host, base y rol de la connection string', () => {
    expect(parseConnectionParts(PROD_URL)).toEqual({
      host: 'ep-twilight-smoke-am4b6vzf-pooler.c-5.us-east-1.aws.neon.tech',
      database: 'neondb',
      role: 'neondb_owner',
    })
  })

  it('desescapa un rol con caracteres codificados', () => {
    const parts = parseConnectionParts('postgresql://due%C3%B1o:x@host.neon.tech/basedatos')
    expect(parts.role).toBe('dueño')
    expect(parts.database).toBe('basedatos')
  })

  it('falla cuando falta la base', () => {
    expect(() => parseConnectionParts('postgresql://user:x@host.neon.tech')).toThrow(/host, base y usuario/)
  })
})

describe('hostOf', () => {
  it('devuelve sólo el host, sin la contraseña', () => {
    expect(hostOf(PROD_URL)).toBe('ep-twilight-smoke-am4b6vzf-pooler.c-5.us-east-1.aws.neon.tech')
  })
})

describe('originHostMatches', () => {
  it('acepta el mismo host con y sin sufijo -pooler', () => {
    // `markEnvironment` guarda el host crudo y `run-migration-017` el
    // normalizado: según cuál escribió último, la fila tiene o no `-pooler`.
    // Comparar en crudo daría un falso negativo en el chequeo que confirma que
    // la branch verificada es la que acabamos de crear.
    expect(originHostMatches('ep-uno-pooler.us-east-1.aws.neon.tech', 'ep-uno.us-east-1.aws.neon.tech')).toBe(true)
    expect(originHostMatches('ep-uno.us-east-1.aws.neon.tech', 'ep-uno-pooler.us-east-1.aws.neon.tech')).toBe(true)
  })

  it('rechaza el host de otra branch', () => {
    // El caso que importa: la branch quedó marcada con el origin_host de
    // producción, o sea que la marca de `staging` nunca se escribió sobre ella.
    expect(originHostMatches('ep-produccion.us-east-1.aws.neon.tech', 'ep-staging.us-east-1.aws.neon.tech')).toBe(false)
  })

  it('rechaza un origin_host ausente', () => {
    expect(originHostMatches(null, 'ep-uno.us-east-1.aws.neon.tech')).toBe(false)
  })
})

describe('countLeaks', () => {
  const reales = comparisonSet([
    'lizarragamauroalejandro@gmail.com',
    'Cinthia Flores',
    '106938271625384019283',
    null,
    '   ',
  ])

  it('no cuenta nada cuando la branch quedó anonimizada', () => {
    expect(countLeaks(reales, ['usuario1@staging.invalid', 'Ana Álvarez', 'stg-user-0001'])).toBe(0)
  })

  it('detecta un valor real sobreviviente', () => {
    expect(countLeaks(reales, ['usuario1@staging.invalid', 'Cinthia Flores'])).toBe(1)
  })

  it('detecta una fuga aunque cambien mayúsculas o espacios', () => {
    // Una columna que el anonimizador reescribe con otro `initcap` seguiría
    // siendo la misma persona. Comparar en crudo la dejaría pasar.
    expect(countLeaks(reales, ['  CINTHIA FLORES  '])).toBe(1)
  })

  it('ignora nulos, que son legítimos (los invitados no tienen email)', () => {
    expect(countLeaks(reales, [null, undefined])).toBe(0)
  })

  it('no cuenta el vacío como fuga aunque producción tenga filas en blanco', () => {
    expect(countLeaks(reales, ['', '   '])).toBe(0)
  })

  it('cuenta cada fila fugada, no cada valor distinto', () => {
    expect(countLeaks(reales, ['Cinthia Flores', 'Cinthia Flores'])).toBe(2)
  })
})

describe('countOutsideDomain', () => {
  it('cuenta los que no están en el dominio reservado', () => {
    expect(countOutsideDomain(
      ['usuario1@staging.invalid', 'alguien@gmail.com', 'usuario2@STAGING.INVALID'],
      'staging.invalid',
    )).toBe(1)
  })

  it('da cero con todo anonimizado', () => {
    expect(countOutsideDomain(['usuario1@staging.invalid'], 'staging.invalid')).toBe(0)
  })
})

describe('renderStagingEnvFile', () => {
  const rendered = renderStagingEnvFile({
    pooledUrl: 'postgresql://u:p@ep-stg-pooler.neon.tech/neondb',
    unpooledUrl: 'postgresql://u:p@ep-stg.neon.tech/neondb',
    projectId: 'noisy-smoke-23995229',
    branchName: 'staging',
    branchId: 'br-abc-123',
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
  })

  it('escribe las dos URLs y el proyecto', () => {
    expect(rendered).toContain('DATABASE_URL=postgresql://u:p@ep-stg-pooler.neon.tech/neondb')
    expect(rendered).toContain('DATABASE_URL_UNPOOLED=postgresql://u:p@ep-stg.neon.tech/neondb')
    expect(rendered).toContain('NEON_PROJECT_ID=noisy-smoke-23995229')
  })

  it('deja rastro de qué branch es y cuándo se creó', () => {
    expect(rendered).toContain('br-abc-123')
    expect(rendered).toContain('2026-08-15T10:00:00.000Z')
  })

  it('NO copia los secretos que tienen que diferir de producción', () => {
    // docs/staging.md §2.5: compartir AUTH_SECRET hace que una sesión de staging
    // valga en producción. Si alguien "completa" este archivo copiándolo de
    // .env.local, esto tiene que fallar.
    expect(rendered).not.toMatch(/^AUTH_SECRET=/m)
    expect(rendered).not.toMatch(/^NEXTAUTH_SECRET=/m)
    expect(rendered).not.toMatch(/^GOOGLE_CLIENT_SECRET=/m)
    expect(rendered).not.toMatch(/^GOOGLE_GENERATIVE_AI_API_KEY=/m)
    // Y los nombra para que se sepa que faltan a propósito.
    expect(rendered).toContain('AUTH_SECRET')
  })
})
