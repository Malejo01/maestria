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
}

afterEach(cleanup)

describe('textoDelContador', () => {
  it('alumnos contra el cupo y el vencimiento', () => {
    expect(textoDelContador({ plan, renovar: null })).toBe('12 de 15 alumnos · tu plan vence el 15/12')
  })
  it('en prueba dice que termina la prueba', () => {
    expect(textoDelContador({ plan: { ...plan, nivel: 0, cupo: 10, alumnos: 4 }, renovar: null })).toBe(
      '4 de 10 alumnos · tu prueba termina el 15/12',
    )
  })
  it('vencido dice que venció', () => {
    expect(textoDelContador({ plan: { ...plan, estado: 'vencido' }, renovar: null })).toBe(
      '12 de 15 alumnos · tu plan venció el 15/12',
    )
  })
  it('prueba sin arrancar: sólo los alumnos', () => {
    expect(textoDelContador({ plan: { ...plan, nivel: 0, cupo: 10, venceEl: null }, renovar: null })).toBe(
      '12 de 10 alumnos',
    )
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
