// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AvisoDePrueba, debeMostrarAvisoDePrueba, textosDelAviso } from './aviso-de-prueba'
import type { ResumenDelPlan } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

/**
 * G2: el aviso de la prueba de 30 días aparece una vez y no dos, y la cuenta
 * exenta no lo ve nunca.
 */
const pendiente: ResumenDelPlan = {
  estado: 'prueba',
  nivel: 0,
  cupo: 10,
  alumnos: 3,
  venceEl: null,
  diasRestantes: null,
  avisoDePruebaPendiente: true,
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('debeMostrarAvisoDePrueba', () => {
  it('sólo con la prueba sin arrancar', () => {
    expect(debeMostrarAvisoDePrueba(pendiente)).toBe(true)
    expect(debeMostrarAvisoDePrueba({ ...pendiente, avisoDePruebaPendiente: false })).toBe(false)
    expect(debeMostrarAvisoDePrueba(null)).toBe(false)
  })

  it('la cuenta exenta nunca lo ve, aunque el dato diga lo contrario', () => {
    expect(debeMostrarAvisoDePrueba({ ...pendiente, estado: 'exento', avisoDePruebaPendiente: true })).toBe(false)
  })
})

describe('AvisoDePrueba', () => {
  it('aparece, al aceptarlo arranca la prueba, y no vuelve a aparecer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ arranco: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const onArranco = vi.fn()

    const { rerender } = render(<AvisoDePrueba plan={pendiente} onArranco={onArranco} />)
    expect(screen.getByText(PLAN.avisoDePrueba.existente.titulo)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: PLAN.avisoDePrueba.boton(30) }))
    await waitFor(() => expect(onArranco).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ accion: 'empezar-prueba' })
    await waitFor(() => expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull())

    // El panel relee el plan: ya no está pendiente. Y aunque llegara viejo, no vuelve.
    rerender(<AvisoDePrueba plan={{ ...pendiente, avisoDePruebaPendiente: false, venceEl: '2026-12-16T00:00:00Z' }} onArranco={onArranco} />)
    expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull()
    rerender(<AvisoDePrueba plan={pendiente} onArranco={onArranco} />)
    expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cerrarlo con la X también es aceptarlo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AvisoDePrueba plan={pendiente} onArranco={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close|cerrar/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('la cuenta exenta no lo ve y no se llama a nada', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AvisoDePrueba plan={{ ...pendiente, estado: 'exento' }} onArranco={() => {}} />)
    expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin la 026 (plan exento por la válvula) tampoco aparece', () => {
    render(
      <AvisoDePrueba
        plan={{ ...pendiente, estado: 'exento', nivel: null, cupo: null, avisoDePruebaPendiente: false }}
        onArranco={() => {}}
      />,
    )
    expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull()
  })
})

describe('H3: dos textos según cuándo se registró', () => {
  const frase = (textos: ReturnType<typeof textosDelAviso>) => (textos ? `${textos.titulo} ${textos.detalle}` : null)

  it('el docente que ya existía lee que se rediseñó', () => {
    expect(frase(textosDelAviso({ ...pendiente, docenteNuevo: false }))).toBe(
      'Rediseñamos MaestrIA. Desde hoy tenés 30 días para probarla completa, con hasta 10 alumnos. Después podés seguir gratis con hasta 2.',
    )
  })

  it('el docente nuevo no lee "rediseñamos"', () => {
    const texto = frase(textosDelAviso({ ...pendiente, docenteNuevo: true }))
    expect(texto).toBe(
      'Tenés 30 días para probar MaestrIA completa, con hasta 10 alumnos. Sin tarjeta. Después podés seguir gratis con hasta 2.',
    )
    expect(texto).not.toMatch(/rediseñ/i)
  })

  it('el cupo gratis sale del plan, no del texto', () => {
    expect(textosDelAviso({ ...pendiente, docenteNuevo: true, cupoGratis: 3 })?.detalle).toMatch(/hasta 3\.$/)
  })

  it('se dibuja el del docente nuevo, con su lista', () => {
    render(<AvisoDePrueba plan={{ ...pendiente, docenteNuevo: true }} onArranco={() => {}} />)
    expect(screen.getByText('Tenés 30 días para probar MaestrIA completa, con hasta 10 alumnos.')).toBeTruthy()
    expect(screen.getByText(PLAN.avisoDePrueba.nuevo.lista)).toBeTruthy()
    expect(screen.queryByText(PLAN.avisoDePrueba.existente.titulo)).toBeNull()
  })

  it('la cuenta exenta no ve ninguno de los dos', () => {
    for (const docenteNuevo of [true, false]) {
      expect(textosDelAviso({ ...pendiente, estado: 'exento', docenteNuevo })).toBeNull()
      const { container } = render(
        <AvisoDePrueba plan={{ ...pendiente, estado: 'exento', docenteNuevo }} onArranco={() => {}} />,
      )
      expect(container.textContent).toBe('')
      cleanup()
    }
  })
})
