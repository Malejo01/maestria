import { describe, expect, it } from 'vitest'
import { anonimizarRespaldo, faltaParaRespaldar, nombreDelRespaldo, pedidoAutorizado, respaldosABorrar, respaldoValido, resumenDelRespaldo, TABLAS_CRITICAS } from './respaldo'

const AHORA = new Date('2026-11-23T06:30:00Z')
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString()

describe('la válvula y el secreto', () => {
  it('sin el token de Blob o sin el secreto, no corre y dice qué falta', () => {
    expect(faltaParaRespaldar({})).toEqual(['BLOB_READ_WRITE_TOKEN', 'RESPALDO_SECRETO'])
    expect(faltaParaRespaldar({ BLOB_READ_WRITE_TOKEN: 'x', RESPALDO_SECRETO: ' ' })).toEqual(['RESPALDO_SECRETO'])
    expect(faltaParaRespaldar({ BLOB_READ_WRITE_TOKEN: 'x', RESPALDO_SECRETO: 'y' })).toEqual([])
  })
  it('sólo con el Bearer exacto', () => {
    expect(pedidoAutorizado('Bearer abc', 'abc')).toBe(true)
    expect(pedidoAutorizado('Bearer abd', 'abc')).toBe(false)
    expect(pedidoAutorizado('abc', 'abc')).toBe(false)
    expect(pedidoAutorizado(null, 'abc')).toBe(false)
    expect(pedidoAutorizado('Bearer ', undefined)).toBe(false)
  })
})

describe('nombre y retención', () => {
  it('uno por día', () => {
    expect(nombreDelRespaldo(AHORA)).toBe('respaldos-json/maestria-2026-11-23.json.gz')
  })
  it('borra los de más de 14 días, nunca el más nuevo, y no toca otros prefijos', () => {
    const blobs = [
      { pathname: 'respaldos-json/a', uploadedAt: hace(1) },
      { pathname: 'respaldos-json/b', uploadedAt: hace(13) },
      { pathname: 'respaldos-json/c', uploadedAt: hace(15) },
      { pathname: 'respaldos-json/d', uploadedAt: hace(40) },
      { pathname: 'db-backups/e', uploadedAt: hace(90) },
    ]
    expect(respaldosABorrar(blobs, AHORA).map((b) => b.pathname)).toEqual(['respaldos-json/c', 'respaldos-json/d'])
    expect(respaldosABorrar([{ pathname: 'respaldos-json/solo', uploadedAt: hace(60) }], AHORA)).toEqual([])
  })
})

describe('el contenido', () => {
  const r = {
    version: 1,
    creadoEl: AHORA.toISOString(),
    origen: 'ep-x.neon.tech',
    tablas: {
      users: [
        { id: 'u1', email: 'real@gmail.com', name: 'Ana Real', image: 'https://foto' },
        { id: 'u2', email: 'otro@gmail.com', name: 'Beto', image: null },
      ],
      classroom_members: [{ user_id: 'u2', display_name: 'Beto Pérez' }],
      pagos: [{ id: 1, mp_payment_id: '123', mp_preference_id: 'p' }],
    },
  }
  it('valida la forma', () => {
    expect(respaldoValido(r)).toBe(true)
    expect(respaldoValido({ ...r, version: 2 })).toBe(false)
    expect(respaldoValido({ ...r, tablas: { quiz_answers: [] } })).toBe(false)
  })
  it('anonimiza para staging: sin emails, nombres, fotos ni ids de Mercado Pago', () => {
    const a = anonimizarRespaldo(r)
    expect(a.tablas.users).toEqual([
      { id: 'u1', email: 'usuario1@staging.invalid', name: 'Usuario 1', image: null },
      { id: 'u2', email: 'usuario2@staging.invalid', name: 'Usuario 2', image: null },
    ])
    expect(a.tablas.classroom_members[0].display_name).toBe('Alumno 2')
    expect(a.tablas.pagos[0]).toMatchObject({ mp_payment_id: null, mp_preference_id: null })
    expect(JSON.stringify(a)).not.toMatch(/gmail|Ana Real|Beto/)
  })
  it('el resumen sigue el orden de restauración; las tablas sensibles no están en la lista', () => {
    expect(resumenDelRespaldo(r)).toEqual([
      { tabla: 'users', filas: 2 },
      { tabla: 'classroom_members', filas: 1 },
      { tabla: 'pagos', filas: 1 },
    ])
    expect(TABLAS_CRITICAS).not.toContain('accounts')
    expect(TABLAS_CRITICAS).not.toContain('verification_tokens')
    expect(TABLAS_CRITICAS.indexOf('users')).toBeLessThan(TABLAS_CRITICAS.indexOf('quiz_attempts'))
    expect(TABLAS_CRITICAS.indexOf('quiz_attempts')).toBeLessThan(TABLAS_CRITICAS.indexOf('quiz_answers'))
  })
})
