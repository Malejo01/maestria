/**
 * Ronda T · C2 — Mercado Pago, por su API REST (sin el SDK: son dos llamadas).
 *
 *   POST /checkout/preferences   la preferencia de Checkout Pro
 *   GET  /v1/payments/{id}        el pago, para el webhook
 *
 * El `fetch` se inyecta: los tests usan respuestas simuladas y nunca las
 * credenciales reales. El token sale de `MERCADOPAGO_ACCESS_TOKEN`.
 */
const API = 'https://api.mercadopago.com'

export type Pedir = (url: string, init?: RequestInit) => Promise<Response>

export interface Preferencia {
  id: string
  /** El link de Checkout Pro (producción). */
  initPoint: string
  /** El de prueba, con credenciales de prueba. */
  sandboxInitPoint: string | null
}

export interface PagoDeMercadoPago {
  id: string
  status: string
  externalReference: string | null
  monto: number | null
}

export async function crearPreferencia(
  params: {
    titulo: string
    monto: number
    externalReference: string
    urlBase: string
    emailDelPagador?: string | null
  },
  token: string,
  pedir: Pedir = fetch,
): Promise<Preferencia> {
  const vuelta = (estado: string) => `${params.urlBase}/precios/gracias?pago=${encodeURIComponent(params.externalReference)}&estado=${estado}`
  const res = await pedir(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: `maestria-${params.externalReference}`, title: params.titulo, quantity: 1, unit_price: params.monto, currency_id: 'ARS' }],
      external_reference: params.externalReference,
      ...(params.emailDelPagador ? { payer: { email: params.emailDelPagador } } : {}),
      back_urls: { success: vuelta('aprobado'), pending: vuelta('pendiente'), failure: vuelta('rechazado') },
      auto_return: 'approved',
      notification_url: `${params.urlBase}/api/pagos/mercadopago`,
      statement_descriptor: 'MAESTRIA',
    }),
  })
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al crear la preferencia`)
  const datos = (await res.json()) as { id?: unknown; init_point?: unknown; sandbox_init_point?: unknown }
  if (typeof datos.id !== 'string' || typeof datos.init_point !== 'string') throw new Error('Mercado Pago no devolvió el link de pago')
  return {
    id: datos.id,
    initPoint: datos.init_point,
    sandboxInitPoint: typeof datos.sandbox_init_point === 'string' ? datos.sandbox_init_point : null,
  }
}

export async function consultarPago(id: string, token: string, pedir: Pedir = fetch): Promise<PagoDeMercadoPago> {
  const res = await pedir(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar el pago`)
  const datos = (await res.json()) as { id?: unknown; status?: unknown; external_reference?: unknown; transaction_amount?: unknown }
  return {
    id: String(datos.id ?? id),
    status: String(datos.status ?? ''),
    externalReference: typeof datos.external_reference === 'string' ? datos.external_reference : null,
    monto: typeof datos.transaction_amount === 'number' ? datos.transaction_amount : null,
  }
}

/** Las credenciales de prueba empiezan con TEST-: con ellas se usa el link sandbox. */
export function esDePrueba(token: string): boolean {
  return token.startsWith('TEST-')
}
