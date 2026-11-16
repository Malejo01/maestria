'use client'

import { Cargando } from '@/components/sistema/cargando'


import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { LegalNotice } from '@/components/legal-notice'
import {
  BajadaEntrada,
  CLASE_ENLACE_ENTRADA,
  CLASE_ENLACE_SUAVE,
  Separador,
  TarjetaEntrada,
  TituloEntrada,
} from '@/components/entrada/tarjeta-entrada'
import { Boton } from '@/components/sistema/boton'
import { esRolElegido, guardarRolElegido, type RolElegido } from '@/lib/rol-elegido'
import { safeCallbackUrl } from '@/lib/safe-callback-url'
import { ENTRADA, INGRESO } from '@/lib/textos'

/**
 * El paso 2 de la entrada: el método de ingreso, DESPUÉS de haber elegido rol.
 *
 * Llega como `/sign-in?rol=docente` o `?rol=alumno`. Tiene URL propia para que
 * el botón Atrás del navegador y recargar funcionen, pero comparte la tarjeta
 * con la entrada, así que se lee como el paso siguiente y no como otra página.
 *
 * Hoy el único método es Google. El ingreso por email con código queda para su
 * propio PR: necesita un proveedor de correo y una tabla de tokens que todavía
 * no existen.
 */
export default function SignInPage() {
  return (
    // useSearchParams obliga a un límite de Suspense para poder prerenderizar.
    <Suspense fallback={<Ingreso rol={null} callbackUrl="/" />}>
      <IngresoDesdeLaUrl />
    </Suspense>
  )
}

function IngresoDesdeLaUrl() {
  const params = useSearchParams()
  const rol = params.get('rol')
  return (
    <Ingreso rol={esRolElegido(rol) ? rol : null} callbackUrl={safeCallbackUrl(params.get('callbackUrl'))} />
  )
}

function Ingreso({ rol, callbackUrl }: { rol: RolElegido | null; callbackUrl: string }) {
  const router = useRouter()
  const { status } = useSession()
  const [abriendo, setAbriendo] = useState(false)

  // Con sesión abierta no hay nada que hacer acá.
  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl)
  }, [status, callbackUrl, router])

  const textos = rol ? INGRESO[rol] : INGRESO.sinRol

  function entrarConGoogle() {
    setAbriendo(true)
    // El rol tiene que sobrevivir a la ida y vuelta a Google: la bienvenida lo
    // lee al volver y no pregunta de nuevo. Ver lib/rol-elegido.ts.
    if (rol) guardarRolElegido(rol)
    void signIn('google', { callbackUrl })
  }

  return (
    <TarjetaEntrada key={rol ?? 'sin-rol'}>
      <TituloEntrada>{textos.titulo}</TituloEntrada>
      <BajadaEntrada>{callbackUrl === '/practicar' ? INGRESO.paraPracticar : textos.bajada}</BajadaEntrada>

      <Boton ancho onClick={entrarConGoogle} disabled={abriendo}>
        {abriendo && <Cargando />}
        {abriendo ? INGRESO.abriendoGoogle : INGRESO.conGoogle}
      </Boton>

      <LegalNotice action="ingresar" className="mt-3" />

      {rol === 'alumno' && (
        <>
          <Separador>{ENTRADA.separador}</Separador>
          <Link href="/" className={CLASE_ENLACE_ENTRADA}>
            {INGRESO.alumno.tengoCodigo}
          </Link>
        </>
      )}

      <div className="mt-1">
        <Link href="/" className={CLASE_ENLACE_SUAVE}>
          {textos.volver}
        </Link>
      </div>
    </TarjetaEntrada>
  )
}
