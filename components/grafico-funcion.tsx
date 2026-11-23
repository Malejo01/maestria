import { armarGrafico, descripcionDelGrafico, formatear, limpiarGrafico, TRAZOS, type Grafico } from '@/lib/grafico'
import { cn } from '@/lib/utils'

/**
 * Ronda X · X3 — El gráfico de una pregunta, en SVG propio (sin librerías).
 * Accesible: `role="img"` con la descripción completa (funciones, dominio,
 * puntos). Los colores salen de los tokens; las curvas, además del color, se
 * distinguen por el trazo (lleno, guiones, puntos), así que también se leen
 * en blanco y negro al imprimir.
 */
const COLOR_DE_CURVA = ['stroke-accion', 'stroke-logrado', 'stroke-flojo'] as const

export function GraficoFuncion({ grafico, className, alto = 240 }: { grafico: Grafico; className?: string; alto?: number }) {
  const g = limpiarGrafico(grafico)
  if (!g) return null
  const ancho = Math.round((alto * 4) / 3)
  const geo = armarGrafico(g, ancho, alto)
  const descripcion = descripcionDelGrafico(g)
  const margen = 28
  return (
    <figure className={cn('w-full max-w-md', className)} data-grafico>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-auto w-full text-texto" role="img" aria-label={descripcion}>
        <title>{descripcion}</title>
        <rect width={ancho} height={alto} className="fill-superficie-tarjeta" />
        <g className="stroke-borde" strokeWidth={1}>
          {geo.marcasX.map((m) => (
            <line key={`vx${m.valor}`} x1={m.px} y1={margen} x2={m.px} y2={alto - margen} />
          ))}
          {geo.marcasY.map((m) => (
            <line key={`hy${m.valor}`} x1={margen} y1={m.px} x2={ancho - margen} y2={m.px} />
          ))}
        </g>
        <g className="stroke-texto-suave" strokeWidth={1.25}>
          {geo.ejeX !== null && <line x1={margen} y1={geo.ejeX} x2={ancho - margen} y2={geo.ejeX} />}
          {geo.ejeY !== null && <line x1={geo.ejeY} y1={margen} x2={geo.ejeY} y2={alto - margen} />}
        </g>
        <g className="fill-texto-suave" fontSize={10} aria-hidden="true">
          {geo.marcasX.map((m) => (
            <text key={`tx${m.valor}`} x={m.px} y={alto - margen + 13} textAnchor="middle">
              {formatear(m.valor)}
            </text>
          ))}
          {geo.marcasY.map((m) => (
            <text key={`ty${m.valor}`} x={margen - 4} y={m.px + 3} textAnchor="end">
              {formatear(m.valor)}
            </text>
          ))}
        </g>
        {geo.caminos.map((d, i) => (
          <path key={i} d={d} fill="none" strokeWidth={2.25} strokeLinecap="round" className={COLOR_DE_CURVA[i]} strokeDasharray={TRAZOS[i] || undefined} />
        ))}
        <g className="fill-texto" fontSize={11}>
          {geo.puntos.map((p, i) => (
            <g key={i}>
              <circle cx={p.cx} cy={p.cy} r={4} />
              <text x={p.cx + 6} y={p.cy - 6}>
                {p.etiqueta}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {g.expresiones.length > 1 && (
        <figcaption className="nota mt-1 flex flex-wrap gap-x-4 gap-y-1 text-texto-suave">
          {g.expresiones.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="21" y2="4" strokeWidth={2.25} className={COLOR_DE_CURVA[i]} strokeDasharray={TRAZOS[i] || undefined} />
              </svg>
              y = {e}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}
