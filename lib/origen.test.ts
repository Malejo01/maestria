import { describe, expect, it } from 'vitest'
import { cookieAGuardar, cookieDeOrigen, leerCookieDeOrigen, linkDeCanal, normalizarRef, origenDeLaUrl, porcentaje, resumenPorCanal } from './origen'

const hoy = new Date('2026-11-23T15:00:00Z')
const q = (s: string) => new URLSearchParams(s)

describe('origenDeLaUrl', () => {
  it('lee el canal y el referido', () => {
    expect(origenDeLaUrl(q('origen=IG&ref=sil-2026'))).toEqual({ origen: 'ig', ref: 'SIL-2026' })
  })
  it('un canal desconocido cuenta como "otro"; sin nada, null', () => {
    expect(origenDeLaUrl(q('origen=newsletter'))).toEqual({ origen: 'otro', ref: null })
    expect(origenDeLaUrl(q('utm_source=x'))).toBeNull()
  })
  it('un ref raro no se guarda', () => {
    expect(origenDeLaUrl(q('ref=<script>'))).toBeNull()
    expect(normalizarRef('ab')).toBeNull()
  })
})

describe('la cookie', () => {
  it('ida y vuelta', () => {
    const v = cookieDeOrigen({ origen: 'wa', ref: 'MAURO' }, hoy)
    expect(v).toBe('wa|MAURO|2026-11-23')
    expect(leerCookieDeOrigen(v)).toEqual({ origen: 'wa', ref: 'MAURO', el: '2026-11-23' })
    expect(leerCookieDeOrigen(encodeURIComponent(v))?.origen).toBe('wa')
  })
  it('la primera visita manda: con una cookie válida no se pisa', () => {
    expect(cookieAGuardar(null, q('origen=ig'), hoy)).toBe('ig||2026-11-23')
    expect(cookieAGuardar('ig||2026-11-20', q('origen=tt'), hoy)).toBeNull()
    expect(cookieAGuardar('basura', q('origen=tt'), hoy)).toBe('tt||2026-11-23')
    expect(cookieAGuardar(null, q(''), hoy)).toBeNull()
  })
})

describe('linkDeCanal', () => {
  it('arma el link con el canal y, si hay, el referido', () => {
    expect(linkDeCanal('https://maestria-edu.vercel.app/', 'yt')).toBe('https://maestria-edu.vercel.app/?origen=yt')
    expect(linkDeCanal('https://maestria.com.ar', 'wa', 'sil-2026')).toBe('https://maestria.com.ar/?origen=wa&ref=SIL-2026')
  })
})

describe('resumenPorCanal', () => {
  it('cuenta docentes, alumnos y la conversión de cada canal', () => {
    const filas = resumenPorCanal([
      { origen: 'ig', rol: 'DOCENTE', pasoDelEmbudo: 4 },
      { origen: 'ig', rol: 'DOCENTE', pasoDelEmbudo: 1 },
      { origen: 'ig', rol: 'ALUMNO' },
      { origen: 'wa', rol: 'DOCENTE', pasoDelEmbudo: 3 },
      { origen: null, rol: 'DOCENTE', pasoDelEmbudo: 5 },
      { origen: 'cualquiera', rol: 'ALUMNO' },
    ])
    expect(filas).toEqual([
      { canal: 'ig', docentes: 2, alumnos: 1, conTarea: 1, conAlumnos: 1 },
      { canal: 'wa', docentes: 1, alumnos: 0, conTarea: 1, conAlumnos: 0 },
      { canal: 'sin-dato', docentes: 1, alumnos: 1, conTarea: 1, conAlumnos: 1 },
    ])
    expect(porcentaje(1, 2)).toBe('50 %')
    expect(porcentaje(0, 0)).toBe('—')
  })
})
