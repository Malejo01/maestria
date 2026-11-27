import { describe, expect, it } from 'vitest'
import { armarAvisoSemanal, claveDelAvisoSemanal, esDocenteDePrueba, lunesDe, recibeElAviso } from './aviso-semanal'
import { resumenDeLaSemana } from './esta-semana'

describe('el aviso de los lunes (AC5)', () => {
  it('la clave es el lunes de Argentina: el cron corre el lunes 12:00 UTC (9 h de acá)', () => {
    expect(lunesDe(new Date('2026-11-30T12:00:00Z'))).toBe('2026-11-30') // lunes
    expect(lunesDe(new Date('2026-12-02T15:00:00Z'))).toBe('2026-11-30') // miércoles de esa semana
    // Domingo 23 h de Argentina (lunes 02:00 UTC): todavía es la semana anterior.
    expect(lunesDe(new Date('2026-12-07T02:00:00Z'))).toBe('2026-11-30')
    expect(lunesDe(new Date('2026-12-07T12:00:00Z'))).toBe('2026-12-07')
  })

  it('idempotente: dos corridas el mismo lunes dan la misma clave (y el INSERT no duplica)', () => {
    const lunes = new Date('2026-11-30T12:00:00Z')
    const otraVez = new Date('2026-11-30T12:07:00Z')
    expect(claveDelAvisoSemanal(lunes)).toBe(claveDelAvisoSemanal(otraVez))
    expect(claveDelAvisoSemanal(new Date('2026-12-07T12:00:00Z'))).not.toBe(claveDelAvisoSemanal(lunes))
  })

  it('quién recibe: un docente real con al menos un alumno', () => {
    const conUno = resumenDeLaSemana([{ nombre: 'Ana', intentos: 0, ejercicios: 0, correctas: 0, calificadas: 0, temaMasFlojo: null }])
    const sinAlumnos = resumenDeLaSemana([])
    expect(recibeElAviso({ id: 'user_abc', nombre: 'Laura' }, conUno)).toBe(true)
    expect(recibeElAviso({ id: 'user_abc', nombre: 'Laura' }, sinAlumnos)).toBe(false)
    expect(recibeElAviso({ id: 'user_abc', nombre: 'Laura', ejemplo: true }, conUno)).toBe(false)
    expect(recibeElAviso({ id: 'aa4-docente-x1', nombre: 'Docente Nueva AA4' }, conUno)).toBe(false)
    expect(recibeElAviso({ id: 'stg-x', nombre: 'E2E · Docente 22/11' }, conUno)).toBe(false)
  })

  it('las cuentas de prueba', () => {
    expect(esDocenteDePrueba({ id: 'o13-docente-abc' })).toBe(true)
    expect(esDocenteDePrueba({ id: 'e2e-docente' })).toBe(true)
    expect(esDocenteDePrueba({ id: 'stg-user-0008', nombre: 'Irina Álvarez' })).toBe(false)
  })

  it('lo que dice: el título, el resumen de AB5 tal cual y el link al panel', () => {
    const resumen = resumenDeLaSemana([{ nombre: 'Juan', intentos: 1, ejercicios: 5, correctas: 4, calificadas: 5, temaMasFlojo: null }])
    const aviso = armarAvisoSemanal(resumen, new Date('2026-11-30T12:00:00Z'), 'Tu resumen de la semana')
    expect(aviso.clave).toBe('semana|2026-11-30')
    expect(aviso.detalle).toContain('Tu alumno practicó esta semana.')
    expect(aviso.detalle).toContain('Juan: 5 ejercicios, 80 % bien.')
    expect(aviso.href).toBe('/teacher')
  })
})
