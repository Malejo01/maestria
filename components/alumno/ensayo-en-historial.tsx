import { LaTeXRenderer } from '@/components/latex-renderer'
import type { Correccion } from '@/lib/ensayo'
import { ENSAYO } from '@/lib/textos'
import { formatearNumero } from '@/lib/numeros'

/** Ronda W · W5 — ¿Esta respuesta guardada es un ensayo? (con la 048, o guardado como respuesta corta sin ella). */
export function esEnsayoGuardado(tipo: string | null | undefined, payload: Record<string, unknown> | null | undefined): boolean {
  return tipo === 'essay' || payload?.tipo === 'essay'
}

/**
 * Ronda W · W5 — Un ensayo en el historial: "En corrección" hasta que el
 * docente confirma; después, la nota y su devolución (nunca la sugerencia de la IA).
 */
export function EnsayoEnHistorial({ numero, consigna, payload }: { numero: number; consigna: string; payload: Record<string, unknown> }) {
  const correccion = payload.estadoDeCorreccion === 'corregida' ? (payload.correccion as Correccion | undefined) : undefined
  return (
    <div className="space-y-2 rounded-xl border-2 border-borde bg-superficie-suave p-3" data-ensayo-historial={correccion ? 'corregido' : 'en-correccion'}>
      <p className="text-sm font-medium">
        {numero}. <LaTeXRenderer content={consigna} />
      </p>
      <div className="space-y-1 text-xs">
        <p className="font-semibold text-texto">{ENSAYO.tuRespuesta}</p>
        <p className="whitespace-pre-line text-texto-suave">{String(payload.selectedText ?? '')}</p>
      </div>
      {correccion ? (
        <div className="space-y-2 text-sm">
          <p className="font-bold text-texto">{ENSAYO.corregida(formatearNumero(correccion.nota))}</p>
          {correccion.devolucion && (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-texto">{ENSAYO.devolucionDelDocente}</p>
              <p className="whitespace-pre-line text-texto">{correccion.devolucion}</p>
            </div>
          )}
          {correccion.criterios.length > 0 && (
            <ul className="space-y-1 text-xs">
              {correccion.criterios.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold text-texto">
                    {c.criterio}: {ENSAYO.correcciones.niveles[c.nivel]}
                  </span>
                  {c.devolucion && <span className="text-texto-suave"> · {c.devolucion}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm font-semibold text-texto">{ENSAYO.enCorreccionCorto}</p>
      )}
    </div>
  )
}
