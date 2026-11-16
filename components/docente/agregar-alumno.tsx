'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useId, useState, type FormEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { AGREGAR_ALUMNO as T, ONBOARDING_DOCENTE } from '@/lib/textos'
import { PantallaDeLimite } from '@/components/docente/pantalla-de-limite'
import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'

const L = ONBOARDING_DOCENTE.link
const CAMPO =
  'h-12 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70'
const ETIQUETA = 'nota mb-2 block font-semibold text-texto-suave'

/**
 * Agregar a un alumno: su nombre, qué prepara y de qué materia.
 *
 * El docente NO crea un grupo. Elige la materia y el grupo aparece detrás
 * (POST /api/teacher/alumnos lo crea si hace falta). Al terminar ve el link
 * para pasarle; el alumno queda en el listado como "Todavía no entró" hasta
 * que lo usa.
 */
export function AgregarAlumno({
  abierto,
  onCambiar,
  materias,
  alAgregar,
}: {
  abierto: boolean
  onCambiar: (abierto: boolean) => void
  materias: { id: number; nombre: string }[]
  /** Se llama cuando el alumno quedó agregado, para releer el listado. */
  alAgregar: () => void
}) {
  const id = useId()
  const [nombre, setNombre] = useState('')
  const [contexto, setContexto] = useState('')
  const [materiaId, setMateriaId] = useState<number | null>(materias[0]?.id ?? null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ nombre: string; codigo: string } | null>(null)
  const [copiado, setCopiado] = useState<'no' | 'si' | 'fallo'>('no')
  // G3: el alta se frenó por el plan (402). Se muestra la pantalla de límite.
  const [bloqueo, setBloqueo] = useState<CuerpoDeBloqueo | null>(null)

  const materiaElegida = materiaId ?? materias[0]?.id ?? null

  function cerrar(siguiente: boolean) {
    onCambiar(siguiente)
    if (!siguiente) {
      setNombre('')
      setContexto('')
      setError(null)
      setListo(null)
      setCopiado('no')
      setBloqueo(null)
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!nombre.trim() || !materiaElegida) return

    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contexto, teacherProgramId: materiaElegida }),
      })
      const data = await res.json().catch(() => null)
      const frenado = res.status === 402 ? leerBloqueo(data) : null
      if (frenado) {
        setBloqueo(frenado)
        return
      }
      if (!res.ok) throw new Error(data?.error || T.fallo)

      setListo({ nombre: nombre.trim(), codigo: data.grupo.codigo })
      alAgregar()
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : T.fallo)
    } finally {
      setEnviando(false)
    }
  }

  const link = listo ? `${window.location.origin}/aula/${listo.codigo}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado('si')
    } catch {
      setCopiado('fallo')
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogContent className={`rounded-lg border-borde ${bloqueo ? 'sm:max-w-[560px]' : 'sm:max-w-[480px]'}`}>
        {bloqueo ? (
          <PantallaDeLimite bloqueo={bloqueo} onVolver={() => setBloqueo(null)} />
        ) : listo ? (
          <>
            <DialogTitle className="titulo-m text-texto">{T.listo.titulo(listo.nombre.split(' ')[0])}</DialogTitle>
            <DialogDescription className="cuerpo-s text-texto-suave">{T.listo.detalle}</DialogDescription>

            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor={`${id}-link`} className={ETIQUETA}>
                  {L.etiquetaLink}
                </label>
                <input
                  id={`${id}-link`}
                  readOnly
                  value={link}
                  onFocus={(evento) => evento.currentTarget.select()}
                  className={`${CAMPO} bg-superficie-base`}
                />
              </div>
              <Boton ancho onClick={copiar}>
                {copiado === 'si' ? (
                  <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                ) : (
                  <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                )}
                <span aria-live="polite">{copiado === 'si' ? L.copiado : L.copiar}</span>
              </Boton>
              {copiado === 'fallo' && (
                <p className="nota text-flojo" role="alert">
                  {L.noSeCopio}
                </p>
              )}
              <p className="nota text-texto-suave">
                {L.recordatorio} {L.codigo(listo.codigo)}
              </p>
              <Boton variante="secundario" onClick={() => cerrar(false)}>
                {T.listo.cerrar}
              </Boton>
            </div>
          </>
        ) : (
          <>
            <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
            <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle}</DialogDescription>

            <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor={`${id}-nombre`} className={ETIQUETA}>
                  {T.nombre.etiqueta}
                </label>
                <input
                  id={`${id}-nombre`}
                  value={nombre}
                  onChange={(evento) => setNombre(evento.target.value)}
                  placeholder={T.nombre.ejemplo}
                  autoComplete="off"
                  maxLength={80}
                  required
                  className={CAMPO}
                />
              </div>

              <div>
                <label htmlFor={`${id}-contexto`} className={ETIQUETA}>
                  {T.contexto.etiqueta}
                </label>
                <input
                  id={`${id}-contexto`}
                  value={contexto}
                  onChange={(evento) => setContexto(evento.target.value)}
                  placeholder={T.contexto.ejemplo}
                  autoComplete="off"
                  maxLength={120}
                  aria-describedby={`${id}-contexto-ayuda`}
                  className={CAMPO}
                />
                <p id={`${id}-contexto-ayuda`} className="nota mt-2 text-texto-suave">
                  {T.contexto.ayuda}
                </p>
              </div>

              {/* Con una sola materia no hay nada que elegir: no se pregunta. */}
              {materias.length > 1 && (
                <div>
                  <label htmlFor={`${id}-materia`} className={ETIQUETA}>
                    {T.materia.etiqueta}
                  </label>
                  <select
                    id={`${id}-materia`}
                    value={materiaElegida ?? ''}
                    onChange={(evento) => setMateriaId(Number(evento.target.value))}
                    className={CAMPO}
                  >
                    {materias.map((materia) => (
                      <option key={materia.id} value={materia.id}>
                        {materia.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="nota text-flojo" role="alert">
                  {error}
                </p>
              )}

              <Boton type="submit" ancho disabled={enviando || !nombre.trim() || !materiaElegida}>
                {enviando && <Cargando />}
                {enviando ? T.agregando : T.boton}
              </Boton>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
