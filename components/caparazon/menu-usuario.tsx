'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRefrescarSesion } from '@/hooks/use-refrescar-sesion'
import { ArrowLeftRight, ExternalLink, GraduationCap, LogOut, ShieldCheck, Undo2 } from 'lucide-react'
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
import { ADMIN, BUZON, CUENTA, DISTINTIVO_DEL_PLAN, MODALIDAD } from '@/lib/textos'
import { RUTA_COMO_DAS_CLASES } from '@/components/docente/como-das-clases'
import { DistintivoPlan } from '@/components/sistema/distintivo-plan'
import { estadoEnElAvatar, etiquetaDelAvatar, huellaDelPlan, seAcreditoUnPlan } from '@/lib/distintivo-del-plan'
import type { ResumenDelPlan } from '@/lib/planes'
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
   * H4/P1: la lista de admin (`isAdminEmail`). Suma un solo link, al panel de
   * administrador (/admin), que lleva a todas sus secciones. Para cualquier
   * otra cuenta el menú no cambia.
   */
  esAdmin?: boolean
}) {
  const actualizarSesion = useRefrescarSesion()
  const nuevos = useReportesNuevos(esAdmin)
  // B2: el estado del plan del docente, en el avatar y en el menú (no para el admin).
  const { plan, caer } = usePlanEnElAvatar(rol === 'DOCENTE' && !esAdmin && !vistaPrevia)
  const enElAvatar = estadoEnElAvatar(plan)
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
            aria-label={enElAvatar.estado || enElAvatar.fundadora ? etiquetaDelAvatar(nombre, enElAvatar, CUENTA.abrirMenu) : CUENTA.abrirMenu}
            data-plan={plan?.estado}
            className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-borde bg-superficie-suave font-titulo text-[15px] font-extrabold text-accion hover:border-borde-fuerte"
          >
            <span aria-hidden="true">{inicial}</span>
            <DistintivoPlan distintivo={enElAvatar.distintivo} punto={enElAvatar.punto} caer={caer} />
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
          {enElAvatar.titulo && <PlanEnElMenu estado={enElAvatar} />}
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

          {/* AC1: cómo da clases (cambia cómo cuentan los alumnos en el gratis). */}
          {rol === 'DOCENTE' && !vistaPrevia && (
            <DropdownMenuItem asChild className={ITEM}>
              <Link href={RUTA_COMO_DAS_CLASES} data-menu-como-das-clases>
                <GraduationCap aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                <span>
                  {MODALIDAD.menu}
                  {plan && (
                    <span className="nota block text-texto-suave">
                      {MODALIDAD.menuDetalle[plan.modalidad ?? 'sinDato']}
                    </span>
                  )}
                </span>
              </Link>
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
                <Link href="/admin">
                  <ShieldCheck aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {ADMIN.menu}
                    {nuevos > 0 && (
                      <span className="nota rounded-full bg-accion px-2 font-bold text-texto-sobre-accion">{BUZON.menuNuevos(nuevos)}</span>
                    )}
                  </span>
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

/** B2 · El bloque del plan en el menú: fundadora, el plan, la barra de cupo y qué hacer. */
function PlanEnElMenu({ estado }: { estado: ReturnType<typeof estadoEnElAvatar> }) {
  const porcentaje = estado.cupo && estado.cupo.total > 0 ? Math.min(100, Math.round((estado.cupo.usados / estado.cupo.total) * 100)) : 0
  return (
    <div className="space-y-1.5 px-3 pb-3" data-plan-en-el-menu="">
      {estado.fundadora && <p className="etiqueta text-accion">{DISTINTIVO_DEL_PLAN.fundadora}</p>}
      <p className="cuerpo-s font-semibold text-texto">{estado.titulo}</p>
      {estado.cupo && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label={DISTINTIVO_DEL_PLAN.cupoEtiqueta}
            aria-valuemin={0}
            aria-valuemax={estado.cupo.total}
            aria-valuenow={estado.cupo.usados}
            aria-valuetext={estado.cupo.texto}
            className="h-1.5 overflow-hidden rounded-full bg-superficie-suave"
          >
            <div className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-flojo' : 'bg-accion'}`} style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="nota text-texto-suave">{estado.cupo.texto}</p>
        </div>
      )}
      {estado.detalle && <p className={`nota ${estado.punto ? 'text-flojo' : 'text-texto-suave'}`}>{estado.detalle}</p>}
      {estado.accion && (
        <Link href={estado.accion.href} className="nota inline-flex min-h-11 items-center font-semibold text-accion underline-offset-2 hover:underline">
          {estado.accion.texto}
        </Link>
      )}
    </div>
  )
}

/**
 * B2 · El plan del docente para el avatar (GET /api/teacher/plan). `caer`: el
 * birrete cae una sola vez cuando se acredita un plan (la huella de lo visto
 * queda en el navegador). Si la lectura falla, sin distintivo: nada se rompe.
 */
const HUELLA = 'maestria:plan-visto'

function usePlanEnElAvatar(activo: boolean): { plan: ResumenDelPlan | null; caer: boolean } {
  const [plan, setPlan] = useState<ResumenDelPlan | null>(null)
  const [caer, setCaer] = useState(false)
  useEffect(() => {
    if (!activo) return
    let vigente = true
    Promise.resolve()
      .then(() => fetch('/api/teacher/plan'))
      .then((r) => (r?.ok ? r.json() : null))
      .then((datos: { plan?: ResumenDelPlan } | null) => {
        if (!vigente || !datos?.plan) return
        setPlan(datos.plan)
        const actual = huellaDelPlan(datos.plan)
        try {
          const anterior = window.localStorage.getItem(HUELLA)
          if (seAcreditoUnPlan(anterior, actual)) setCaer(true)
          if (actual) window.localStorage.setItem(HUELLA, actual)
        } catch {
          // Sin almacenamiento, sin animación: el distintivo igual se ve.
        }
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [activo])
  return { plan: activo ? plan : null, caer }
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
