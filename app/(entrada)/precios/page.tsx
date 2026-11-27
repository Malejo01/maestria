import { ComoFunciona } from '@/components/sistema/como-funciona'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ExternalLink, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import {
  ALUMNOS_POR_BLOQUE,
  DIAS_PASE,
  NIVELES,
  cupoDeNivel,
  cupoGratis,
  formatearPesos,
  linkDePago,
  precioMensual,
  precioPase,
  type NivelPlan,
  type TipoDePago,
} from '@/lib/planes'
import { OFERTA_PARTICULAR as O, PRECIOS as T } from '@/lib/textos'
import { OtrosPlanes } from '@/components/pagos/otros-planes'
import { alumnosMaximosPorCurso, type ResumenDelPlan } from '@/lib/planes'
import {
  caminoDelDocente,
  leerCamino,
  linkDeWhatsApp,
  pasePorAlumnoPorMes,
  precioAulaCurso,
  precioAulaCursoAdicional,
  precioPaseAlumno,
  type Camino,
} from '@/lib/precios'
import { getViewer } from '@/lib/auth-session'
import { resumenDelPlan } from '@/lib/planes-server'
import { cn } from '@/lib/utils'

/** AB3: lo que dice la vista previa de WhatsApp: la oferta Particular, sin la prueba. */
const descripcion = () => {
  const bloque = precioMensual(1)
  return `${O.gratis(cupoGratis())}. ${O.bloque(ALUMNOS_POR_BLOQUE)}${bloque === null ? '' : `: ${formatearPesos(bloque)} ${O.porMes}`}.`
}

export function generateMetadata(): Metadata {
  const description = `${T.frase} ${descripcion()}`
  return {
    title: 'Precios | MaestrIA',
    description,
    openGraph: { title: 'Precios de MaestrIA', description },
  }
}

/** Los niveles que se pagan: de 1 bloque al tope. El gratis va en la oferta de arriba. */
const NIVELES_PAGOS = NIVELES.filter((nivel) => nivel > 0)

/**
 * G5 y H5: /precios, sin cuenta. Es lo que Mauro le manda a un cliente por
 * WhatsApp, así que se piensa primero en celular: una tarjeta por nivel, y
 * recién desde 640 px una tabla.
 *
 * AB3 (27/11/2026): una sola oferta adelante, el plan Particular («Gratis con
 * 2 alumnos, para siempre» y el bloque de 5 por mes, con el pase de 90 días
 * más chico), con la garantía de 14 días y «sin débito automático» debajo.
 * Los demás bloques van plegados; Aula, Institución y Autodidacta, detrás de
 * «¿Sos escuela, instituto o estudiás por tu cuenta?». No se borró nada.
 *
 * Los montos salen de las mismas variables de entorno que el resto del cobro
 * (lib/planes.ts); ninguno está escrito acá. Si falta uno, se muestra "—".
 * Donde hay link de pago, el monto es un botón que lleva al link.
 */
export default async function PreciosPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const gratis = cupoGratis()
  // B3 y AB3: con sesión de docente, su plan queda marcado y, si usa el Aula,
  // los otros planes arrancan abiertos. `?camino=aula` también los abre.
  const pedido = leerCamino((await searchParams)?.camino)
  const miPlan = await planDelDocente()
  const camino: Camino | null = pedido ?? caminoDelDocente(miPlan)
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
        <ComoFunciona guia="planes-y-pagos" />
      </header>

      {/* AB3: una sola oferta adelante, el plan Particular. */}
      <OfertaParticular gratis={gratis} miPlan={miPlan} />

      {/* Los bloques de más de 5 alumnos, el pase de temporada y la letra chica, plegados. */}
      <details className="rounded-lg border border-borde bg-superficie-tarjeta p-4" data-todos-los-bloques>
        <summary className="cuerpo-s min-h-11 cursor-pointer font-semibold text-texto">{O.masBloques}</summary>
        <div className="mt-4 space-y-6">
          <section className="space-y-3" aria-labelledby="precios-planes">
            <h2 id="precios-planes" className="titulo-m text-texto">
              {T.planes}
            </h2>

            {/* Celular: una tarjeta por nivel pago. */}
            <ul className="space-y-3 sm:hidden" aria-label={T.planes}>
              {filas.map((fila) => (
                <li key={fila.nivel} className="rounded-lg border border-borde bg-superficie-base p-4">
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
            <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie-base sm:block">
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
          <ul className="space-y-2">
            {T.notas(gratis, cupoDeNivel(1)).map((nota) => (
              <li key={nota} className="cuerpo-s text-texto-suave">
                {nota}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* AB3: Aula, Institución y Autodidacta, detrás de un botón. No se borró nada. */}
      <OtrosPlanes etiqueta={O.otros} etiquetaCerrar={O.otrosCerrar} abiertoDeEntrada={camino === 'aula'}>
        <CaminoAula porCurso={porCurso} miPlan={miPlan} />
        <Autodidacta />
        <details className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <summary className="cuerpo-s min-h-11 cursor-pointer font-semibold text-texto">{T.porQueTitulo}</summary>
          <p className="cuerpo-s mt-2 text-texto">{T.porQueTexto}</p>
        </details>
      </OtrosPlanes>
    </div>
  )
}

/**
 * AB3 · La oferta: gratis con 2 alumnos para siempre, el bloque de 5 por mes
 * y, más chico, el pase de 90 días. Debajo, la garantía y lo de marzo.
 */
function OfertaParticular({ gratis, miPlan }: { gratis: number; miPlan: ResumenDelPlan | null }) {
  const mensual = precioMensual(1)
  const pase = precioPase(1)
  const esMiPlan = miPlan !== null && miPlan.tipo !== 'aula' && (miPlan.estado === 'activo' || miPlan.estado === 'gratis')
  const cobra = hayCobro()
  return (
    <section
      aria-labelledby="oferta-particular"
      className={cn('space-y-5 rounded-lg border-2 bg-superficie-tarjeta p-5', esMiPlan ? 'border-accion' : 'border-borde')}
      data-oferta-particular
    >
      <div className="space-y-1">
        <h2 id="oferta-particular" className="titulo-m text-texto">
          {O.titulo}
          {esMiPlan && <TuPlan />}
        </h2>
        <p className="cuerpo-s text-texto-suave">{O.bajada}</p>
      </div>

      <p className="cuerpo flex items-start gap-2 font-semibold text-texto">
        <Check className="mt-1 h-4 w-4 shrink-0 text-logrado" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        {O.gratis(gratis)}
      </p>

      <div className="space-y-2" data-bloque>
        <p className="cuerpo text-texto">{O.bloque(ALUMNOS_POR_BLOQUE)}</p>
        <p className="titulo-l text-texto">
          {mensual !== null ? formatearPesos(mensual) : O.sinPrecio}{' '}
          {mensual !== null && <span className="cuerpo font-normal text-texto-suave">{O.porMes}</span>}
        </p>
        {mensual !== null && (cobra || linkDePago('mensual', 1)) && (
          <Boton asChild>
            <Link
              href="/precios/pagar?plan=particular&forma=mensual&cantidad=1"
              aria-label={T.pagar('mensual', T.nombreNivel(1), formatearPesos(mensual))}
            >
              {O.pagarMes}
            </Link>
          </Boton>
        )}
      </div>

      {pase !== null && (
        <p className="cuerpo-s text-texto-suave" data-pase>
          {O.pase(DIAS_PASE)}: <span className="font-semibold text-texto">{formatearPesos(pase)}</span>
          {(cobra || linkDePago('pase', 1)) && (
            <>
              {' · '}
              <Link
                href="/precios/pagar?plan=particular&forma=pase&cantidad=1"
                aria-label={T.pagar('pase', T.nombreNivel(1), formatearPesos(pase))}
                className="font-semibold text-accion underline-offset-4 hover:underline"
              >
                {O.pagarPase}
              </Link>
            </>
          )}
        </p>
      )}

      <ul className="space-y-2 border-t border-borde pt-4">
        <li className="cuerpo-s flex items-start gap-2 text-texto" data-garantia>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accion" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {O.garantia}
        </li>
        <li className="cuerpo-s flex items-start gap-2 text-texto" data-marzo>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accion" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {O.marzo}
        </li>
      </ul>

      <Boton asChild variante="secundario" ancho>
        <Link href="/sign-in?rol=docente">{O.empezar}</Link>
      </Boton>
    </section>
  )
}

/** AB3: el pase por materia del que se prepara solo (E2), que antes no estaba en /precios. */
function Autodidacta() {
  const pase = precioPaseAlumno()
  return (
    <section aria-labelledby="precios-autodidacta" className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <h2 id="precios-autodidacta" className="cuerpo font-bold text-texto">
        {O.autodidactaTitulo}
      </h2>
      <p className="cuerpo-s text-texto">{O.autodidactaDetalle}</p>
      {pase !== null && <p className="cuerpo-s font-semibold text-texto">{O.autodidactaPase(formatearPesos(pase))}</p>}
    </section>
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
