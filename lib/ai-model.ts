/**
 * El modelo de Gemini que usa toda la app. Un solo lugar a propósito.
 *
 * Hasta el 30/09/2026 el id estaba escrito a mano en 10 llamadas. Ese día se
 * cambió la API key por una de un proyecto nuevo de Google, y Google ya no
 * habilita `gemini-2.5-flash` (ni `-lite`) a proyectos nuevos: devuelve 404
 * "no longer available to new users", que la app convertía en un 502 genérico.
 * Cambiar de modelo tenía que ser un renglón, y eran diez.
 *
 * Al cambiarlo, tres cosas a mirar — no es sólo el nombre:
 * - Precio: tiene que tener su fila en `MODEL_PRICING_USD_PER_MTOK`
 *   (lib/ai-usage.ts), o el tope de gasto diario lo cobra con la tarifa de
 *   otro modelo. Lo fija un test.
 * - "Pensamiento": varios modelos 3.x piensan por defecto y esos tokens salen
 *   del mismo `maxOutputTokens`. Es la falla que cortaba el JSON de la
 *   corrección de respuestas cortas el 10/08. `gemini-3.1-flash-lite` no piensa
 *   por defecto y acepta `thinkingBudget: 0` (verificado contra la API el
 *   30/09/2026); `gemini-3.5-flash` y `3.8-flash` gastaron 20 de 20 tokens
 *   pensando antes de escribir una palabra.
 * - Que la key lo tenga habilitado: `GET /v1beta/models` lista modelos que
 *   después dan 404 al generar, así que hay que probar un `generateContent`.
 */
export const AI_MODEL = 'gemini-3.1-flash-lite'
