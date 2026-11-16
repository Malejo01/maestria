import Link from 'next/link'
import { ENTRADA } from '@/lib/textos'
import { cn } from '@/lib/utils'
import type { RolElegido } from '@/lib/rol-elegido'

/**
 * Las dos opciones grandes de la entrada: qué sos y qué hacés.
 *
 * Es la única decisión de la pantalla. El método de ingreso (Google) NO va
 * acá: viene en el paso siguiente, después de elegir. Ofrecer rol y método a la
 * vez es exactamente lo que confundía a los docentes que probaron la versión
 * anterior (design-reference/sistema/componentes/ElegirRol).
 *
 * Diferencia deliberada con la referencia: la segunda línea del botón azul va
 * en `texto-sobre-accion` pleno y no al 75 % de opacidad. A 12 px, la versión
 * atenuada da 3,8:1 sobre `accion` y no llega al 4,5:1 que exige AA.
 */
const BASE = 'block w-full rounded-lg border-[1.5px] p-4 text-left transition-colors'
const LLENO = 'border-accion bg-accion hover:border-accion-hover hover:bg-accion-hover'
const HUECO = 'border-texto bg-superficie-tarjeta hover:bg-superficie-suave'

function Contenido({ rol }: { rol: RolElegido }) {
  const lleno = rol === 'docente'
  return (
    <>
      <span className={cn('cuerpo-l block', lleno ? 'text-texto-sobre-accion' : 'text-texto')}>
        {ENTRADA[rol].titulo}
      </span>
      <span className={cn('nota mt-0.5 block', lleno ? 'text-texto-sobre-accion' : 'text-texto-suave')}>
        {ENTRADA[rol].detalle}
      </span>
    </>
  )
}

type Props =
  /** En la entrada: cada opción lleva al paso de ingreso, con URL propia. */
  | { hrefDe: (rol: RolElegido) => string; onElegir?: never; deshabilitado?: never }
  /** En la bienvenida (ya hay sesión): elegir guarda el rol directamente. */
  | { onElegir: (rol: RolElegido) => void; hrefDe?: never; deshabilitado?: boolean }

export function ElegirRol(props: Props) {
  const roles: RolElegido[] = ['docente', 'alumno']

  return (
    <div className="flex flex-col gap-3">
      {roles.map((rol) => {
        const clase = cn(BASE, rol === 'docente' ? LLENO : HUECO)
        return props.hrefDe ? (
          <Link key={rol} href={props.hrefDe(rol)} className={clase}>
            <Contenido rol={rol} />
          </Link>
        ) : (
          <button
            key={rol}
            type="button"
            className={cn(clase, 'disabled:opacity-60')}
            disabled={props.deshabilitado}
            onClick={() => props.onElegir(rol)}
          >
            <Contenido rol={rol} />
          </button>
        )
      })}
    </div>
  )
}
