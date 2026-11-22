'use client'

import { useCallback, useEffect, useState } from 'react'
import { pedirJson } from '@/lib/pedir-json'

/**
 * M3: el seguimiento de UN grupo, como lo devuelve
 * GET /api/teacher/classrooms/[id]/report. Salió de components/teacher-classrooms.tsx
 * (la vista vieja de un aula), que ya no existe: todo vive en la página del
 * grupo (`/teacher/grupos/[id]`).
 */

export interface TemaFlojo {
  topicName: string
  correct: number
  total: number
  accuracy: number
}

export interface AlumnoDelInforme {
  memberId: number
  userId: string
  displayName: string
  isVerified: boolean
  joinedAt: string
  attemptCount: number
  averageScore: number | null
  bestScore: number | null
  passedCount: number
  lastAttemptAt: string | null
  weakTopics: TemaFlojo[]
  /** P4: las prácticas extra de las tareas del grupo, aparte del promedio. */
  practicasExtra?: { cantidad: number; promedio: number | null } | null
}

export interface TemaDelGrupo extends TemaFlojo {
  studentCount: number
}

export interface TareaDelInforme {
  id: number
  title: string
  questionCount: number
  opensAt: string | null
  dueAt: string | null
  maxAttempts: number | null
  submittedCount: number
  pendingCount: number
  attemptCount: number
  averageScore: number | null
  /** L0: sólo para un alumno (un diagnóstico individual). No cuenta para el grupo. */
  individual?: boolean
  destinatario?: string | null
}

export interface ResumenDelGrupo {
  studentCount: number
  inactiveCount: number
  totalAttempts: number
  groupAverage: number | null
  weakTopicCount: number
}

export interface InformeDelGrupo {
  students: AlumnoDelInforme[]
  topics: TemaDelGrupo[]
  assignments: TareaDelInforme[]
  summary: ResumenDelGrupo | null
}

export function useInformeDelGrupo(grupoId: number) {
  const [informe, setInforme] = useState<InformeDelGrupo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const leer = useCallback(async () => {
    const respuesta = await pedirJson<Partial<InformeDelGrupo>>(`/api/teacher/classrooms/${grupoId}/report`)
    if ('error' in respuesta) {
      setError(respuesta.error)
      return
    }
    setError(null)
    setInforme({
      students: Array.isArray(respuesta.data.students) ? respuesta.data.students : [],
      topics: Array.isArray(respuesta.data.topics) ? respuesta.data.topics : [],
      assignments: Array.isArray(respuesta.data.assignments) ? respuesta.data.assignments : [],
      summary: respuesta.data.summary ?? null,
    })
  }, [grupoId])

  useEffect(() => {
    void leer()
  }, [leer])

  return { informe, error, leer }
}
