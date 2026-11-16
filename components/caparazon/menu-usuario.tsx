'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRefrescarSesion } from '@/hooks/use-refrescar-sesion'
import { ArrowLeftRight, ExternalLink, LogOut, Undo2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { inicioDe } from '@/lib/navegacion'
import { CUENTA } from '@/lib/textos'
import type { UserRole } from '@/lib/types'

const ITEM = 'min-h-11 cursor-pointer gap-3 rounded-sm px-3 cuerpo-s text-texto focus:bg-superficie-suave focus:text-texto'

/**
 * El menú de la cuenta: quién sos, cómo estás entrando, y las dos únicas cosas
 * que se hacen con la cuenta (cambiar de vista y salir).
 *
 * El cambio de rol vive ACÁ y no en la barra. Antes era un desplegable a un
 * clic del logo que cambiaba el rol en caliente, y una persona podía pasar a
 * ver otra aplicación sin querer. Ahora hay dos caminos, y ninguno es
 * accidental:
 *
 *  - "Ver la vista de alumno" (docente): abre las pantallas de alumno en otra
 *    pestaña, con un aviso arriba. El rol NO cambia, así que el panel del
 *    docente sigue funcionando en la pestaña original.
 *  - "Cambiar mi cuenta a…": cambia el rol de verdad, con confirmación
 *    explícita y un texto que dice qué va a pasar.
 */
export function MenuUsuario({
  nombre,
  email,
  rol,
  vistaPrevia,
}: {
  nombre: string
  email: string | null
  rol: UserRole
  /** Un docente mirando las pantallas de alumno. */
  vistaPrevia: boolean
}) {
  const actualizarSesion = useRefrescarSesion()
  const [confirmando, setConfirmando] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [fallo, setFallo] = useState(false)

  const destino: UserRole = rol === 'DOCENTE' ? 'ALUMNO' : 'DOCENTE'
  const textos = destino === 'ALUMNO' ? CUENTA.cambiar.aAlumno : CUENTA.cambiar.aDocente
  const inicial = (nombre.trim()[0] ?? '?').toUpperCase()

  async function cambiarDeRol() {
    setCambiando(true)
    setFallo(false)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: destino }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // El rol viaja cacheado en el JWT: sin esto el proxy sigue viendo el viejo.
      await actualizarSesion()
      // Carga completa a propósito: cambia el caparazón entero y el store.
      window.location.assign(inicioDe({ rol: destino, esInvitado: false }) ?? '/')
    } catch {
      setFallo(true)
      setCambiando(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={CUENTA.abrirMenu}
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-borde bg-superficie-suave font-titulo text-[15px] font-extrabold text-accion hover:border-borde-fuerte"
          >
            <span aria-hidden="true">{inicial}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-lg border-borde-fuerte p-2">
          <DropdownMenuLabel className="px-3 pb-3 font-normal">
            <span className="cuerpo-s block truncate font-bold text-texto">{nombre}</span>
            {email && <span className="nota block truncate text-texto-suave">{email}</span>}
            <span className="nota mt-1 block text-texto-suave">{CUENTA.estasComo[rol]}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-borde" />

          {rol === 'DOCENTE' && !vistaPrevia && (
            <DropdownMenuItem asChild className={ITEM}>
              <a href="/aulas" target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                <span>
                  {CUENTA.verComoAlumno}
                  <span className="nota block text-texto-suave">{CUENTA.verComoAlumnoDetalle}</span>
                </span>
              </a>
            </DropdownMenuItem>
          )}

          {vistaPrevia && (
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/teacher">
                <Undo2 aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {CUENTA.vistaAlumno.volver}
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem className={ITEM} onSelect={() => setConfirmando(true)}>
            <ArrowLeftRight aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {textos.item}
          </DropdownMenuItem>

          <DropdownMenuItem className={ITEM} onSelect={() => signOut({ callbackUrl: '/' })}>
            <LogOut aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {CUENTA.cerrarSesion}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmando} onOpenChange={(abierto) => !cambiando && setConfirmando(abierto)}>
        <AlertDialogContent className="rounded-lg border-borde">
          <AlertDialogHeader>
            <AlertDialogTitle className="titulo-m text-texto">{textos.titulo}</AlertDialogTitle>
            <AlertDialogDescription className="cuerpo-s text-texto-suave">{textos.detalle}</AlertDialogDescription>
          </AlertDialogHeader>
          {fallo && (
            <p className="nota text-flojo" role="alert">
              {CUENTA.cambiar.fallo}
            </p>
          )}
          <AlertDialogFooter>
            <Boton variante="secundario" disabled={cambiando} onClick={() => setConfirmando(false)}>
              {CUENTA.cambiar.cancelar}
            </Boton>
            <Boton disabled={cambiando} onClick={cambiarDeRol}>
              {cambiando && <Cargando />}
              {cambiando ? CUENTA.cambiar.cambiando : CUENTA.cambiar.confirmar}
            </Boton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
