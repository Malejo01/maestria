'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Boton } from '@/components/sistema/boton'
import { Aviso } from '@/components/sistema/aviso'
import { armarAviso, type AvisoPendiente } from '@/lib/avisos-de-reporte'
import { pedirJson } from '@/lib/pedir-json'
import { useAppStore } from '@/lib/store'
import { AVISO_DE_REPORTE as T } from '@/lib/textos'

/**
 * N1: "Gracias por avisarnos… ya está corregido." Arriba del contenido de
 * cualquier pantalla de la app, para quien reportó algo que el admin marcó
 * como resuelto (con cuenta o como invitado).
 *
 * P3: se muestra sólo la PRIMERA vez. Apenas se ve, se guarda como visto; en
 * esta pestaña sigue arriba hasta "Entendido", pero no vuelve en la próxima
 * visita: desde ahí vive en la campanita ("Tu reporte se resolvió").
 *
 * Se pide UNA vez por pestaña: el resultado queda en memoria (y en
 * sessionStorage, por si la pestaña recarga), así navegar no le pega a la base.
 * Nunca en medio de un cuestionario: mientras el motor está en 'loading' o
 * 'quiz' no se muestra; aparece al terminarlo o en la próxima pantalla.
 */

const CLAVE = 'maestria:avisos-de-reporte:'
let enMemoria: { clave: string; avisos: AvisoPendiente[] } | null = null

function leerGuardado(clave: string): AvisoPendiente[] | null {
  if (enMemoria?.clave === clave) return enMemoria.avisos
  try {
    const crudo = window.sessionStorage.getItem(CLAVE + clave)
    if (!crudo) return null
    const avisos = JSON.parse(crudo)
    return Array.isArray(avisos) ? (avisos as AvisoPendiente[]) : null
  } catch {
    return null
  }
}

function guardar(clave: string, avisos: AvisoPendiente[]) {
  enMemoria = { clave, avisos }
  try {
    window.sessionStorage.setItem(CLAVE + clave, JSON.stringify(avisos))
  } catch {
    // Sin sessionStorage (modo privado): queda en memoria, que alcanza.
  }
}

/**
 * Lo guardado en esta pestaña o, la primera vez, lo que diga el servidor. Un
 * error devuelve `null` y no se guarda: el aviso es un agradecimiento, no algo
 * que la persona tenga que resolver, así que no se muestra nada.
 */
async function avisosDe(quien: string): Promise<AvisoPendiente[] | null> {
  const guardado = leerGuardado(quien)
  if (guardado) return guardado
  const respuesta = await pedirJson<{ avisos: AvisoPendiente[] }>('/api/feedback/avisos')
  if ('error' in respuesta) return null
  const lista = Array.isArray(respuesta.data.avisos) ? respuesta.data.avisos : []
  guardar(quien, lista)
  return lista
}

/** Sólo para los tests: olvidar lo pedido. */
export function olvidarAvisosDeReporte() {
  enMemoria = null
}

export function AvisoDeReporte({ quien }: { quien: string }) {
  const [avisos, setAvisos] = useState<AvisoPendiente[] | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const activeView = useAppStore((s) => s.activeView)

  useEffect(() => {
    let vigente = true
    void avisosDe(quien).then((lista) => {
      if (vigente && lista) setAvisos(lista)
    })
    return () => {
      vigente = false
    }
  }, [quien])

  const aviso = useMemo(() => armarAviso(avisos ?? []), [avisos])
  const enCuestionario = activeView === 'quiz' || activeView === 'loading'
  const visible = Boolean(aviso) && !enCuestionario

  // P3: visto en cuanto se muestra (una sola vez por reporte).
  const marcados = useRef(new Set<number>())
  useEffect(() => {
    if (!visible || !aviso) return
    const ids = aviso.ids.filter((id) => !marcados.current.has(id))
    if (ids.length === 0) return
    ids.forEach((id) => marcados.current.add(id))
    void pedirJson('/api/feedback/avisos/visto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }, [visible, aviso])

  async function entendido() {
    if (!aviso) return
    setCerrando(true)
    const respuesta = await pedirJson('/api/feedback/avisos/visto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: aviso.ids }),
    })
    setCerrando(false)
    // Si no se pudo guardar, se cierra igual en esta pestaña: vuelve a salir
    // la próxima vez, que es mejor que dejar un botón que no responde.
    if ('error' in respuesta) console.warn('[aviso de reporte] no se guardó el visto:', respuesta.error)
    guardar(quien, [])
    setAvisos([])
  }

  return (
    <Aviso
      visible={visible}
      etiqueta={T.etiqueta}
      accion={
        <Boton variante="secundario" disabled={cerrando} onClick={() => void entendido()}>
          {T.entendido}
        </Boton>
      }
    >
      {aviso && (
        <div className="flex flex-col gap-2">
          <p className="cuerpo-s text-texto">{aviso.titulo}</p>
          {aviso.renglones.length === 1 ? (
            aviso.renglones[0].mensaje && <p className="cuerpo-s whitespace-pre-wrap break-words text-texto-suave">{aviso.renglones[0].mensaje}</p>
          ) : (
            <ul className="cuerpo-s flex list-disc flex-col gap-1 pl-5 text-texto">
              {aviso.renglones.map((r) => (
                <li key={r.id}>
                  {r.texto}
                  {r.mensaje && <span className="block whitespace-pre-wrap break-words text-texto-suave">{r.mensaje}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Aviso>
  )
}
