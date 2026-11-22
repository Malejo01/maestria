import { describe, expect, it } from 'vitest'
import { estadoEnElAvatar, etiquetaDelAvatar, huellaDelPlan, seAcreditoUnPlan } from './distintivo-del-plan'
import type { ResumenDelPlan } from './planes'

const base: ResumenDelPlan = {
  estado: 'activo',
  nivel: 2,
  cupo: 10,
  alumnos: 7,
  venceEl: '2026-12-22T12:00:00Z',
  diasRestantes: 30,
  avisoDePruebaPendiente: false,
  cupoGratis: 2,
  topeCuestionarios: 10,
  cuestionarios: null,
  docenteNuevo: false,
  tipo: 'particular',
  aulaCursos: 0,
  alumnosPorCurso: 35,
  permiteIndividual: true,
  permiteImprimirYMoodle: true,
  fundadoraDesde: null,
}

describe('B2 · el estado del plan en el avatar: los 6 estados', () => {
  it('pago Particular: birrete, "Plan Particular · 2 bloques", barra de 7 de 10', () => {
    const e = estadoEnElAvatar(base)
    expect(e).toMatchObject({ distintivo: 'birrete', punto: false, titulo: 'Plan Particular · 2 bloques', accion: null })
    expect(e.cupo).toEqual({ usados: 7, total: 10, texto: '7 de 10 alumnos' })
    expect(e.detalle).toBe('vence el 22/12')
    expect(e.estado).toBe('plan particular, vence el 22/12')
  })

  it('pago Aula: birrete, cursos, alumnos y cuestionarios del mes', () => {
    const e = estadoEnElAvatar({ ...base, tipo: 'aula', aulaCursos: 1, cupo: 35, alumnos: 31, cuestionarios: 42, topeCuestionarios: 60 })
    expect(e.titulo).toBe('Plan Aula · 1 curso')
    expect(e.cupo?.texto).toBe('31 de 35 alumnos')
    expect(e.detalle).toBe('42 de 60 cuestionarios · vence el 22/12')
  })

  it('fundadora: birrete con estrella, para siempre (también vencida o en gratis)', () => {
    const f = { ...base, fundadoraDesde: '2026-11-22T00:00:00Z' }
    expect(estadoEnElAvatar(f)).toMatchObject({ distintivo: 'birrete-estrella', fundadora: true })
    expect(estadoEnElAvatar({ ...f, estado: 'vencido' })).toMatchObject({ distintivo: 'birrete-estrella', punto: true })
    expect(estadoEnElAvatar({ ...f, estado: 'gratis', cuestionarios: 3 })).toMatchObject({ distintivo: 'birrete-estrella' })
  })

  it('prueba: reloj, "Prueba · quedan 12 días" y Elegir un plan', () => {
    const e = estadoEnElAvatar({ ...base, estado: 'prueba', nivel: 0, diasRestantes: 12 })
    expect(e).toMatchObject({ distintivo: 'reloj', titulo: 'Prueba · quedan 12 días', accion: { texto: 'Elegir un plan', href: '/precios' } })
  })

  it('gratis: sin distintivo, lo que le queda del mes y Pasate a un plan', () => {
    const e = estadoEnElAvatar({ ...base, estado: 'gratis', cuestionarios: 6, topeCuestionarios: 10, venceEl: null, diasRestantes: null })
    expect(e).toMatchObject({ distintivo: null, punto: false, titulo: 'Plan gratis', detalle: 'Te quedan 4 de 10 cuestionarios este mes' })
    expect(e.accion?.texto).toBe('Pasate a un plan')
  })

  it('vencido: punto ámbar, "Tu plan venció · tus alumnos sólo pueden ver" y Renovar', () => {
    const e = estadoEnElAvatar({ ...base, estado: 'vencido' })
    expect(e).toMatchObject({ distintivo: null, punto: true, titulo: 'Tu plan venció', detalle: 'Tus alumnos sólo pueden ver' })
    expect(e.accion?.texto).toBe('Renovar')
  })

  it('a 7 días de vencer: birrete con punto, "Vence en 7 días" y Renovar', () => {
    const e = estadoEnElAvatar({ ...base, diasRestantes: 7 })
    expect(e).toMatchObject({ distintivo: 'birrete', punto: true, detalle: 'Vence en 7 días', accion: { texto: 'Renovar', href: '/precios' } })
    expect(estadoEnElAvatar({ ...base, diasRestantes: 8 }).punto).toBe(false)
  })

  it('exento (admin) y sin datos: nada', () => {
    expect(estadoEnElAvatar({ ...base, estado: 'exento' }).distintivo).toBeNull()
    expect(estadoEnElAvatar(null).titulo).toBeNull()
  })
})

describe('B2 · nunca sólo el ícono', () => {
  it('el nombre del avatar dice el estado', () => {
    expect(etiquetaDelAvatar('Mauro', estadoEnElAvatar(base), 'Abrir el menú de tu cuenta')).toBe(
      'Mauro · plan particular, vence el 22/12. Abrir el menú de tu cuenta',
    )
    expect(etiquetaDelAvatar('Silvana', estadoEnElAvatar({ ...base, fundadoraDesde: '2026-11-22' }), 'Abrir')).toMatch(/^Silvana · Docente fundadora · plan particular/)
  })
})

describe('B2 · el birrete cae una sola vez al acreditarse', () => {
  it('de prueba a pago, o renovado (otro vencimiento): cae', () => {
    const prueba = huellaDelPlan({ ...base, estado: 'prueba' })
    const pago = huellaDelPlan(base)
    expect(seAcreditoUnPlan(prueba, pago)).toBe(true)
    expect(seAcreditoUnPlan(pago, huellaDelPlan({ ...base, venceEl: '2027-01-22T12:00:00Z' }))).toBe(true)
  })

  it('la primera vez que se mira, o sin cambios, no', () => {
    expect(seAcreditoUnPlan(null, huellaDelPlan(base))).toBe(false)
    expect(seAcreditoUnPlan(huellaDelPlan(base), huellaDelPlan(base))).toBe(false)
  })

  it('al pasar a gratis o vencido, no', () => {
    expect(seAcreditoUnPlan(huellaDelPlan(base), huellaDelPlan({ ...base, estado: 'vencido' }))).toBe(false)
  })

  it('al marcarla fundadora, cae (con la estrella)', () => {
    expect(seAcreditoUnPlan(huellaDelPlan(base), huellaDelPlan({ ...base, fundadoraDesde: '2026-11-22' }))).toBe(true)
  })
})
