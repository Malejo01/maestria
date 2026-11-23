import { premiosRecientes } from '@/lib/referidos-server'
import { sql } from '@/lib/db'
import { armarAvisos, type FilaDeAviso } from '@/lib/avisos-docente'
import { leerLectura, marcarTodoLeido } from '@/lib/avisos/lectura-server'
import { crearAviso, type RespuestaDeAvisos } from '@/lib/avisos/tipos'
import { pagosAcreditadosDe } from '@/lib/pagos-server'
import { PAGAR, REFERIDOS } from '@/lib/textos'

/**
 * O10 · Los avisos del docente, de lo que ya está en la base, de las últimas
 * dos semanas: intentos terminados por tarea y por día (alumnos distintos),
 * alumnos nuevos por grupo y por día, y reportes (M6) de sus grupos o sus
 * cuestionarios. Los días van en hora de Argentina.
 *
 * Lo leído sale de `avisos_lectura` (035) y, sin ella, de la columna de la
 * 034 (lib/avisos/lectura-server.ts); sin ninguna de las dos, los avisos se
 * listan sin "no leídos". Sin la 029 los reportes no saben de qué grupo son:
 * no se listan.
 */
const DIAS = 14

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : '')
const faltaColumna = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

async function reportes(docenteId: string): Promise<FilaDeAviso[]> {
  try {
    const filas = (await sql`
      SELECT f.classroom_id AS grupo_id, c.name AS grupo,
             to_char((f.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS dia,
             COUNT(*)::int AS n, MAX(f.created_at) AS ultimo
      FROM feedback_reports f
      LEFT JOIN classrooms c ON c.id = f.classroom_id
      LEFT JOIN teacher_quizzes q ON q.id = f.teacher_quiz_id
      WHERE f.created_at > NOW() - make_interval(days => ${DIAS})
        AND (c.teacher_id = ${docenteId} OR q.user_id = ${docenteId})
      GROUP BY f.classroom_id, c.name, dia
    `) as { grupo_id: number | null; grupo: string | null; dia: string; n: number; ultimo: string | Date }[]
    return filas.map((f) => ({
      tipo: 'reporte' as const,
      grupoId: f.grupo_id === null ? null : Number(f.grupo_id),
      grupo: f.grupo,
      dia: f.dia,
      reportes: Number(f.n),
      ultimo: iso(f.ultimo),
    }))
  } catch (error) {
    if (faltaColumna(error)) return []
    throw error
  }
}

export async function avisosDelDocente(docenteId: string): Promise<RespuestaDeAvisos> {
  const [leida, tareas, nuevos, reportados, pagos, premios] = await Promise.all([
    leerLectura(docenteId, { esDocente: true }),
    sql`
      SELECT c.id AS grupo_id, c.name AS grupo, q.title AS tarea,
             to_char((att.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS dia,
             COUNT(DISTINCT att.user_id)::int AS alumnos, MAX(att.completed_at) AS ultimo
      FROM quiz_attempts att
      JOIN classroom_assignments a ON a.id = att.assignment_id
      JOIN classrooms c ON c.id = a.classroom_id AND c.teacher_id = ${docenteId} AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      WHERE att.completed_at > NOW() - make_interval(days => ${DIAS})
        AND att.user_id <> ${docenteId}
      GROUP BY c.id, c.name, q.title, dia
    ` as unknown as Promise<{ grupo_id: number; grupo: string; tarea: string; dia: string; alumnos: number; ultimo: string | Date }[]>,
    sql`
      SELECT c.id AS grupo_id, c.name AS grupo,
             to_char((m.joined_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS dia,
             COUNT(*)::int AS alumnos, MAX(m.joined_at) AS ultimo
      FROM classroom_members m
      JOIN classrooms c ON c.id = m.classroom_id AND c.teacher_id = ${docenteId} AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      WHERE m.status = 'active' AND m.joined_at > NOW() - make_interval(days => ${DIAS})
      GROUP BY c.id, c.name, dia
    ` as unknown as Promise<{ grupo_id: number; grupo: string; dia: string; alumnos: number; ultimo: string | Date }[]>,
    reportes(docenteId),
    // C2: los pagos acreditados (sin la 039, ninguno).
    pagosAcreditadosDe(docenteId).catch(() => []),
    // V3: los premios por referidos (apagado o sin la 046, ninguno).
    premiosRecientes(docenteId).catch(() => []),
  ])

  const filas: FilaDeAviso[] = [
    ...tareas.map((f) => ({ tipo: 'tarea' as const, grupoId: Number(f.grupo_id), grupo: f.grupo, tarea: f.tarea, dia: f.dia, alumnos: Number(f.alumnos), ultimo: iso(f.ultimo) })),
    ...nuevos.map((f) => ({ tipo: 'nuevos' as const, grupoId: Number(f.grupo_id), grupo: f.grupo, dia: f.dia, alumnos: Number(f.alumnos), ultimo: iso(f.ultimo) })),
    ...reportados,
  ]
  const deLosPagos = pagos.map((p) =>
    crearAviso(
      'pagoAcreditado',
      { clave: `pago-${p.id}`, titulo: PAGAR.aviso.titulo, detalle: PAGAR.aviso.detalle(p.descripcion), href: `/precios/gracias?pago=${p.id}`, fecha: p.acreditadoEl },
      leida,
    ),
  )
  const deLosReferidos = premios.map((p) =>
    crearAviso(
      'referidoPremio',
      { clave: `referido-${p.id}`, titulo: REFERIDOS.aviso.titulo, detalle: REFERIDOS.aviso.detalle, href: '/teacher', fecha: p.premiadoEl },
      leida,
    ),
  )
  const avisos = [...armarAvisos(filas, leida), ...deLosPagos, ...deLosReferidos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  return { avisos, vistoEl: leida.vistoEl, puedeMarcar: leida.puedeMarcar }
}

/** "Marcar todo como leído". Desde la 035, en `avisos_lectura`; sin ella, en la columna de la 034. */
export async function marcarAvisosVistos(docenteId: string): Promise<void> {
  await marcarTodoLeido(docenteId, { esDocente: true })
}
