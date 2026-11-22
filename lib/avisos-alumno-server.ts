import { sql } from '@/lib/db'
import { armarAvisosDelAlumno, HORAS_VENCE_PRONTO, VENTANA_DIAS, type FilaDeAvisoAlumno } from '@/lib/avisos-alumno'
import { leerLectura, marcarTodoLeido } from '@/lib/avisos/lectura-server'
import type { RespuestaDeAvisos } from '@/lib/avisos/tipos'
import { destinatarioDeFila, visibleParaAlumno } from '@/lib/destinatario'

/**
 * P3 · Los avisos del alumno (con cuenta o invitado), de lo que ya está en la
 * base. TODAS las consultas filtran por el id del viewer (nunca por algo que
 * mande el cliente): las tareas, sólo de grupos donde es miembro activo y
 * visibles para él (las individuales de otro no); los reportes, sólo los
 * suyos; los temas y la racha, sólo los suyos.
 *
 * Cada fuente se resuelve por su lado y con su válvula: sin la 028 todo es del
 * grupo; sin la 029/030 no hay reportes resueltos; sin la 031 no hay temas
 * superados; sin la 032 no hay racha. Ninguna tumba la campanita.
 */
const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null)
const faltaAlgo = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

async function conValvula<T>(consulta: () => Promise<T[]>): Promise<T[]> {
  try {
    return await consulta()
  } catch (error) {
    if (faltaAlgo(error)) return []
    throw error
  }
}

interface FilaDeAsignacion {
  id: number
  grupo: string
  tarea: string
  tipo: string | null
  diagnostico_id: string | null
  teacher_quiz_id: number
  creada: string | Date
  opens_at: string | Date | null
  due_at: string | Date | null
  intentos: number
  solo_user_id: string | null
  solo_invitacion_id: string | null
}

async function tareas(userId: string): Promise<FilaDeAvisoAlumno[]> {
  const filas = (await sql`
    SELECT a.id, c.name AS grupo, q.title AS tarea, a.teacher_quiz_id, a.created_at AS creada, a.opens_at, a.due_at,
      to_jsonb(q) ->> 'tipo' AS tipo,
      to_jsonb(q) ->> 'diagnostico_id' AS diagnostico_id,
      to_jsonb(a) ->> 'solo_user_id' AS solo_user_id,
      to_jsonb(a) ->> 'solo_invitacion_id' AS solo_invitacion_id,
      (SELECT COUNT(*) FROM quiz_attempts t WHERE t.assignment_id = a.id AND t.user_id = ${userId})::int AS intentos
    FROM classroom_members m
    JOIN classrooms c ON c.id = m.classroom_id AND c.status = 'open'
    JOIN classroom_assignments a ON a.classroom_id = c.id
    JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
    WHERE m.user_id = ${userId}
      AND m.status = 'active'
      AND (a.opens_at IS NULL OR a.opens_at <= NOW())
      AND (
        GREATEST(a.created_at, COALESCE(a.opens_at, a.created_at)) > NOW() - make_interval(days => ${VENTANA_DIAS})
        OR a.due_at BETWEEN NOW() AND NOW() + make_interval(hours => ${HORAS_VENCE_PRONTO})
      )
  `) as FilaDeAsignacion[]

  const visibles = filas.filter((f) => visibleParaAlumno(destinatarioDeFila(f as unknown as Record<string, unknown>), userId))
  const salida: FilaDeAvisoAlumno[] = []
  const diagnosticos = new Map<number, FilaDeAsignacion[]>()

  for (const f of visibles) {
    const creada = iso(f.creada)!
    const disponibleDesde = iso(f.opens_at) && iso(f.opens_at)! > creada ? iso(f.opens_at)! : creada
    if (f.tipo === 'diagnostico' && f.diagnostico_id) {
      const id = Number(f.diagnostico_id)
      diagnosticos.set(id, [...(diagnosticos.get(id) ?? []), f])
      continue
    }
    salida.push({ tipo: 'tareaNueva', asignacionId: Number(f.id), grupo: f.grupo, tarea: f.tarea, disponibleDesde })
    if (f.due_at && Number(f.intentos) === 0) {
      salida.push({ tipo: 'vencePronto', asignacionId: Number(f.id), grupo: f.grupo, tarea: f.tarea, venceEl: iso(f.due_at)!, creadaEl: creada })
    }
  }

  for (const [diagnosticoId, partes] of diagnosticos) {
    const ordenadas = [...partes].sort((a, b) => Number(a.teacher_quiz_id) - Number(b.teacher_quiz_id))
    salida.push({
      tipo: 'diagnosticoNuevo',
      diagnosticoId,
      primeraAsignacionId: Number(ordenadas[0].id),
      grupo: ordenadas[0].grupo,
      cuestionarios: ordenadas.length,
      creadoEl: ordenadas.map((p) => iso(p.creada)!).sort()[0],
    })
  }
  // "Tarea nueva" sólo dentro de la ventana; lo que entró por vencer pronto ya está arriba.
  const corte = Date.now() - VENTANA_DIAS * 86_400_000
  return salida.filter((f) =>
    f.tipo === 'tareaNueva' ? new Date(f.disponibleDesde).getTime() > corte : f.tipo === 'diagnosticoNuevo' ? new Date(f.creadoEl).getTime() > corte : true,
  )
}

async function reportesResueltos(userId: string): Promise<FilaDeAvisoAlumno[]> {
  const filas = (await sql`
    SELECT id, respondido_por, respuesta, resuelto_el
    FROM feedback_reports
    WHERE user_id = ${userId}
      AND status = 'resuelto'
      AND resuelto_el > NOW() - make_interval(days => ${VENTANA_DIAS})
  `) as { id: number; respondido_por: string | null; respuesta: string | null; resuelto_el: string | Date }[]
  return filas.map((f) => ({
    tipo: 'reporteResuelto' as const,
    reporteId: Number(f.id),
    respondidoPor: f.respondido_por,
    conMensaje: Boolean(f.respuesta?.trim()),
    resueltoEl: iso(f.resuelto_el)!,
  }))
}

async function temasSuperados(userId: string): Promise<FilaDeAvisoAlumno[]> {
  const filas = (await sql`
    SELECT id, topic_name, resolved_by, resolved_at
    FROM student_misconceptions
    WHERE user_id = ${userId}
      AND resolved = TRUE
      AND resolved_at > NOW() - make_interval(days => ${VENTANA_DIAS})
  `) as { id: number; topic_name: string; resolved_by: string | null; resolved_at: string | Date }[]
  return filas.map((f) => ({
    tipo: 'temaSuperado' as const,
    misconceptionId: Number(f.id),
    tema: f.topic_name,
    porDocente: Boolean(f.resolved_by) && f.resolved_by !== 'auto',
    superadoEl: iso(f.resolved_at)!,
  }))
}

async function racha(userId: string): Promise<FilaDeAvisoAlumno[]> {
  const filas = (await sql`
    SELECT r.racha, (SELECT MAX(t.completed_at) FROM quiz_attempts t WHERE t.user_id = ${userId}) AS ultima
    FROM rachas_alumno r
    WHERE r.user_id = ${userId}
  `) as { racha: number; ultima: string | Date | null }[]
  return filas.map((f) => ({ tipo: 'racha' as const, racha: Number(f.racha), ultimaPractica: iso(f.ultima) }))
}

export async function avisosDelAlumno(userId: string, { esInvitado }: { esInvitado: boolean }, ahora = new Date()): Promise<RespuestaDeAvisos> {
  const [lectura, ...fuentes] = await Promise.all([
    leerLectura(userId, { esDocente: false }),
    conValvula(() => tareas(userId)),
    conValvula(() => reportesResueltos(userId)),
    conValvula(() => temasSuperados(userId)),
    conValvula(() => racha(userId)),
  ])
  return {
    avisos: armarAvisosDelAlumno(fuentes.flat(), lectura, ahora, { esInvitado }),
    vistoEl: lectura.vistoEl,
    puedeMarcar: lectura.puedeMarcar,
  }
}

export async function marcarAvisosDelAlumnoLeidos(userId: string): Promise<void> {
  await marcarTodoLeido(userId, { esDocente: false })
}
