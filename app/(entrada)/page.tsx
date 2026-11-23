import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/auth-session'
import { inicioDe } from '@/lib/navegacion'
import { ENTRADA, PORTADA } from '@/lib/textos'
import { TarjetaEntrada, TituloEntrada, BajadaEntrada, Separador } from '@/components/entrada/tarjeta-entrada'
import { ElegirRol } from '@/components/entrada/elegir-rol'
import { CampoCodigo } from '@/components/entrada/campo-codigo'
import { Bienvenida } from '@/components/entrada/bienvenida'
import { Boton } from '@/components/sistema/boton'
import { Aparecer } from '@/components/sistema/aparecer'
import { Logo } from '@/components/sistema/logo'
import { CAMINOS_DE_LA_PORTADA, CAPTURA_DEL_CAMINO, DESTINO_DEL_CAMINO, testimoniosValidos, videoDeDemo } from '@/lib/portada'

export const dynamic = 'force-dynamic'

/** Los testimonios del repo (content/portada/testimonios.json). Sin archivo o vacío: ninguno. */
async function leerTestimonios() {
  try {
    return testimoniosValidos(JSON.parse(await readFile(join(process.cwd(), 'content', 'portada', 'testimonios.json'), 'utf8')))
  } catch {
    return []
  }
}

/**
 * La raíz del sitio.
 *
 * Ronda V · V5: para quien no tiene cuenta es la portada pública, con la
 * tesis ("Tu alumno llega a la mesa sabiendo qué le falta") y los tres
 * caminos (clases particulares, un curso, prepararse solo para un examen),
 * cada uno con una captura de la materia de ejemplo (V2). Abajo, la entrada
 * de siempre: docente o alumno, y el código de quien ya recibió una invitación.
 * El video de demo y los testimonios aparecen sólo cuando hay contenido.
 *
 * Quien ya tiene identidad no ve esta pantalla: va derecho a su inicio. Y
 * quien tiene cuenta pero todavía no eligió rol cae en la bienvenida.
 */
export default async function RaizPage() {
  const viewer = await getViewer()
  const quien = viewer ? { rol: viewer.role, esInvitado: viewer.isGuest } : null

  const inicio = inicioDe(quien)
  if (inicio) redirect(inicio)

  if (viewer) return <Bienvenida />

  const video = videoDeDemo(process.env.NEXT_PUBLIC_VIDEO_DEMO_URL)
  const testimonios = await leerTestimonios()

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-14 pb-6">
      <Aparecer className="flex max-w-2xl flex-col items-center gap-5 pt-4 text-center">
        <Logo />
        <h1 className="titulo-l text-balance text-texto sm:text-[40px] sm:leading-tight">{PORTADA.titular}</h1>
        <p className="cuerpo text-pretty text-texto-suave">{PORTADA.bajada}</p>
        <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          <Boton asChild>
            <Link href="/sign-in?rol=docente">{PORTADA.empezar}</Link>
          </Boton>
          <Boton asChild variante="secundario">
            <Link href="#entrar">{PORTADA.tengoCodigo}</Link>
          </Boton>
        </div>
      </Aparecer>

      {video && (
        <section aria-labelledby="portada-video" className="w-full max-w-3xl space-y-3" data-video-demo>
          <h2 id="portada-video" className="titulo-m text-center text-texto">
            {PORTADA.video}
          </h2>
          <div className="aspect-video overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta">
            <iframe
              src={video}
              title={PORTADA.video}
              className="size-full"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>
      )}

      <section aria-labelledby="portada-caminos" className="w-full space-y-6">
        <h2 id="portada-caminos" className="titulo-m text-center text-texto">
          {PORTADA.caminosTitulo}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {CAMINOS_DE_LA_PORTADA.map((camino, i) => {
            const t = PORTADA.caminos[camino]
            return (
              <li key={camino}>
                <Aparecer demora={i * 0.06} className="flex h-full flex-col gap-4 rounded-lg border border-borde bg-superficie-tarjeta p-5">
                  <div className="space-y-2" data-camino={camino}>
                    <h3 className="cuerpo font-bold text-texto">{t.titulo}</h3>
                    <p className="cuerpo-s text-texto-suave">{t.detalle}</p>
                  </div>
                  <div className="relative mt-auto aspect-[4/3] w-full overflow-hidden rounded-md border border-borde bg-superficie-base">
                    <Image
                      src={CAPTURA_DEL_CAMINO[camino]}
                      alt={t.captura}
                      fill
                      sizes="(min-width: 768px) 320px, 100vw"
                      className={camino === 'curso' ? 'object-contain' : 'object-cover object-top'}
                    />
                  </div>
                  <Boton asChild variante="secundario">
                    <Link href={DESTINO_DEL_CAMINO[camino]}>{t.boton}</Link>
                  </Boton>
                </Aparecer>
              </li>
            )
          })}
        </ul>
        <p className="nota text-center text-texto-suave">{PORTADA.datosDeEjemplo}</p>
      </section>

      {testimonios.length > 0 && (
        <section aria-labelledby="portada-testimonios" className="w-full space-y-4" data-testimonios>
          <h2 id="portada-testimonios" className="titulo-m text-center text-texto">
            {PORTADA.testimonios}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {testimonios.map((t) => (
              <li key={`${t.nombre}-${t.texto.slice(0, 20)}`} className="rounded-lg border border-borde bg-superficie-tarjeta p-5">
                <blockquote className="cuerpo text-texto">{t.texto}</blockquote>
                <p className="nota mt-3 text-texto-suave">
                  {t.nombre} · {t.rol}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="entrar" aria-label={PORTADA.entrar} className="flex w-full scroll-mt-6 flex-col items-center">
        <TarjetaEntrada>
          <TituloEntrada>{ENTRADA.titulo}</TituloEntrada>
          <BajadaEntrada>{ENTRADA.bajada}</BajadaEntrada>
          <ElegirRol hrefDe={(rol) => `/sign-in?rol=${rol}`} />
          <Separador>{ENTRADA.separador}</Separador>
          <CampoCodigo />
        </TarjetaEntrada>
      </section>
    </div>
  )
}
