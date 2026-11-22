import { sql } from '@/lib/db'
import { MOTIVO_DEL_RECHAZO, validarCodigo, type ResultadoDelCodigo } from '@/lib/codigos-descuento'
import { buscarCodigo, registrarUso } from '@/lib/codigos-descuento-server'
import { acreditarPlan, marcarFundadora } from '@/lib/planes-server'
import { acreditarPase } from '@/lib/autodidacta-server'
import { linkDePago, type NivelPlan } from '@/lib/planes'
import { linkDeWhatsApp } from '@/lib/precios'
import { armarCobro, estadoDelPago, nuevoVencimiento, queSePaga, type Cobro, type PedidoDePago } from '@/lib/pagos'
import { consultarPago, crearPreferencia, esDePrueba, type Pedir } from '@/lib/mercadopago'
import { captureRouteFailure } from '@/lib/observability'
import { PAGAR as T } from '@/lib/textos'

/**
 * Ronda T · C2 — Pagar desde la app: el resumen, el checkout y el webhook.
 *
 * LA VÁLVULA: sin `MERCADOPAGO_ACCESS_TOKEN` (o sin la 039), el pago vuelve a
 * lo de antes: el link fijo de Mercado Pago y la acreditación a mano; con un
 * código, "Escribile a Mauro para pagar con tu código" con WhatsApp.
 */
const faltaLaTabla = (e: unknown) => (e as { code?: string })?.code === '42P01'

export interface ResumenDelPago {
  cobro: Cobro | null
  /** El código: ok con su porcentaje, o el motivo del rechazo en palabras. */
  codigo: { texto: string; ok: true; porcentaje: number } | { texto: string; ok: false; motivo: string } | null
  /** Hay Checkout Pro (token y tabla). Si no, `manual`. */
  conCheckout: boolean
  /** La válvula: el link fijo y, con código, WhatsApp a Mauro. */
  manual: { link: string | null; whatsapp: string | null } | null
}

/** El cobro con el nombre de la materia del pase, para que se lea en Mercado Pago. */
function conMateria(cobro: Cobro | null, materia: string | null | undefined): Cobro | null {
  return cobro && materia ? { ...cobro, descripcion: `${cobro.descripcion} · ${materia.slice(0, 60)}` } : cobro
}

async function validar(userId: string, pedido: PedidoDePago, texto: string): Promise<ResultadoDelCodigo | null> {
  if (!texto.trim()) return null
  const encontrado = await buscarCodigo(texto, userId)
  return validarCodigo({
    codigo: encontrado?.codigo ?? null,
    que: queSePaga(pedido),
    primerUsoDeLaPersona: encontrado?.primerUsoDeLaPersona ?? null,
    ahora: new Date(),
  })
}

async function hayTablaDePagos(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM pagos LIMIT 0`
    return true
  } catch (error) {
    if (faltaLaTabla(error)) return false
    throw error
  }
}

/** Lo que se muestra antes de pagar: lista, código, total y cómo se paga. */
export async function resumenDelPago(userId: string, pedido: PedidoDePago, textoDelCodigo: string, materia?: string | null): Promise<ResumenDelPago> {
  const resultado = await validar(userId, pedido, textoDelCodigo)
  const cobro = conMateria(armarCobro(pedido, resultado), materia)
  const conCheckout = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) && (await hayTablaDePagos())
  const codigo =
    resultado === null
      ? null
      : resultado.ok
        ? { texto: resultado.codigo.codigo, ok: true as const, porcentaje: resultado.porcentaje }
        : { texto: textoDelCodigo.trim().toUpperCase(), ok: false as const, motivo: MOTIVO_DEL_RECHAZO[resultado.motivo] }
  const manual = conCheckout
    ? null
    : {
        link: pedido.plan === 'particular' ? linkDePago(pedido.forma, pedido.cantidad as NivelPlan) : null,
        whatsapp:
          codigo?.ok || pedido.plan !== 'particular'
            ? linkDeWhatsApp(T.mensajeWhatsApp(cobro?.descripcion ?? '', codigo?.ok ? codigo.texto : null))
            : null,
      }
  return { cobro, codigo, conCheckout, manual }
}

/**
 * Crea la fila del pago y la preferencia de Checkout Pro, con el monto que
 * calculó el servidor. Devuelve el link al que se redirige.
 */
export async function iniciarCheckout(params: {
  userId: string
  email: string | null
  pedido: PedidoDePago
  textoDelCodigo: string
  urlBase: string
  pedir?: Pedir
  /** E2: el nombre de la materia del pase. */
  materia?: string | null
}): Promise<{ ok: true; url: string; pagoId: number } | { ok: false; error: string }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  if (!token) return { ok: false, error: T.sinCheckout }
  const resultado = await validar(params.userId, params.pedido, params.textoDelCodigo)
  if (resultado && !resultado.ok) return { ok: false, error: MOTIVO_DEL_RECHAZO[resultado.motivo] }
  const cobro = conMateria(armarCobro(params.pedido, resultado), params.materia)
  if (!cobro) return { ok: false, error: T.sinPrecio }
  if (cobro.monto <= 0) return { ok: false, error: T.montoCero }

  const [fila] = (await sql`
    INSERT INTO pagos (user_id, plan, forma, cantidad, monto_lista, monto, codigo_id, codigo, detalle)
    VALUES (${params.userId}, ${cobro.pedido.plan}, ${cobro.pedido.forma}, ${cobro.pedido.cantidad}, ${cobro.montoLista}, ${cobro.monto},
            ${resultado?.ok ? resultado.codigo.id : null}, ${resultado?.ok ? resultado.codigo.codigo : null},
            ${JSON.stringify({
              descripcion: cobro.descripcion,
              dias: cobro.dias,
              fundadora: resultado?.ok ? resultado.codigo.fundadora : false,
              ...(cobro.pedido.materia ? { materia: cobro.pedido.materia } : {}),
            })})
    RETURNING id
  `) as { id: number }[]
  const pagoId = Number(fila.id)
  const preferencia = await crearPreferencia(
    { titulo: `MaestrIA · ${cobro.descripcion}`, monto: cobro.monto, externalReference: String(pagoId), urlBase: params.urlBase, emailDelPagador: params.email },
    token,
    params.pedir,
  )
  await sql`UPDATE pagos SET mp_preference_id = ${preferencia.id}, actualizado_el = NOW() WHERE id = ${pagoId}`
  const url = esDePrueba(token) && preferencia.sandboxInitPoint ? preferencia.sandboxInitPoint : preferencia.initPoint
  return { ok: true, url, pagoId }
}

export type ResultadoDeLaNotificacion = 'acreditado' | 'ya_estaba' | 'rechazado' | 'pendiente' | 'desconocido'

/**
 * El webhook: consulta el pago a la API (nunca confía en el cuerpo), busca la
 * fila por `external_reference` y, si está aprobado, acredita UNA sola vez: el
 * paso a 'aprobado' es un UPDATE condicionado, así que dos notificaciones del
 * mismo pago no acreditan dos veces.
 */
export async function procesarNotificacion(paymentId: string, pedir?: Pedir): Promise<ResultadoDeLaNotificacion> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  if (!token) return 'desconocido'
  const pago = await consultarPago(paymentId, token, pedir)
  const pagoId = Number(pago.externalReference)
  if (!Number.isInteger(pagoId) || pagoId <= 0) return 'desconocido'
  const estado = estadoDelPago(pago.status)

  if (estado !== 'aprobado') {
    await sql`
      UPDATE pagos SET estado = ${estado}, mp_payment_id = COALESCE(mp_payment_id, ${pago.id}), actualizado_el = NOW()
      WHERE id = ${pagoId} AND estado <> 'aprobado'
    `
    return estado === 'pendiente' ? 'pendiente' : 'rechazado'
  }

  const filas = (await sql`
    UPDATE pagos SET estado = 'aprobado', mp_payment_id = ${pago.id}, acreditado_el = NOW(), actualizado_el = NOW()
    WHERE id = ${pagoId} AND estado <> 'aprobado'
    RETURNING id, user_id, plan, forma, cantidad, monto, codigo_id, detalle
  `) as Record<string, unknown>[]
  const fila = filas[0]
  if (!fila) return 'ya_estaba'

  // El monto que pagó tiene que ser el que pedimos: si no, no se acredita solo.
  if (pago.monto !== null && Math.abs(pago.monto - Number(fila.monto)) > 1) {
    captureRouteFailure(new Error(`Pago ${pagoId}: Mercado Pago cobró ${pago.monto} y se pidió ${fila.monto}`), {
      endpoint: '/api/pagos/mercadopago',
      operation: 'montoDistinto',
    })
    await sql`UPDATE pagos SET estado = 'pendiente', acreditado_el = NULL WHERE id = ${pagoId}`
    return 'pendiente'
  }

  await acreditarDesdePago(fila)
  return 'acreditado'
}

async function acreditarDesdePago(fila: Record<string, unknown>): Promise<void> {
  const userId = String(fila.user_id)
  const detalle = (fila.detalle ?? {}) as { dias?: number; fundadora?: boolean; descripcion?: string; materia?: number }
  const plan = String(fila.plan)
  if (plan === 'particular' || plan === 'aula') {
    const [usuario] = (await sql`SELECT plan_vence_el FROM users WHERE id = ${userId}`) as { plan_vence_el: string | null }[]
    const venceEl = nuevoVencimiento(usuario?.plan_vence_el, Number(detalle.dias ?? 30), new Date())
    await acreditarPlan({
      docenteId: userId,
      nivel: (plan === 'aula' ? 1 : Number(fila.cantidad)) as NivelPlan,
      venceEl,
      nota: `Mercado Pago, pago ${fila.id}${fila.codigo_id ? ` con código` : ''}`,
      acreditadoPor: 'Mercado Pago',
      tipo: plan === 'aula' ? 'aula' : 'particular',
      cursos: plan === 'aula' ? Number(fila.cantidad) : undefined,
    })
  }
  // E2: el pase de alumno, a su materia personal (examen + 7).
  if (plan === 'pase_alumno') {
    const ok = detalle.materia ? await acreditarPase(userId, Number(detalle.materia)) : false
    if (!ok) {
      captureRouteFailure(new Error(`Pago ${fila.id}: pase sin materia personal de esa persona`), { endpoint: '/api/pagos/mercadopago', operation: 'paseSinMateria' })
    }
  }
  if (fila.codigo_id) await registrarUso(Number(fila.codigo_id), userId)
  if (detalle.fundadora) await marcarFundadora({ docenteId: userId, fundadora: true, marcadoPor: 'Mercado Pago (código fundadora)' })
}

export interface PagoLeido {
  id: number
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado'
  descripcion: string
  monto: number
  acreditadoEl: string | null
  /** E2: el pase de alumno vuelve a su materia. */
  plan?: string
  materia?: number | null
}

/** Para /precios/gracias: el pago, sólo si es de esta persona. */
export async function leerPago(userId: string, pagoId: number): Promise<PagoLeido | null> {
  try {
    const filas = (await sql`
      SELECT id, estado, monto, detalle, acreditado_el, plan FROM pagos WHERE id = ${pagoId} AND user_id = ${userId}
    `) as Record<string, unknown>[]
    const f = filas[0]
    if (!f) return null
    const detalle = (f.detalle ?? {}) as { descripcion?: string; materia?: number }
    return {
      id: Number(f.id),
      estado: f.estado as PagoLeido['estado'],
      descripcion: String(detalle.descripcion ?? ''),
      monto: Number(f.monto),
      acreditadoEl: f.acreditado_el ? new Date(String(f.acreditado_el)).toISOString() : null,
      plan: String(f.plan ?? ''),
      materia: detalle.materia ? Number(detalle.materia) : null,
    }
  } catch (error) {
    if (faltaLaTabla(error)) return null
    throw error
  }
}

/** Para /admin/planes: los últimos pagos. [] sin la 039. */
export async function pagosRecientes(limite = 10): Promise<(PagoLeido & { docente: string; codigo: string | null; creadoEl: string })[]> {
  try {
    const filas = (await sql`
      SELECT p.id, p.estado, p.monto, p.detalle, p.acreditado_el, p.codigo, p.creado_el, COALESCE(u.name, u.email, p.user_id) AS docente
      FROM pagos p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.creado_el DESC LIMIT ${limite}
    `) as Record<string, unknown>[]
    return filas.map((f) => ({
      id: Number(f.id),
      estado: f.estado as PagoLeido['estado'],
      descripcion: String((f.detalle as { descripcion?: string } | null)?.descripcion ?? ''),
      monto: Number(f.monto),
      acreditadoEl: f.acreditado_el ? new Date(String(f.acreditado_el)).toISOString() : null,
      docente: String(f.docente ?? ''),
      codigo: typeof f.codigo === 'string' ? f.codigo : null,
      creadoEl: new Date(String(f.creado_el)).toISOString(),
    }))
  } catch (error) {
    if (faltaLaTabla(error)) return []
    throw error
  }
}

/** Para la campanita del docente: sus pagos acreditados de las últimas dos semanas. [] sin la 039. */
export async function pagosAcreditadosDe(userId: string): Promise<{ id: number; descripcion: string; acreditadoEl: string }[]> {
  try {
    const filas = (await sql`
      SELECT id, detalle, acreditado_el FROM pagos
      WHERE user_id = ${userId} AND estado = 'aprobado' AND acreditado_el > NOW() - INTERVAL '14 days'
    `) as Record<string, unknown>[]
    return filas.map((f) => ({
      id: Number(f.id),
      descripcion: String((f.detalle as { descripcion?: string } | null)?.descripcion ?? ''),
      acreditadoEl: new Date(String(f.acreditado_el)).toISOString(),
    }))
  } catch (error) {
    if (faltaLaTabla(error)) return []
    throw error
  }
}
