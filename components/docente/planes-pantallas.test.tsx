// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EstadoDelPlan, queMostrar } from './estado-del-plan'
import { OpcionesDePago } from './opciones-de-pago'
import { PantallaDeLimite } from './pantalla-de-limite'
import { cuerpoDeBloqueo, opcionDePago, type ResumenDelPlan } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

/** G3: la pantalla de límite y la de vencimiento. */
const ENV = {
  MAESTRIA_PRECIO_MENSUAL_BLOQUE: '20000',
  MAESTRIA_PRECIO_PASE_BLOQUE: '50000',
  MAESTRIA_LINK_MENSUAL_2: 'https://mp.example/m2',
  MAESTRIA_LINK_PASE_2: 'https://mp.example/p2',
  MAESTRIA_LINK_MENSUAL_1: 'https://mp.example/m1',
}

const base: ResumenDelPlan = {
  estado: 'activo',
  nivel: 1,
  cupo: 5,
  alumnos: 5,
  venceEl: '2026-12-16T00:00:00Z',
  diasRestantes: 20,
  avisoDePruebaPendiente: false,
}

afterEach(cleanup)

describe('queMostrar', () => {
  it('nada con exento, con datos que no llegaron o con más de 7 días', () => {
    expect(queMostrar(null)).toBe('nada')
    expect(queMostrar({ plan: { ...base, estado: 'exento' }, renovar: null })).toBe('nada')
    expect(queMostrar({ plan: { ...base, diasRestantes: 8 }, renovar: null })).toBe('nada')
  })
  it('el banner con 7 días o menos', () => {
    expect(queMostrar({ plan: { ...base, diasRestantes: 7 }, renovar: null })).toBe('por-vencer')
    expect(queMostrar({ plan: { ...base, diasRestantes: 1 }, renovar: null })).toBe('por-vencer')
  })
  it('la pantalla de solo lectura cuando venció', () => {
    expect(queMostrar({ plan: { ...base, estado: 'vencido', diasRestantes: 0 }, renovar: null })).toBe('vencido')
  })
})

describe('OpcionesDePago', () => {
  it('muestra los dos montos con su link, y el ahorro del pase', () => {
    render(<OpcionesDePago opcion={opcionDePago(2, ENV)} />)
    expect(screen.getByRole('link', { name: /Pagar el mes/ }).getAttribute('href')).toBe('https://mp.example/m2')
    expect(screen.getByRole('link', { name: /Pagar el pase/ }).getAttribute('href')).toBe('https://mp.example/p2')
    expect(screen.getByText(/40\.000/)).toBeTruthy()
    expect(screen.getByText(/100\.000/)).toBeTruthy()
    expect(screen.getByText(/Ahorrás .*20\.000/)).toBeTruthy()
  })
  it('una opción sin link no se ofrece', () => {
    render(<OpcionesDePago opcion={opcionDePago(1, ENV)} />)
    expect(screen.getByRole('link', { name: /Pagar el mes/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Pagar el pase/ })).toBeNull()
  })
  it('sin ningún link, lo dice y no rompe', () => {
    render(<OpcionesDePago opcion={opcionDePago(3, {})} />)
    expect(screen.getByText(PLAN.opciones.sinPago)).toBeTruthy()
  })
})

describe('PantallaDeLimite', () => {
  it('dice cuántos tiene, su cupo y lo que cuesta el siguiente', () => {
    render(
      <Dialog open>
        <DialogContent>
          <PantallaDeLimite bloqueo={cuerpoDeBloqueo(base, 'sin_cupo', ENV)} onVolver={() => {}} />
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Tenés 5 de 5 alumnos')).toBeTruthy()
    expect(screen.getByText(/pasá a 2 bloques/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Pagar el pase/ })).toBeTruthy()
    expect(screen.queryByText(/administrador/i)).toBeNull()
  })
})

describe('EstadoDelPlan', () => {
  it('vencido: qué puede seguir haciendo y qué no', () => {
    render(
      <EstadoDelPlan
        datos={{ plan: { ...base, estado: 'vencido', diasRestantes: 0 }, renovar: opcionDePago(1, ENV) }}
      />,
    )
    expect(screen.getByRole('heading', { name: PLAN.vencimiento.tituloPlan })).toBeTruthy()
    for (const item of [...PLAN.vencimiento.puede, ...PLAN.vencimiento.noPuede]) expect(screen.getByText(item)).toBeTruthy()
  })
  it('prueba con 3 días: el banner', () => {
    render(<EstadoDelPlan datos={{ plan: { ...base, nivel: 0, cupo: 10, diasRestantes: 3 }, renovar: null }} />)
    expect(screen.getByText('Tu prueba termina en 3 días.')).toBeTruthy()
  })
  it('exento: nada', () => {
    const { container } = render(<EstadoDelPlan datos={{ plan: { ...base, estado: 'exento' }, renovar: null }} />)
    expect(container.textContent).toBe('')
  })
})
