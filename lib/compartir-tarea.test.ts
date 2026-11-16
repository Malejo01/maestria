import { describe, expect, it } from 'vitest'
import { aQuienSaludar, armarMensaje, deQueEs, fechaParaMensaje, linkDeWhatsApp } from './compartir-tarea'

const LINK = 'https://maestria-edu.vercel.app/aula/7K4P2M'
const base = { nombre: null, temas: ['Límites'], materia: 'Análisis I', link: LINK, hasta: null }

describe('armarMensaje', () => {
  it('con un solo alumno lo saluda por su primer nombre', () => {
    expect(armarMensaje({ ...base, nombre: 'Sofía Ramírez' })).toBe(
      ['Hola Sofía, te dejo la tarea de límites.', LINK, 'Entrás con tu nombre, no necesitás cuenta.'].join('\n'),
    )
  })

  it('para varios, el saludo no lleva nombre', () => {
    expect(armarMensaje(base).startsWith('Hola, te dejo la tarea de límites.')).toBe(true)
  })

  it('NO dice para cuándo si el docente no puso fecha', () => {
    const mensaje = armarMensaje(base)
    expect(mensaje).not.toMatch(/semana|hasta|tiempo/)
  })

  it('con fecha, dice hasta cuándo con día y fecha', () => {
    expect(armarMensaje({ ...base, hasta: new Date(2026, 11, 11, 23, 59) })).toContain('Tenés tiempo hasta el viernes 11/12.')
  })

  it('el link va solo en su renglón, para que WhatsApp lo vuelva tocable', () => {
    expect(armarMensaje(base).split('\n')[1]).toBe(LINK)
  })

  it('recuerda que se entra sin cuenta', () => {
    expect(armarMensaje(base)).toContain('no necesitás cuenta')
  })

  it('sin emojis ni signos de exclamación', () => {
    expect(armarMensaje({ ...base, nombre: 'Sofía' })).not.toMatch(/[!¡]|\p{Extended_Pictographic}/u)
  })
})

describe('deQueEs', () => {
  it('un tema: su nombre corto, en minúscula', () => {
    expect(deQueEs(['Clases de palabras: sustantivos propios y comunes.'], 'Lengua')).toBe('clases de palabras')
  })

  it('dos temas: los dos', () => {
    expect(deQueEs(['Límites', 'Derivadas'], 'Análisis I')).toBe('límites y derivadas')
  })

  it('tres o más: la materia, porque la lista no entra en una frase', () => {
    expect(deQueEs(['Límites', 'Derivadas', 'Integrales'], 'Análisis I')).toBe('Análisis I')
  })

  it('sin temas: la materia', () => {
    expect(deQueEs([], 'Física')).toBe('Física')
  })

  it('dos temas que se acortan a lo mismo cuentan como uno', () => {
    expect(deQueEs(['El verbo. Tiempo pasado', 'El verbo. Tiempo futuro'], 'Lengua')).toBe('el verbo')
  })
})

describe('fechaParaMensaje', () => {
  it('día de la semana y fecha, sin año', () => {
    expect(fechaParaMensaje(new Date(2026, 10, 15))).toBe('el domingo 15/11')
  })
})

describe('linkDeWhatsApp', () => {
  it('lleva el mensaje codificado, con sus saltos de línea', () => {
    const link = linkDeWhatsApp('Hola Sofía\nhttps://x.test/aula/ABC234')
    expect(link.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Hola Sofía\nhttps://x.test/aula/ABC234')
  })
})

describe('aQuienSaludar', () => {
  it('sólo nombra si hay exactamente una persona', () => {
    expect(aQuienSaludar([{ nombre: 'Sofía Ramírez' }])).toBe('Sofía Ramírez')
    expect(aQuienSaludar([{ nombre: 'Sofía' }, { nombre: 'Tomás' }])).toBeNull()
    expect(aQuienSaludar([])).toBeNull()
  })
})
