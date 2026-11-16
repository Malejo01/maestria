import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import {
  NIVELES,
  cupoDeNivel,
  formatearPesos,
  precioMensual,
  precioPase,
  DIAS_PRUEBA,
  type NivelPlan,
} from '@/lib/planes'
import { PRECIOS as T } from '@/lib/textos'

export const metadata: Metadata = {
  title: 'Precios | MaestrIA',
  description: `${T.frase} ${T.prueba}`,
  openGraph: { title: 'Precios de MaestrIA', description: `${T.frase} ${T.prueba}` },
}

/**
 * G5: /precios, sin cuenta. Es lo que Mauro le manda a un cliente por
 * WhatsApp, así que se piensa primero en celular: una tarjeta por nivel, y
 * recién desde 640 px una tabla.
 *
 * Los montos salen de las mismas variables de entorno que el resto del cobro
 * (lib/planes.ts); ninguno está escrito acá. Si falta una, ese monto no se
 * muestra.
 */
export default function PreciosPage() {
  const filas = NIVELES.map((nivel) => ({
    nivel,
    nombre: T.nombreNivel(nivel),
    cupo: cupoDeNivel(nivel),
    mensual: precioMensual(nivel),
    pase: precioPase(nivel),
  }))

  const monto = (valor: number | null, nivel: NivelPlan) =>
    nivel === 0 ? T.gratis(DIAS_PRUEBA) : valor === null ? '—' : formatearPesos(valor)

  return (
    <div className="w-full max-w-3xl space-y-8">
      <header className="space-y-4 text-center">
        <Logo className="mx-auto" />
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-l font-bold text-texto">{T.frase}</p>
        <p className="cuerpo text-texto-suave">{T.prueba}</p>
        <Boton asChild>
          <Link href="/sign-in?rol=docente">{T.empezar}</Link>
        </Boton>
      </header>

      {/* Celular: una tarjeta por nivel. */}
      <ul className="space-y-3 sm:hidden" aria-label={T.titulo}>
        {filas.map((fila) => (
          <li key={fila.nivel} className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="cuerpo font-bold text-texto">{fila.nombre}</h2>
              <p className="nota text-texto-suave">{T.alumnos(fila.cupo)}</p>
            </div>
            {fila.nivel === 0 ? (
              <p className="cuerpo-s mt-2 text-texto">{monto(null, 0)}</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="etiqueta text-texto-suave">{T.porMes}</dt>
                  <dd className="cuerpo-l font-bold text-texto">{monto(fila.mensual, fila.nivel)}</dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-suave">{T.pase}</dt>
                  <dd className="cuerpo-l font-bold text-texto">{monto(fila.pase, fila.nivel)}</dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ul>

      {/* Desde 640 px: la tabla. */}
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta sm:block">
        <table className="w-full text-left">
          <caption className="sr-only">{T.titulo}</caption>
          <thead className="bg-superficie-suave">
            <tr>
              <th scope="col" className="etiqueta px-4 py-3 text-texto-suave">{T.plan}</th>
              <th scope="col" className="etiqueta px-4 py-3 text-texto-suave">{T.columnaAlumnos}</th>
              <th scope="col" className="etiqueta px-4 py-3 text-right text-texto-suave">{T.porMes}</th>
              <th scope="col" className="etiqueta px-4 py-3 text-right text-texto-suave">{T.pase}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.nivel} className="border-t border-borde">
                <th scope="row" className="cuerpo px-4 py-3 font-bold text-texto">{fila.nombre}</th>
                <td className="cuerpo-s px-4 py-3 text-texto">{T.alumnos(fila.cupo)}</td>
                {fila.nivel === 0 ? (
                  <td colSpan={2} className="cuerpo-s px-4 py-3 text-right text-texto">{monto(null, 0)}</td>
                ) : (
                  <>
                    <td className="cuerpo px-4 py-3 text-right font-bold text-texto">{monto(fila.mensual, fila.nivel)}</td>
                    <td className="cuerpo px-4 py-3 text-right font-bold text-texto">{monto(fila.pase, fila.nivel)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2">
        {T.notas.map((nota) => (
          <li key={nota} className="cuerpo-s text-texto-suave">
            {nota}
          </li>
        ))}
      </ul>
    </div>
  )
}
