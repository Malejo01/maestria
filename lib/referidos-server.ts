import { sql } from '@/lib/db'
import { nuevoVencimiento } from '@/lib/pagos'
import { codigoParaDocente, DIAS_DEL_PREMIO, premioDelReferente, referidosActivo, validarReferido } from '@/lib/referidos'
import type { QueSePaga, ResultadoDelCodigo } from '@/lib/codigos-descuento'
import { esCampana, normalizarRef } from '@/lib/origen'
import { captureRouteFailure } from '@/lib/observability'

/**
 * Ronda V · V3 — Los referidos en la base. Todo pasa por la válvula
 * (`referidosActivo`) y nunca lanza por la migración: sin la 046, no hace nada.
 */
const faltaLaMigracion = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

/** El código del docente; lo crea la primera vez. null apagado o sin la 046. */
export async function miCodigoDeReferido(userId: string): Promise<string | null> {
  if (!referidosActivo()) return null
  try {
    const [u] = (await sql`SELECT name, codigo_referido FROM users WHERE id = ${userId}`) as { name: string | null; codigo_referido: string | null }[]
    if (!u) return null
    if (u.codigo_referido) return u.codigo_referido
    for (let intento = 0; intento < 5; intento++) {
      const codigo = codigoParaDocente(u.name)
      try {
        const filas = (await sql`
          UPDATE users SET codigo_referido = ${codigo} WHERE id = ${userId} AND codigo_referido IS NULL RETURNING codigo_referido
        `) as { codigo_referido: string }[]
        if (filas[0]) return filas[0].codigo_referido
        const [otra] = (await sql`SELECT codigo_referido FROM users WHERE id = ${userId}`) as { codigo_referido: string | null }[]
        return otra?.codigo_referido ?? null
      } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error // repetido: otro intento
      }
    }
    return null
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}

/** De quién es el código (o null). */
async function duenoDelCodigo(codigo: string): Promise<string | null> {
  const [f] = (await sql`SELECT id FROM users WHERE codigo_referido = ${codigo} AND role = 'DOCENTE'`) as { id: string }[]
  return f ? String(f.id) : null
}

/**
 * Al registrarse: si llegó con un `?ref=` de otro docente (V1 lo guardó en
 * `users.origen_ref`), queda anotado quién lo trajo. Nunca lanza.
 */
export async function registrarReferido(userId: string): Promise<void> {
  if (!referidosActivo()) return
  try {
    const [u] = (await sql`SELECT to_jsonb(users) ->> 'origen_ref' AS ref FROM users WHERE id = ${userId}`) as { ref: string | null }[]
    const codigo = normalizarRef(u?.ref)
    // AA2: `AD-…` es el nombre de un anuncio de Meta, nunca el código de un docente.
    if (!codigo || esCampana(codigo)) return
    const referente = await duenoDelCodigo(codigo)
    if (!referente || referente === userId) return
    await sql`
      INSERT INTO referidos (referente_id, referido_id, codigo) VALUES (${referente}, ${userId}, ${codigo})
      ON CONFLICT (referido_id) DO NOTHING
    `
  } catch (error) {
    if (!faltaLaMigracion(error)) captureRouteFailure(error, { endpoint: 'lib/referidos-server', operation: 'registrarReferido' })
  }
}

/** Si quien paga ya tiene algún pago acreditado (sin la 039, no). */
async function yaPago(userId: string): Promise<boolean> {
  try {
    const filas = (await sql`SELECT 1 FROM pagos WHERE user_id = ${userId} AND estado = 'aprobado' LIMIT 1`) as unknown[]
    return filas.length > 0
  } catch (error) {
    if (faltaLaMigracion(error)) return false
    throw error
  }
}

/**
 * En el pago: si el texto es un código de referido, su resultado como código
 * de C1 (10 % en el primer pago); si no lo es, null y sigue C1.
 */
export async function validarCodigoDeReferido(texto: string, quienPaga: string, que: QueSePaga): Promise<ResultadoDelCodigo | null> {
  if (!referidosActivo()) return null
  const codigo = normalizarRef(texto)
  if (!codigo) return null
  try {
    const referenteId = await duenoDelCodigo(codigo)
    if (!referenteId) return null
    return validarReferido({ activo: true, codigo, referenteId, quienPaga, yaPago: await yaPago(quienPaga), que })
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}

/** El código que viene puesto en "¿Tenés un código?": el del link con el que llegó, si todavía no pagó. */
export async function codigoSugerido(userId: string): Promise<string | null> {
  if (!referidosActivo()) return null
  try {
    const [f] = (await sql`SELECT codigo FROM referidos WHERE referido_id = ${userId} AND pago_id IS NULL`) as { codigo: string }[]
    return f?.codigo ?? null
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}

/** Suma los días del premio al plan del docente (desde su vencimiento si está vigente). */
async function sumarDias(docenteId: string, dias: number, ahora: Date): Promise<void> {
  const [u] = (await sql`SELECT plan_vence_el FROM users WHERE id = ${docenteId}`) as { plan_vence_el: string | null }[]
  const vence = nuevoVencimiento(u?.plan_vence_el, dias, ahora)
  const linea = `${ahora.toISOString().slice(0, 10)} · +${dias} días por un referido`
  await sql`
    UPDATE users SET plan_vence_el = ${vence.toISOString()},
      plan_notas = CASE WHEN COALESCE(plan_notas, '') = '' THEN ${linea} ELSE plan_notas || E'\n' || ${linea} END,
      updated_at = NOW()
    WHERE id = ${docenteId}
  `
}

/**
 * Al acreditarse el pago de un plan docente (webhook de C2):
 *   1. si quien pagó llegó referido y es su primer pago, al que lo trajo se
 *      le suman 30 días (o le quedan pendientes, si no tiene plan);
 *   2. si quien pagó tenía premios pendientes, se le suman ahora.
 * Una vez por referido (UPDATE condicionado). Nunca lanza.
 */
export async function premiarReferidos(userId: string, pagoId: number, ahora = new Date()): Promise<void> {
  if (!referidosActivo()) return
  try {
    const marcados = (await sql`
      UPDATE referidos SET pago_id = ${pagoId}, pagado_el = ${ahora.toISOString()}
      WHERE referido_id = ${userId} AND pago_id IS NULL
      RETURNING id, referente_id
    `) as { id: number; referente_id: string }[]
    for (const r of marcados) {
      const [ref] = (await sql`SELECT plan_vence_el FROM users WHERE id = ${r.referente_id}`) as { plan_vence_el: string | null }[]
      if (premioDelReferente({ planVenceEl: ref?.plan_vence_el, ahora }) === 'sumar') {
        const ok = (await sql`
          UPDATE referidos SET premiado_el = ${ahora.toISOString()}, dias_premio = ${DIAS_DEL_PREMIO} WHERE id = ${r.id} AND premiado_el IS NULL RETURNING id
        `) as unknown[]
        if (ok.length) await sumarDias(r.referente_id, DIAS_DEL_PREMIO, ahora)
      }
    }
    // Los premios que tenía pendientes quien acaba de pagar.
    const pendientes = (await sql`
      UPDATE referidos SET premiado_el = ${ahora.toISOString()}, dias_premio = ${DIAS_DEL_PREMIO}
      WHERE referente_id = ${userId} AND pago_id IS NOT NULL AND premiado_el IS NULL
      RETURNING id
    `) as unknown[]
    if (pendientes.length) await sumarDias(userId, DIAS_DEL_PREMIO * pendientes.length, ahora)
  } catch (error) {
    if (!faltaLaMigracion(error)) captureRouteFailure(error, { endpoint: 'lib/referidos-server', operation: 'premiarReferidos' })
  }
}

export interface MisReferidos {
  activo: boolean
  codigo: string | null
  registrados: number
  pagaron: number
  diasGanados: number
}

/** Para el docente: su código y cómo le fue. */
export async function misReferidos(userId: string): Promise<MisReferidos> {
  const codigo = await miCodigoDeReferido(userId)
  if (!codigo) return { activo: false, codigo: null, registrados: 0, pagaron: 0, diasGanados: 0 }
  const [f] = (await sql`
    SELECT COUNT(*)::int AS registrados, COUNT(pago_id)::int AS pagaron, COALESCE(SUM(dias_premio), 0)::int AS dias
    FROM referidos WHERE referente_id = ${userId}
  `) as { registrados: number; pagaron: number; dias: number }[]
  return { activo: true, codigo, registrados: f.registrados, pagaron: f.pagaron, diasGanados: f.dias }
}

/** Los premios recientes, para la campanita del que trajo. */
export async function premiosRecientes(userId: string, dias = 14): Promise<{ id: number; premiadoEl: string }[]> {
  if (!referidosActivo()) return []
  try {
    const filas = (await sql`
      SELECT id, premiado_el FROM referidos
      WHERE referente_id = ${userId} AND premiado_el > NOW() - make_interval(days => ${dias})
    `) as { id: number; premiado_el: string | Date }[]
    return filas.map((f) => ({ id: Number(f.id), premiadoEl: new Date(f.premiado_el).toISOString() }))
  } catch (error) {
    if (faltaLaMigracion(error)) return []
    throw error
  }
}
