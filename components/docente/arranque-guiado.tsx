'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { EVENTO_TAREA_MANDADA } from '@/lib/eventos'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { aQuienSaludar, armarMensaje, linkDeWhatsApp } from '@/lib/compartir-tarea'
import { pasoActual } from '@/lib/arranque-docente'
import type { ArranqueDelDocente } from '@/lib/arranque-docente-server'
import { pedirJson } from '@/lib/pedir-json'
import { ARRANQUE as T } from '@/lib/textos'
import type { TeacherQuiz } from '@/lib/types'
import { cn } from '@/lib/utils'

const CLAVE_LISTO_CERRADO = 'maestria-arranque-listo-cerrado'

interface Respuesta {
  arranque: ArranqueDelDocente
  /** El WhatsApp de Mauro para «Pedime que te lo cargue», o null sin el número. */
  cargamelo: string | null
}

interface Props {
  /** Las tareas guardadas del panel: la más nueva es la que se manda en el paso 3. */
  tareas: TeacherQuiz[]
  onSubirPrograma: () => void
  onArmar: () => void
  /** Cambia cuando el docente creó o borró algo: se relee. */
  refrescarCon: unknown
  /** Lo que se dibuja cuando el arranque no corresponde (el onboarding de siempre). */
  children?: ReactNode
}

/**
 * AB4 · El arranque guiado del docente nuevo: tres pasos que se tildan solos
 * (lib/arranque-docente.ts) hasta que 2 alumnos practican. Mientras se ve,
 * reemplaza a los primeros pasos de siempre; cuando no corresponde, dibuja
 * `children` (los primeros pasos), así un docente que ya arrancó no pierde nada.
 */
export function ArranqueGuiado({ tareas, onSubirPrograma, onArmar, refrescarCon, children }: Props) {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [fallo, setFallo] = useState(false)
  const [mandando, setMandando] = useState<TeacherQuiz | null>(null)
  const [listoCerrado, setListoCerrado] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(CLAVE_LISTO_CERRADO) === '1'
    } catch {
      return false
    }
  })

  const leer = useCallback(async () => {
    const res = await pedirJson<Respuesta>('/api/teacher/arranque')
    if ('error' in res) {
      setFallo(true)
      return
    }
    setFallo(false)
    setDatos(res.data)
  }, [])

  useEffect(() => {
    void leer()
  }, [leer, refrescarCon])

  // Los alumnos practican en otro dispositivo: al volver a la pestaña se relee.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer()
    }
    const alMandar = () => void leer()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener(EVENTO_TAREA_MANDADA, alMandar)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener(EVENTO_TAREA_MANDADA, alMandar)
    }
  }, [leer])

  // Si falla la lectura, los primeros pasos de siempre: el panel no se queda sin guía.
  if (fallo && !datos) return <>{children}</>
  if (!datos) return null
  const { arranque, cargamelo } = datos

  if (arranque.mostrar === null) return <>{children}</>

  if (arranque.mostrar === 'listo') {
    if (listoCerrado) return null
    return (
      <Aparecer>
        <section
          aria-label={T.etiqueta}
          className="flex flex-col gap-3 rounded-lg border border-accion-tenue-borde bg-accion-tenue p-4 sm:flex-row sm:items-center"
          data-arranque="listo"
        >
          <p className="cuerpo flex-1 text-texto">{T.listo}</p>
          <Boton
            variante="secundario"
            className="shrink-0"
            onClick={() => {
              setListoCerrado(true)
              try {
                localStorage.setItem(CLAVE_LISTO_CERRADO, '1')
              } catch {
                // Se cierra igual por esta carga.
              }
            }}
          >
            {T.cerrar}
          </Boton>
        </section>
      </Aparecer>
    )
  }

  const actual = pasoActual(arranque)
  const hechos = [arranque.hechos.programa, arranque.hechos.aprobado, arranque.hechos.mandado].filter(Boolean).length
  const tareaMasNueva = [...tareas].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null

  return (
    <section aria-labelledby="arranque-titulo" className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6" data-arranque="lista">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="etiqueta uppercase text-texto-suave">{T.etiqueta}</p>
        <p className="nota text-texto-suave">{T.progreso(hechos)}</p>
      </div>
      <h2 id="arranque-titulo" className="titulo-m mb-4 text-texto">
        {T.titulo}
      </h2>

      <ol className="space-y-3">
        <Paso numero={1} hecho={arranque.hechos.programa} actual={actual === 1} titulo={T.pasos.programa.titulo} detalle={T.pasos.programa.detalle}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton onClick={onSubirPrograma}>{T.pasos.programa.boton}</Boton>
            {cargamelo && (
              <Boton asChild variante="secundario" className="gap-1.5">
                <a href={cargamelo} target="_blank" rel="noopener noreferrer">
                  {T.pasos.programa.cargamelo}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                </a>
              </Boton>
            )}
          </div>
        </Paso>
        <Paso numero={2} hecho={arranque.hechos.aprobado} actual={actual === 2} titulo={T.pasos.aprobado.titulo} detalle={T.pasos.aprobado.detalle}>
          <Boton onClick={onArmar}>{T.pasos.aprobado.boton}</Boton>
        </Paso>
        <Paso
          numero={3}
          hecho={arranque.hechos.mandado}
          actual={actual === 3 || arranque.paso === 3}
          titulo={T.pasos.mandado.titulo}
          detalle={T.pasos.mandado.detalle}
        >
          {arranque.paso === 3 && arranque.ultimaTarea ? (
            <Reenviar arranque={arranque} />
          ) : (
            <Boton onClick={() => (tareaMasNueva ? setMandando(tareaMasNueva) : onArmar())}>{T.pasos.mandado.boton}</Boton>
          )}
        </Paso>
      </ol>

      <ShareQuizDialog
        open={Boolean(mandando)}
        onOpenChange={(abierto) => {
          if (abierto) return
          setMandando(null)
          void leer()
        }}
        quiz={mandando}
        // Exportar a Moodle no es parte del arranque: se hace desde Mis tareas.
        onExportMoodle={() => undefined}
      />
    </section>
  )
}

function Paso({
  numero,
  hecho,
  actual,
  titulo,
  detalle,
  children,
}: {
  numero: number
  hecho: boolean
  actual: boolean
  titulo: string
  detalle: string
  children: ReactNode
}) {
  return (
    <li
      className={cn('rounded-lg border p-3', actual ? 'border-accion bg-superficie-base' : 'border-borde')}
      aria-current={actual ? 'step' : undefined}
      data-paso={numero}
      data-hecho={hecho ? 'si' : 'no'}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'etiqueta flex size-7 shrink-0 items-center justify-center rounded-full',
            hecho ? 'bg-logrado text-texto-sobre-accion' : actual ? 'bg-accion text-texto-sobre-accion' : 'bg-superficie-suave text-texto-suave',
          )}
        >
          {hecho ? <Check className="h-4 w-4" aria-label={T.hecho} strokeWidth={TRAZO_ICONO} /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('cuerpo font-semibold', hecho && !actual ? 'text-texto-suave' : 'text-texto')}>{titulo}</p>
          {actual && (
            <Aparecer className="mt-1 space-y-3">
              <p className="cuerpo-s text-texto-suave">{detalle}</p>
              {children}
            </Aparecer>
          )}
        </div>
      </div>
    </li>
  )
}

/** Paso 3 ya hecho, esperando que practiquen 2: el mismo mensaje de siempre, para reenviarlo. */
function Reenviar({ arranque }: { arranque: ArranqueDelDocente }) {
  const [copiado, setCopiado] = useState<'nada' | 'si' | 'fallo'>('nada')
  const tarea = arranque.ultimaTarea
  const mensaje = useMemo(() => {
    if (!tarea) return ''
    const origen = typeof window !== 'undefined' ? window.location.origin : ''
    return armarMensaje({
      nombre: aQuienSaludar(tarea.alumnos),
      temas: tarea.temas,
      materia: tarea.materia,
      link: `${origen}/aula/${tarea.codigo}`,
      hasta: tarea.hasta ? new Date(tarea.hasta) : null,
    })
  }, [tarea])
  if (!tarea) return null

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje)
      setCopiado('si')
    } catch {
      setCopiado('fallo')
    }
  }

  return (
    <div className="space-y-2" data-reenviar>
      <p className="cuerpo-s font-semibold text-texto">{T.pasos.mandado.esperando(arranque.practicaron)}</p>
      <textarea
        readOnly
        value={mensaje}
        rows={4}
        aria-label={T.copiar}
        className="cuerpo-s w-full resize-none rounded-md border border-borde bg-superficie-tarjeta p-2 text-texto"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton onClick={() => void copiar()}>
          <span aria-live="polite">{copiado === 'si' ? T.copiado : T.copiar}</span>
        </Boton>
        <Boton asChild variante="secundario" className="gap-1.5">
          <a href={linkDeWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
            {T.abrirWhatsApp}
            <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          </a>
        </Boton>
      </div>
      {copiado === 'fallo' && <p className="nota text-flojo">{T.noSeCopio}</p>}
    </div>
  )
}
