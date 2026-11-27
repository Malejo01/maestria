import { describe, expect, it } from 'vitest'
import { diasDeEvidencia, fraseDeEvidencia } from './evidencia-del-muro'

const AHORA = new Date('2026-11-27T15:00:00Z')
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString()

describe('fraseDeEvidencia (AB6)', () => {
  it('con evidencia: cuántos, cuántos ejercicios, en cuántos días y el tema más flojo', () => {
    expect(fraseDeEvidencia({ alumnos: 2, ejercicios: 46, desde: hace(8.5), temaMasFlojo: 'Funciones: dominio e imagen' }, AHORA, 2)).toBe(
      'Tus 2 alumnos hicieron 46 ejercicios en 9 días. El tema más flojo: funciones.',
    )
  })
  it('un alumno, un día, sin tema flojo medido: no inventa el tema', () => {
    expect(fraseDeEvidencia({ alumnos: 1, ejercicios: 1, desde: hace(0.2), temaMasFlojo: null }, AHORA, 2)).toBe('Tu alumno hizo 1 ejercicio en 1 día.')
  })
  it('sin práctica (o sin datos): el texto honesto', () => {
    const honesto = 'Todavía no practicaron: probá primero con tus 2 alumnos.'
    expect(fraseDeEvidencia({ alumnos: 0, ejercicios: 0, desde: null, temaMasFlojo: null }, AHORA, 2)).toBe(honesto)
    expect(fraseDeEvidencia(null, AHORA, 2)).toBe(honesto)
  })
  it('diasDeEvidencia: al menos 1, null sin fecha', () => {
    expect(diasDeEvidencia(null, AHORA)).toBeNull()
    expect(diasDeEvidencia(hace(0), AHORA)).toBe(1)
    expect(diasDeEvidencia('basura', AHORA)).toBeNull()
  })
})
