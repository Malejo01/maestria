import Link from 'next/link'
import { LEGALES } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Aviso legal compacto para los puntos donde efectivamente se recolecta el dato:
 * la pantalla de ingreso con Google y la de entrar a un grupo como invitado.
 *
 * Existe aparte del pie porque esas pantallas son sueltas, a propósito. Sin
 * esto, un alumno menor de edad crea su sesión sin haber tenido a la vista un
 * solo link a la política que describe ese tratamiento.
 */
export function LegalNotice({
  action = 'continuar',
  className,
}: {
  /** Cómo se nombra el acto de consentimiento: "ingresar", "entrar al grupo", … */
  action?: string
  className?: string
}) {
  const texto = LEGALES.aviso(action)
  const enlace = 'underline underline-offset-2 hover:text-texto'

  return (
    <p className={cn('nota text-texto-suave', className)}>
      {texto.antes}
      <Link href="/terminos" className={enlace}>
        {LEGALES.terminos}
      </Link>
      {texto.medio}
      <Link href="/privacidad" className={enlace}>
        {LEGALES.privacidad}
      </Link>
      {texto.despues}
    </p>
  )
}

/** Los dos links legales sueltos, para el pie de las pantallas de entrada y de la app. */
export function EnlacesLegales({ className }: { className?: string }) {
  const enlace = 'inline-flex min-h-11 items-center hover:text-texto'
  return (
    <nav aria-label="Legales" className={cn('nota flex flex-wrap items-center gap-x-5 text-texto-suave', className)}>
      <Link href="/terminos" className={enlace}>
        {LEGALES.terminos}
      </Link>
      <Link href="/privacidad" className={enlace}>
        {LEGALES.privacidad}
      </Link>
    </nav>
  )
}
