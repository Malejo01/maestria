import { describe, expect, it } from 'vitest'
import {
  cuerpoDeBloqueo,
  cupoDeNivel,
  diasRestantes,
  estadoDelPlan,
  formatearPesos,
  leerBloqueo,
  linkDePago,
  nivelQueAlcanza,
  normalizarNivel,
  opcionDePago,
  precioMensual,
  precioPase,
  puedeGenerar,
  puedeSumarAlumno,
  sumarDias,
  type DatosDelPlan,
  type ResumenDelPlan,
} from './planes'

const ENV = {
  MAESTRIA_PRECIO_MENSUAL_BLOQUE: '20000',
  MAESTRIA_PRECIO_MENSUAL_TOPE: '99000',
  MAESTRIA_PRECIO_PASE_BLOQUE: '50000',
  MAESTRIA_PRECIO_PASE_TOPE: '249000',
  MAESTRIA_LINK_MENSUAL_2: 'https://mpago.la/mensual-2',
  MAESTRIA_LINK_PASE_2: 'https://mpago.la/pase-2',
}

const AHORA = new Date('2026-11-16T15:00:00Z')
const datos = (parcial: Partial<DatosDelPlan>): DatosDelPlan => ({
  nivel: 0,
  venceEl: null,
  pruebaIniciadaEl: null,
  esExento: false,
  ahora: AHORA,
  ...parcial,
})

describe('cupoDeNivel', () => {
  it('sigue la tabla: prueba 10, después cinco por bloque, tope 150', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => cupoDeNivel(n as 0))).toEqual([10, 5, 10, 15, 20, 150])
  })
})

describe('normalizarNivel', () => {
  it('acepta números y textos de 0 a 5', () => {
    expect(normalizarNivel(3)).toBe(3)
    expect(normalizarNivel('2')).toBe(2)
  })
  it('rechaza lo que no es un nivel', () => {
    for (const valor of [null, undefined, '', 'x', 6, -1, 2.5, NaN]) expect(normalizarNivel(valor)).toBeNull()
  })
})

describe('precios', () => {
  it('mensual: por bloque hasta el 4, el tope tiene precio propio', () => {
    expect(precioMensual(1, ENV)).toBe(20000)
    expect(precioMensual(3, ENV)).toBe(60000)
    expect(precioMensual(5, ENV)).toBe(99000)
  })
  it('el pase se cobra por bloque: nivel 1 $50.000, 2 $100.000, 3 $150.000', () => {
    expect(precioPase(1, ENV)).toBe(50000)
    expect(precioPase(2, ENV)).toBe(100000)
    expect(precioPase(3, ENV)).toBe(150000)
    expect(precioPase(5, ENV)).toBe(249000)
  })
  it('la prueba no tiene precio, y sin variable no hay precio', () => {
    expect(precioMensual(0, ENV)).toBeNull()
    expect(precioPase(0, ENV)).toBeNull()
    expect(precioMensual(2, {})).toBeNull()
    expect(precioPase(5, { MAESTRIA_PRECIO_PASE_TOPE: 'gratis' })).toBeNull()
  })
  it('un link que falta no se ofrece, y no rompe', () => {
    expect(linkDePago('mensual', 2, ENV)).toBe('https://mpago.la/mensual-2')
    expect(linkDePago('mensual', 3, ENV)).toBeNull()
    expect(linkDePago('pase', 2, { MAESTRIA_LINK_PASE_2: 'javascript:alert(1)' })).toBeNull()
    expect(opcionDePago(3, ENV)).toEqual({
      nivel: 3,
      cupo: 15,
      mensual: { monto: 60000, link: null },
      pase: { monto: 150000, link: null },
    })
  })
  it('se muestran en pesos, formato es-AR', () => {
    expect(formatearPesos(150000).replace(/\s/g, ' ')).toMatch(/^\$ ?150\.000$/)
  })
})

describe('estadoDelPlan', () => {
  it('la cuenta exenta es exenta aunque tenga un plan vencido cargado', () => {
    expect(estadoDelPlan(datos({ esExento: true, nivel: 1, venceEl: '2020-01-01' }))).toBe('exento')
  })

  it('la válvula: sin nivel legible el docente es exento, nunca vencido', () => {
    expect(estadoDelPlan(datos({ nivel: undefined }))).toBe('exento')
    expect(estadoDelPlan(datos({ nivel: null, venceEl: '2020-01-01' }))).toBe('exento')
    expect(estadoDelPlan(datos({ nivel: 'basura' }))).toBe('exento')
  })

  it('prueba que todavía no arrancó (no vio el aviso): prueba, sin vencimiento', () => {
    const d = datos({ nivel: 0 })
    expect(estadoDelPlan(d)).toBe('prueba')
    expect(diasRestantes(d)).toBeNull()
  })

  it('prueba en curso: 30 días desde que arrancó', () => {
    const d = datos({ nivel: 0, pruebaIniciadaEl: sumarDias(AHORA, -10) })
    expect(estadoDelPlan(d)).toBe('prueba')
    expect(diasRestantes(d)).toBe(20)
  })

  it('prueba terminada: vencido', () => {
    expect(estadoDelPlan(datos({ nivel: 0, pruebaIniciadaEl: sumarDias(AHORA, -31) }))).toBe('vencido')
  })

  it('nivel pago vigente: activo', () => {
    expect(estadoDelPlan(datos({ nivel: 2, venceEl: sumarDias(AHORA, 15) }))).toBe('activo')
  })

  it('nivel pago sin fecha: activo (un dato que falta no cierra nada)', () => {
    expect(estadoDelPlan(datos({ nivel: 2 }))).toBe('activo')
  })

  describe('el borde del vencimiento', () => {
    // Acreditado el 15/11 a las 10:00 (Argentina) por 30 días: vence el 15/12 a las 10:00.
    const venceEl = new Date('2026-12-15T13:00:00Z')
    const en = (iso: string) => datos({ nivel: 1, venceEl, ahora: new Date(iso) })

    it('el día antes: activo, le queda 1 día', () => {
      expect(estadoDelPlan(en('2026-12-14T13:00:00Z'))).toBe('activo')
      expect(diasRestantes(en('2026-12-14T13:00:00Z'))).toBe(1)
    })
    it('el día de, antes de la hora: activo', () => {
      expect(estadoDelPlan(en('2026-12-15T12:59:00Z'))).toBe('activo')
      expect(diasRestantes(en('2026-12-15T12:59:00Z'))).toBe(1)
    })
    it('el día de, a la hora exacta: vencido', () => {
      expect(estadoDelPlan(en('2026-12-15T13:00:00Z'))).toBe('vencido')
      expect(diasRestantes(en('2026-12-15T13:00:00Z'))).toBe(0)
    })
    it('el día después: vencido', () => {
      expect(estadoDelPlan(en('2026-12-16T13:00:00Z'))).toBe('vencido')
      expect(diasRestantes(en('2026-12-16T13:00:00Z'))).toBe(0)
    })
  })
})

describe('puedeGenerar', () => {
  it('sólo el vencido no genera', () => {
    expect(puedeGenerar('exento')).toBe(true)
    expect(puedeGenerar('prueba')).toBe(true)
    expect(puedeGenerar('activo')).toBe(true)
    expect(puedeGenerar('vencido')).toBe(false)
  })
})

describe('puedeSumarAlumno', () => {
  it('nivel 1: con 4 suma el quinto; con 5 no suma el sexto', () => {
    expect(puedeSumarAlumno('activo', 4, 1)).toBe(true)
    expect(puedeSumarAlumno('activo', 5, 1)).toBe(false)
  })
  it('prueba: hasta 10', () => {
    expect(puedeSumarAlumno('prueba', 9, 0)).toBe(true)
    expect(puedeSumarAlumno('prueba', 10, 0)).toBe(false)
  })
  it('vencido no suma a nadie, aunque tenga lugar', () => {
    expect(puedeSumarAlumno('vencido', 0, 5)).toBe(false)
  })
  it('exento suma siempre', () => {
    expect(puedeSumarAlumno('exento', 10_000, 1)).toBe(true)
  })
})

describe('nivelQueAlcanza', () => {
  it('el nivel pago más chico con lugar', () => {
    expect(nivelQueAlcanza(1)).toBe(1)
    expect(nivelQueAlcanza(6)).toBe(2)
    expect(nivelQueAlcanza(16)).toBe(4)
    expect(nivelQueAlcanza(21)).toBe(5)
    expect(nivelQueAlcanza(151)).toBeNull()
  })
})

describe('cuerpoDeBloqueo', () => {
  const resumen: ResumenDelPlan = {
    estado: 'activo',
    nivel: 1,
    cupo: 5,
    alumnos: 5,
    venceEl: null,
    diasRestantes: null,
    avisoDePruebaPendiente: false,
  }

  it('sin cupo: ofrece el nivel que alcanza para uno más, con los dos montos', () => {
    const cuerpo = cuerpoDeBloqueo(resumen, 'sin_cupo', ENV)
    expect(cuerpo.plan.motivo).toBe('sin_cupo')
    expect(cuerpo.plan.siguiente).toMatchObject({ nivel: 2, cupo: 10, mensual: { monto: 40000 }, pase: { monto: 100000 } })
  })

  it('vencido: ofrece renovar el mismo nivel', () => {
    const cuerpo = cuerpoDeBloqueo({ ...resumen, estado: 'vencido', alumnos: 3 }, 'vencido', ENV)
    expect(cuerpo.plan.siguiente?.nivel).toBe(1)
  })

  it('prueba vencida con 7 alumnos: ofrece el nivel 2', () => {
    const cuerpo = cuerpoDeBloqueo({ ...resumen, estado: 'vencido', nivel: 0, cupo: 10, alumnos: 7 }, 'vencido', ENV)
    expect(cuerpo.plan.siguiente?.nivel).toBe(2)
  })

  it('la UI lo sabe leer, y no confunde otro error con un bloqueo', () => {
    expect(leerBloqueo(cuerpoDeBloqueo(resumen, 'sin_cupo', ENV))?.plan.motivo).toBe('sin_cupo')
    expect(leerBloqueo({ error: 'otra cosa' })).toBeNull()
    expect(leerBloqueo(null)).toBeNull()
  })
})
