'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { LinkDelGrupo } from '@/components/docente/link-del-grupo'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { HITOS, type Hito } from '@/lib/onboarding-docente'
import type { OnboardingDocente } from '@/lib/onboarding-docente-server'
import { pedirJson } from '@/lib/pedir-json'
import { ONBOARDING_DOCENTE as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

const CLAVE_CERRADO = 'maestria-onboarding-docente-cerrado'

interface Props {
  /** Abre los caminos para crear la materia (y con ella, el temario). */
  onCrearMateria: () => void
  /** Lleva a Mis materias, a editar el temario de la que ya existe. */
  onCargarTemario: () => void
  /** Lleva a armar una tarea nueva. */
  onArmarTarea: () => void
  /** Lleva a las tareas guardadas, donde se mandan al grupo. */
  onMandarTarea: () => void
  /** Cambia cuando el docente creó o borró algo: dispara una relectura. */
  refrescarCon: unknown
}

/**
 * El onboarding del docente: cuatro hitos con el paso siguiente a la vista.
 *
 * No es un tour que se cierra. Se queda arriba del panel hasta que hay un
 * alumno con una tarea mandada, y cada vez dice una sola cosa: qué hacer
 * ahora, con un solo botón. El progreso se deduce de los datos del docente
 * (lib/onboarding-docente.ts), así que si abandona y vuelve mañana, o entra
 * desde otro dispositivo, retoma donde estaba.
 */
export function HitosOnboarding({ onCrearMateria, onCargarTemario, onArmarTarea, onMandarTarea, refrescarCon }: Props) {
  const [estado, setEstado] = useState<OnboardingDocente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkAbierto, setLinkAbierto] = useState(false)
  // Lectura perezosa y no un efecto: este componente no dibuja nada hasta que
  // llega su fetch, así que el servidor y la hidratación nunca ven este valor.
  const [festejoCerrado, setFestejoCerrado] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(CLAVE_CERRADO) === '1'
    } catch {
      // Sin almacenamiento, el aviso se muestra mientras dure.
      return false
    }
  })

  const leer = useCallback(async () => {
    const res = await pedirJson<{ onboarding: OnboardingDocente }>('/api/teacher/onboarding')
    if ('error' in res) {
      setError(res.error)
      return
    }
    setError(null)
    setEstado(res.data.onboarding)
  }, [])

  useEffect(() => {
    void leer()
  }, [leer, refrescarCon])

  // El hito del alumno se completa en OTRO dispositivo (el del alumno): al
  // volver a esta pestaña se relee, sin que el docente tenga que recargar.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [leer])

  if (error && !estado) {
    return <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
  }
  if (!estado) return null

  if (estado.completo) {
    if (!estado.recienTerminado || festejoCerrado) return null

    return (
      <Aparecer>
        <section
          aria-label={T.etiqueta}
          className="flex flex-col gap-3 rounded-lg border border-accion-tenue-borde bg-accion-tenue p-4 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <h2 className="cuerpo text-texto">{T.listo.titulo}</h2>
            <p className="cuerpo-s text-texto-suave">{T.listo.detalle}</p>
          </div>
          <Boton
            variante="secundario"
            className="shrink-0"
            onClick={() => {
              setFestejoCerrado(true)
              try {
                localStorage.setItem(CLAVE_CERRADO, '1')
              } catch {
                // Se cierra igual por esta carga.
              }
            }}
          >
            {T.listo.boton}
          </Boton>
        </section>
      </Aparecer>
    )
  }

  const paso = pasoSiguiente(estado, {
    onCrearMateria,
    onCargarTemario,
    onArmarTarea,
    onMandarTarea,
    onVerLink: () => setLinkAbierto(true),
  })

  return (
    <section aria-label={T.etiqueta} className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="etiqueta uppercase text-texto-suave">{T.etiqueta}</p>
        <p className="nota text-texto-suave">{T.progreso(estado.cantidadHechos, HITOS.length)}</p>
      </div>

      <BarraDeProgreso hechos={estado.cantidadHechos} total={HITOS.length} />

      <ol className="mb-6 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {HITOS.map((hito) => (
          <ItemHito key={hito} hito={hito} hecho={estado.hechos[hito]} actual={hito === estado.siguiente} />
        ))}
      </ol>

      {/* `key`: al cambiar de paso, el texto nuevo entra animado. */}
      <Aparecer key={paso.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="titulo-m text-texto">{paso.titulo}</h2>
          <p className="cuerpo-s mt-1 text-texto-suave">{paso.detalle}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Boton onClick={paso.accion}>{paso.boton}</Boton>
          {estado.puedeAdelantarLaTarea && (
            <button
              type="button"
              onClick={onArmarTarea}
              className="cuerpo-s inline-flex min-h-11 items-center rounded-sm font-semibold text-accion hover:text-accion-hover"
            >
              {T.alumno.mientrasTanto}
            </button>
          )}
        </div>
      </Aparecer>

      {estado.materia && (
        <LinkDelGrupo
          abierto={linkAbierto}
          onCambiar={setLinkAbierto}
          materia={estado.materia}
          alPrepararlo={leer}
        />
      )}
    </section>
  )
}

interface Paso {
  id: string
  titulo: string
  detalle: string
  boton: string
  accion: () => void
}

/** El único paso que la tarjeta propone ahora. Un solo botón: una decisión por pantalla. */
function pasoSiguiente(
  estado: OnboardingDocente,
  ir: {
    onCrearMateria: () => void
    onCargarTemario: () => void
    onArmarTarea: () => void
    onMandarTarea: () => void
    onVerLink: () => void
  },
): Paso {
  switch (estado.siguiente) {
    case 'materia':
      return { id: 'materia', ...T.materia, accion: ir.onCrearMateria }
    case 'temario':
      return {
        id: 'temario',
        titulo: T.temario.titulo(estado.materia?.nombre ?? ''),
        detalle: T.temario.detalle,
        boton: T.temario.boton,
        accion: ir.onCargarTemario,
      }
    case 'alumno':
      // Si el grupo ya existe, el link ya se generó alguna vez: lo que falta
      // es que el alumno entre, no que el docente haga algo nuevo.
      return estado.grupo
        ? { id: 'esperando', ...T.alumno.esperando, accion: ir.onVerLink }
        : { id: 'alumno', titulo: T.alumno.titulo, detalle: T.alumno.detalle, boton: T.alumno.boton, accion: ir.onVerLink }
    default:
      return estado.faltaSoloMandar
        ? { id: 'mandar', ...T.tarea.mandar, accion: ir.onMandarTarea }
        : { id: 'tarea', titulo: T.tarea.titulo, detalle: T.tarea.detalle, boton: T.tarea.boton, accion: ir.onArmarTarea }
  }
}

function BarraDeProgreso({ hechos, total }: { hechos: number; total: number }) {
  const sinMovimiento = useReducedMotion()
  return (
    <div
      role="progressbar"
      aria-label={T.etiqueta}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={hechos}
      aria-valuetext={T.progreso(hechos, total)}
      className="h-1.5 overflow-hidden rounded-full bg-borde"
    >
      <motion.div
        className="h-full rounded-full bg-accion"
        initial={false}
        animate={{ width: `${(hechos / total) * 100}%` }}
        transition={sinMovimiento ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  )
}

function ItemHito({ hito, hecho, actual }: { hito: Hito; hecho: boolean; actual: boolean }) {
  return (
    <li
      aria-current={actual ? 'step' : undefined}
      className={cn(
        'cuerpo-s flex items-center gap-2',
        hecho ? 'text-texto' : actual ? 'font-semibold text-texto' : 'text-texto-suave',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          hecho
            ? 'border-logrado bg-logrado-fondo text-logrado'
            : actual
              ? 'border-accion'
              : 'border-borde-fuerte',
        )}
      >
        {hecho && <Check className="size-3" strokeWidth={3} />}
      </span>
      {T.hitos[hito]}
      {/* El estado no puede depender sólo del color ni del ícono. */}
      <span className="sr-only">: {hecho ? T.hecho : T.pendiente}</span>
    </li>
  )
}
