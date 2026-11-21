'use client'

import { EVENTO_TAREA_MANDADA } from '@/lib/eventos'
import { Cargando } from '@/components/sistema/cargando'


import { useEffect, useId, useMemo, useState } from 'react'
import { Check, Copy, Download, MessageCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { MisAlumnos } from '@/lib/alumnos-docente-server'
import { aQuienSaludar, armarMensaje, linkDeWhatsApp } from '@/lib/compartir-tarea'
import { COMPARTIR_TAREA as T } from '@/lib/textos'
import type { TeacherQuiz } from '@/lib/types'
import { tamanoDeTarea } from '@/lib/diagnostico'

interface Grupo {
  id: number
  name: string
  join_code: string
  status: 'open' | 'closed'
  teacher_program_id: number
  member_count: number
}

interface ShareQuizDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExportMoodle: () => void
  isExporting?: boolean
  /** La tarea que se manda. */
  quiz?: TeacherQuiz | null
  /** M3: desde la página de un grupo, ése es el grupo elegido (si es de la materia). */
  grupoInicial?: number | null
}

const CAMPO =
  'h-12 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70'
const ETIQUETA = 'nota mb-2 block font-semibold text-texto-suave'

/**
 * Un `datetime-local` no trae zona horaria: el navegador lo lee como hora
 * local, que es lo que quiso decir el docente al escribir "viernes 23:59".
 */
function aFecha(valor: string): Date | null {
  if (!valor) return null
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/**
 * Mandar una tarea y compartirla. Dos pasos en el mismo diálogo:
 *
 *  1. Mandar. Una sola decisión: el botón. El grupo de la materia aparece solo
 *     (se crea si todavía no existe: el docente no pasa por "crear aula"), y
 *     las fechas y el límite de intentos están plegados porque casi nunca
 *     hacen falta.
 *  2. Compartir. La pantalla que más rinde por línea escrita: el link del
 *     grupo, grande, con su botón de copiar; un mensaje ya escrito para
 *     WhatsApp; y el recordatorio de que el alumno entra sin cuenta.
 *
 * El mensaje se arma en lib/compartir-tarea.ts, que no inventa nada: no dice
 * para cuándo si no hay fecha, ni nombra a un alumno si la tarea va a varios.
 */
export function ShareQuizDialog({
  open,
  onOpenChange,
  onExportMoodle,
  isExporting = false,
  quiz = null,
  grupoInicial = null,
}: ShareQuizDialogProps) {
  const id = useId()
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [grupoId, setGrupoId] = useState<number | null>(null)
  const [alumnos, setAlumnos] = useState<{ nombre: string }[]>([])
  const [conOpciones, setConOpciones] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [intentos, setIntentos] = useState('')
  const [mandando, setMandando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mandada, setMandada] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState<'nada' | 'link' | 'mensaje' | 'fallo'>('nada')

  const materiaId = quiz?.teacherProgramId ?? null

  useEffect(() => {
    if (!open || !materiaId) return

    let vigente = true
    setGrupos(null)
    setGrupoId(null)
    setConOpciones(false)
    setDesde('')
    setHasta('')
    setIntentos('')
    setError(null)
    setMandada(false)
    setCopiado('nada')

    async function preparar() {
      // El grupo automático: si la materia todavía no tiene grupo, se crea acá.
      const asegurado = await fetch('/api/teacher/onboarding/grupo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherProgramId: materiaId }),
      })
      if (!asegurado.ok) throw new Error(`HTTP ${asegurado.status}`)

      const [resGrupos, resAlumnos] = await Promise.all([
        fetch('/api/teacher/classrooms'),
        fetch('/api/teacher/alumnos'),
      ])
      if (!resGrupos.ok) throw new Error(`HTTP ${resGrupos.status}`)
      const todos = ((await resGrupos.json()).classrooms ?? []) as Grupo[]
      const deLaMateria = todos.filter(
        (grupo) => Number(grupo.teacher_program_id) === Number(materiaId) && grupo.status === 'open',
      )

      // A quién saludar en el mensaje. Si falla, el mensaje sale sin nombre.
      const listado = resAlumnos.ok ? ((await resAlumnos.json()) as MisAlumnos) : null
      const deEstaMateria = (listado?.alumnos ?? []).filter((alumno) =>
        alumno.materias.some((materia) => materia.id === Number(materiaId)),
      )

      if (!vigente) return
      setGrupos(deLaMateria)
      const elegido = deLaMateria.find((g) => g.id === grupoInicial) ?? deLaMateria[0]
      setGrupoId(elegido?.id ?? null)
      setAlumnos(deEstaMateria.map((alumno) => ({ nombre: alumno.nombre })))
    }

    preparar().catch(() => {
      if (vigente) {
        setGrupos([])
        setError(T.mandar.fallo)
      }
    })

    return () => {
      vigente = false
    }
  }, [open, materiaId, grupoInicial])

  const grupo = useMemo(() => grupos?.find((g) => g.id === grupoId) ?? null, [grupos, grupoId])
  const link = grupo ? `${window.location.origin}/aula/${grupo.join_code}` : ''

  async function mandar() {
    if (!quiz || !grupo) return

    const maximo = intentos.trim() ? Number(intentos) : null
    if (maximo !== null && (!Number.isInteger(maximo) || maximo < 1)) {
      setError(T.mandar.intentosInvalidos)
      return
    }

    setMandando(true)
    setError(null)
    try {
      const res = await fetch(`/api/teacher/classrooms/${grupo.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherQuizId: quiz.id,
          opensAt: aFecha(desde)?.toISOString() ?? null,
          dueAt: aFecha(hasta)?.toISOString() ?? null,
          maxAttempts: maximo,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || T.mandar.fallo)

      setMensaje(
        armarMensaje({
          nombre: aQuienSaludar(alumnos),
          temas: quiz.selectedTopics.map((tema) => tema.name),
          materia: quiz.subjectName,
          link,
          hasta: aFecha(hasta),
        }),
      )
      setMandada(true)
      // K4: los primeros pasos del panel ("mandá tu primera tarea") se ponen al
      // día aunque el diálogo se haya abierto desde la materia, fuera del panel.
      window.dispatchEvent(new Event(EVENTO_TAREA_MANDADA))
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : T.mandar.fallo)
    } finally {
      setMandando(false)
    }
  }

  async function copiar(texto: string, que: 'link' | 'mensaje') {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(que)
    } catch {
      setCopiado('fallo')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-lg border-borde sm:max-w-[520px]">
        {mandada ? (
          <Aparecer key="compartir" className="flex flex-col gap-4">
            <div>
              <DialogTitle className="titulo-m text-texto">{T.lista.titulo}</DialogTitle>
              <DialogDescription className="cuerpo-s mt-1 text-texto-suave">{T.lista.detalle}</DialogDescription>
            </div>

            <div>
              <label htmlFor={`${id}-link`} className={ETIQUETA}>
                {T.lista.link}
              </label>
              <input
                id={`${id}-link`}
                readOnly
                value={link}
                onFocus={(evento) => evento.currentTarget.select()}
                className={`${CAMPO} h-14 bg-superficie-base text-[17px] font-semibold`}
              />
              <Boton ancho className="mt-2" onClick={() => copiar(link, 'link')}>
                {copiado === 'link' ? (
                  <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                ) : (
                  <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                )}
                <span aria-live="polite">{copiado === 'link' ? T.lista.linkCopiado : T.lista.copiarLink}</span>
              </Boton>
            </div>

            <div>
              <label htmlFor={`${id}-mensaje`} className={ETIQUETA}>
                {T.lista.mensaje}
              </label>
              <textarea
                id={`${id}-mensaje`}
                value={mensaje}
                onChange={(evento) => setMensaje(evento.target.value)}
                rows={5}
                aria-describedby={`${id}-mensaje-ayuda`}
                className="cuerpo-s w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta p-3 text-texto"
              />
              <p id={`${id}-mensaje-ayuda`} className="nota mt-1 text-texto-suave">
                {T.lista.mensajeAyuda}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={() => copiar(mensaje, 'mensaje')}>
                  {copiado === 'mensaje' ? (
                    <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  ) : (
                    <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  )}
                  <span aria-live="polite">
                    {copiado === 'mensaje' ? T.lista.mensajeCopiado : T.lista.copiarMensaje}
                  </span>
                </Boton>
                <Boton variante="secundario" asChild>
                  <a href={linkDeWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                    {T.lista.abrirWhatsApp}
                  </a>
                </Boton>
              </div>
            </div>

            {copiado === 'fallo' && (
              <p className="nota text-flojo" role="alert">
                {T.lista.noSeCopio}
              </p>
            )}

            <p className="cuerpo-s rounded-lg border border-accion-tenue-borde bg-accion-tenue p-3 text-texto">
              {T.lista.recordatorio}
            </p>

            <Boton variante="secundario" onClick={() => onOpenChange(false)}>
              {T.lista.cerrar}
            </Boton>
          </Aparecer>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <DialogTitle className="titulo-m text-texto">{T.mandar.titulo}</DialogTitle>
              <DialogDescription className="cuerpo-s mt-1 text-texto-suave">
                {T.mandar.detalle(quiz?.subjectName ?? '')}
              </DialogDescription>
              {/* L5: qué se manda y cuánto lleva, antes de mandarlo. */}
              {quiz && quiz.questionCount > 0 && (
                <p className="nota mt-2 text-texto-suave">
                  <span className="font-semibold text-texto">{quiz.title}</span> · {tamanoDeTarea(quiz.questionCount)}
                </p>
              )}
            </div>

            {grupos === null && (
              <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
                <Cargando />
                {T.mandar.preparando}
              </p>
            )}

            {/* Con un solo grupo no hay nada que elegir: no se pregunta. */}
            {grupos && grupos.length > 1 && (
              <fieldset>
                <legend className={ETIQUETA}>{T.mandar.grupo}</legend>
                <div className="flex flex-wrap gap-2">
                  {grupos.map((opcion) => (
                    <Boton
                      key={opcion.id}
                      variante="secundario"
                      aria-pressed={grupoId === opcion.id}
                      className="aria-pressed:border-texto"
                      onClick={() => setGrupoId(opcion.id)}
                    >
                      {opcion.name}
                      <span className="nota font-normal text-texto-suave">{T.mandar.alumnos(opcion.member_count)}</span>
                    </Boton>
                  ))}
                </div>
              </fieldset>
            )}

            {grupo && (
              <>
                <div>
                  <button
                    type="button"
                    aria-expanded={conOpciones}
                    onClick={() => setConOpciones((abierto) => !abierto)}
                    className="cuerpo-s inline-flex min-h-11 items-center rounded-sm font-semibold text-accion hover:text-accion-hover"
                  >
                    {conOpciones ? T.mandar.opciones.ocultar : T.mandar.opciones.mostrar}
                  </button>

                  {conOpciones && (
                    <Aparecer className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`${id}-desde`} className={ETIQUETA}>
                          {T.mandar.desde}
                        </label>
                        <input
                          id={`${id}-desde`}
                          type="datetime-local"
                          value={desde}
                          onChange={(evento) => setDesde(evento.target.value)}
                          className={CAMPO}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-hasta`} className={ETIQUETA}>
                          {T.mandar.hasta}
                        </label>
                        <input
                          id={`${id}-hasta`}
                          type="datetime-local"
                          value={hasta}
                          onChange={(evento) => setHasta(evento.target.value)}
                          className={CAMPO}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`${id}-intentos`} className={ETIQUETA}>
                          {T.mandar.intentos}
                        </label>
                        <input
                          id={`${id}-intentos`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={intentos}
                          onChange={(evento) => setIntentos(evento.target.value)}
                          aria-describedby={`${id}-intentos-ayuda`}
                          className={`${CAMPO} max-w-[10rem]`}
                        />
                        <p id={`${id}-intentos-ayuda`} className="nota mt-1 text-texto-suave">
                          {T.mandar.intentosAyuda}
                        </p>
                      </div>
                    </Aparecer>
                  )}
                </div>

                <Boton ancho onClick={mandar} disabled={mandando}>
                  {mandando && <Cargando />}
                  {mandando ? T.mandar.mandando : T.mandar.boton}
                </Boton>
              </>
            )}

            {error && (
              <p className="cuerpo-s text-flojo" role="alert">
                {error}
              </p>
            )}

            <div className="border-t border-borde pt-2">
              <button
                type="button"
                onClick={onExportMoodle}
                disabled={isExporting}
                className="cuerpo-s inline-flex min-h-11 items-center gap-2 rounded-sm text-texto-suave hover:text-texto disabled:opacity-60"
              >
                {isExporting ? <Cargando /> : <Download aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />}
                {isExporting ? T.mandar.exportando : T.mandar.moodle}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
