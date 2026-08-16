import { describe, it, expect } from 'vitest'
import { isSessionProfileStale } from './session-profile-sync'

describe('isSessionProfileStale', () => {
  it('detecta el caso de los 31: la base ya está migrada y el token no', () => {
    expect(
      isSessionProfileStale(
        { nivel: 'Superior', grado: '1er Año' },
        { nivel: 'Secundario', grado: '4to Año' },
      ),
    ).toBe(true)
  })

  it('detecta un cambio sólo de grado', () => {
    expect(
      isSessionProfileStale({ nivel: 'Secundario', grado: '5to Año' }, { nivel: 'Secundario', grado: '4to Año' }),
    ).toBe(true)
  })

  it('no dispara cuando coinciden', () => {
    expect(
      isSessionProfileStale({ nivel: 'Superior', grado: '1er Año' }, { nivel: 'Superior', grado: '1er Año' }),
    ).toBe(false)
  })

  // Los tres de abajo son los que importan: un falso positivo acá es un request
  // a /api/auth por cada carga de página, para todos los usuarios logueados.
  it('trata null y undefined como iguales', () => {
    expect(isSessionProfileStale({ nivel: null, grado: null }, { nivel: undefined, grado: undefined })).toBe(false)
    expect(isSessionProfileStale({ nivel: undefined, grado: undefined }, { nivel: null, grado: null })).toBe(false)
  })

  it('no dispara para un usuario sin nivel ni grado cargados', () => {
    // El endpoint de perfil mapea columnas vacías a undefined y el JWT las
    // guarda como null. Comparando crudo, todo K-12 sin onboarding completo
    // refrescaría la sesión en cada carga.
    expect(isSessionProfileStale({}, {})).toBe(false)
  })

  it('no dispara mientras falta alguno de los dos lados', () => {
    expect(isSessionProfileStale(null, { nivel: 'Superior', grado: '1er Año' })).toBe(false)
    expect(isSessionProfileStale({ nivel: 'Superior', grado: '1er Año' }, null)).toBe(false)
    expect(isSessionProfileStale(undefined, undefined)).toBe(false)
  })

  it('sí dispara cuando la base tiene valor y la sesión no', () => {
    expect(isSessionProfileStale({ nivel: 'Superior', grado: '1er Año' }, { nivel: null, grado: null })).toBe(true)
  })
})
