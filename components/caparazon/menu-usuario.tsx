'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRefrescarSesion } from '@/hooks/use-refrescar-sesion'
import { ArrowLeftRight, CreditCard, ExternalLink, Filter, Gauge, LogOut, Undo2, Inbox } from 'lucide-react'
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
import { BUZON, EMBUDO, CUENTA } from '@/lib/textos'
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
  esAdmin = false,
}: {
  nombre: string
  email: string | null
  rol: UserRole
  /** Un docente mirando las pantallas de alumno. */
  vistaPrevia: boolean
  /**
   * H4: la lista de admin (`isAdminEmail`). Suma los links a /admin/planes y
   * /admin/ai-usage, que antes sólo se encontraban escribiendo la dirección.
   * Para cualquier otra cuenta el menú no cambia.
   */
  esAdmin?: boolean
}) {
  const actualizarSesion = useRefrescarSesion()
  const nuevos = useReportesNuevos(esAdmin)
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
            className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-borde bg-superficie-suave font-titulo text-[15px] font-extrabold text-accion hover:border-borde-fuerte"
          >
            <span aria-hidden="true">{inicial}</span>
            {nuevos > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accion px-1 text-[11px] font-bold leading-5 text-texto-sobre-accion">
                {nuevos}
                <span className="sr-only">{BUZON.menuNuevos(nuevos)}</span>
              </span>
            )}
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

          {esAdmin && (
            <>
              <DropdownMenuSeparator className="bg-borde" />
              <DropdownMenuLabel className="etiqueta px-3 pt-2 pb-1 text-texto-suave">{CUENTA.admin.titulo}</DropdownMenuLabel>
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/admin/planes">
                  <CreditCard aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  {CUENTA.admin.planes}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/admin/reportes">
                  <Inbox aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {BUZON.menu}
                    {nuevos > 0 && (
                      <span className="nota rounded-full bg-accion px-2 font-bold text-texto-sobre-accion">{BUZON.menuNuevos(nuevos)}</span>
                    )}
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/admin/embudo">
                  <Filter aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  {EMBUDO.menu}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className={ITEM}>
                <Link href="/admin/ai-usage">
                  <Gauge aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  {CUENTA.admin.usoDeIA}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-borde" />
            </>
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

/**
 * M6: cuántos reportes hay en 'nuevo', para la marca del menú del admin. Se
 * pide al montar y cuando el buzón cambia un estado. Para otra cuenta, 0 y
 * ningún pedido.
 */
function useReportesNuevos(esAdmin: boolean): number {
  const [nuevos, setNuevos] = useState(0)
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    if (!esAdmin) return
    const alCambiar = () => setVuelta((n) => n + 1)
    window.addEventListener('maestria:reportes-cambiaron', alCambiar)
    return () => window.removeEventListener('maestria:reportes-cambiaron', alCambiar)
  }, [esAdmin])
  useEffect(() => {
    if (!esAdmin) return
    let vigente = true
    Promise.resolve()
      .then(() => fetch('/api/admin/reportes?resumen=1'))
      .then((r) => (r?.ok ? r.json() : null))
      .then((datos: { nuevos?: number } | null) => {
        if (vigente) setNuevos(Number(datos?.nuevos ?? 0))
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [esAdmin, vuelta])
  return esAdmin ? nuevos : 0
}
