'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { FichaPedagogica } from '@/components/docente/ficha-pedagogica'
import { SeccionDiagnostico } from '@/components/docente/seccion-diagnostico'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { FichaLeida } from '@/lib/fichas-server'
import { pedirJson } from '@/lib/pedir-json'
import { FICHA_ALUMNO, FICHA_PEDAGOGICA as T } from '@/lib/textos'

/**
 * J2: la ficha de alguien que todavía no entró. Así el docente arma la ficha
 * (y en J4, el diagnóstico) antes de mandarle el link. Cuando el alumno entra
 * con ese link y con el mismo nombre, la ficha pasa a ser suya.
 */
export function FichaInvitacion({ invitacionId }: { invitacionId: number }) {
  const [datos, setDatos] = useState<FichaLeida | null>(null)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  // J6: marcar los temas que falló cambia la ficha; se relee y se vuelve a montar.
  const [version, setVersion] = useState(0)
  const url = `/api/teacher/fichas?invitacion=${invitacionId}`

  const leer = useCallback(async () => {
    const res = await pedirJson<FichaLeida>(url)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setError(null)
    setDatos(res.data)
    setNombre(res.data.nombre)
  }, [url])

  useEffect(() => {
    void leer()
  }, [leer])

  const volver = (
    <Link
      href="/teacher"
      className="cuerpo-s inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-semibold text-texto-suave hover:text-texto"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
      {FICHA_ALUMNO.volver}
    </Link>
  )

  if (error && !datos) {
    return (
      <div className="flex flex-col gap-3">
        {volver}
        <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
      </div>
    )
  }
  if (!datos) return null

  return (
    <div className="flex flex-col gap-3">
      {volver}
      <header className="flex flex-col gap-4 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:flex-row sm:items-start sm:p-6">
        <span
          aria-hidden="true"
          className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-superficie-suave font-titulo text-[17px] font-extrabold text-accion"
        >
          {(nombre.trim()[0] ?? '?').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="titulo-l text-texto">{nombre}</h1>
          <p className="nota mt-1 text-texto-suave">
            {T.todaviaNoEntro} · {T.pasaleElLink}
          </p>
        </div>
        {datos.grupo && (
          <Boton variante="secundario" className="shrink-0" asChild>
            <a href={`/aula/${datos.grupo.codigo}`} target="_blank" rel="noopener noreferrer">
              {T.verLink}
            </a>
          </Boton>
        )}
      </header>

      <SeccionDiagnostico
        destino={{ invitacion: invitacionId }}
        nombre={nombre || null}
        alMarcarTemas={() => {
          setVersion((v) => v + 1)
          void leer()
        }}
      />

      {datos.disponible && (
        <FichaPedagogica
          key={`${version}-${datos.ficha.temasDificiles.join(',')}`}
          url={url}
          nombreInicial={datos.nombre}
          inicial={datos.ficha}
          materias={datos.materias}
          alGuardar={setNombre}
        />
      )}
    </div>
  )
}
