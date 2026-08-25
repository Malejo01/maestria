'use client'

import { AlertTriangle } from 'lucide-react'

/**
 * Estado de error de una carga de datos.
 *
 * Existe como componente compartido y no como bloques repetidos porque el punto
 * es que todos los estados de error se vean IGUAL de distintos al estado vacío.
 * Mientras "falló la consulta" y "no hay datos cargados" compartieron el mismo
 * cartel gris, una caída de `/api/curriculum/topics` se leyó durante nueve días
 * como "todavía no cargamos el temario".
 *
 * El detalle técnico se muestra en pantalla a propósito: es lo que el alumno
 * puede copiar y mandar, y es lo que convierte un reporte de "no anda" en uno
 * accionable.
 */
export function CargaFallida({
  que,
  detalle,
  onReintentar,
}: {
  que: string
  detalle: string
  onReintentar: () => void
}) {
  return (
    <div className="text-center py-12 space-y-3">
      <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
      <p className="text-sm font-semibold text-foreground">No pudimos cargar {que}.</p>
      <p className="text-muted-foreground text-xs max-w-sm mx-auto">
        No es que no haya nada cargado: falló la consulta. Probá de nuevo en unos instantes; si
        sigue igual, avisá con este detalle.
      </p>
      <p className="text-[11px] font-mono text-muted-foreground break-words px-4">{detalle}</p>
      <button onClick={onReintentar} className="text-sm font-semibold text-primary hover:underline">
        Reintentar
      </button>
    </div>
  )
}
