import { describe, expect, it } from 'vitest'
import { caminoDelDocente, leerCamino, linkDeWhatsApp, pasePorAlumnoPorMes, precioAula, precioAulaCurso, precioAulaCursoAdicional } from './precios'

describe('B3 · los precios salen de las variables de entorno', () => {
  it('Aula: curso y adicional', () => {
    const env = { MAESTRIA_PRECIO_AULA_CURSO: '15000', MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL: '10000' }
    expect(precioAulaCurso(env)).toBe(15000)
    expect(precioAulaCursoAdicional(env)).toBe(10000)
    expect(precioAula(1, env)).toBe(15000)
    expect(precioAula(3, env)).toBe(35000)
    expect(precioAulaCurso({})).toBeNull()
    expect(precioAulaCurso({ MAESTRIA_PRECIO_AULA_CURSO: 'quince' })).toBeNull()
  })

  it('el pase por alumno por mes: pase de 1 bloque / 5 alumnos / 3 meses', () => {
    expect(pasePorAlumnoPorMes({ MAESTRIA_PRECIO_PASE_BLOQUE: '60000' })).toBe(4000)
    expect(pasePorAlumnoPorMes({ MAESTRIA_PRECIO_PASE_BLOQUE: '50000' })).toBe(3333)
    expect(pasePorAlumnoPorMes({})).toBeNull()
  })

  it('WhatsApp: el número de la variable, o nada', () => {
    expect(linkDeWhatsApp('Hola', { MAESTRIA_WHATSAPP_CONTACTO: '+54 9 11 1234-5678' })).toBe('https://wa.me/5491112345678?text=Hola')
    expect(linkDeWhatsApp('Hola', {})).toBeNull()
    expect(linkDeWhatsApp('Hola', { MAESTRIA_WHATSAPP_CONTACTO: 'mauro' })).toBeNull()
  })
})

describe('B3 · el camino', () => {
  it('de la URL', () => {
    expect(leerCamino('aula')).toBe('aula')
    expect(leerCamino('otra')).toBeNull()
  })
  it('del plan del docente', () => {
    expect(caminoDelDocente({ estado: 'activo', tipo: 'aula' })).toBe('aula')
    expect(caminoDelDocente({ estado: 'prueba', tipo: 'particular' })).toBe('particular')
    expect(caminoDelDocente({ estado: 'exento', tipo: 'particular' })).toBeNull()
    expect(caminoDelDocente(null)).toBeNull()
  })
})
