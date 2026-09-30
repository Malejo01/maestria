/**
 * Captura explícita de errores hacia Sentry.
 *
 * `onRequestError` (instrumentation.ts) sólo ve las excepciones que escapan de
 * un route handler, y en este proyecto casi ninguna lo hace: los handlers
 * atrapan, loguean por consola y responden un JSON con status 500. Desde afuera
 * eso es indistinguible de un 200 — el error existe pero nadie se entera. Estos
 * helpers son la forma de que sí se enteren, con tags consistentes para poder
 * filtrar en el panel.
 *
 * Cada helper cubre una de las tres prioridades definidas para el lanzamiento:
 * fallas de esquema de Gemini, errores de endpoints, y parseo de archivos.
 */
import * as Sentry from '@sentry/nextjs'

/** Nunca dejar que un fallo del reporte tape al error que se estaba reportando. */
function safeCapture(error: unknown, configure: (scope: Sentry.Scope) => void): void {
  try {
    Sentry.withScope((scope) => {
      configure(scope)
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)))
    })
  } catch (reportingError) {
    console.error('[observability] no se pudo reportar el error', reportingError)
  }
}

/**
 * Gemini devolvió algo que no encaja en el esquema Zod de `generateObject`.
 *
 * Es el error más caro del sistema y el más invisible: casi todos los llamadores
 * tienen un fallback (reintento con generateText, o parseo heurístico), así que
 * el usuario recibe un resultado degradado sin que nada falle a la vista. Si
 * esto sube de golpe, algo cambió en el modelo o en el prompt.
 */
export function captureAiSchemaFailure(
  error: unknown,
  context: {
    endpoint: string
    /** Camino que se tomó al fallar, para saber si el usuario notó algo. */
    fallback: 'generateText' | 'heuristic' | 'none'
    model?: string
    nivel?: string | null
    subject?: string | null
  }
): void {
  safeCapture(error, (scope) => {
    scope.setLevel('warning')
    scope.setTag('error_kind', 'ai_schema')
    scope.setTag('ai_endpoint', context.endpoint)
    scope.setTag('ai_fallback', context.fallback)
    scope.setTag('ai_model', context.model ?? 'gemini-2.5-flash')
    // Sin texto libre del alumno: sólo la forma del pedido, que es lo que hace
    // falta para reproducirlo.
    scope.setContext('generacion', {
      nivel: context.nivel ?? null,
      materia: context.subject ?? null,
    })
  })
}

/**
 * Un handler atrapó su propia excepción y va a responder un 4xx/5xx. Se usa en
 * `/api/teacher/*` y `/api/quiz/*`, que son los que sostienen las dos
 * experiencias con datos reales de por medio.
 */
export function captureRouteFailure(
  error: unknown,
  context: { endpoint: string; status?: number; operation?: string }
): void {
  safeCapture(error, (scope) => {
    scope.setLevel(context.status && context.status < 500 ? 'warning' : 'error')
    scope.setTag('error_kind', 'route')
    scope.setTag('endpoint', context.endpoint)
    if (context.operation) scope.setTag('operation', context.operation)
    if (context.status) scope.setContext('respuesta', { status: context.status })
  })
}

/**
 * Se rompió en el cliente una invariante que el sistema de tipos da por cierta
 * pero que TypeScript no puede sostener en runtime — típicamente una unión
 * discriminada que llegó desalineada.
 *
 * Existe porque el modo de falla natural de estos casos es el silencio: el
 * componente cae en su rama por defecto, devuelve `null`, y el alumno se queda
 * con una pregunta sin nada para clickear. Nadie abre un ticket por eso, y en
 * el panel no aparece nada. Esto lo convierte en un evento visible sin tener
 * que romperle la pantalla al alumno para enterarnos.
 *
 * No lleva texto del enunciado ni de la respuesta: sólo los discriminantes, que
 * es lo único que hace falta para reproducirlo.
 */
export function captureClientInvariant(
  error: unknown,
  context: { component: string; expected: string; received: string }
): void {
  safeCapture(error, (scope) => {
    scope.setLevel('error')
    scope.setTag('error_kind', 'client_invariant')
    scope.setTag('component', context.component)
    scope.setContext('invariante', {
      esperado: context.expected,
      recibido: context.received,
    })
  })
}

/**
 * Un presupuesto diario de IA se agotó y el guard empezó a rechazar llamadas.
 *
 * No es una excepción de nadie: el guard responde un 429/503 prolijo y el
 * sistema "anda". Justamente por eso tiene que llegar acá — si no, el primer
 * aviso es un docente diciendo que la app no funciona. `pool` separa los dos
 * casos: `guest` es el sub-tope de invitados (señal de abuso o de un aula
 * grande de invitados), `global` es el kill switch que corta a todos.
 *
 * Mientras dure el corte, cada request lo volvería a reportar; con un abuso
 * eso son miles de eventos que agotan la cuota de Sentry y nos dejan ciegos
 * para todo lo demás. Por eso se reporta una vez cada 15 minutos por instancia
 * y pool, con un fingerprint fijo para que caigan en el mismo issue.
 */
const BUDGET_CUTOFF_REPORT_INTERVAL_MS = 15 * 60 * 1000
const lastBudgetCutoffReport = new Map<string, number>()

export function captureAiBudgetCutoff(context: {
  pool: 'guest' | 'global'
  bucket: string
  spentUsd: number
  budgetUsd: number
}): void {
  const now = Date.now()
  const last = lastBudgetCutoffReport.get(context.pool)
  if (last != null && now - last < BUDGET_CUTOFF_REPORT_INTERVAL_MS) return
  lastBudgetCutoffReport.set(context.pool, now)

  safeCapture(new Error(`Presupuesto de IA agotado (${context.pool})`), (scope) => {
    scope.setLevel(context.pool === 'global' ? 'error' : 'warning')
    scope.setTag('error_kind', 'ai_budget')
    scope.setTag('ai_budget_pool', context.pool)
    scope.setTag('ai_bucket', context.bucket)
    scope.setFingerprint(['ai-budget-exhausted', context.pool])
    scope.setContext('presupuesto', {
      gastadoUsd: context.spentUsd,
      topeUsd: context.budgetUsd,
    })
  })
}

/**
 * Un aula llegó al tope de invitados nuevos del día y se rechazó un ingreso.
 *
 * El docente lo ve en su panel; esto es para nosotros: un aula que llega al
 * tope es o una clase más grande de lo previsto (hay que subir el número) o un
 * código filtrado. El id del aula va como tag para distinguirlos. Mismo
 * criterio que el presupuesto: una vez cada 15 minutos por aula e instancia.
 */
const lastGuestCapReport = new Map<number, number>()

export function captureGuestJoinCapReached(context: { classroomId: number; newGuests: number; limit: number }): void {
  const now = Date.now()
  const last = lastGuestCapReport.get(context.classroomId)
  if (last != null && now - last < BUDGET_CUTOFF_REPORT_INTERVAL_MS) return
  lastGuestCapReport.set(context.classroomId, now)

  safeCapture(new Error('Aula llegó al tope de invitados nuevos'), (scope) => {
    scope.setLevel('warning')
    scope.setTag('error_kind', 'guest_join_cap')
    scope.setTag('classroom_id', String(context.classroomId))
    scope.setFingerprint(['guest-join-cap', String(context.classroomId)])
    scope.setContext('tope_invitados', { invitadosNuevos: context.newGuests, tope: context.limit })
  })
}

/**
 * Falló la extracción de texto de un archivo subido por un docente.
 *
 * Cada formato tiene su propia librería y sus propios modos de romperse (un PDF
 * escaneado, un .doc de Word 97, un OCR que no encuentra texto). El tag por
 * parser es lo que permite ver si el problema es de un formato puntual antes de
 * ponerse a adivinar.
 *
 * El nombre del archivo NO se manda: suele ser "Programa 3ro B - Prof Gonzalez.pdf".
 */
export function captureFileParsingFailure(
  error: unknown,
  context: {
    parser: 'mammoth' | 'pdf-parse' | 'tesseract' | 'word-extractor'
    mimeType?: string
    sizeBytes?: number
  }
): void {
  safeCapture(error, (scope) => {
    scope.setLevel('warning')
    scope.setTag('error_kind', 'file_parsing')
    scope.setTag('parser', context.parser)
    if (context.mimeType) scope.setTag('mime_type', context.mimeType)
    scope.setContext('archivo', {
      mimeType: context.mimeType ?? null,
      sizeBytes: context.sizeBytes ?? null,
    })
  })
}
