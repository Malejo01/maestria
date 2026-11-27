// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EstadoDelPlan, queMostrar } from './estado-del-plan'
import { OpcionesDePago } from './opciones-de-pago'
import { PantallaDeLimite } from './pantalla-de-limite'
import { cuerpoDeBloqueo, opcionDePago, type ResumenDelPlan } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

// AB6: el muro lee la evidencia y el resumen de pago; acá no hace falta que respondan.
vi.mock('@/lib/pedir-json', () => ({ pedirJson: () => new Promise(() => {}) }))

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

  const enDialogo = (bloqueo: ReturnType<typeof cuerpoDeBloqueo>) =>
    render(
      <Dialog open>
        <DialogContent>
          <PantallaDeLimite bloqueo={bloqueo} onVolver={() => {}} />
        </DialogContent>
      </Dialog>,
    )
  const gratis: ResumenDelPlan = { ...base, estado: 'gratis', nivel: 0, cupo: 2, alumnos: 2, venceEl: null, diasRestantes: null }

  it('AB6, gratis lleno: el muro del 3.er alumno, con la oferta del bloque de 5 (antes, la pantalla de límite)', () => {
    enDialogo(cuerpoDeBloqueo(gratis, 'sin_cupo', ENV))
    expect(screen.getByText('Tu plan gratis llega hasta 2 alumnos')).toBeTruthy()
    expect(screen.getByText(/Sumá hasta 5 alumnos por \$\s?20\.000 al mes\./)).toBeTruthy()
    expect(screen.getByText('Mirando lo que practicaron…')).toBeTruthy()
  })

  it('H7, tope de cuestionarios: cuántos generó, el tope y lo que cuesta seguir', () => {
    enDialogo(cuerpoDeBloqueo({ ...gratis, cuestionarios: 20 }, 'tope_cuestionarios', ENV))
    expect(screen.getByText('Generaste 20 de 20 cuestionarios')).toBeTruthy()
    expect(screen.getByText(/hasta 20 cuestionarios cada 30 días. Con 1 bloque/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Pagar el mes/ })).toBeTruthy()
  })

  it('H7, sin link para ese nivel: el botón no aparece', () => {
    enDialogo(cuerpoDeBloqueo({ ...gratis, cuestionarios: 20 }, 'tope_cuestionarios', {}))
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('EstadoDelPlan', () => {
  it('vencido: qué puede seguir haciendo, qué no, y cómo volver al gratis', () => {
    render(
      <EstadoDelPlan
        datos={{ plan: { ...base, estado: 'vencido', alumnos: 3, diasRestantes: 0 }, renovar: opcionDePago(1, ENV) }}
      />,
    )
    expect(screen.getByRole('heading', { name: PLAN.vencimiento.tituloPlan })).toBeTruthy()
    for (const item of [...PLAN.vencimiento.puede(2), ...PLAN.vencimiento.noPuede]) expect(screen.getByText(item)).toBeTruthy()
    expect(screen.getByText(/Tenés 3 alumnos y el plan gratis llega hasta 2/)).toBeTruthy()
  })
  it('H7, prueba con 4 días y 2 alumnos: después sigue gratis, sin vender nada', () => {
    render(<EstadoDelPlan datos={{ plan: { ...base, nivel: 0, cupo: 10, alumnos: 2, diasRestantes: 4 }, renovar: null }} />)
    expect(screen.getByText('Te quedan 4 días de prueba.')).toBeTruthy()
    expect(screen.getByText('Después seguís gratis con hasta 2 alumnos particulares y un curso.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button', { name: PLAN.vencimiento.verPlanes })).toBeNull()
  })
  it('H7, prueba con 4 días y 12 alumnos: necesita un plan, con link a /precios', () => {
    render(<EstadoDelPlan datos={{ plan: { ...base, nivel: 0, cupo: 10, alumnos: 12, diasRestantes: 4 }, renovar: null }} />)
    expect(screen.getByText('Te quedan 4 días de prueba.')).toBeTruthy()
    expect(screen.getByText(/Después, con 12 alumnos, necesitás un plan\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mirá los precios.' }).getAttribute('href')).toBe('/precios')
  })
  it('gratis: ni banner ni solo lectura', () => {
    const { container } = render(
      <EstadoDelPlan datos={{ plan: { ...base, estado: 'gratis', cupo: 2, alumnos: 2, venceEl: null, diasRestantes: null }, renovar: null }} />,
    )
    expect(container.textContent).toBe('')
  })
  it('exento: nada', () => {
    const { container } = render(<EstadoDelPlan datos={{ plan: { ...base, estado: 'exento' }, renovar: null }} />)
    expect(container.textContent).toBe('')
  })
})
