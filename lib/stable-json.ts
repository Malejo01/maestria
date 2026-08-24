/**
 * `JSON.stringify` con las claves de objeto ordenadas, en cualquier profundidad.
 *
 * ─── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * Postgres guarda `jsonb` en un formato propio y **reordena las claves** (por
 * longitud y después byte a byte). Un objeto que sale del cliente como
 *
 *   {"id","topic","topicName","type","question","options","correctAnswer",...}
 *
 * vuelve del `RETURNING` como
 *
 *   {"id","type","topic","origin","options","question","topicName",...}
 *
 * Son el mismo dato y `JSON.stringify` los declara distintos.
 *
 * Eso rompió dos veces en el mismo día (24/08/2026), en dos lugares que no se
 * conocen entre sí:
 *
 *  1. El dry-run del seeder de currículum reportó "CAMBIA" en las 7 unidades
 *     cuando no cambiaba ninguna. Ahí el costo fue un susto.
 *  2. La vista de revisión comparaba las preguntas locales contra las que
 *     devolvía el PATCH para saber si quedaban cambios sin guardar. Después de
 *     guardar, el cartel "Cambios sin guardar" no se apagaba nunca, el botón
 *     seguía habilitado y salir pedía confirmación sobre un cuestionario ya
 *     guardado. Un aviso que miente una vez deja de leerse.
 *
 * La lección de la segunda es la que justifica que esto sea un módulo con
 * nombre propio y no una función suelta: comparar JSON que pasó por Postgres
 * con `JSON.stringify` va a volver a aparecer, y la próxima vez conviene que
 * haya dónde mirar.
 *
 * NO es un serializador canónico de propósito general: no toca el orden de los
 * arrays (donde el orden SÍ es dato) ni intenta normalizar números.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_clave, valor) => {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return valor

    // El replacer de JSON.stringify se aplica de arriba hacia abajo, así que
    // devolver un objeto con las claves reordenadas alcanza: los valores de
    // adentro vuelven a pasar por acá.
    return Object.fromEntries(
      Object.keys(valor as Record<string, unknown>)
        .sort()
        .map((clave) => [clave, (valor as Record<string, unknown>)[clave]]),
    )
  })
}

/** ¿Son el mismo dato, sin que importe el orden de las claves? */
export function sameJsonValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}
