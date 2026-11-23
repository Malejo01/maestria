import { createHash, randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { leerFichaAlumno } from '@/lib/alumnos-docente-server'
import { armarInforme, DIAS_DEL_LINK, limpiarProximosPasos, linkVigente, tokenConForma, type InformeParaLaFamilia } from '@/lib/informe-familia'

/**
 * Ronda V · V4 — Los links del informe para la familia. El token sale de 32
 * bytes al azar y nunca se guarda: se guarda su SHA-256. Sin la 047, nada
 * (el botón no aparece y el link "no existe").
 */
const faltaLaMigracion = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')
const hashDelToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function informesDisponibles(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM informes_compartidos LIMIT 0`
    return true
  } catch (error) {
    if (faltaLaMigracion(error)) return false
    throw error
  }
}

export interface LinkDeInforme {
  id: number
  creadoEl: string
  venceEl: string
  vistoEl: string | null
  proximosPasos: string
}

/** Los links vigentes del docente para ese alumno. */
export async function linksDelAlumno(teacherId: string, alumnoId: string, ahora = new Date()): Promise<LinkDeInforme[]> {
  const filas = (await sql`
    SELECT id, creado_el, vence_el, revocado_el, visto_el, proximos_pasos FROM informes_compartidos
    WHERE teacher_id = ${teacherId} AND alumno_id = ${alumnoId}
    ORDER BY creado_el DESC
  `) as { id: number; creado_el: string; vence_el: string; revocado_el: string | null; visto_el: string | null; proximos_pasos: string }[]
  return filas
    .filter((f) => linkVigente({ venceEl: f.vence_el, revocadoEl: f.revocado_el }, ahora))
    .map((f) => ({
      id: Number(f.id),
      creadoEl: new Date(f.creado_el).toISOString(),
      venceEl: new Date(f.vence_el).toISOString(),
      vistoEl: f.visto_el ? new Date(f.visto_el).toISOString() : null,
      proximosPasos: f.proximos_pasos,
    }))
}

/**
 * Crea un link para ese alumno (sólo si es alumno de este docente). Devuelve
 * el token una sola vez: después no se puede recuperar, sólo revocar.
 */
export async function crearLinkDeInforme(
  teacherId: string,
  alumnoId: string,
  proximosPasos: string,
  ahora = new Date(),
): Promise<{ token: string; venceEl: string } | null> {
  const ficha = await leerFichaAlumno(teacherId, alumnoId)
  if (!ficha) return null
  const token = randomBytes(32).toString('base64url')
  const venceEl = new Date(ahora.getTime() + DIAS_DEL_LINK * 86_400_000).toISOString()
  await sql`
    INSERT INTO informes_compartidos (token_hash, teacher_id, alumno_id, proximos_pasos, vence_el)
    VALUES (${hashDelToken(token)}, ${teacherId}, ${alumnoId}, ${limpiarProximosPasos(proximosPasos)}, ${venceEl})
  `
  return { token, venceEl }
}

/** Revoca un link del docente. false si no era suyo. */
export async function revocarLinkDeInforme(teacherId: string, id: number): Promise<boolean> {
  const filas = (await sql`
    UPDATE informes_compartidos SET revocado_el = NOW() WHERE id = ${id} AND teacher_id = ${teacherId} AND revocado_el IS NULL RETURNING id
  `) as unknown[]
  return filas.length > 0
}

/**
 * Lo que ve quien abre el link: el informe de hoy (se arma en el momento) o
 * null si no existe, venció o se revocó. Anota la primera vez que se vio.
 */
export async function leerInformePublico(token: unknown, ahora = new Date()): Promise<(InformeParaLaFamilia & { venceEl: string }) | null> {
  if (!tokenConForma(token)) return null
  try {
    const [f] = (await sql`
      SELECT id, teacher_id, alumno_id, proximos_pasos, vence_el, revocado_el, visto_el FROM informes_compartidos WHERE token_hash = ${hashDelToken(token)}
    `) as { id: number; teacher_id: string; alumno_id: string; proximos_pasos: string; vence_el: string; revocado_el: string | null; visto_el: string | null }[]
    if (!f || !linkVigente({ venceEl: f.vence_el, revocadoEl: f.revocado_el }, ahora)) return null
    const ficha = await leerFichaAlumno(f.teacher_id, f.alumno_id)
    if (!ficha) return null
    if (!f.visto_el) await sql`UPDATE informes_compartidos SET visto_el = NOW() WHERE id = ${f.id}`
    const informe = armarInforme(
      { nombre: ficha.nombre, materias: ficha.materias.map((m) => m.nombre), temas: ficha.temas, intentos: ficha.intentos },
      f.proximos_pasos,
      ahora,
    )
    return { ...informe, venceEl: new Date(f.vence_el).toISOString() }
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}
