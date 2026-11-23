'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Boton } from '@/components/sistema/boton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { pedirJson } from '@/lib/pedir-json'
import { AREAS_DE_EJEMPLO, type AreaDeEjemplo } from '@/lib/materias-de-ejemplo'
import { MATERIA_DE_EJEMPLO as T } from '@/lib/textos'

interface EstadoDelEjemplo {
  disponible: boolean
  ejemplos: { materiaId: number; materia: string; grupoId: number | null }[]
}

/** Avisa al resto del panel que el ejemplo cambió (para volver a leerlo). */
export const EVENTO_EJEMPLO = 'maestria:ejemplo'

/** V2 · Si la materia de ejemplo está disponible (la 045) y si el docente ya tiene una. */
export function useMateriaDeEjemplo() {
  const [estado, setEstado] = useState<EstadoDelEjemplo | null>(null)
  const leer = useCallback(async () => {
    const res = await pedirJson<EstadoDelEjemplo>('/api/teacher/ejemplo')
    setEstado('error' in res ? { disponible: false, ejemplos: [] } : res.data)
  }, [])
  useEffect(() => {
    void leer()
    window.addEventListener(EVENTO_EJEMPLO, leer)
    return () => window.removeEventListener(EVENTO_EJEMPLO, leer)
  }, [leer])
  return estado
}

/**
 * V2 · "Probar con una materia de ejemplo" y el diálogo con las seis áreas.
 * Al elegir, se arma el ejemplo y se abre el grupo.
 */
export function ProbarConEjemplo() {
  const estado = useMateriaDeEjemplo()
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState<AreaDeEjemplo | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!estado?.disponible || estado.ejemplos.length > 0) return null

  async function crear(area: AreaDeEjemplo) {
    setCreando(area)
    setError(null)
    const res = await pedirJson<{ materiaId: number; grupoId: number | null }>('/api/teacher/ejemplo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area }),
    })
    setCreando(null)
    if ('error' in res) {
      setError(T.noSePudo)
      return
    }
    setAbierto(false)
    window.dispatchEvent(new Event(EVENTO_EJEMPLO))
    router.push(res.data.grupoId ? `/teacher/grupos/${res.data.grupoId}` : '/teacher?seccion=materias')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="cuerpo-s inline-flex min-h-11 items-center rounded-sm font-semibold text-accion hover:text-accion-hover"
      >
        {T.probar}
      </button>
      <Dialog open={abierto} onOpenChange={(v) => !creando && setAbierto(v)}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle}</DialogDescription>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={T.titulo}>
            {AREAS_DE_EJEMPLO.map((area) => (
              <Boton key={area} variante="secundario" disabled={creando !== null} onClick={() => crear(area)}>
                {creando === area ? T.creando : T.areas[area]}
              </Boton>
            ))}
          </div>
          {error && (
            <p className="cuerpo-s text-flojo" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** V2 · Si el docente tiene un ejemplo: qué es, el link al grupo y "Borrar el ejemplo". */
export function AvisoDeEjemplo() {
  const estado = useMateriaDeEjemplo()
  const reducir = useReducedMotion()
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const ejemplo = estado?.ejemplos[0]

  async function borrar() {
    setBorrando(true)
    await pedirJson('/api/teacher/ejemplo', { method: 'DELETE' })
    setBorrando(false)
    setConfirmando(false)
    window.dispatchEvent(new Event(EVENTO_EJEMPLO))
  }

  return (
    <AnimatePresence initial={false}>
      {ejemplo && (
        <motion.section
          key="ejemplo"
          data-materia-de-ejemplo={ejemplo.materiaId}
          className="space-y-3 rounded-lg border border-borde bg-superficie-suave p-4"
          initial={reducir ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducir ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reducir ? 0 : 0.18 }}
        >
          <p className="cuerpo-s text-texto">{T.activo(ejemplo.materia)}</p>
          {confirmando ? (
            <div className="space-y-2">
              <p className="cuerpo-s text-texto">{T.confirmar}</p>
              <div className="flex flex-wrap gap-2">
                <Boton onClick={borrar} disabled={borrando}>
                  {borrando ? T.borrando : T.borrar}
                </Boton>
                <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={borrando}>
                  {T.cancelar}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ejemplo.grupoId && (
                <Boton asChild variante="secundario">
                  <Link href={`/teacher/grupos/${ejemplo.grupoId}`}>{T.verGrupo}</Link>
                </Boton>
              )}
              <Boton variante="secundario" onClick={() => setConfirmando(true)}>
                {T.borrar}
              </Boton>
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
