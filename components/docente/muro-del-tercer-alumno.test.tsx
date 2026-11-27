// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { VistaDelMuro } from './muro-del-tercer-alumno'
import { esMuroDelTercerAlumno } from './pantalla-de-limite'
import type { CuerpoDeBloqueo } from '@/lib/planes'

afterEach(cleanup)

const AHORA = new Date('2026-11-27T15:00:00Z')
const pinta = (props: Partial<Parameters<typeof VistaDelMuro>[0]> = {}) =>
  render(
    <Dialog open>
      <DialogContent>
        <VistaDelMuro
          cupoGratis={2}
          precioBloque={15000}
          evidencia={{ alumnos: 2, ejercicios: 46, desde: '2026-11-18T18:00:00Z', temaMasFlojo: 'Funciones' }}
          ahora={AHORA}
          pago={<div data-testid="pago">¿Tenés un código?</div>}
          onVolver={vi.fn()}
          {...props}
        />
      </DialogContent>
    </Dialog>,
  )

describe('VistaDelMuro (AB6)', () => {
  it('con evidencia: primero lo que practicaron, después la oferta, la garantía y el código', () => {
    pinta()
    const evidencia = screen.getByText('Tus 2 alumnos hicieron 46 ejercicios en 9 días. El tema más flojo: funciones.')
    const oferta = screen.getByText(/Sumá hasta 5 alumnos por \$\s?15\.000 al mes\./)
    // La evidencia va antes que la oferta.
    expect(evidencia.compareDocumentPosition(oferta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Si en 14 días ninguno de tus alumnos practicó, te devuelvo el pago.')).toBeTruthy()
    expect(screen.getByText(/Sin débito automático/)).toBeTruthy()
    expect(screen.getByTestId('pago').textContent).toMatch(/¿Tenés un código\?/)
  })

  it('sin evidencia: el texto honesto, sin números inventados', () => {
    pinta({ evidencia: { alumnos: 0, ejercicios: 0, desde: null, temaMasFlojo: null } })
    expect(screen.getByText('Todavía no practicaron: probá primero con tus 2 alumnos.')).toBeTruthy()
    expect(document.querySelector('[data-evidencia]')?.getAttribute('data-evidencia')).toBe('no')
  })

  it('sin la variable de precio: la oferta no dice ningún monto', () => {
    pinta({ precioBloque: null })
    const oferta = document.querySelector('[data-oferta]')?.textContent ?? ''
    expect(oferta).toBe('Sumá hasta 5 alumnos con el plan Particular.')
    expect(oferta).not.toMatch(/\$/)
  })
})

describe('esMuroDelTercerAlumno', () => {
  const bloqueo = (plan: Partial<CuerpoDeBloqueo['plan']>) => ({ error: '', plan: { motivo: 'sin_cupo', estado: 'gratis', tipo: 'particular', ...plan } }) as CuerpoDeBloqueo
  it('sólo para el gratis sin cupo (Particular)', () => {
    expect(esMuroDelTercerAlumno(bloqueo({}))).toBe(true)
    expect(esMuroDelTercerAlumno(bloqueo({ estado: 'activo' }))).toBe(false)
    expect(esMuroDelTercerAlumno(bloqueo({ motivo: 'tope_cuestionarios' }))).toBe(false)
    expect(esMuroDelTercerAlumno(bloqueo({ tipo: 'aula' }))).toBe(false)
  })
})
