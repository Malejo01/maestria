'use client'

import { useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { aplicables, aplicarPropuestas, type PropuestaDeCorreccion } from '@/lib/corregir-tipos'
import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'
import { CORREGIR_TIPOS as T, TIPO_INCOHERENTE } from '@/lib/textos'
import type { Question } from '@/lib/types'

/**
 * N2: el diálogo de antes → después. Pide las propuestas al servidor (que NO
 * guarda), muestra cada pregunta marcada con su corrección y una casilla
 * (todas tildadas), y recién con Aplicar le pasa las preguntas nuevas a
 * `alAplicar`, que decide cómo se guardan (Mis tareas: el PATCH con copia si
 * hay intentos; Revisar y editar: a la pantalla, sin guardar).
 */
export function CorregirTiposDialog({
  quizId,
  preguntas,
  abierto,
  onOpenChange,
  alAplicar,
  alBloquear,
}: {
  quizId: number
  /** Las preguntas como están (en Revisar y editar, con lo no guardado). */
  preguntas: Question[]
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  /** Devuelve un error para mostrar, o nada si salió bien (y el diálogo se cierra). */
  alAplicar: (nuevas: Question[], cambios: number) => Promise<string | void> | string | void
  /** Un 402 del plan: lo muestra quien abrió el diálogo. */
  alBloquear?: (bloqueo: CuerpoDeBloqueo) => void
}) {
  const [propuestas, setPropuestas] = useState<PropuestaDeCorreccion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [aplicando, setAplicando] = useState(false)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    void (async () => {
      try {
        const res = await fetch(`/api/teacher/quizzes/${quizId}/corregir-tipos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: preguntas }),
        })
        const data = await res.json().catch(() => ({}))
        if (!vigente) return
        const bloqueo = res.status === 402 ? leerBloqueo(data) : null
        if (bloqueo) {
          onOpenChange(false)
          alBloquear?.(bloqueo)
          return
        }
        if (!res.ok || !Array.isArray(data?.propuestas)) {
          setError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`)
          return
        }
        const lista = data.propuestas as PropuestaDeCorreccion[]
        setError(null)
        setPropuestas(lista)
        setElegidas(new Set(aplicables(lista).map((p) => p.indice)))
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'Error de red')
      }
    })()
    return () => {
      vigente = false
    }
    // Las preguntas se leen al abrir: si cambian con el diálogo abierto, no se vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, quizId, vuelta])

  function cerrar(abrir: boolean) {
    if (aplicando) return
    if (!abrir) {
      setPropuestas(null)
      setError(null)
    }
    onOpenChange(abrir)
  }

  async function aplicar() {
    if (!propuestas) return
    setAplicando(true)
    const fallo = await alAplicar(aplicarPropuestas(preguntas, propuestas, elegidas), elegidas.size)
    setAplicando(false)
    if (fallo) {
      setError(fallo)
      return
    }
    setPropuestas(null)
    onOpenChange(false)
  }

  const cuantas = elegidas.size

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{T.titulo}</DialogTitle>
          <DialogDescription>{T.detalle}</DialogDescription>
        </DialogHeader>

        {error && !propuestas ? (
          <CargaFallida que={T.queCargamos} detalle={error} onReintentar={() => setVuelta((n) => n + 1)} />
        ) : !propuestas ? (
          <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
            <Cargando /> {T.buscando}
          </p>
        ) : propuestas.length === 0 ? (
          <p className="cuerpo-s text-texto-suave">{T.sinCambios}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {propuestas.map((p) => (
              <li key={p.indice} className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie-tarjeta p-3">
                <div className="flex items-start gap-3">
                  {p.despues ? (
                    <Checkbox
                      id={`corregir-${p.indice}`}
                      className="mt-1"
                      checked={elegidas.has(p.indice)}
                      onCheckedChange={(v) =>
                        setElegidas((prev) => {
                          const sig = new Set(prev)
                          if (v === true) sig.add(p.indice)
                          else sig.delete(p.indice)
                          return sig
                        })
                      }
                    />
                  ) : null}
                  <label htmlFor={`corregir-${p.indice}`} className="flex-1">
                    <span className="cuerpo-s font-semibold text-texto">{T.pregunta(p.indice + 1)}</span>
                    <span className="nota block text-texto-suave">
                      {TIPO_INCOHERENTE.detalle[p.problema]}
                      {p.despues ? ` · ${p.via === 'regla' ? T.porRegla : T.porIa}` : ''}
                    </span>
                  </label>
                </div>
                <Version etiqueta={T.antes} pregunta={p.antes} />
                {p.despues ? (
                  <>
                    <ArrowDown aria-hidden="true" className="mx-auto size-4 text-texto-suave" strokeWidth={TRAZO_ICONO} />
                    <Version etiqueta={T.despues} pregunta={p.despues} />
                  </>
                ) : (
                  <p className="nota text-texto-suave">
                    {T.noSePudo}: {p.motivo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && propuestas && (
          <p className="cuerpo-s text-flojo" role="alert">
            {T.noSeGuardo}: {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Boton variante="secundario" disabled={aplicando} onClick={() => cerrar(false)}>
            {T.cancelar}
          </Boton>
          {propuestas && aplicables(propuestas).length > 0 && (
            <Boton disabled={aplicando || cuantas === 0} onClick={() => void aplicar()}>
              {aplicando ? T.aplicando : T.aplicar(cuantas)}
            </Boton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Una versión de la pregunta: consigna, opciones y la respuesta correcta. */
function Version({ etiqueta, pregunta }: { etiqueta: string; pregunta: Question }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-borde bg-superficie-base p-2">
      <p className="etiqueta text-texto-suave">{etiqueta}</p>
      <LaTeXRenderer content={pregunta.question} className="cuerpo-s text-texto" />
      {pregunta.type === 'multiple_choice' && (
        <ol className="cuerpo-s list-[upper-alpha] pl-6 text-texto">
          {pregunta.options.map((o, i) => (
            <li key={i} className={i === pregunta.correctAnswer ? 'font-semibold' : undefined}>
              <LaTeXRenderer content={o} />
              {i === pregunta.correctAnswer && <span className="nota text-logrado"> · {T.correcta}</span>}
            </li>
          ))}
        </ol>
      )}
      {pregunta.type === 'true_false' && (
        <p className="nota text-texto-suave">
          {T.correcta}: {pregunta.correctAnswer ? T.verdadero : T.falso}
        </p>
      )}
      {pregunta.type === 'short_answer' && (
        <p className="nota text-texto-suave">
          {T.correcta}: {pregunta.acceptedAnswers.join(' · ')}
        </p>
      )}
    </div>
  )
}
