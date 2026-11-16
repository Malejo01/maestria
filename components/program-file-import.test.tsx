// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProgramFileImport } from './program-file-import'
import { NO_SE_PUDO_LEER } from '@/lib/lectura-programa'

/**
 * I4: cuando la lectura falla, el docente ve qué pasó y qué puede hacer, con
 * los otros dos caminos del wizard como botones en el mismo lugar.
 */
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function montar() {
  const alternativas = { escribirlo: vi.fn(), planOficial: vi.fn() }
  render(<ProgramFileImport onUnitsSuggested={vi.fn()} alternativas={alternativas} />)
  return alternativas
}

function elegir(archivo: File) {
  fireEvent.change(screen.getByLabelText(/Tu temario/), { target: { files: [archivo] } })
}

function archivoDe(nombre: string, tipo: string, bytes: number): File {
  const archivo = new File(['x'], nombre, { type: tipo })
  Object.defineProperty(archivo, 'size', { value: bytes })
  return archivo
}

/** Un cuerpo de progreso que manda estas líneas y después, si `queda`, no termina nunca. */
function progreso(lineas: object[], queda = false): Response {
  const codificador = new TextEncoder()
  const cuerpo = new ReadableStream<Uint8Array>({
    start(controlador) {
      for (const linea of lineas) controlador.enqueue(codificador.encode(`${JSON.stringify(linea)}\n`))
      if (!queda) controlador.close()
    },
  })
  return new Response(cuerpo, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
}

describe('ProgramFileImport — fallas con salida (I4)', () => {
  it('más de 5 MB: dice cuánto pesa, qué hacer, y no sube nada', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    montar()
    elegir(archivoDe('escaneo.pdf', 'application/pdf', 7.2 * 1024 * 1024))
    expect(screen.getByText(/Tu archivo pesa 7,2 MB y el máximo es 5 MB\. Si es un escaneo, sacale una foto/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Leer el archivo' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no se pudo leer: el mensaje y los otros dos caminos, que funcionan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(progreso([{ etapa: 'leyendo' }, { etapa: 'error', error: NO_SE_PUDO_LEER, status: 422 }])))
    const alternativas = montar()
    elegir(archivoDe('programa.pdf', 'application/pdf', 1000))
    fireEvent.click(screen.getByRole('button', { name: 'Leer el archivo' }))

    expect(await screen.findByText(NO_SE_PUDO_LEER)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escribirlo yo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Usar el plan oficial' }))
    expect(alternativas.escribirlo).toHaveBeenCalledTimes(1)
    expect(alternativas.planOficial).toHaveBeenCalledTimes(1)
  })

  it('sin novedades a los 45 s: el mismo mensaje, sin esperar a que el servidor corte', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(progreso([{ etapa: 'leyendo' }], true)))
    montar()
    elegir(archivoDe('foto.jpg', 'image/jpeg', 1000))
    fireEvent.click(screen.getByRole('button', { name: 'Leer el archivo' }))
    await waitFor(() => expect(screen.getByText('Leyendo el archivo…')).toBeTruthy())

    expect(screen.queryByText(NO_SE_PUDO_LEER)).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })
    expect(await screen.findByText(NO_SE_PUDO_LEER)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Escribirlo yo' })).toBeTruthy()
  })

  it('el progreso de una foto dice que la lee la IA', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        progreso([
          { etapa: 'leyendo' },
          { etapa: 'leyendo-con-ia' },
          { etapa: 'ordenando' },
          { etapa: 'listo', resultado: { units: [{ name: 'Unidad 1', topics: [{ name: 'Fracciones' }] }], summary: { unitCount: 1, topicCount: 1 } } },
        ]),
      ),
    )
    montar()
    elegir(archivoDe('foto.jpg', 'image/jpeg', 1000))
    fireEvent.click(screen.getByRole('button', { name: 'Leer el archivo' }))
    expect(await screen.findByText('Es una imagen: la estoy leyendo con IA…')).toBeTruthy()
  })
})
