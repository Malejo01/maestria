// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ContadorDelPlan, textoDelContador } from './contador-del-plan'
import type { ResumenDelPlan } from '@/lib/planes'

/** G6: "12 de 15 alumnos · tu plan vence el 15/12", y nada para la exenta. */
const plan: ResumenDelPlan = {
  estado: 'activo',
  nivel: 3,
  cupo: 15,
  alumnos: 12,
  venceEl: '2026-12-15T15:00:00Z',
  diasRestantes: 29,
  avisoDePruebaPendiente: false,
  cupoGratis: 2,
  topeCuestionarios: 20,
  cuestionarios: null,
  docenteNuevo: false,
  tipo: 'particular',
  aulaCursos: 0,
  alumnosPorCurso: 35,
  permiteIndividual: true,
  permiteImprimirYMoodle: true,
  fundadoraDesde: null,
}

afterEach(cleanup)

describe('textoDelContador', () => {
  it('alumnos contra el cupo y el vencimiento', () => {
    expect(textoDelContador({ plan, renovar: null })).toBe('12 de 15 alumnos · tu plan vence el 15/12')
  })
  it('en prueba dice cuántos días quedan', () => {
    expect(
      textoDelContador({ plan: { ...plan, estado: 'prueba', nivel: 0, cupo: 10, alumnos: 6, diasRestantes: 18 }, renovar: null }),
    ).toBe('6 de 10 alumnos · prueba, quedan 18 días')
    expect(
      textoDelContador({ plan: { ...plan, estado: 'prueba', nivel: 0, cupo: 10, alumnos: 6, diasRestantes: 1 }, renovar: null }),
    ).toBe('6 de 10 alumnos · prueba, queda 1 día')
  })
  it('H7, en gratis: plan gratis, sin fecha', () => {
    expect(
      textoDelContador({
        plan: { ...plan, estado: 'gratis', nivel: 0, cupo: 2, alumnos: 2, venceEl: null, diasRestantes: null },
        renovar: null,
      }),
    ).toBe('2 de 2 alumnos · plan gratis')
  })
  it('vencido dice que venció', () => {
    expect(textoDelContador({ plan: { ...plan, estado: 'vencido' }, renovar: null })).toBe(
      '12 alumnos · tu plan venció el 15/12',
    )
    expect(textoDelContador({ plan: { ...plan, estado: 'vencido', nivel: 0, cupo: 10, alumnos: 3 }, renovar: null })).toBe(
      '3 alumnos · tu prueba terminó el 15/12',
    )
  })
  it('prueba sin arrancar: los alumnos y que es la prueba', () => {
    expect(
      textoDelContador({ plan: { ...plan, estado: 'prueba', nivel: 0, cupo: 10, venceEl: null, diasRestantes: null }, renovar: null }),
    ).toBe('12 de 10 alumnos · prueba')
  })
  it('la cuenta exenta (o sin la 026) no ve nada', () => {
    expect(textoDelContador({ plan: { ...plan, estado: 'exento', cupo: null }, renovar: null })).toBeNull()
    expect(textoDelContador(null)).toBeNull()
  })
})

describe('ContadorDelPlan', () => {
  it('no dibuja nada para la exenta', () => {
    const { container } = render(<ContadorDelPlan datos={{ plan: { ...plan, estado: 'exento', cupo: null }, renovar: null }} />)
    expect(container.textContent).toBe('')
  })
  it('se dibuja con el texto', () => {
    const { container } = render(<ContadorDelPlan datos={{ plan, renovar: null }} />)
    expect(container.textContent).toBe('12 de 15 alumnos · tu plan vence el 15/12')
  })
})

describe('AC3 · el contador del gratis según la modalidad', () => {
  const gratis = { ...plan, estado: 'gratis' as const, nivel: 0 as const, cupo: 2, venceEl: null, diasRestantes: null }
  const texto = (p: Partial<ResumenDelPlan>) => textoDelContador({ plan: { ...gratis, ...p }, renovar: null })

  it('particular: «2 de 2 alumnos · plan gratis» (los del link cuentan como particulares)', () => {
    expect(texto({ modalidad: 'particular', alumnos: 2, lugares: { particulares: 2, curso: 0 } })).toBe('2 de 2 alumnos · plan gratis')
    expect(texto({ modalidad: 'particular', alumnos: 1, lugares: { particulares: 1, curso: 0 } })).toBe('1 de 2 alumnos · plan gratis')
  })

  it('curso: «Particulares 1 de 2 · Curso 18 de 35»', () => {
    expect(texto({ modalidad: 'curso', alumnos: 19, lugares: { particulares: 1, curso: 18 } })).toBe('Particulares 1 de 2 · Curso 18 de 35')
  })

  it('sin dato (null), la regla B1: igual que curso; sin alumnos de curso, como antes', () => {
    expect(texto({ modalidad: null, alumnos: 5, lugares: { particulares: 2, curso: 3 } })).toBe('Particulares 2 de 2 · Curso 3 de 35')
    expect(texto({ modalidad: null, alumnos: 1, lugares: { particulares: 1, curso: 0 } })).toBe('1 de 2 alumnos · plan gratis')
    // Un resumen viejo, sin lugares: lo de siempre.
    expect(texto({ alumnos: 2 })).toBe('2 de 2 alumnos · plan gratis')
  })

  it('nunca «5 de 2»: el particular que conserva más de 2 ve cuántos tiene, sin el cupo', () => {
    const t = texto({ modalidad: 'particular', alumnos: 5, lugares: { particulares: 5, curso: 0 } })
    expect(t).toBe('5 alumnos · plan gratis')
    for (const caso of [
      { modalidad: null, alumnos: 5, lugares: { particulares: 2, curso: 3 } },
      { modalidad: 'curso' as const, alumnos: 5, lugares: { particulares: 2, curso: 3 } },
    ]) {
      expect(texto(caso)).not.toMatch(/5 de 2/)
    }
  })

  it('naranja sólo en el tope', () => {
    const lleno = (p: Partial<ResumenDelPlan>) => {
      render(<ContadorDelPlan datos={{ plan: { ...gratis, ...p }, renovar: null }} />)
      const v = document.querySelector('[data-lleno]')?.getAttribute('data-lleno')
      cleanup()
      return v
    }
    expect(lleno({ modalidad: 'particular', alumnos: 1, lugares: { particulares: 1, curso: 0 } })).toBe('no')
    expect(lleno({ modalidad: 'particular', alumnos: 2, lugares: { particulares: 2, curso: 0 } })).toBe('si')
    expect(lleno({ modalidad: 'curso', alumnos: 19, lugares: { particulares: 1, curso: 18 } })).toBe('no')
    expect(lleno({ modalidad: 'curso', alumnos: 37, lugares: { particulares: 2, curso: 35 } })).toBe('si')
  })
})
