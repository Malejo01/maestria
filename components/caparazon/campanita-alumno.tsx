'use client'

import { Campanita } from '@/components/sistema/campanita'
import { AVISOS_ALUMNO as T } from '@/lib/textos'

/**
 * P3: la campanita del alumno y del invitado. Los avisos salen de sus tareas,
 * sus reportes, sus temas y su racha (`/api/avisos`); el dibujo es el común.
 */
export function CampanitaAlumno() {
  return <Campanita endpoint="/api/avisos" vacio={T.vacio} vacioDetalle={T.vacioDetalle} />
}
