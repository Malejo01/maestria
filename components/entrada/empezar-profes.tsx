'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Boton } from '@/components/sistema/boton'
import { linkParaEmpezar } from '@/lib/profes'

/**
 * AA3 · El botón de /profes. La página es estática (rápida en el celular que
 * llega del anuncio); el `origen` y el `ref` de la URL se suman acá, en el
 * navegador. Mientras tanto —y sin JavaScript— el link va igual al ingreso
 * del docente, y la cookie del middleware ya guardó de dónde vino.
 */
export function EmpezarProfes({ texto }: { texto: string }) {
  return (
    <Suspense fallback={<BotonEmpezar texto={texto} href={linkParaEmpezar(null)} />}>
      <ConLaUrl texto={texto} />
    </Suspense>
  )
}

function ConLaUrl({ texto }: { texto: string }) {
  const params = useSearchParams()
  return <BotonEmpezar texto={texto} href={linkParaEmpezar(params ? new URLSearchParams(params.toString()) : null)} />
}

function BotonEmpezar({ texto, href }: { texto: string; href: string }) {
  return (
    <Boton asChild ancho>
      <Link href={href} data-empezar-profes>
        {texto}
      </Link>
    </Boton>
  )
}
