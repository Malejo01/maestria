import { afterEach, describe, expect, it, vi } from 'vitest'
import { quienEntroDe } from './quien-entro'

/** H4: el menú muestra los links de admin sólo a la lista de `ADMIN_EMAILS`. */
const docente = { displayName: 'Irina', email: 'irina@x.com', role: 'DOCENTE' as const, isGuest: false }

afterEach(() => vi.unstubAllEnvs())

describe('quienEntroDe', () => {
  it('un docente común no es admin', () => {
    vi.stubEnv('ADMIN_EMAILS', 'dueno@x.com')
    expect(quienEntroDe(docente)?.esAdmin).toBe(false)
  })

  it('sin ADMIN_EMAILS nadie es admin', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(quienEntroDe({ ...docente, email: 'dueno@x.com' })?.esAdmin).toBe(false)
  })

  it('la cuenta de la lista sí, sin importar mayúsculas', () => {
    vi.stubEnv('ADMIN_EMAILS', 'otro@x.com, Dueno@X.com')
    expect(quienEntroDe({ ...docente, email: 'dueno@x.com' })?.esAdmin).toBe(true)
  })

  it('un invitado nunca, aunque el email coincidiera', () => {
    vi.stubEnv('ADMIN_EMAILS', 'dueno@x.com')
    expect(quienEntroDe({ ...docente, email: 'dueno@x.com', isGuest: true })?.esAdmin).toBe(false)
  })

  it('sin viewer, nada', () => {
    expect(quienEntroDe(null)).toBeNull()
  })

  it('el resto pasa tal cual', () => {
    expect(quienEntroDe(docente)).toMatchObject({ nombre: 'Irina', email: 'irina@x.com', rol: 'DOCENTE', esInvitado: false })
  })
})
