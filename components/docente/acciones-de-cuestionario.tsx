'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, ListChecks, MoreHorizontal, Pencil, Play, Printer } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { pedirJson } from '@/lib/pedir-json'
import { useAppStore } from '@/lib/store'
import { configDeTarea, rutaDeRevision, tareaDesdeFila } from '@/lib/tarea-docente'
import { ACCIONES_DE_CUESTIONARIO as T } from '@/lib/textos'

export type AccionDeCuestionario = 'revisar' | 'verComoAlumno' | 'hacerlo' | 'imprimir' | 'cargar'

const ICONO = { revisar: Pencil, verComoAlumno: Eye, hacerlo: Play, imprimir: Printer, cargar: ListChecks } as const

const ITEM = 'min-h-11 cursor-pointer gap-3 rounded-sm px-3 cuerpo-s text-texto focus:bg-superficie-suave focus:text-texto'

/**
 * L1: lo que se puede hacer con un cuestionario del diagnóstico, en su renglón
 * (la ficha y el final de "Armar diagnóstico"). Los mismos caminos que *Mis
 * tareas*: revisar y editar es `TeacherQuizReview` (en su propia ruta, que
 * vuelve a donde se estaba), ver como alumno es la vista previa y hacerlo es
 * "Probarla yo". Ninguna cuenta como intento del alumno.
 *
 * En escritorio son íconos con nombre; a 390 px, un menú "…".
 */
export function AccionesDeCuestionario({
  quizId,
  titulo,
  consulta,
  acciones,
  antesDeAbrir,
}: {
  quizId: number
  titulo: string
  /** `alumno=…` o `invitacion=…`, para la hoja impresa y la carga a mano. */
  consulta: string
  acciones: AccionDeCuestionario[]
  /** Antes de abrir el cuestionario encima (un diálogo abierto lo taparía). */
  antesDeAbrir?: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { startQuiz, startQuizPreview } = useAppStore()
  const [abriendo, setAbriendo] = useState<AccionDeCuestionario | null>(null)

  const href: Partial<Record<AccionDeCuestionario, string>> = {
    imprimir: `/teacher/diagnosticos/imprimir/${quizId}?${consulta}`,
    cargar: `/teacher/diagnosticos/cargar/${quizId}?${consulta}`,
  }

  async function correr(accion: 'verComoAlumno' | 'hacerlo') {
    setAbriendo(accion)
    const respuesta = await pedirJson<{ quiz: Record<string, unknown> }>(`/api/teacher/quizzes/${quizId}`)
    setAbriendo(null)
    if ('error' in respuesta) {
      toast({ title: T.noSeAbrio, description: respuesta.error })
      return
    }
    const tarea = tareaDesdeFila(respuesta.data.quiz)
    antesDeAbrir?.()
    if (accion === 'hacerlo') startQuiz(configDeTarea(tarea), tarea.questions)
    else startQuizPreview(configDeTarea(tarea), tarea.questions)
  }

  function hacer(accion: AccionDeCuestionario) {
    if (accion === 'revisar') {
      router.push(rutaDeRevision(quizId, `${window.location.pathname}${window.location.search}`))
    } else if (accion === 'verComoAlumno' || accion === 'hacerlo') {
      void correr(accion)
    }
  }

  return (
    <>
      <span className="hidden gap-2 sm:flex">
        {acciones.map((accion) => {
          const Icono = ICONO[accion]
          const contenido = abriendo === accion ? <Cargando /> : <Icono aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          const destino = href[accion]
          return destino ? (
            <Boton key={accion} variante="icono" asChild>
              <Link href={destino} aria-label={T.aria[accion](titulo)} title={T.nombre[accion]}>
                {contenido}
              </Link>
            </Boton>
          ) : (
            <Boton
              key={accion}
              variante="icono"
              aria-label={T.aria[accion](titulo)}
              title={T.nombre[accion]}
              disabled={abriendo !== null}
              onClick={() => hacer(accion)}
            >
              {contenido}
            </Boton>
          )
        })}
      </span>

      <span className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Boton variante="icono" aria-label={T.menu(titulo)} disabled={abriendo !== null}>
              {abriendo ? <Cargando /> : <MoreHorizontal aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
            </Boton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-lg border-borde-fuerte p-2">
            {acciones.map((accion) => {
              const Icono = ICONO[accion]
              const destino = href[accion]
              return destino ? (
                <DropdownMenuItem key={accion} asChild className={ITEM}>
                  <Link href={destino}>
                    <Icono aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                    {T.nombre[accion]}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={accion} className={ITEM} onSelect={() => hacer(accion)}>
                  <Icono aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                  {T.nombre[accion]}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </>
  )
}
