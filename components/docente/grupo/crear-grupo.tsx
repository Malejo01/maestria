'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { etiquetaDeMateria, materiaDePrograma } from '@/lib/etiqueta-materia'
import { pedirJson } from '@/lib/pedir-json'
import { CREAR_GRUPO as T, MODALIDAD } from '@/lib/textos'
import Link from 'next/link'
import { RUTA_COMO_DAS_CLASES } from '@/components/docente/como-das-clases'
import type { Modalidad } from '@/lib/modalidad'
import type { TeacherProgram } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A dónde va el docente después de crear un grupo: a su página, con el link listo. */
export const rutaDelGrupoNuevo = (id: number) => `/teacher/grupos/${id}?nuevo=1`

/**
 * M3: "+ Crear grupo", arriba de *Mis grupos*. Antes "Crear aula" estaba
 * escondido en *Seguimiento detallado y gestión → Ver* y el 21/11 Mauro no lo
 * encontró. El mismo formulario de siempre (materia + nombre); al crear, lleva
 * a la página del grupo nuevo.
 */
export function CrearGrupo({ materias, modalidad = null }: { materias: TeacherProgram[]; modalidad?: Modalidad | null }) {
  const router = useRouter()
  const idNombre = useId()
  const [abierto, setAbierto] = useState(false)
  const [materiaId, setMateriaId] = useState<number | null>(materias.length === 1 ? materias[0].id : null)
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const todas = materias.map(materiaDePrograma)

  async function crear() {
    if (!materiaId) return setError(T.faltaMateria)
    if (!nombre.trim()) return setError(T.faltaNombre)
    setCreando(true)
    setError(null)
    const respuesta = await pedirJson<{ classroom: { id: number } }>('/api/teacher/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherProgramId: materiaId, name: nombre.trim() }),
    })
    if ('error' in respuesta) {
      setCreando(false)
      setError(respuesta.error || T.fallo)
      return
    }
    router.push(rutaDelGrupoNuevo(Number(respuesta.data.classroom.id)))
  }

  // AC1: el docente particular no abre cursos. El botón se ve, deshabilitado, con la ayuda.
  if (modalidad === 'particular') {
    return (
      <div className="flex max-w-sm flex-col items-end gap-2" data-crear-grupo-deshabilitado>
        <Boton disabled aria-describedby={`${idNombre}-ayuda`}>
          <Plus aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {T.boton}
        </Boton>
        <p id={`${idNombre}-ayuda`} className="nota text-right text-texto-suave">
          {MODALIDAD.crearCursoDeshabilitado}{' '}
          <Link href={RUTA_COMO_DAS_CLASES} className="font-semibold text-accion underline-offset-4 hover:underline">
            {MODALIDAD.enlaceComoDasClases}
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <>
      <Boton
        onClick={() => {
          setError(null)
          setAbierto(true)
        }}
      >
        <Plus aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        {T.boton}
      </Boton>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[480px]">
          <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle}</DialogDescription>

          <fieldset className="flex flex-col gap-2">
            <legend className="nota mb-2 font-semibold text-texto-suave">{T.materia}</legend>
            {materias.length === 0 ? (
              <p className="cuerpo-s text-texto-suave">{T.sinMaterias}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {materias.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={materiaId === m.id}
                    onClick={() => setMateriaId(m.id)}
                    className={cn(
                      'cuerpo-s min-h-11 rounded-md border px-3 text-left',
                      materiaId === m.id
                        ? 'border-accion bg-accion text-texto-sobre-accion'
                        : 'border-borde-fuerte bg-superficie-tarjeta text-texto hover:border-accion',
                    )}
                  >
                    {etiquetaDeMateria(materiaDePrograma(m), todas)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor={idNombre} className="nota font-semibold text-texto-suave">
              {T.nombre}
            </label>
            <input
              id={idNombre}
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') void crear()
              }}
              placeholder={T.ejemplo}
              className="h-12 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70"
            />
          </div>

          {error && (
            <p className="nota text-flojo" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              {T.cancelar}
            </Boton>
            <Boton disabled={creando || materias.length === 0} onClick={() => void crear()}>
              {creando ? <Cargando /> : null}
              {T.crear}
            </Boton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
