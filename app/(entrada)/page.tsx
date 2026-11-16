import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/auth-session'
import { inicioDe } from '@/lib/navegacion'
import { ENTRADA, MARCA } from '@/lib/textos'
import { TarjetaEntrada, TituloEntrada, BajadaEntrada, Separador } from '@/components/entrada/tarjeta-entrada'
import { ElegirRol } from '@/components/entrada/elegir-rol'
import { CampoCodigo } from '@/components/entrada/campo-codigo'
import { Bienvenida } from '@/components/entrada/bienvenida'

export const dynamic = 'force-dynamic'

/**
 * La raíz del sitio.
 *
 * Para quien no tiene cuenta es la entrada: qué es MaestrIA en una frase y una
 * sola decisión (¿docente o alumno?), con el campo de código aparte para quien
 * ya recibió una invitación.
 *
 * Quien ya tiene identidad no ve esta pantalla: va derecho a su inicio (el
 * docente a Mis alumnos, el alumno y el invitado a Mis tareas). Y quien tiene
 * cuenta pero todavía no eligió rol cae en la bienvenida, que termina de
 * preguntarle lo que falta.
 */
export default async function RaizPage() {
  const viewer = await getViewer()
  const quien = viewer ? { rol: viewer.role, esInvitado: viewer.isGuest } : null

  const inicio = inicioDe(quien)
  if (inicio) redirect(inicio)

  if (viewer) return <Bienvenida />

  return (
    <>
      <p className="cuerpo-s max-w-[380px] text-center text-texto-suave">{MARCA.queEs}</p>
      <TarjetaEntrada>
        <TituloEntrada>{ENTRADA.titulo}</TituloEntrada>
        <BajadaEntrada>{ENTRADA.bajada}</BajadaEntrada>
        <ElegirRol hrefDe={(rol) => `/sign-in?rol=${rol}`} />
        <Separador>{ENTRADA.separador}</Separador>
        <CampoCodigo />
      </TarjetaEntrada>
    </>
  )
}
