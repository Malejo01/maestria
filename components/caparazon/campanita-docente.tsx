'use client'

import { Campanita } from '@/components/sistema/campanita'
import { AVISOS_DOCENTE as T } from '@/lib/textos'

/**
 * O10/P2: la campanita de la barra del docente. Los avisos salen de lo que ya
 * pasó en sus grupos (`/api/teacher/avisos`); el dibujo es el común
 * (components/sistema/campanita.tsx y aviso-item.tsx). No hay correo ni push.
 */
export function CampanitaDocente() {
  return <Campanita endpoint="/api/teacher/avisos" vacio={T.vacio} vacioDetalle={T.vacioDetalle} />
}
