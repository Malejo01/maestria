/**
 * El fondo de las pantallas a pantalla completa (cuestionario, resultados,
 * selector de práctica).
 *
 * Era un degradé con una grilla de puntos y manchas de color desenfocadas.
 * El sistema de diseño pide fondos planos: el contenido lleva fórmulas en
 * pantallas chicas y nada tiene que competir con eso ("La matemática se tiene
 * que leer", brand-book.md). Queda como un fondo liso en `superficie-base`.
 *
 * Se conserva el componente —y su nombre— para no tocar los siete lugares que
 * lo montan, varios dentro del motor de cuestionarios.
 */
export function MathBackground() {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-superficie-base" />
}
