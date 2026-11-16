'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useRefrescarSesion } from '@/hooks/use-refrescar-sesion'
import { ElegirRol } from '@/components/entrada/elegir-rol'
import {
  BajadaEntrada,
  CLASE_ENLACE_SUAVE,
  TarjetaEntrada,
  TituloEntrada,
} from '@/components/entrada/tarjeta-entrada'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { aUserRole, leerRolElegido, olvidarRolElegido, type RolElegido } from '@/lib/rol-elegido'
import { BIENVENIDA, ENTRADA, ONBOARDING_ALUMNO as A } from '@/lib/textos'

/** `rol`: falta elegirlo. `alumno-N`: las tres pantallas del alumno. */
type Paso = 'leyendo' | 'rol' | 'alumno-1' | 'alumno-2' | 'alumno-3' | 'guardando'

const PASOS_ALUMNO = 3

/**
 * Lo que falta antes de dejar entrar a una cuenta recién creada.
 *
 * Si la persona ya eligió su rol en la entrada (lib/rol-elegido.ts), acá NO se
 * le vuelve a preguntar. El docente pasa de largo: su onboarding son los
 * cuatro hitos del panel. El alumno ve tres pantallas y nada más:
 *
 *   1. qué es esto,
 *   2. cómo se entra a un grupo (y puede entrar ahí mismo),
 *   3. dónde ve lo que le mandaron.
 *
 * Antes este lugar le preguntaba al alumno el nivel y el año. Salieron: eran
 * dos pantallas de formulario antes de ver nada, tenían un "saltar por ahora",
 * y Practicar ya los pregunta cuando hacen falta.
 *
 * El rol se guarda recién al terminar la tercera pantalla. Quien cierra a
 * mitad de camino las vuelve a ver la próxima vez: no hay un "ya lo vio" que
 * pueda quedar marcado sin que lo haya visto.
 */
export function Bienvenida({ onComplete }: { onComplete?: () => void }) {
  const actualizarSesion = useRefrescarSesion()
  const router = useRouter()
  const idCodigo = useId()
  const [paso, setPaso] = useState<Paso>('leyendo')
  const [error, setError] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [codigoIncompleto, setCodigoIncompleto] = useState(false)
  /** null: todavía no se sabe. Se pregunta al llegar a la segunda pantalla. */
  const [yaEstaEnUnGrupo, setYaEstaEnUnGrupo] = useState<boolean | null>(null)
  const arranco = useRef(false)

  const guardar = useCallback(
    async (rol: RolElegido, despues?: string) => {
      setPaso('guardando')
      setError(null)
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: aUserRole(rol) }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        olvidarRolElegido()
        // Refresca el JWT: rol e isOnboarded viajan cacheados ahí.
        await actualizarSesion()
        if (despues) {
          router.push(despues)
          return
        }
        router.refresh()
        onComplete?.()
      } catch {
        setError(BIENVENIDA.noSeGuardo)
        setPaso(rol === 'alumno' ? 'alumno-3' : 'rol')
      }
    },
    [actualizarSesion, onComplete, router],
  )

  const elegirRol = useCallback(
    (rol: RolElegido) => {
      if (rol === 'docente') void guardar(rol)
      else setPaso('alumno-1')
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

  // Quien llegó por el link de su profe ya está adentro de un grupo: la
  // segunda pantalla no le pide un código que no necesita.
  useEffect(() => {
    if (paso !== 'alumno-2' || yaEstaEnUnGrupo !== null) return
    let vigente = true
    fetch('/api/student/classrooms')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (vigente) setYaEstaEnUnGrupo(Array.isArray(data?.classrooms) && data.classrooms.length > 0)
      })
      .catch(() => {
        if (vigente) setYaEstaEnUnGrupo(false)
      })
    return () => {
      vigente = false
    }
  }, [paso, yaEstaEnUnGrupo])

  function entrarConCodigo(evento: FormEvent) {
    evento.preventDefault()
    if (!isValidJoinCode(codigo)) {
      setCodigoIncompleto(true)
      return
    }
    // Guarda el rol y sigue en la pantalla del grupo, que es la que sabe sumarlo.
    void guardar('alumno', `/aula/${normalizeJoinCode(codigo)}`)
  }

  const numero = paso === 'alumno-1' ? 1 : paso === 'alumno-2' ? 2 : 3
  const contador = (
    <p className="etiqueta mb-3 uppercase text-texto-suave" aria-live="polite">
      {A.paso(numero, PASOS_ALUMNO)}
    </p>
  )
  const volver = (a: Paso) => (
    <button type="button" className={CLASE_ENLACE_SUAVE} onClick={() => setPaso(a)}>
      {A.volver}
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

      {paso === 'alumno-1' && (
        <Aparecer key="alumno-1">
          {contador}
          <TituloEntrada>{A.queEs.titulo}</TituloEntrada>
          <BajadaEntrada className="cuerpo-s">{A.queEs.detalle}</BajadaEntrada>
          <Boton ancho onClick={() => setPaso('alumno-2')}>
            {A.seguir}
          </Boton>
        </Aparecer>
      )}

      {paso === 'alumno-2' && (
        <Aparecer key="alumno-2">
          {contador}
          {yaEstaEnUnGrupo === null ? (
            <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
              <Cargando />
              <span className="sr-only">{BIENVENIDA.guardando}</span>
            </p>
          ) : yaEstaEnUnGrupo ? (
            <>
              <TituloEntrada>{A.grupo.yaEstas.titulo}</TituloEntrada>
              <BajadaEntrada className="cuerpo-s">{A.grupo.yaEstas.detalle}</BajadaEntrada>
              <Boton ancho onClick={() => setPaso('alumno-3')}>
                {A.seguir}
              </Boton>
            </>
          ) : (
            <>
              <TituloEntrada>{A.grupo.titulo}</TituloEntrada>
              <BajadaEntrada className="cuerpo-s">{A.grupo.detalle}</BajadaEntrada>
              <form onSubmit={entrarConCodigo} noValidate>
                <label htmlFor={idCodigo} className="nota mb-2 block font-semibold text-texto-suave">
                  {A.grupo.etiqueta}
                </label>
                <input
                  id={idCodigo}
                  type="text"
                  value={codigo}
                  onChange={(evento) => {
                    setCodigo(normalizeJoinCode(evento.target.value).slice(0, JOIN_CODE_LENGTH))
                    setCodigoIncompleto(false)
                  }}
                  placeholder={A.grupo.ejemplo}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={codigoIncompleto}
                  aria-describedby={codigoIncompleto ? `${idCodigo}-error` : undefined}
                  className="mb-3 h-12 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] uppercase tracking-[0.14em] text-texto placeholder:text-texto-suave placeholder:opacity-70"
                />
                <p id={`${idCodigo}-error`} role="status" className="nota -mt-1 mb-3 text-flojo empty:hidden">
                  {codigoIncompleto ? A.grupo.incompleto(JOIN_CODE_LENGTH) : ''}
                </p>
                {/* Con un código escrito, entrar es lo principal; sin código, seguir. */}
                <Boton type="submit" ancho variante={codigo ? 'principal' : 'secundario'}>
                  {A.grupo.entrar}
                </Boton>
              </form>
              <Boton
                ancho
                className="mt-2"
                variante={codigo ? 'secundario' : 'principal'}
                onClick={() => setPaso('alumno-3')}
              >
                {A.grupo.sinCodigo}
              </Boton>
            </>
          )}
          <div className="mt-1">{volver('alumno-1')}</div>
        </Aparecer>
      )}

      {paso === 'alumno-3' && (
        <Aparecer key="alumno-3">
          {contador}
          <TituloEntrada>{A.tareas.titulo}</TituloEntrada>
          <BajadaEntrada className="cuerpo-s">{A.tareas.detalle}</BajadaEntrada>
          <Boton ancho onClick={() => guardar('alumno')}>
            {A.tareas.boton}
          </Boton>
          {error && (
            <p className="nota mt-3 text-flojo" role="alert">
              {error}
            </p>
          )}
          <div className="mt-1">{volver('alumno-2')}</div>
        </Aparecer>
      )}
    </TarjetaEntrada>
  )
}
