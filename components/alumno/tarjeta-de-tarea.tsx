'use client'

import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { ASSIGNMENT_STATE_LABEL } from '@/lib/classrooms'
import { tamanoDeTarea } from '@/lib/diagnostico'
import { formatearNumero } from '@/lib/numeros'
import { MIS_TAREAS_ALUMNO as T } from '@/lib/textos'
import type { StudentAssignment } from '@/lib/types'

function formatDate(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Una tarea en Mis tareas del alumno. L5: la segunda línea empieza por cuántas
 * preguntas tiene y cuánto lleva ("15 preguntas · unos 20 min"), para poder
 * elegir una corta.
 */
export function TarjetaDeTarea({
  assignment,
  materia,
  docente,
  principal,
  abriendo,
  alEmpezar,
}: {
  assignment: Pick<
    StudentAssignment,
    'title' | 'questionCount' | 'state' | 'dueAt' | 'opensAt' | 'attemptsUsed' | 'maxAttempts' | 'bestScore'
  >
  materia: string
  docente: string
  /** Un solo azul: la primera tarea para hacer es la principal. */
  principal: boolean
  abriendo: boolean
  alEmpezar: () => void
}) {
  const disponible = assignment.state === 'disponible'
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="cuerpo text-texto">{assignment.title}</h2>
        <p className="nota text-texto-suave">
          {[materia, docente, assignment.dueAt ? T.hasta(formatDate(assignment.dueAt)) : null].filter(Boolean).join(' · ')}
        </p>
        <p className="nota mt-1 text-texto-suave">
          {[
            assignment.questionCount > 0 ? tamanoDeTarea(assignment.questionCount) : null,
            disponible ? null : ASSIGNMENT_STATE_LABEL[assignment.state],
            assignment.opensAt && assignment.state === 'programada' ? T.desde(formatDate(assignment.opensAt)) : null,
            T.intentos(assignment.attemptsUsed, assignment.maxAttempts),
            assignment.bestScore !== null ? T.mejorNota(formatearNumero(Number(assignment.bestScore), { decimales: 1 })) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <Boton
        variante={principal ? 'principal' : 'secundario'}
        className="shrink-0"
        disabled={!disponible || abriendo}
        onClick={alEmpezar}
      >
        {abriendo && <Cargando />}
        {assignment.attemptsUsed > 0 ? T.volverAHacer : T.empezar}
      </Boton>
    </li>
  )
}
