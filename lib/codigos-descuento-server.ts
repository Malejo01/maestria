import { sql } from '@/lib/db'
import { codigoDesdeFila, normalizarCodigo, type AplicaA, type CodigoDeDescuento, type FormaDePago } from '@/lib/codigos-descuento'

/**
 * Ronda T · C1 — La base de los códigos de descuento (migración 038).
 *
 * La válvula: sin la 038 (42P01), la lista dice 'sin_migracion', crear
 * devuelve 'sin_migracion' y buscar un código devuelve null (al pagar no se
 * aceptan códigos). Nada da 500 por eso.
 */
const faltaLaTabla = (e: unknown) => (e as { code?: string })?.code === '42P01'

export interface CodigoEnLista extends CodigoDeDescuento {
  creadoPor: string | null
  creadoEl: string
  /** Quién lo usó (nombre) y cuándo por primera vez. */
  usos: { nombre: string; primerUsoEl: string }[]
}

export async function listarCodigos(): Promise<CodigoEnLista[] | 'sin_migracion'> {
  try {
    const filas = (await sql`
      SELECT c.*, COUNT(u.user_id)::int AS usos_hechos,
             COALESCE(json_agg(json_build_object('nombre', COALESCE(us.name, 'Sin nombre'), 'primerUsoEl', u.primer_uso_el)
                      ORDER BY u.primer_uso_el) FILTER (WHERE u.user_id IS NOT NULL), '[]') AS usos
      FROM codigos_descuento c
      LEFT JOIN codigos_descuento_usos u ON u.codigo_id = c.id
      LEFT JOIN users us ON us.id = u.user_id
      GROUP BY c.id
      ORDER BY c.activo DESC, c.creado_el DESC
    `) as Record<string, unknown>[]
    return filas.map((f) => ({
      ...codigoDesdeFila(f),
      creadoPor: typeof f.creado_por === 'string' ? f.creado_por : null,
      creadoEl: new Date(String(f.creado_el)).toISOString(),
      usos: (Array.isArray(f.usos) ? f.usos : []) as { nombre: string; primerUsoEl: string }[],
    }))
  } catch (error) {
    if (faltaLaTabla(error)) return 'sin_migracion'
    throw error
  }
}

export interface NuevoCodigo {
  codigo: string
  porcentaje: number
  aplica: AplicaA
  forma: FormaDePago
  meses: number | null
  usosMaximos: number
  venceEl: string | null
  fundadora: boolean
  nota: string
  creadoPor: string
}

/** Crea un código. 'repetido' si ya existe; 'sin_migracion' sin la 038. */
export async function crearCodigo(nuevo: NuevoCodigo): Promise<{ id: number } | 'repetido' | 'sin_migracion'> {
  try {
    const filas = (await sql`
      INSERT INTO codigos_descuento (codigo, porcentaje, aplica, forma, meses, usos_maximos, vence_el, fundadora, nota, creado_por)
      VALUES (${normalizarCodigo(nuevo.codigo)}, ${nuevo.porcentaje}, ${nuevo.aplica}, ${nuevo.forma}, ${nuevo.meses},
              ${nuevo.usosMaximos}, ${nuevo.venceEl}, ${nuevo.fundadora}, ${nuevo.nota || null}, ${nuevo.creadoPor})
      ON CONFLICT (codigo) DO NOTHING
      RETURNING id
    `) as { id: number }[]
    return filas[0] ? { id: Number(filas[0].id) } : 'repetido'
  } catch (error) {
    if (faltaLaTabla(error)) return 'sin_migracion'
    throw error
  }
}

/** Activa o desactiva. false si no existe. */
export async function activarCodigo(id: number, activo: boolean): Promise<boolean | 'sin_migracion'> {
  try {
    const filas = (await sql`UPDATE codigos_descuento SET activo = ${activo} WHERE id = ${id} RETURNING id`) as unknown[]
    return filas.length > 0
  } catch (error) {
    if (faltaLaTabla(error)) return 'sin_migracion'
    throw error
  }
}

/**
 * Para pagar (C2): el código, con sus usos, y el primer uso de esta persona.
 * null si no existe o falta la 038.
 */
export async function buscarCodigo(
  texto: string,
  userId: string,
): Promise<{ codigo: CodigoDeDescuento; primerUsoDeLaPersona: string | null } | null> {
  try {
    const filas = (await sql`
      SELECT c.*,
             (SELECT COUNT(*)::int FROM codigos_descuento_usos u WHERE u.codigo_id = c.id) AS usos_hechos,
             (SELECT u.primer_uso_el FROM codigos_descuento_usos u WHERE u.codigo_id = c.id AND u.user_id = ${userId}) AS primer_uso
      FROM codigos_descuento c
      WHERE c.codigo = ${normalizarCodigo(texto)}
    `) as Record<string, unknown>[]
    const fila = filas[0]
    if (!fila) return null
    return {
      codigo: codigoDesdeFila(fila),
      primerUsoDeLaPersona: fila.primer_uso ? new Date(String(fila.primer_uso)).toISOString() : null,
    }
  } catch (error) {
    if (faltaLaTabla(error)) return null
    throw error
  }
}

/**
 * Anota que esta persona usó el código (al acreditarse el pago, C2). Una sola
 * vez por persona: lo repetido no gasta otro uso.
 */
export async function registrarUso(codigoId: number, userId: string): Promise<void> {
  await sql`
    INSERT INTO codigos_descuento_usos (codigo_id, user_id) VALUES (${codigoId}, ${userId})
    ON CONFLICT (codigo_id, user_id) DO NOTHING
  `
}
