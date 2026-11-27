import { describe, expect, it } from 'vitest'
import { cookieAGuardar, cookieDeOrigen, esCampana, leerCookieDeOrigen, linkDeCanal, NOMBRE_DEL_CANAL, normalizarRef, origenDeLaUrl, porcentaje, resumenPorCanal, separarRef } from './origen'

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

describe('AA2 · el canal Meta y las campañas', () => {
  it('origen=meta es un canal propio, «Anuncio de Meta»', () => {
    expect(origenDeLaUrl(q('origen=meta'))).toEqual({ origen: 'meta', ref: null })
    expect(origenDeLaUrl(q('origen=META'))?.origen).toBe('meta')
    expect(NOMBRE_DEL_CANAL.meta).toBe('Anuncio de Meta')
  })

  it('ref=AD-… es la campaña, no un código de referido', () => {
    const o = origenDeLaUrl(q('origen=meta&ref=AD-prueba'))
    expect(o).toEqual({ origen: 'meta', ref: null, campana: 'AD-PRUEBA' })
    expect(o?.ref).toBeNull()
    expect(esCampana('AD-reel-1')).toBe(true)
  })

  it('un referido de verdad sigue siendo referido, también con origen=meta', () => {
    expect(origenDeLaUrl(q('origen=meta&ref=SILVINA-AB12'))).toEqual({ origen: 'meta', ref: 'SILVINA-AB12' })
    expect(separarRef('ADRIANA-K7PQ')).toEqual({ ref: 'ADRIANA-K7PQ' })
    expect(esCampana('ADRIANA-K7PQ')).toBe(false)
  })

  it('«AD-» solo, sin nombre, no es ni campaña ni referido', () => {
    expect(separarRef('AD-')).toEqual({ ref: null })
    expect(origenDeLaUrl(q('ref=AD-'))).toBeNull()
  })

  it('la campaña viaja en la cookie y vuelve como campaña', () => {
    const valor = cookieAGuardar(null, q('origen=meta&ref=AD-prueba'), hoy)
    expect(valor).toBe('meta|AD-PRUEBA|2026-11-23')
    expect(leerCookieDeOrigen(valor)).toEqual({ origen: 'meta', ref: null, campana: 'AD-PRUEBA', el: '2026-11-23' })
    expect(cookieDeOrigen({ origen: 'meta', ref: null, campana: 'AD-X1' }, hoy)).toBe('meta|AD-X1|2026-11-23')
  })

  it('el link del canal Meta y la fila del resumen', () => {
    expect(linkDeCanal('https://maestria-edu.vercel.app', 'meta')).toBe('https://maestria-edu.vercel.app/?origen=meta')
    expect(resumenPorCanal([{ origen: 'meta', rol: 'DOCENTE', pasoDelEmbudo: 4 }])).toEqual([
      { canal: 'meta', docentes: 1, alumnos: 0, conTarea: 1, conAlumnos: 1 },
    ])
  })
})
