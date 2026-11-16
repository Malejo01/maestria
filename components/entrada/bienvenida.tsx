'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Cargando } from '@/components/sistema/cargando'
import { CargaFallida } from '@/components/carga-fallida'
import { ElegirRol } from '@/components/entrada/elegir-rol'
import {
  BajadaEntrada,
  CLASE_ENLACE_SUAVE,
  TarjetaEntrada,
  TituloEntrada,
} from '@/components/entrada/tarjeta-entrada'
import { Aparecer } from '@/components/sistema/aparecer'
import { NIVEL_OPTIONS, type Nivel } from '@/lib/nivel-options'
import { pedirJson } from '@/lib/pedir-json'
import { aUserRole, leerRolElegido, olvidarRolElegido, type RolElegido } from '@/lib/rol-elegido'
import { BIENVENIDA, ENTRADA } from '@/lib/textos'

type Paso = 'leyendo' | 'rol' | 'nivel' | 'grado' | 'guardando'

const OPCION =
  'block w-full rounded-lg border border-borde-fuerte bg-superficie-tarjeta p-4 text-left transition-colors hover:border-texto disabled:opacity-60'

/**
 * Lo que falta preguntarle a una cuenta recién creada antes de dejarla entrar.
 *
 * Si la persona ya eligió su rol en la entrada (lib/rol-elegido.ts), acá NO se
 * le vuelve a preguntar: el docente pasa de largo y el alumno va directo a
 * elegir qué cursa. La pregunta de rol aparece sólo para quien llegó a tener
 * sesión sin pasar por la entrada.
 *
 * Los pasos de nivel y año del alumno se conservan tal cual funcionaban; el
 * bloque 7 del rediseño rehace el onboarding del alumno completo.
 */
export function Bienvenida({ onComplete }: { onComplete?: () => void }) {
  const { update: actualizarSesion } = useSession()
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('leyendo')
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [grados, setGrados] = useState<string[]>([])
  const [cargandoGrados, setCargandoGrados] = useState(false)
  const [errorGrados, setErrorGrados] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const arranco = useRef(false)

  const guardar = useCallback(
    async (datos: { role: 'ALUMNO' | 'DOCENTE'; nivel?: string; grado?: string }) => {
      setPaso('guardando')
      setError(null)
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        olvidarRolElegido()
        // Refresca el JWT: rol, nivel, año e isOnboarded viajan cacheados ahí.
        await actualizarSesion()
        router.refresh()
        onComplete?.()
      } catch {
        setError(BIENVENIDA.noSeGuardo)
        setPaso('rol')
      }
    },
    [actualizarSesion, onComplete, router],
  )

  const elegirRol = useCallback(
    (rol: RolElegido) => {
      if (rol === 'docente') void guardar({ role: aUserRole(rol) })
      else setPaso('nivel')
    },
    [guardar],
  )

  // El rol elegido en la entrada vive en localStorage, que el servidor no ve:
  // se lee al montar, una sola vez.
  useEffect(() => {
    if (arranco.current) return
    arranco.current = true
    const elegido = leerRolElegido()
    if (elegido) elegirRol(elegido)
    else setPaso('rol')
  }, [elegirRol])

  const elegirNivel = async (n: Nivel) => {
    setNivel(n)
    setCargandoGrados(true)
    setErrorGrados(null)
    setPaso('grado')
    // Es lo primero que ve un alumno nuevo: un 500 acá no puede pintarse como
    // "no hay años para tu nivel" — ver docs/deuda-tecnica.md §6a.
    const res = await pedirJson<{ grades?: string[] }>(`/api/curriculum/grades?nivel=${encodeURIComponent(n)}`)
    if ('error' in res) {
      setGrados([])
      setErrorGrados(res.error)
    } else {
      setGrados(res.data.grades ?? [])
    }
    setCargandoGrados(false)
  }

  const saltar = (
    <button type="button" className={CLASE_ENLACE_SUAVE} onClick={() => guardar({ role: 'ALUMNO' })}>
      {BIENVENIDA.saltar}
    </button>
  )

  return (
    <TarjetaEntrada>
      {(paso === 'leyendo' || paso === 'guardando') && (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando />
          {BIENVENIDA.guardando}
        </p>
      )}

      {paso === 'rol' && (
        <Aparecer key="rol">
          <TituloEntrada>{ENTRADA.titulo}</TituloEntrada>
          <BajadaEntrada>{ENTRADA.bajada}</BajadaEntrada>
          <ElegirRol onElegir={elegirRol} />
          {error && (
            <p className="nota mt-3 text-flojo" role="alert">
              {error}
            </p>
          )}
        </Aparecer>
      )}

      {paso === 'nivel' && (
        <Aparecer key="nivel">
          <TituloEntrada>{BIENVENIDA.nivel.titulo}</TituloEntrada>
          <BajadaEntrada>{BIENVENIDA.nivel.bajada}</BajadaEntrada>
          <div className="flex flex-col gap-3">
            {NIVEL_OPTIONS.map(({ value, label, sub }) => (
              <button key={value} type="button" className={OPCION} onClick={() => elegirNivel(value)}>
                <span className="cuerpo-l block text-texto">{label}</span>
                <span className="nota mt-0.5 block text-texto-suave">{sub}</span>
              </button>
            ))}
          </div>
          <div className="mt-2">{saltar}</div>
        </Aparecer>
      )}

      {paso === 'grado' && (
        <Aparecer key="grado">
          <TituloEntrada>
            {nivel === 'Primario' ? BIENVENIDA.grado.tituloPrimario : BIENVENIDA.grado.titulo}
          </TituloEntrada>
          <BajadaEntrada>{nivel}</BajadaEntrada>

          {cargandoGrados ? (
            <p className="flex justify-center py-8" role="status">
              <Cargando className="size-5 text-accion" />
              <span className="sr-only">{BIENVENIDA.guardando}</span>
            </p>
          ) : errorGrados ? (
            <CargaFallida
              que={BIENVENIDA.grado.queCargamos}
              detalle={errorGrados}
              onReintentar={() => nivel && elegirNivel(nivel)}
            />
          ) : grados.length === 0 ? (
            <p className="cuerpo-s py-4 text-texto-suave">{BIENVENIDA.grado.sinContenido}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {grados.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`${OPCION} cuerpo-s min-h-11 p-3 text-center font-semibold`}
                  onClick={() => nivel && guardar({ role: 'ALUMNO', nivel, grado: g })}
                >
                  {nivel === 'Primario' ? g.replace(/Año/gi, 'Grado') : g}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-4">
            <button type="button" className={CLASE_ENLACE_SUAVE} onClick={() => setPaso('nivel')}>
              {BIENVENIDA.volver}
            </button>
            {saltar}
          </div>
        </Aparecer>
      )}
    </TarjetaEntrada>
  )
}
