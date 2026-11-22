import { describe, expect, it } from 'vitest'
import { armarAviso, fechaCorta, idsDesdeElCuerpo, mensajeDelAdmin, nombreDePila, veAvisos, type AvisoPendiente } from './avisos-de-reporte'

const clarita: AvisoPendiente = {
  id: 6,
  reportadoEl: '2026-11-20T18:40:00.000Z',
  cuestionario: 'Matemática - Mixto - 20/11/2026',
  respuesta: null,
  respondidoPor: 'Mauro',
}

describe('N1 · el texto del aviso', () => {
  it('uno, con el texto por defecto', () => {
    expect(armarAviso([clarita])).toEqual({
      ids: [6],
      titulo:
        'Gracias por avisarnos. Lo que reportaste el 20/11 sobre una pregunta de «Matemática - Mixto - 20/11/2026» ya está corregido.',
      renglones: [{ id: 6, texto: '', mensaje: null }],
    })
  })

  it('con mensaje del admin, firmado', () => {
    const aviso = armarAviso([{ ...clarita, respuesta: '  Cambié la pregunta 3.  ' }])
    expect(aviso?.renglones[0].mensaje).toBe('Mauro te dejó un mensaje: Cambié la pregunta 3.')
  })

  it('un mensaje sin firma no inventa un nombre', () => {
    const aviso = armarAviso([{ ...clarita, respuesta: 'Listo', respondidoPor: null }])
    expect(aviso?.renglones[0].mensaje).toBe('Te dejamos un mensaje: Listo')
  })

  it('sin cuestionario (un reporte de antes de la 029)', () => {
    expect(armarAviso([{ ...clarita, cuestionario: null }])?.titulo).toBe(
      'Gracias por avisarnos. Lo que reportaste el 20/11 ya está corregido.',
    )
  })

  it('varios van juntos, del más viejo al más nuevo, sin repetir', () => {
    const otro: AvisoPendiente = { ...clarita, id: 9, reportadoEl: '2026-09-30T12:00:00.000Z', cuestionario: null, respuesta: 'Gracias' }
    const aviso = armarAviso([clarita, otro, clarita])
    expect(aviso?.ids).toEqual([9, 6])
    expect(aviso?.titulo).toBe('Gracias por avisarnos. Ya corregimos los 2 problemas que reportaste:')
    expect(aviso?.renglones.map((r) => r.texto)).toEqual([
      'El del 30/09.',
      'El del 20/11, sobre una pregunta de «Matemática - Mixto - 20/11/2026».',
    ])
    expect(aviso?.renglones[0].mensaje).toBe('Mauro te dejó un mensaje: Gracias')
  })

  it('sin pendientes, no hay aviso', () => {
    expect(armarAviso([])).toBeNull()
  })

  it('la fecha es la de Argentina: un reporte de las 23:30 no pasa al día siguiente', () => {
    expect(fechaCorta('2026-11-21T02:30:00.000Z')).toBe('20/11')
    expect(fechaCorta('no es fecha')).toBe('')
  })
})

describe('N1 · quién ve avisos', () => {
  it('un invitado y un usuario con cuenta, sí; el admin, no; sin sesión, no', () => {
    expect(veAvisos({ isGuest: true, esAdmin: false })).toBe(true)
    expect(veAvisos({ isGuest: false, esAdmin: false })).toBe(true)
    expect(veAvisos({ isGuest: false, esAdmin: true })).toBe(false)
    expect(veAvisos(null)).toBe(false)
  })
})

describe('N1 · lo que llega del cliente', () => {
  it('ids: enteros positivos, sin repetir, hasta 50', () => {
    expect(idsDesdeElCuerpo({ ids: [6, '9', 6, -1, 1.5, 'x'] })).toEqual([6, 9])
    expect(idsDesdeElCuerpo({ ids: Array.from({ length: 80 }, (_, i) => i + 1) })).toHaveLength(50)
    expect(idsDesdeElCuerpo(null)).toEqual([])
    expect(idsDesdeElCuerpo({ ids: 'todos' })).toEqual([])
  })

  it('el mensaje del admin: recortado, vacío es null', () => {
    expect(mensajeDelAdmin('  hola  ')).toBe('hola')
    expect(mensajeDelAdmin('   ')).toBeNull()
    expect(mensajeDelAdmin(4)).toBeNull()
    expect(mensajeDelAdmin('x'.repeat(2000))).toHaveLength(1000)
  })

  it('el nombre de pila', () => {
    expect(nombreDePila('Mauro Lizarraga')).toBe('Mauro')
    expect(nombreDePila('  ')).toBeNull()
    expect(nombreDePila(null)).toBeNull()
  })
})
