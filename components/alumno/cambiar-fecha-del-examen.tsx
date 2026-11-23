'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Boton } from '@/components/sistema/boton'
import { pedirJson } from '@/lib/pedir-json'
import type { CorrimientoDelPase } from '@/lib/autodidacta'
import { AUTODIDACTA as T } from '@/lib/textos'

const CAMPO = 'h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s text-texto'

const enTexto = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR')

/** La frase de lo que pasó con el pase (o sólo con la fecha). */
export function fraseDelCambio(resultado: CorrimientoDelPase, pase: string | null): string {
  if (!pase) return T.fechaCambiada
  if (resultado === 'corrido') return T.paseCorrido(enTexto(pase))
  if (resultado === 'ya-corrido') return T.paseYaCorrido(enTexto(pase))
  if (resultado === 'no-acorta') return T.paseNoAcorta(enTexto(pase))
  return T.fechaCambiada
}

/**
 * Ronda U · U2 — Cambiar la fecha del examen de la materia personal. Si el
 * alumno tiene el pase, se corre con la fecha nueva una sola vez y nunca se
 * acorta (lo decide el servidor; acá sólo se cuenta qué pasó).
 */
export function CambiarFechaDelExamen({
  materiaId,
  fechaExamen,
  onCambio,
}: {
  materiaId: number
  fechaExamen: string | null
  onCambio: (fechaExamen: string, pase: string | null) => void
}) {
  const reducir = useReducedMotion()
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(fechaExamen ?? '')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const res = await pedirJson<{ fechaExamen: string; pase: string | null; resultado: CorrimientoDelPase }>(`/api/autodidacta/${materiaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fechaExamen: fecha }),
    })
    setGuardando(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setMensaje(fraseDelCambio(res.data.resultado, res.data.pase))
    setAbierto(false)
    onCambio(res.data.fechaExamen, res.data.pase)
  }

  return (
    <div className="space-y-2">
      {!abierto && (
        <button
          type="button"
          className="nota min-h-11 text-accion underline underline-offset-2 hover:text-accion-hover"
          onClick={() => {
            setAbierto(true)
            setMensaje(null)
          }}
        >
          {T.cambiarFecha}
        </button>
      )}
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.form
            key="form"
            onSubmit={guardar}
            className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4"
            initial={reducir ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reducir ? 0 : 0.18 }}
          >
            <label className="block space-y-1">
              <span className="cuerpo-s font-semibold text-texto">{T.fechaNueva}</span>
              <input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <p className="nota text-texto-suave">{T.avisoDelPase}</p>
            <div className="flex flex-wrap gap-2">
              <Boton type="submit" disabled={!fecha || guardando}>
                {guardando ? T.guardandoFecha : T.guardarFecha}
              </Boton>
              <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>
                {T.cancelar}
              </Boton>
            </div>
            {error && (
              <p role="alert" className="cuerpo-s text-flojo">
                {error}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
      {mensaje && (
        <p role="status" className="cuerpo-s text-texto">
          {mensaje}
        </p>
      )}
    </div>
  )
}
