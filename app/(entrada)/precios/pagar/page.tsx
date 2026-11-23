import { codigoSugerido } from '@/lib/referidos-server'
import Link from 'next/link'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import { ResumenDePago } from '@/components/pagos/resumen-de-pago'
import { getTeacherViewer, getViewer } from '@/lib/auth-session'
import { leerPedido } from '@/lib/pagos'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — /precios/pagar?plan=…&forma=…&cantidad=…: el resumen antes de
 * pagar, con "¿Tenés un código?". Hace falta la cuenta de docente (el plan se
 * acredita a esa cuenta).
 */
export default async function PagarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pedido = leerPedido(params)
  // E2: el pase de alumno lo paga el alumno con cuenta (no invitado); el resto, el docente.
  const esPase = pedido?.plan === 'pase_alumno'
  const viewer = esPase ? await getViewer() : null
  const docente = esPase ? (viewer && !viewer.isGuest ? viewer : null) : await getTeacherViewer()
  const volver = `/precios/pagar?${new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string')).toString()}`

  return (
    <div className="w-full max-w-md space-y-6">
      <header className="space-y-3 text-center">
        <Logo className="mx-auto" />
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
      </header>
      {!pedido ? (
        <p className="cuerpo-s text-flojo">{T.pedidoInvalido}</p>
      ) : !docente ? (
        <div className="space-y-3 text-center">
          <p className="cuerpo text-texto">{T.entrar}</p>
          <Boton asChild>
            <Link href={`/sign-in?${esPase ? '' : 'rol=docente&'}callbackUrl=${encodeURIComponent(volver)}`}>{T.entrar}</Link>
          </Boton>
        </div>
      ) : (
        <ResumenDePago
          pedido={pedido}
          codigoInicial={typeof params.codigo === 'string' ? params.codigo : esPase ? '' : ((await codigoSugerido(docente.id)) ?? '')}
        />
      )}
    </div>
  )
}
