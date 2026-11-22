import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import { contarAlumnosDelDocente } from '@/lib/alumnos-docente-server'
import { normalizarNombre } from '@/lib/alumnos-docente'
import { captureRouteFailure } from '@/lib/observability'
import { lugaresDelDocente } from '@/lib/alumnos-docente-server'
import {
  alumnosMaximosPorCurso,
  cuestionariosDelMes,
  cursoTieneLugar,
  practicasExtraPorAlumnoMes,
  puedeCrearCurso,
  cupoDeCursosAula,
  permiteImprimirYMoodle,
  permiteIndividual,
  tipoDePlan,
  type LugaresPorTipo,
  type TipoDePlan,
  DIAS_PRUEBA,
  DIAS_VENTANA_GRATIS,
  cuerpoDeBloqueo,
  cuestionariosGratisPorMes,
  cupoGratis,
  cupoVigente,
  diasRestantes,
  esDocenteNuevo,
  estadoDelPlan,
  normalizarNivel,
  puedeGenerar,
  puedeSumarAlumno,
  terminoElPeriodo,
  venceElEfectivo,
  type DatosDelPlan,
  type EstadoPlan,
  type NivelPlan,
  type ResumenDelPlan,
} from '@/lib/planes'

/**
 * La lectura y la escritura del plan del docente. Las decisiones viven en
 * lib/planes.ts; acá sólo se buscan los datos y se arman las respuestas.
 *
 * Cada lectura respeta la válvula: si la consulta falla —la 026 no corrió, la
 * base no responde— el docente es `exento`. Se avisa a Sentry, pero el docente
 * no se entera: el producto no se cierra por un dato que falta.
 */

type Fila = Record<string, unknown>

interface PlanLeido {
  datos: DatosDelPlan
  /** false si las columnas de la 026 no existen (o la consulta falló). */
  columnasPresentes: boolean
  /** `users.created_at`, para el texto del aviso de bienvenida (H3). */
  creadoEl: unknown
  /** B2: `users.fundadora_desde` (null sin la 037). */
  fundadoraDesde: unknown
}

/**
 * B1 · Las columnas de la 037, con su válvula: si no existen (42703), todo
 * sigue como antes de la ronda T (particular, sin cursos Aula, sin marca).
 */
async function leerFilaDelPlan(userId: string): Promise<Fila | undefined> {
  try {
    const filas = (await sql`
      SELECT plan_nivel, plan_vence_el, prueba_iniciada_el, created_at, plan_tipo, aula_cursos, fundadora_desde
      FROM users WHERE id = ${userId} LIMIT 1
    `) as Fila[]
    return filas[0]
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703') throw error
    const filas = (await sql`
      SELECT plan_nivel, plan_vence_el, prueba_iniciada_el, created_at FROM users WHERE id = ${userId} LIMIT 1
    `) as Fila[]
    return filas[0]
  }
}

/**
 * Lee el plan. Los alumnos se cuentan sólo cuando deciden algo —la prueba o el
 * plan ya terminaron, y entonces es gratis o solo lectura— o cuando quien
 * llama los necesita igual (`contarSiempre`): así generar con un plan vigente
 * sigue siendo una sola consulta.
 */
async function leerPlan(
  userId: string,
  email: string | null,
  ahora: Date,
  { contarSiempre = false }: { contarSiempre?: boolean } = {},
): Promise<PlanLeido> {
  const esExento = isAdminEmail(email)
  const vacio: PlanLeido = {
    datos: { nivel: undefined, venceEl: null, pruebaIniciadaEl: null, esExento, ahora, alumnosActuales: 0 },
    columnasPresentes: false,
    creadoEl: null,
    fundadoraDesde: null,
  }
  if (esExento) return vacio
  try {
    const fila = await leerFilaDelPlan(userId)
    if (!fila) return vacio
    const datos: DatosDelPlan = {
      nivel: fila.plan_nivel,
      venceEl: fila.plan_vence_el as string | null,
      pruebaIniciadaEl: fila.prueba_iniciada_el as string | null,
      esExento,
      ahora,
      alumnosActuales: 0,
      tipo: fila.plan_tipo,
      aulaCursos: fila.aula_cursos,
    }
    if (normalizarNivel(datos.nivel) !== null && (contarSiempre || terminoElPeriodo(datos))) {
      const lugares = await lugaresSinRomper(userId)
      datos.alumnosActuales = lugares.total
      // B1: el gratis se decide por tipo de lugar (2 particulares + 1 curso).
      if (lugares.porTipo) datos.lugares = lugares.porTipo
    }
    return { datos, columnasPresentes: true, creadoEl: fila.created_at, fundadoraDesde: fila.fundadora_desde ?? null }
  } catch (error) {
    // 42703 = columna inexistente: la 026 todavía no corrió en esta base. Es
    // el estado esperado hasta que Mauro la corra, no un incidente.
    if ((error as { code?: string })?.code !== '42703') {
      captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'leerPlan' })
    }
    return vacio
  }
}

/** Todo lo que la UI necesita del plan del docente, alumnos contados incluidos. */
export async function resumenDelPlan(
  teacherId: string,
  email: string | null,
  ahora: Date = new Date(),
): Promise<ResumenDelPlan> {
  const { datos, columnasPresentes, creadoEl, fundadoraDesde } = await leerPlan(teacherId, email, ahora, { contarSiempre: true })
  const estado = estadoDelPlan(datos)
  const tope = cuestionariosDelMes(tipoDePlan(datos.tipo), estado)
  const cuestionarios = tope !== null ? await contarCuestionariosEnVentana(teacherId) : null
  return armarResumen(datos, estado, cuestionarios, columnasPresentes, creadoEl, fundadoraDesde)
}

function armarResumen(
  datos: DatosDelPlan,
  estado: EstadoPlan,
  cuestionarios: number | null,
  columnasPresentes: boolean,
  creadoEl: unknown,
  fundadoraDesde: unknown = null,
): ResumenDelPlan {
  // Exento no cuenta nada: ni consume ni se muestra.
  const exento = estado === 'exento'
  const nivel = exento ? null : normalizarNivel(datos.nivel)
  // El gratis no vence: no se muestra la fecha en que terminó lo anterior.
  const vence = exento || estado === 'gratis' ? null : venceElEfectivo(datos)
  return {
    estado,
    nivel,
    cupo: cupoVigente(estado, nivel, process.env, { tipo: datos.tipo, cursos: datos.aulaCursos }),
    alumnos: exento ? 0 : datos.alumnosActuales,
    venceEl: vence ? vence.toISOString() : null,
    diasRestantes: diasRestantes(datos),
    avisoDePruebaPendiente:
      columnasPresentes && estado === 'prueba' && nivel === 0 && !datos.pruebaIniciadaEl && !datos.venceEl,
    cupoGratis: cupoGratis(),
    topeCuestionarios: cuestionariosDelMes(tipoDePlan(datos.tipo), estado) ?? cuestionariosGratisPorMes(),
    cuestionarios,
    docenteNuevo: esDocenteNuevo(creadoEl as string | Date | null | undefined),
    tipo: tipoDePlan(datos.tipo),
    aulaCursos: cupoDeCursosAula(datos.aulaCursos),
    alumnosPorCurso: alumnosMaximosPorCurso(),
    permiteIndividual: permiteIndividual(tipoDePlan(datos.tipo), estado),
    permiteImprimirYMoodle: permiteImprimirYMoodle(estado),
    fundadoraDesde: fechaIso(fundadoraDesde),
  }
}

function fechaIso(valor: unknown): string | null {
  if (!valor) return null
  const fecha = valor instanceof Date ? valor : new Date(String(valor))
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString()
}

/**
 * Cuestionarios generados en los últimos 30 días corridos: las filas de
 * `ai_usage_log` del bucket `quiz_generation` (generar un cuestionario y
 * regenerar una pregunta) de ese usuario. No cuentan las que terminaron en
 * 'error': una falla del modelo no le come el tope al docente. Si la consulta
 * falla, cero: la válvula, también acá.
 */
async function contarCuestionariosEnVentana(userId: string): Promise<number> {
  try {
    const filas = (await sql`
      SELECT COUNT(*)::int AS total
      FROM ai_usage_log
      WHERE user_id = ${userId}
        AND endpoint = 'quiz_generation'
        AND status <> 'error'
        AND created_at > NOW() - make_interval(days => ${DIAS_VENTANA_GRATIS})
    `) as Fila[]
    return Number(filas[0]?.total ?? 0)
  } catch (error) {
    captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'contarCuestionarios' })
    return 0
  }
}

async function contarAlumnosSinRomper(teacherId: string): Promise<number> {
  try {
    return await contarAlumnosDelDocente(teacherId)
  } catch (error) {
    captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'contarAlumnos' })
    return 0
  }
}

/** B1 · Los lugares, en total y por tipo. Si algo falla, el total de siempre y sin tipos (regla de antes). */
async function lugaresSinRomper(teacherId: string): Promise<{ total: number; porTipo: LugaresPorTipo | null }> {
  try {
    return await lugaresDelDocente(teacherId)
  } catch (error) {
    captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'lugaresPorTipo' })
    return { total: await contarAlumnosSinRomper(teacherId), porTipo: null }
  }
}

/**
 * Para los endpoints que generan, crean materias o crean grupos: null si puede
 * seguir, o el 402 que la UI sabe leer. `cuestionario: true` cuando lo que se
 * pide es generar un cuestionario o regenerar una pregunta: en el plan gratis
 * eso consume el tope de cuestionarios; crear una materia o un grupo, no.
 */
export async function bloqueoParaGenerar(
  teacherId: string,
  email: string | null,
  extra: Record<string, unknown> = {},
  { cuestionario = false }: { cuestionario?: boolean } = {},
): Promise<NextResponse | null> {
  const { datos } = await leerPlan(teacherId, email, new Date())
  const estado = estadoDelPlan(datos)
  const tope = cuestionariosDelMes(tipoDePlan(datos.tipo), estado)
  const cuestionarios = tope !== null && cuestionario ? await contarCuestionariosEnVentana(teacherId) : undefined
  // B1: en el Aula, el tope es de 60; en el gratis, el de siempre (puedeGenerar).
  const pasaElTopeAula = !(estado === 'activo' && tope !== null && cuestionarios !== undefined && cuestionarios >= tope)
  if (puedeGenerar(estado, cuestionarios) && pasaElTopeAula) return null
  const resumen = await resumenDelPlan(teacherId, email)
  const motivo = estado === 'vencido' ? 'vencido' : 'tope_cuestionarios'
  return NextResponse.json({ ...extra, ...cuerpoDeBloqueo(resumen, motivo) }, { status: 402 })
}

/**
 * Para sumar UN alumno particular (con invitación): null si hay lugar, o el
 * 402 (vencido, sin cupo, o B1: "con el plan Particular" en el Aula). En el
 * gratis cuentan sólo los particulares (los del curso no ocupan esos 2).
 */
export async function bloqueoParaSumarAlumno(teacherId: string, email: string | null): Promise<NextResponse | null> {
  const { datos } = await leerPlan(teacherId, email, new Date(), { contarSiempre: true })
  const estado = estadoDelPlan(datos)
  if (estado === 'exento') return null
  const resumen = await resumenDelPlan(teacherId, email)
  if (!resumen.permiteIndividual) return NextResponse.json(cuerpoDeBloqueo(resumen, 'solo_particular'), { status: 402 })
  const ocupados = estado === 'gratis' && datos.lugares ? datos.lugares.particulares : resumen.alumnos
  if (puedeSumarAlumno(resumen.estado, ocupados, resumen.nivel)) return null
  return NextResponse.json(cuerpoDeBloqueo(resumen, resumen.estado === 'vencido' ? 'vencido' : 'sin_cupo'), {
    status: 402,
  })
}

/**
 * B1 · Las funciones individuales (ficha, diagnóstico de un alumno): null si
 * puede, o el 402 "con el plan Particular" del plan Aula. Lo demás (vencido,
 * tope) lo decide quien llama, como siempre.
 */
export async function bloqueoIndividual(teacherId: string, email: string | null): Promise<NextResponse | null> {
  const { datos } = await leerPlan(teacherId, email, new Date())
  const estado = estadoDelPlan(datos)
  if (permiteIndividual(tipoDePlan(datos.tipo), estado)) return null
  return NextResponse.json(cuerpoDeBloqueo(await resumenDelPlan(teacherId, email), 'solo_particular'), { status: 402 })
}

/** B1 · Abrir un grupo en el plan Aula: hasta los cursos pagos. null si puede. */
export async function bloqueoParaCrearGrupo(teacherId: string, email: string | null): Promise<NextResponse | null> {
  const { datos } = await leerPlan(teacherId, email, new Date())
  const estado = estadoDelPlan(datos)
  const tipo = tipoDePlan(datos.tipo)
  if (tipo !== 'aula' || estado !== 'activo') return null
  try {
    const filas = (await sql`
      SELECT COUNT(*)::int AS total FROM classrooms WHERE teacher_id = ${teacherId} AND status = 'open'
    `) as Fila[]
    if (puedeCrearCurso(tipo, estado, Number(filas[0]?.total ?? 0), datos.aulaCursos)) return null
  } catch (error) {
    captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'bloqueoParaCrearGrupo' })
    return null
  }
  return NextResponse.json(cuerpoDeBloqueo(await resumenDelPlan(teacherId, email), 'sin_cursos'), { status: 402 })
}

/** B1 · El informe para imprimir y Moodle: no en el gratis. Para las páginas del servidor. */
export async function puedeImprimirYMoodle(teacherId: string, email: string | null): Promise<boolean> {
  const { datos } = await leerPlan(teacherId, email, new Date(), { contarSiempre: true })
  return permiteImprimirYMoodle(estadoDelPlan(datos))
}

/**
 * B1 · Las prácticas extra (P4) de un alumno en el mes, en el plan Aula: 10.
 * null si no hay tope mensual (o no se puede decidir: la válvula).
 */
export async function topeMensualDePracticasExtra(teacherId: string): Promise<number | null> {
  try {
    const email = await emailDeUsuario(teacherId)
    const { datos } = await leerPlan(teacherId, email, new Date())
    return practicasExtraPorAlumnoMes(tipoDePlan(datos.tipo), estadoDelPlan(datos))
  } catch {
    return null
  }
}

/** El email del dueño de un grupo, para saber si es exento. */
export async function emailDeUsuario(userId: string): Promise<string | null> {
  const filas = (await sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`) as Fila[]
  const email = filas[0]?.email
  return typeof email === 'string' ? email : null
}

/**
 * G2: el docente aceptó el aviso. Arranca la prueba de 30 días, una sola vez:
 * si ya arrancó (o tiene un plan pago) no toca nada. Devuelve si la arrancó.
 */
export async function iniciarPrueba(teacherId: string, email: string | null): Promise<boolean> {
  if (isAdminEmail(email)) return false
  try {
    const filas = (await sql`
      UPDATE users
      SET prueba_iniciada_el = NOW(),
          plan_vence_el = NOW() + make_interval(days => ${DIAS_PRUEBA}),
          updated_at = NOW()
      WHERE id = ${teacherId}
        AND prueba_iniciada_el IS NULL
        AND plan_vence_el IS NULL
        AND plan_nivel = 0
      RETURNING id
    `) as Fila[]
    return filas.length > 0
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703') {
      captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'iniciarPrueba' })
    }
    return false
  }
}

// ─── Admin (G4) ───────────────────────────────────────────────────────────────

export interface DocenteEnPlanes {
  id: string
  nombre: string
  email: string | null
  alumnos: number
  resumen: ResumenDelPlan
  notas: string | null
}

/** La tabla de /admin/planes. Lanza si la 026 no corrió: la pantalla lo dice. */
export async function listarDocentesConPlan(ahora: Date = new Date()): Promise<DocenteEnPlanes[]> {
  // B1: con la 037, también tipo, cursos y fundadora (sin ella, la lista de siempre).
  let filas: Fila[]
  try {
    filas = (await sql`
      SELECT id, name, email, plan_nivel, plan_vence_el, prueba_iniciada_el, plan_notas, created_at,
             plan_tipo, aula_cursos, fundadora_desde
      FROM users
      WHERE role = 'DOCENTE' AND COALESCE(is_guest, false) = false
      ORDER BY created_at ASC
    `) as Fila[]
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703') throw error
    filas = (await sql`
      SELECT id, name, email, plan_nivel, plan_vence_el, prueba_iniciada_el, plan_notas, created_at
      FROM users
      WHERE role = 'DOCENTE' AND COALESCE(is_guest, false) = false
      ORDER BY created_at ASC
    `) as Fila[]
  }

  return Promise.all(
    filas.map(async (fila) => {
      const id = String(fila.id)
      const email = typeof fila.email === 'string' ? fila.email : null
      const alumnos = await contarAlumnosSinRomper(id)
      const datos: DatosDelPlan = {
        nivel: fila.plan_nivel,
        venceEl: fila.plan_vence_el as string | null,
        pruebaIniciadaEl: fila.prueba_iniciada_el as string | null,
        esExento: isAdminEmail(email),
        ahora,
        alumnosActuales: alumnos,
        tipo: fila.plan_tipo,
        aulaCursos: fila.aula_cursos,
      }
      return {
        id,
        nombre: String(fila.name ?? ''),
        email,
        alumnos,
        notas: typeof fila.plan_notas === 'string' ? fila.plan_notas : null,
        resumen: armarResumen(datos, estadoDelPlan(datos), null, true, fila.created_at, fila.fundadora_desde ?? null),
      }
    }),
  )
}

/**
 * Acredita un plan a mano. Escribe nivel y vencimiento, y AGREGA una línea a
 * `plan_notas` con quién, cuándo y la nota: el historial no se pisa nunca.
 */
export async function acreditarPlan(params: {
  docenteId: string
  nivel: NivelPlan
  venceEl: Date
  nota: string
  acreditadoPor: string
  ahora?: Date
  /** B1: 'aula' con sus cursos; si no, Particular (el de siempre). */
  tipo?: TipoDePlan
  cursos?: number
}): Promise<boolean> {
  const ahora = params.ahora ?? new Date()
  const linea = lineaDeAcreditacion({ ...params, ahora })
  const tipo = params.tipo ?? 'particular'
  const cursos = tipo === 'aula' ? Math.max(1, params.cursos ?? 1) : 0
  // B1: con la 037, también el tipo y los cursos. Sin ella (42703), Aula no se
  // puede acreditar (lo dice el error) y Particular sigue como siempre.
  try {
    const filas = (await sql`
      UPDATE users
      SET plan_nivel = ${params.nivel},
          plan_vence_el = ${params.venceEl.toISOString()},
          plan_tipo = ${tipo},
          aula_cursos = ${cursos},
          plan_notas = CASE WHEN COALESCE(plan_notas, '') = '' THEN ${linea} ELSE plan_notas || E'\n' || ${linea} END,
          updated_at = NOW()
      WHERE id = ${params.docenteId} AND role = 'DOCENTE'
      RETURNING id
    `) as Fila[]
    return filas.length > 0
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703' || tipo === 'aula') throw error
  }
  const filas = (await sql`
    UPDATE users
    SET plan_nivel = ${params.nivel},
        plan_vence_el = ${params.venceEl.toISOString()},
        plan_notas = CASE WHEN COALESCE(plan_notas, '') = '' THEN ${linea} ELSE plan_notas || E'\n' || ${linea} END,
        updated_at = NOW()
    WHERE id = ${params.docenteId} AND role = 'DOCENTE'
    RETURNING id
  `) as Fila[]
  return filas.length > 0
}

export function lineaDeAcreditacion(params: {
  nivel: NivelPlan
  venceEl: Date
  nota: string
  acreditadoPor: string
  ahora: Date
  tipo?: TipoDePlan
  cursos?: number
}): string {
  const fecha = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
  const nota = params.nota.replace(/\s+/g, ' ').trim()
  const que =
    params.tipo === 'aula'
      ? `Aula ${params.cursos ?? 1} ${(params.cursos ?? 1) === 1 ? 'curso' : 'cursos'}`
      : `nivel ${params.nivel}`
  return `${fecha(params.ahora)} · ${params.acreditadoPor} acreditó ${que} hasta el ${fecha(params.venceEl)}${nota ? ` · ${nota}` : ''}`
}

/**
 * Para el ingreso por código (POST /api/classrooms/join): ¿este alumno entra?
 *
 * Sólo se frena a quien ocuparía un lugar NUEVO. Pasan siempre: el docente
 * exento, quien ya es miembro activo de algún grupo abierto de ese docente
 * (no suma: un alumno en dos grupos es un lugar, y con el plan vencido sus
 * alumnos actuales siguen respondiendo), y quien viene a ocupar una invitación
 * de ese grupo con su nombre (el docente ya lo sumó).
 */
export async function grupoTieneLugarPara(params: {
  teacherId: string
  classroomId: number
  userId: string | null
  nombre: string
}): Promise<boolean> {
  return (await motivoSinLugarEnElGrupo(params)) === null
}

/**
 * Lo mismo, con el motivo: null si entra; 'curso_completo' (B1: el curso del
 * Aula o del gratis llegó a 35, o el gratis ya tiene su curso) o 'sin_lugar'
 * (el cupo de siempre).
 */
export async function motivoSinLugarEnElGrupo(params: {
  teacherId: string
  classroomId: number
  userId: string | null
  nombre: string
}): Promise<null | 'sin_lugar' | 'curso_completo'> {
  const entra = await grupoTieneLugarParaInterno(params)
  return entra === true ? null : entra
}

async function grupoTieneLugarParaInterno(params: {
  teacherId: string
  classroomId: number
  userId: string | null
  nombre: string
}): Promise<true | 'sin_lugar' | 'curso_completo'> {
  try {
    const email = await emailDeUsuario(params.teacherId)
    const { datos } = await leerPlan(params.teacherId, email, new Date())
    if (estadoDelPlan(datos) === 'exento') return true
    if (params.userId === params.teacherId) return true

    if (params.userId) {
      const yaEsta = (await sql`
        SELECT 1 FROM classroom_members m
        JOIN classrooms c ON c.id = m.classroom_id
        WHERE c.teacher_id = ${params.teacherId} AND c.status = 'open'
          AND m.status = 'active' AND m.user_id = ${params.userId}
        LIMIT 1
      `) as Fila[]
      if (yaEsta.length > 0) return true
    }

    const nombre = normalizarNombre(params.nombre)
    if (nombre) {
      const invitaciones = (await sql`
        SELECT nombre FROM classroom_invitations WHERE classroom_id = ${params.classroomId}
      `) as Fila[]
      if (invitaciones.some((fila) => normalizarNombre(String(fila.nombre)) === nombre)) return true
    }

    // B1: en el Aula y en el gratis, quien entra por código ocupa un lugar en
    // un curso (hasta 35; en el gratis, un solo curso).
    const plan = await leerPlan(params.teacherId, email, new Date(), { contarSiempre: true })
    const estado = estadoDelPlan(plan.datos)
    const tipo = tipoDePlan(plan.datos.tipo)
    if (estado === 'gratis' || (tipo === 'aula' && estado === 'activo')) {
      const { porGrupo } = await lugaresDelDocente(params.teacherId)
      const enEsteCurso = porGrupo.get(params.classroomId) ?? 0
      const otrosCursosConAlumnos = [...porGrupo.entries()].filter(([id, n]) => id !== params.classroomId && n > 0).length
      return cursoTieneLugar({ estado, tipo, enEsteCurso, otrosCursosConAlumnos }) ? true : 'curso_completo'
    }

    const resumen = await resumenDelPlan(params.teacherId, email)
    return puedeSumarAlumno(resumen.estado, resumen.alumnos, resumen.nivel) ? true : 'sin_lugar'
  } catch (error) {
    // La válvula, también acá: si no se puede decidir, el alumno entra.
    captureRouteFailure(error, { endpoint: 'lib/planes-server', operation: 'grupoTieneLugarPara' })
    return true
  }
}
