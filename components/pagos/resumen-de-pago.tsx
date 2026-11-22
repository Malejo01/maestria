'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { formatearPesos } from '@/lib/planes'
import type { PedidoDePago } from '@/lib/pagos'
import type { ResumenDelPago } from '@/lib/pagos-server'
import { PAGAR as T } from '@/lib/textos'

const CAMPO = 'h-11 flex-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s uppercase text-texto'

/**
 * Ronda T · C2 — El resumen antes de pagar: el plan, "¿Tenés un código?" y el
 * total que calculó el servidor. Con Checkout Pro, "Pagar con Mercado Pago"
 * crea la preferencia y redirige. Sin él (la válvula), el link fijo y, con
 * código, WhatsApp a Mauro.
 */
export function ResumenDePago({ pedido, codigoInicial = '' }: { pedido: PedidoDePago; codigoInicial?: string }) {
  const [codigo, setCodigo] = useState(codigoInicial)
  const [aplicado, setAplicado] = useState(codigoInicial)
  const [resumen, setResumen] = useState<ResumenDelPago | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pagando, setPagando] = useState(false)

  // El pedido es un objeto nuevo en cada render del padre: la clave lo fija.
  const clave = `${pedido.plan}|${pedido.forma}|${pedido.cantidad}`
  useEffect(() => {
    let vigente = true
    void pedirJson<ResumenDelPago>('/api/pagos/resumen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pedido, codigo: aplicado }),
    }).then((res) => {
      if (!vigente) return
      if ('error' in res) {
        setError(res.error)
      } else {
        setError(null)
        setResumen(res.data)
      }
    })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, aplicado])

  function aplicar(evento: FormEvent) {
    evento.preventDefault()
    setAplicado(codigo.trim())
  }

  async function pagar() {
    setPagando(true)
    setError(null)
    const res = await pedirJson<{ url: string }>('/api/pagos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pedido, codigo: resumen?.codigo?.ok ? aplicado : '' }),
    })
    if ('error' in res) {
      setError(res.error)
      setPagando(false)
      return
    }
    window.location.assign(res.data.url)
  }

  const cobro = resumen?.cobro
  const descuento = resumen?.codigo?.ok ? resumen.codigo.porcentaje : null

  return (
    <div className="space-y-4" data-resumen-de-pago="">
      {!resumen && !error && <Cargando />}

      {cobro && (
        <dl className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <div className="flex justify-between gap-3">
            <dt className="cuerpo-s text-texto-suave">{T.plan}</dt>
            <dd className="cuerpo-s text-right font-semibold text-texto">{cobro.descripcion}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="cuerpo-s text-texto-suave">{T.precioDeLista}</dt>
            <dd className="cuerpo-s text-texto">{formatearPesos(cobro.montoLista)}</dd>
          </div>
          {descuento !== null && (
            <div className="flex justify-between gap-3">
              <dt className="cuerpo-s text-logrado">{T.descuento(descuento)}</dt>
              <dd className="cuerpo-s text-logrado">−{formatearPesos(cobro.montoLista - cobro.monto)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-borde pt-2">
            <dt className="cuerpo font-bold text-texto">{T.total}</dt>
            <dd className="titulo-m text-texto" data-total={cobro.monto}>
              {formatearPesos(cobro.monto)}
            </dd>
          </div>
        </dl>
      )}
      {resumen && !cobro && <p className="cuerpo-s text-flojo">{T.sinPrecio}</p>}

      <form onSubmit={aplicar} className="space-y-1">
        <label htmlFor="codigo" className="cuerpo-s font-semibold text-texto">
          {T.tenesUnCodigo}
        </label>
        <div className="flex gap-2">
          <input id="codigo" className={CAMPO} value={codigo} maxLength={40} onChange={(e) => setCodigo(e.target.value)} placeholder="FUNDADORA-…" />
          <Boton type="submit" variante="secundario">
            {T.aplicar}
          </Boton>
        </div>
        {resumen?.codigo && (
          <p role="status" className={`nota ${resumen.codigo.ok ? 'text-logrado' : 'text-flojo'}`}>
            {resumen.codigo.ok ? T.codigoAplicado(resumen.codigo.texto, resumen.codigo.porcentaje) : resumen.codigo.motivo}
          </p>
        )}
      </form>

      {resumen?.conCheckout && cobro && (
        <div className="space-y-2">
          <Boton className="w-full" disabled={pagando || cobro.monto <= 0} onClick={pagar}>
            {pagando && <Cargando />}
            {pagando ? T.yendo : T.pagarConMercadoPago}
          </Boton>
          <p className="nota text-texto-suave">{T.seguro}</p>
        </div>
      )}

      {resumen?.manual && (
        <div className="space-y-2 rounded-lg border border-borde bg-superficie-suave p-4" data-pago-manual="">
          <p className="cuerpo-s text-texto">{T.sinCheckout}</p>
          {resumen.codigo?.ok && resumen.manual.whatsapp ? (
            <Boton asChild className="w-full gap-1.5">
              <a href={resumen.manual.whatsapp} target="_blank" rel="noopener noreferrer">
                {T.escribileAMauro}
                <ExternalLink className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              </a>
            </Boton>
          ) : resumen.manual.link ? (
            <>
              <Boton asChild className="w-full gap-1.5">
                <a href={resumen.manual.link} target="_blank" rel="noopener noreferrer">
                  {T.linkFijo}
                  <ExternalLink className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                </a>
              </Boton>
              <p className="nota text-texto-suave">{T.linkFijoDetalle}</p>
            </>
          ) : resumen.manual.whatsapp ? (
            <Boton asChild variante="secundario" className="w-full gap-1.5">
              <a href={resumen.manual.whatsapp} target="_blank" rel="noopener noreferrer">
                {T.escribile}
                <ExternalLink className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              </a>
            </Boton>
          ) : null}
        </div>
      )}

      {error && (
        <p role="alert" className="cuerpo-s text-flojo">
          {error}
        </p>
      )}
    </div>
  )
}
