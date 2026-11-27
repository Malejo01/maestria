import { sql } from '@/lib/db'
import { crearAviso, ESTILO_DEL_AVISO, type Aviso, type Lectura, type TipoDeAviso } from '@/lib/avisos/tipos'
import { fraseDeEvidencia } from '@/lib/evidencia-del-muro'
import { leerEvidencia } from '@/lib/evidencia-del-muro-server'
import { cupoGratis } from '@/lib/planes'
import { captureRouteFailure } from '@/lib/observability'
import { AVISOS_GUARDADOS as T } from '@/lib/textos'

/**
 * AC1 / AC5 · Los avisos de la campanita que no se deducen de otros datos
 * (`avisos_guardados`, migración 050): el alumno que no pudo entrar por el
 * cupo (AC1) y el resumen de los lunes (AC5). Uno por (user_id, clave): volver
 * a escribir el mismo no lo duplica.
 *
 * La válvula: sin la 050, escribir no hace nada y leer devuelve ninguno. Nada
 * de esto puede romper el ingreso de un alumno ni la campanita.
 */

const faltaLaTabla = (e: unknown) => ['42P01', '42703'].includes((e as { code?: string })?.code ?? '')
const DIAS_A_LA_VISTA = 14

export interface AvisoParaGuardar {
  userId: string
  tipo: TipoDeAviso
  clave: string
  titulo: string
  detalle: string
  href: string
}

/** Guarda el aviso; si ya estaba (misma clave), no hace nada. Devuelve si lo guardó. Nunca lanza. */
export async function guardarAviso(a: AvisoParaGuardar): Promise<boolean> {
  try {
    const filas = (await sql`
      INSERT INTO avisos_guardados (user_id, tipo, clave, titulo, detalle, href)
      VALUES (${a.userId}, ${a.tipo}, ${a.clave}, ${a.titulo}, ${a.detalle}, ${a.href})
      ON CONFLICT (user_id, clave) DO NOTHING
      RETURNING id
    `) as unknown[]
    return filas.length > 0
  } catch (error) {
    if (!faltaLaTabla(error)) captureRouteFailure(error, { endpoint: 'lib/avisos-guardados-server', operation: 'guardarAviso' })
    return false
  }
}

/** El día de hoy en Argentina, AAAA-MM-DD: la clave de los avisos que van una vez por día. */
export function diaArgentino(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * AC1 · Un alumno nuevo quiso entrar por el link de un docente particular que
 * ya tiene su cupo gratis: el docente recibe el muro (AB6) en la campanita,
 * con la evidencia. Uno por día, aunque lo intenten varios.
 */
export async function avisarMuroAlDocente(teacherId: string, ahora: Date = new Date()): Promise<void> {
  try {
    const evidencia = await leerEvidencia(teacherId).catch(() => null)
    await guardarAviso({
      userId: teacherId,
      tipo: 'muroDelPlan',
      clave: `muro|${diaArgentino(ahora)}`,
      titulo: T.muro.titulo,
      detalle: T.muro.detalle(fraseDeEvidencia(evidencia, ahora, cupoGratis())),
      href: '/teacher?muro=1',
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: 'lib/avisos-guardados-server', operation: 'avisarMuroAlDocente' })
  }
}

/** Los avisos guardados de las últimas dos semanas, con el estilo de su tipo. Sin la 050, ninguno. */
export async function avisosGuardadosDe(userId: string, lectura: Lectura): Promise<Aviso[]> {
  try {
    const filas = (await sql`
      SELECT tipo, clave, titulo, detalle, href, creado_el
      FROM avisos_guardados
      WHERE user_id = ${userId} AND creado_el > NOW() - make_interval(days => ${DIAS_A_LA_VISTA})
      ORDER BY creado_el DESC
    `) as { tipo: string; clave: string; titulo: string; detalle: string; href: string; creado_el: string | Date }[]
    return filas
      .filter((f) => f.tipo in ESTILO_DEL_AVISO)
      .map(
        (f) =>
          crearAviso(
            f.tipo as TipoDeAviso,
            { clave: `guardado|${f.clave}`, titulo: f.titulo, detalle: f.detalle, href: f.href, fecha: new Date(f.creado_el).toISOString() },
            lectura,
          ) as Aviso,
      )
  } catch (error) {
    if (!faltaLaTabla(error)) captureRouteFailure(error, { endpoint: 'lib/avisos-guardados-server', operation: 'avisosGuardadosDe' })
    return []
  }
}
