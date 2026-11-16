'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { Cargando } from '@/components/sistema/cargando'
import { LegalNotice } from '@/components/legal-notice'
import {
  BajadaEntrada,
  CLASE_ENLACE_ENTRADA,
  Separador,
  TarjetaEntrada,
  TituloEntrada,
} from '@/components/entrada/tarjeta-entrada'
import { Boton } from '@/components/sistema/boton'
import { isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { guardarRolElegido } from '@/lib/rol-elegido'
import { ENTRADA, GRUPO } from '@/lib/textos'

interface ClassroomPreview {
  id: number
  name: string
  subject_name: string
  nivel: string | null
  grado: string | null
  teacher_name: string
}

interface QuienEntra {
  displayName: string
  isGuest: boolean
}

/**
 * La pantalla de quien llegó por un link de grupo o escribió un código.
 *
 * Acá NO se pregunta el rol: quien llega por una invitación es alumno, y
 * preguntárselo sería hacerle una pregunta cuya respuesta ya tenemos. Arriba va
 * quién lo invitó, y abajo un solo camino recomendado: entrar con el nombre,
 * sin cuenta. Google queda como salida secundaria para quien ya tiene cuenta.
 *
 * Vive fuera del caparazón de la app a propósito: un alumno que llega desde un
 * link pegado en un grupo de WhatsApp tiene que caer en una pantalla enfocada.
 */
export default function LinkDeGrupoPage() {
  const params = useParams<{ codigo: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const idNombre = useId()

  const code = normalizeJoinCode(String(params?.codigo ?? ''))
  const codigoValido = isValidJoinCode(code)

  const [preview, setPreview] = useState<ClassroomPreview | null>(null)
  const [quienEntra, setQuienEntra] = useState<QuienEntra | null>(null)
  const [error, setError] = useState<string | null>(codigoValido ? null : GRUPO.codigoInvalido)
  const [isLoading, setIsLoading] = useState(codigoValido)
  const [guestName, setGuestName] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (!codigoValido) return

    let isMounted = true

    fetch(`/api/classrooms/join?code=${encodeURIComponent(code)}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!isMounted) return
        if (!ok) {
          setError(data?.error || GRUPO.noEncontrado)
          return
        }
        setPreview(data.classroom)
        setQuienEntra(data.viewer ?? null)
      })
      .catch(() => {
        if (isMounted) setError(GRUPO.sinConexion)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [code, codigoValido])

  const join = async (displayName?: string) => {
    setIsJoining(true)
    setError(null)

    try {
      const response = await fetch('/api/classrooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, displayName }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data?.error || GRUPO.noPudimosSumarte)
        return
      }

      router.push('/aulas')
    } catch {
      setError(GRUPO.noPudimosSumarte)
    } finally {
      setIsJoining(false)
    }
  }

  function entrarComoInvitado(evento: FormEvent) {
    evento.preventDefault()
    const nombre = guestName.trim()
    if (nombre) void join(nombre)
  }

  function entrarConGoogle() {
    // Llegó por una invitación: es alumno, y la bienvenida no se lo pregunta.
    guardarRolElegido('alumno')
    void signIn('google', { callbackUrl: `/aula/${code}` })
  }

  // Quien ya tiene identidad (cuenta, o invitado que vuelve con su cookie) no
  // escribe nada: confirma y entra.
  const nombreConocido =
    status === 'authenticated' ? (session?.user?.name?.split(' ')[0] ?? null) : (quienEntra?.displayName ?? null)
  const yaTieneIdentidad = status === 'authenticated' || Boolean(quienEntra)

  return (
    <TarjetaEntrada>
      {isLoading && (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando />
          {GRUPO.buscando}
        </p>
      )}

      {!isLoading && !preview && (
        <>
          <p className="cuerpo-s mb-4 text-texto" role="alert">
            {error}
          </p>
          <Boton variante="secundario" asChild>
            <Link href="/">{GRUPO.volverAlInicio}</Link>
          </Boton>
        </>
      )}

      {preview && (
        <>
          <p className="nota text-texto-suave">{GRUPO.teInvito(preview.teacher_name)}</p>
          <TituloEntrada className="mt-1">{preview.subject_name}</TituloEntrada>
          <BajadaEntrada>
            {[preview.name, preview.nivel, preview.grado].filter(Boolean).join(' · ')}
          </BajadaEntrada>

          {yaTieneIdentidad ? (
            <Boton ancho disabled={isJoining} onClick={() => join()}>
              {isJoining && <Cargando />}
              {isJoining ? GRUPO.entrando : nombreConocido ? GRUPO.entrarComo(nombreConocido) : GRUPO.entrar}
            </Boton>
          ) : (
            <>
              <form onSubmit={entrarComoInvitado} noValidate>
                <label htmlFor={idNombre} className="nota mb-2 block font-semibold text-texto-suave">
                  {GRUPO.nombre.etiqueta}
                </label>
                <input
                  id={idNombre}
                  type="text"
                  value={guestName}
                  onChange={(evento) => setGuestName(evento.target.value)}
                  placeholder={GRUPO.nombre.ejemplo}
                  autoComplete="name"
                  maxLength={80}
                  className="mb-3 h-12 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70"
                />
                <Boton type="submit" ancho disabled={isJoining || !guestName.trim()}>
                  {isJoining && <Cargando />}
                  {isJoining ? GRUPO.entrando : GRUPO.entrar}
                </Boton>
                <p className="nota mt-2 text-texto-suave">{GRUPO.bajadaInvitado}</p>
              </form>

              <Separador>{ENTRADA.separador}</Separador>

              <button type="button" className={CLASE_ENLACE_ENTRADA} onClick={entrarConGoogle}>
                {GRUPO.yaTengoCuenta}
              </button>
            </>
          )}

          {error && (
            <p className="nota mt-3 text-flojo" role="alert">
              {error}
            </p>
          )}

          <LegalNotice action="entrar al grupo" className="mt-3" />
        </>
      )}
    </TarjetaEntrada>
  )
}
