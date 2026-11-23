import type { Metadata } from 'next'
import { Logo } from '@/components/sistema/logo'
import { leerInformePublico } from '@/lib/informe-familia-server'
import { INFORME_FAMILIA } from '@/lib/textos'

/**
 * Ronda V · V4 — El informe del alumno para él y su familia: sólo lectura,
 * sin login, con el token del link. Se arma en el momento (muestra cómo viene
 * hoy). Nunca la indexa un buscador.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Informe · MaestrIA',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

const T = INFORME_FAMILIA.pagina
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })

function Lista({ titulo, temas, clase }: { titulo: string; temas: string[]; clase: string }) {
  return (
    <section className="space-y-2">
      <h2 className="cuerpo font-bold text-texto">{titulo}</h2>
      {temas.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.nada}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {temas.map((t) => (
            <li key={t} className={`cuerpo-s rounded-md border px-3 py-1 ${clase}`}>
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function InformePage({ params }: { params: Promise<{ token: string }> }) {
  const informe = await leerInformePublico((await params).token)

  if (!informe) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <Logo className="mx-auto" />
        <h1 className="titulo-m text-texto">{T.noExiste}</h1>
        <p className="cuerpo-s text-texto-suave">{T.noExisteDetalle}</p>
      </div>
    )
  }

  return (
    <article className="w-full max-w-xl space-y-6 rounded-lg border border-borde bg-superficie-tarjeta p-6" data-informe-familia>
      <header className="space-y-2">
        <Logo />
        <h1 className="titulo-l text-texto">{T.titulo(informe.nombre)}</h1>
        {informe.materias.length > 0 && <p className="cuerpo-s text-texto-suave">{T.materias(informe.materias.join(' · '))}</p>}
      </header>

      <section className="space-y-1">
        <p className="cuerpo text-texto">{T.practico(informe.cuestionarios)}</p>
        {informe.ultimaVez && <p className="cuerpo-s text-texto-suave">{T.ultimaVez(fecha(informe.ultimaVez))}</p>}
        {informe.aciertosDelMes !== null && <p className="cuerpo-s text-texto-suave">{T.aciertos(informe.aciertosDelMes)}</p>}
      </section>

      <Lista titulo={T.dominados} temas={informe.dominados} clase="border-logrado text-logrado" />
      <Lista titulo={T.aReforzar} temas={informe.aReforzar} clase="border-flojo text-flojo" />
      {informe.enCamino.length > 0 && <Lista titulo={T.enCamino} temas={informe.enCamino} clase="border-borde-fuerte text-texto" />}

      {informe.proximosPasos && (
        <section className="space-y-2 rounded-md bg-superficie-suave p-4">
          <h2 className="cuerpo font-bold text-texto">{T.proximosPasos}</h2>
          <p className="cuerpo-s whitespace-pre-line text-texto">{informe.proximosPasos}</p>
        </section>
      )}

      <p className="nota text-texto-suave">{T.pie(fecha(informe.venceEl))}</p>
    </article>
  )
}
