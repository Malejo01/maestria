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
import { alumnosMaximosPorCurso, type ResumenDelPlan } from '@/lib/planes'
import {
  caminoDelDocente,
  leerCamino,
  linkDeWhatsApp,
  pasePorAlumnoPorMes,
  precioAulaCurso,
  precioAulaCursoAdicional,
  type Camino,
} from '@/lib/precios'
import { getViewer } from '@/lib/auth-session'
import { resumenDelPlan } from '@/lib/planes-server'
import { cn } from '@/lib/utils'

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
export default async function PreciosPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const gratis = cupoGratis()
  // B3: "¿Cómo das clases?". Con sesión de docente, el camino arranca elegido
  // según lo que ya usa y su plan queda marcado. Si algo falla, sin elegir.
  const pedido = leerCamino((await searchParams)?.camino)
  const plan = pedido ? null : await planDelDocente()
  const miPlan = pedido ? await planDelDocente() : plan
  const camino: Camino | null = pedido ?? caminoDelDocente(plan)
  const porCurso = alumnosMaximosPorCurso()
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

      {/* B3: dos caminos. Cada uno muestra sólo sus planes. */}
      <nav aria-label={T.comoDasClases} className="space-y-3">
        <h2 className="titulo-m text-center text-texto">{T.comoDasClases}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(['particular', 'aula'] as const).map((opcion) => (
            <li key={opcion}>
              <Link
                href={`/precios?camino=${opcion}`}
                aria-current={camino === opcion ? 'page' : undefined}
                data-camino={opcion}
                className={cn(
                  'flex min-h-24 flex-col justify-center rounded-lg border-2 p-4 text-left hover:border-accion',
                  camino === opcion ? 'border-accion bg-accion-tenue' : 'border-borde bg-superficie-tarjeta',
                )}
              >
                <span className="cuerpo font-bold text-texto">{T.caminos[opcion].titulo}</span>
                <span className="cuerpo-s mt-1 text-texto-suave">{T.caminos[opcion].detalle}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!camino && <p className="cuerpo-s text-center text-texto-suave">{T.elegiUnCamino}</p>}
      </nav>

      {camino && (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={T.sinPagar}>
          <li className={cn('rounded-lg border bg-superficie-tarjeta p-4', miPlan?.estado === 'gratis' ? 'border-accion' : 'border-borde')}>
            <h2 className="cuerpo font-bold text-texto">
              {T.gratisTitulo}
              {miPlan?.estado === 'gratis' && <TuPlan />}
            </h2>
            <p className="cuerpo-s mt-1 text-texto">{T.gratisCaminoDetalle(gratis, porCurso)}</p>
            <p className="nota mt-1 text-texto-suave">
              {T.gratisTope(cuestionariosGratisPorMes())} {T.gratisSinExtras}
            </p>
          </li>
          <li className={cn('rounded-lg border bg-superficie-tarjeta p-4', miPlan?.estado === 'prueba' ? 'border-accion' : 'border-borde')}>
            <h2 className="cuerpo font-bold text-texto">
              {T.pruebaTitulo}
              {miPlan?.estado === 'prueba' && <TuPlan />}
            </h2>
            <p className="cuerpo-s mt-1 text-texto">{T.pruebaDetalle(DIAS_PRUEBA, cupoDeNivel(0))}</p>
          </li>
        </ul>
      )}

      {camino === 'particular' && (
        <>
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
          <PaseTemporada />
        </>
      )}

      {camino === 'aula' && <CaminoAula porCurso={porCurso} miPlan={miPlan} />}

      {camino && (
        <details className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <summary className="cuerpo-s min-h-11 cursor-pointer font-semibold text-texto">{T.porQueTitulo}</summary>
          <p className="cuerpo-s mt-2 text-texto">{T.porQueTexto}</p>
        </details>
      )}

      {camino === 'particular' && <ul className="space-y-2">
        {T.notas(gratis, cupoDeNivel(1)).map((nota) => (
          <li key={nota} className="cuerpo-s text-texto-suave">
            {nota}
          </li>
        ))}
      </ul>}
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
  // C2: con Checkout Pro (o un link fijo, la válvula), el monto lleva al
  // resumen del pago, donde va el código de descuento. Sin ninguno, texto.
  if (!hayCobro() && !linkDePago(tipo, nivel)) return <span className="cuerpo font-bold text-texto">{texto}</span>
  return (
    <Boton asChild variante="secundario" className="gap-1.5">
      <Link href={`/precios/pagar?plan=particular&forma=${tipo}&cantidad=${nivel}`} aria-label={T.pagar(tipo, T.nombreNivel(nivel), texto)}>
        {texto}
      </Link>
    </Boton>
  )
}

/** C2: si hay Checkout Pro (el token de Mercado Pago). */
function hayCobro(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim())
}

/** B3 · El plan del docente con sesión, para elegir el camino y marcar "Tu plan". null sin sesión o si falla. */
async function planDelDocente(): Promise<ResumenDelPlan | null> {
  try {
    const viewer = await getViewer()
    if (!viewer || viewer.isGuest || viewer.role !== 'DOCENTE') return null
    return await resumenDelPlan(viewer.id, viewer.email ?? null)
  } catch {
    return null
  }
}

function TuPlan() {
  return <span className="etiqueta ml-2 rounded-full bg-accion px-2 py-0.5 text-texto-sobre-accion">{T.tuPlan}</span>
}

/** El pase de 90 días con su nombre de temporada y "son $X por alumno por mes". */
function PaseTemporada() {
  const porAlumno = pasePorAlumnoPorMes()
  return (
    <section className="space-y-1 rounded-lg border border-borde bg-superficie-tarjeta p-4" aria-labelledby="pase-temporada">
      <h2 id="pase-temporada" className="cuerpo font-bold text-texto">
        {T.paseTemporada}
      </h2>
      <p className="cuerpo-s text-texto">{T.paseTemporadaDetalle}</p>
      {porAlumno !== null && <p className="cuerpo-s font-semibold text-texto">{T.porAlumnoPorMes(formatearPesos(porAlumno))}</p>}
    </section>
  )
}

/** B3 · El camino Aula: el curso, el adicional y la Institución (WhatsApp). */
function CaminoAula({ porCurso, miPlan }: { porCurso: number; miPlan: ResumenDelPlan | null }) {
  const curso = precioAulaCurso()
  const adicional = precioAulaCursoAdicional()
  const whatsapp = linkDeWhatsApp(T.hablemosMensaje)
  const esMiPlan = miPlan?.tipo === 'aula' && miPlan.estado === 'activo'
  return (
    <section className="space-y-3" aria-labelledby="precios-aula">
      <h2 id="precios-aula" className="titulo-m text-texto">
        {T.aulaTitulo}
        {esMiPlan && <TuPlan />}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className={cn('rounded-lg border bg-superficie-tarjeta p-4', esMiPlan ? 'border-accion' : 'border-borde')}>
          <h3 className="cuerpo font-bold text-texto">{T.aulaCurso(porCurso)}</h3>
          <p className="cuerpo-l mt-2 font-bold text-texto">
            {curso !== null ? formatearPesos(curso) : '—'} <span className="nota font-normal text-texto-suave">{T.porMesCorto}</span>
          </p>
          <p className="cuerpo-s mt-2 text-texto-suave">{T.aulaCursoDetalle}</p>
          {curso !== null && (
            <Boton asChild className="mt-3">
              <Link href="/precios/pagar?plan=aula&forma=mensual&cantidad=1">{T.pagarAula}</Link>
            </Boton>
          )}
        </li>
        <li className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <h3 className="cuerpo font-bold text-texto">{T.aulaAdicional}</h3>
          <p className="cuerpo-l mt-2 font-bold text-texto">
            {adicional !== null ? formatearPesos(adicional) : '—'} <span className="nota font-normal text-texto-suave">{T.porMesCorto}</span>
          </p>
          <p className="cuerpo-s mt-2 text-texto-suave">{T.aulaCurso(porCurso)}.</p>
        </li>
      </ul>
      <p className="nota text-texto-suave">{T.aulaSinIndividual}</p>
      <div className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
        <h3 className="cuerpo font-bold text-texto">{T.institucionTitulo}</h3>
        <p className="cuerpo-s mt-1 text-texto">{T.institucionDetalle}</p>
        {whatsapp && (
          <Boton asChild variante="secundario" className="mt-3 gap-1.5">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              {T.hablemos}
              <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </a>
          </Boton>
        )}
      </div>
    </section>
  )
}
