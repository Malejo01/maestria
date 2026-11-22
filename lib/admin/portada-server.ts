import { sql } from '@/lib/db'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import { embudoDeDocentes } from '@/lib/embudo-server'
import { contarNuevos } from '@/lib/reportes-server'
import { resumirPlanes, type PlanCrudo, type ResumenDePlanes } from '@/lib/admin/portada'

/**
 * P1 · Los números de la portada de /admin. Cada número es UN viaje a la base,
 * de las tablas que ya existen, y cada uno se resuelve por su lado: si una
 * consulta falla (una migración que no corrió, la base lenta), ese número sale
 * como "—" y los demás se muestran igual. La portada nunca se cae por un dato.
 *
 * "Hoy" es el día de Argentina, calculado por Postgres: la app se usa ahí y el
 * servidor de Vercel corre en UTC (a las 22 h de Buenos Aires ya es mañana).
 */

export interface NumerosDeHoy {
  docentesActivos: number | null
  alumnosQueRespondieron: number | null
  intentos: number | null
  reportesNuevos: number | null
}

export interface TarjetasDeAdmin {
  reportesNuevos: number | null
  trabados: number | null
  ia: { gastoDelMesUsd: number; llamadasDeHoy: number } | null
  planes: ResumenDePlanes | null
  docentes: number | null
}

async function sinRomper<T>(consulta: () => Promise<T>): Promise<T | null> {
  try {
    return await consulta()
  } catch (error) {
    console.error('[admin/portada]', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Docentes que hoy generaron con la IA, guardaron un cuestionario, mandaron una
 * tarea, o a quienes un alumno les terminó una tarea. No hay registro de
 * ingresos: "activo" es "dejó rastro en las tablas".
 */
async function docentesActivosHoy(): Promise<number> {
  const filas = (await sql`
    WITH hoy AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS desde
    ),
    rastro AS (
      SELECT l.user_id AS id FROM ai_usage_log l, hoy WHERE l.created_at >= hoy.desde
      UNION SELECT q.user_id FROM teacher_quizzes q, hoy WHERE q.updated_at >= hoy.desde
      UNION SELECT c.teacher_id FROM classroom_assignments a JOIN classrooms c ON c.id = a.classroom_id, hoy WHERE a.created_at >= hoy.desde
      UNION SELECT c.teacher_id FROM quiz_attempts att JOIN classrooms c ON c.id = att.classroom_id, hoy WHERE att.completed_at >= hoy.desde
    )
    SELECT COUNT(*)::int AS n
    FROM rastro r JOIN users u ON u.id = r.id
    WHERE u.role = 'DOCENTE' AND COALESCE(u.is_guest, false) = false
  `) as { n: number }[]
  return Number(filas[0]?.n ?? 0)
}

/** Alumnos (cuentas o invitados, no docentes) con un intento terminado hoy, y cuántos intentos hubo. */
async function intentosDeHoy(): Promise<{ alumnos: number; intentos: number }> {
  const filas = (await sql`
    WITH hoy AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS desde
    )
    SELECT COUNT(DISTINCT att.user_id) FILTER (WHERE COALESCE(u.role, 'ALUMNO') <> 'DOCENTE')::int AS alumnos,
           COUNT(*)::int AS intentos
    FROM quiz_attempts att
    JOIN users u ON u.id = att.user_id, hoy
    WHERE att.completed_at >= hoy.desde
  `) as { alumnos: number; intentos: number }[]
  return { alumnos: Number(filas[0]?.alumnos ?? 0), intentos: Number(filas[0]?.intentos ?? 0) }
}

async function usoDeIA(): Promise<{ gastoDelMesUsd: number; llamadasDeHoy: number }> {
  const filas = (await sql`
    WITH ahora AS (SELECT NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' AS local)
    SELECT
      COALESCE(SUM(estimated_cost_usd) FILTER (
        WHERE created_at >= date_trunc('month', ahora.local) AT TIME ZONE 'America/Argentina/Buenos_Aires'
      ), 0)::float8 AS mes,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('day', ahora.local) AT TIME ZONE 'America/Argentina/Buenos_Aires'
      )::int AS hoy
    FROM ai_usage_log, ahora
    WHERE created_at > NOW() - INTERVAL '32 days'
  `) as { mes: number; hoy: number }[]
  return { gastoDelMesUsd: Number(filas[0]?.mes ?? 0), llamadasDeHoy: Number(filas[0]?.hoy ?? 0) }
}

/**
 * Los planes de todos los docentes en un viaje. `to_jsonb(u)` lee las columnas
 * de la 026 sin nombrarlas: si no corrió, vienen null y todos quedan exentos
 * (la válvula de lib/planes.ts), en vez de romper la consulta.
 */
export async function planesCrudos(): Promise<(PlanCrudo & { id: string })[]> {
  const filas = (await sql`
    SELECT u.id, u.email,
      to_jsonb(u) ->> 'plan_nivel' AS plan_nivel,
      to_jsonb(u) ->> 'plan_vence_el' AS plan_vence_el,
      to_jsonb(u) ->> 'prueba_iniciada_el' AS prueba_iniciada_el,
      (SELECT COUNT(DISTINCT m.user_id) FROM classroom_members m JOIN classrooms c ON c.id = m.classroom_id
        WHERE c.teacher_id = u.id AND m.status = 'active' AND m.user_id <> u.id)::int AS alumnos
    FROM users u
    WHERE u.role = 'DOCENTE' AND COALESCE(u.is_guest, false) = false
  `) as { id: string; email: string | null; plan_nivel: string | null; plan_vence_el: string | null; prueba_iniciada_el: string | null; alumnos: number }[]
  return filas.map((f) => ({
    id: String(f.id),
    email: f.email,
    nivel: f.plan_nivel === null ? null : Number(f.plan_nivel),
    venceEl: f.plan_vence_el,
    pruebaIniciadaEl: f.prueba_iniciada_el,
    alumnos: Number(f.alumnos ?? 0),
  }))
}

export async function leerPortada(ahora = new Date()): Promise<{ hoy: NumerosDeHoy; tarjetas: TarjetasDeAdmin }> {
  const [activos, intentos, nuevos, embudo, ia, planes] = await Promise.all([
    sinRomper(docentesActivosHoy),
    sinRomper(intentosDeHoy),
    sinRomper(contarNuevos),
    sinRomper(() => embudoDeDocentes(ahora)),
    sinRomper(usoDeIA),
    sinRomper(planesCrudos),
  ])
  return {
    hoy: {
      docentesActivos: activos,
      alumnosQueRespondieron: intentos?.alumnos ?? null,
      intentos: intentos?.intentos ?? null,
      reportesNuevos: nuevos,
    },
    tarjetas: {
      reportesNuevos: nuevos,
      trabados: embudo ? embudo.filter((d) => d.trabado).length : null,
      ia,
      planes: planes ? resumirPlanes(planes, isAdminEmail, ahora) : null,
      docentes: planes ? planes.length : null,
    },
  }
}
