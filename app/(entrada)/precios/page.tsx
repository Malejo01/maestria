import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import {
  DIAS_PRUEBA,
  NIVELES,
  cuestionariosGratisPorMes,
  cupoDeNivel,
  cupoGratis,
  formatearPesos,
  linkDePago,
  precioMensual,
  precioPase,
  type NivelPlan,
  type TipoDePago,
} from '@/lib/planes'
import { PRECIOS as T } from '@/lib/textos'

const bajada = () => T.bajada(DIAS_PRUEBA, cupoDeNivel(0), cupoGratis())

export function generateMetadata(): Metadata {
  const description = `${T.frase} ${bajada()}`
  return {
    title: 'Precios | MaestrIA',
    description,
    openGraph: { title: 'Precios de MaestrIA', description },
  }
}

/** Los niveles que se pagan: de 1 bloque al tope. La prueba y el gratis van aparte. */
const NIVELES_PAGOS = NIVELES.filter((nivel) => nivel > 0)

/**
 * G5 y H5: /precios, sin cuenta. Es lo que Mauro le manda a un cliente por
 * WhatsApp, así que se piensa primero en celular: una tarjeta por nivel, y
 * recién desde 640 px una tabla.
 *
 * Arriba, aparte de la tabla, lo que no se paga: el plan gratis y la prueba.
 * Antes la prueba era una fila más, y "Gratis, 30 días" caía en la columna
 * del pase: quien leía rápido entendía que la prueba era un pase.
 *
 * Los montos salen de las mismas variables de entorno que el resto del cobro
 * (lib/planes.ts); ninguno está escrito acá. Si falta uno, se muestra "—".
 * Donde hay link de pago, el monto es un botón que lleva al link.
 */
export default function PreciosPage() {
  const gratis = cupoGratis()
  const filas = NIVELES_PAGOS.map((nivel) => ({
    nivel,
    nombre: T.nombreNivel(nivel),
    cupo: cupoDeNivel(nivel),
    mensual: precioMensual(nivel),
    pase: precioPase(nivel),
  }))

  return (
    <div className="w-full max-w-3xl space-y-8">
      <header className="space-y-4 text-center">
        <Logo className="mx-auto" />
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-l font-bold text-texto">{T.frase}</p>
        <p className="cuerpo text-texto-suave">{bajada()}</p>
        <Boton asChild>
          <Link href="/sign-in?rol=docente">{T.empezar(DIAS_PRUEBA)}</Link>
        </Boton>
      </header>

      {/* Lo que no se paga, antes de la tabla. */}
      <ul className="grid gap-3 sm:grid-cols-2" aria-label={T.sinPagar}>
        <li className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <h2 className="cuerpo font-bold text-texto">{T.gratisTitulo}</h2>
          <p className="cuerpo-s mt-1 text-texto">{T.gratisDetalle(gratis)}</p>
          <p className="nota mt-1 text-texto-suave">{T.gratisTope(cuestionariosGratisPorMes())}</p>
        </li>
        <li className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <h2 className="cuerpo font-bold text-texto">{T.pruebaTitulo}</h2>
          <p className="cuerpo-s mt-1 text-texto">{T.pruebaDetalle(DIAS_PRUEBA, cupoDeNivel(0))}</p>
        </li>
      </ul>

      <section className="space-y-3" aria-labelledby="precios-planes">
        <h2 id="precios-planes" className="titulo-m text-texto">
          {T.planes}
        </h2>

        {/* Celular: una tarjeta por nivel pago. */}
        <ul className="space-y-3 sm:hidden" aria-label={T.planes}>
          {filas.map((fila) => (
            <li key={fila.nivel} className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="cuerpo font-bold text-texto">{fila.nombre}</h3>
                <p className="nota text-texto-suave">{T.alumnos(fila.cupo)}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="etiqueta text-texto-suave">{T.porMes}</dt>
                  <dd className="mt-1">
                    <Monto monto={fila.mensual} tipo="mensual" nivel={fila.nivel} />
                  </dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-suave">{T.pase}</dt>
                  <dd className="mt-1">
                    <Monto monto={fila.pase} tipo="pase" nivel={fila.nivel} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {/* Desde 640 px: la tabla. */}
        <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta sm:block">
          <table className="w-full text-left">
            <caption className="sr-only">{T.planes}</caption>
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
                  <td className="px-4 py-3 text-right">
                    <Monto monto={fila.mensual} tipo="mensual" nivel={fila.nivel} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Monto monto={fila.pase} tipo="pase" nivel={fila.nivel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ul className="space-y-2">
        {T.notas(gratis, cupoDeNivel(1)).map((nota) => (
          <li key={nota} className="cuerpo-s text-texto-suave">
            {nota}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Un monto. Si hay link de pago para ese nivel y esa forma, es un botón que
 * lleva a MercadoPago; si no, texto. Sin precio cargado, "—".
 */
function Monto({ monto, tipo, nivel }: { monto: number | null; tipo: TipoDePago; nivel: NivelPlan }) {
  if (monto === null) return <span className="cuerpo font-bold text-texto">—</span>
  const texto = formatearPesos(monto)
  const link = linkDePago(tipo, nivel)
  if (!link) return <span className="cuerpo font-bold text-texto">{texto}</span>
  return (
    <Boton asChild variante="secundario" className="gap-1.5">
      <a href={link} target="_blank" rel="noopener noreferrer" aria-label={T.pagar(tipo, T.nombreNivel(nivel), texto)}>
        {texto}
        <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      </a>
    </Boton>
  )
}
