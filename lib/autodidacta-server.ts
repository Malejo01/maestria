import { sql } from '@/lib/db'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { normalizeUnits } from '@/lib/teacher-programs'
import {
  accesoALaMateria,
  estadoPorTema,
  paseHastaPara,
  planHastaElExamen,
  type Acceso,
  type ResultadoDeTema,
  type TipoDeResultado,
} from '@/lib/autodidacta'
import { precioDeLista } from '@/lib/pagos'
import type { ProgramUnit } from '@/lib/types'

/**
 * Ronda T · E1 — La base del modo autodidacta (migración 040).
 *
 * La materia personal es un `teacher_programs` con `personal = true` cuyo
 * dueño es el alumno: así reusa el temario, el área (A2) y la generación (A4)
 * tal cual, y no aparece en ningún panel docente (el docente sólo ve lo suyo y,
 * además, las consultas del docente filtran `personal`).
 *
 * LA VÁLVULA: sin la 040 (42703 / 42P01), `disponible: false` y la entrada
 * "Me preparo solo para un examen" no se muestra.
 */
const faltaLaMigracion = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

export interface MateriaPersonal {
  id: number
  nombre: string
  fechaExamen: string | null
  temas: number
  area: string | null
}

export interface EstadoAutodidacta {
  disponible: boolean
  mayorDeEdad: boolean
  materias: MateriaPersonal[]
}

export async function leerAutodidacta(userId: string): Promise<EstadoAutodidacta> {
  try {
    const [u] = (await sql`SELECT mayor_de_18_el FROM users WHERE id = ${userId}`) as { mayor_de_18_el: string | null }[]
    const filas = (await sql`
      SELECT id, subject_name, fecha_examen, units, pedagogy_profile
      FROM teacher_programs
      WHERE user_id = ${userId} AND personal = TRUE AND status = 'active'
      ORDER BY fecha_examen ASC NULLS LAST, id DESC
    `) as Record<string, unknown>[]
    return {
      disponible: true,
      mayorDeEdad: Boolean(u?.mayor_de_18_el),
      materias: filas.map((f) => ({
        id: Number(f.id),
        nombre: String(f.subject_name),
        fechaExamen: f.fecha_examen ? new Date(String(f.fecha_examen)).toISOString().slice(0, 10) : null,
        temas: normalizeUnits(f.units).reduce((s, u) => s + u.topics.length, 0),
        area: ((f.pedagogy_profile ?? {}) as { area?: string }).area ?? null,
      })),
    }
  } catch (error) {
    if (faltaLaMigracion(error)) return { disponible: false, mayorDeEdad: false, materias: [] }
    throw error
  }
}

/** La declaración obligatoria de que es mayor de 18, con su fecha (una sola vez). */
export async function declararMayorDeEdad(userId: string): Promise<void> {
  await sql`UPDATE users SET mayor_de_18_el = COALESCE(mayor_de_18_el, NOW()) WHERE id = ${userId}`
}

/** Crea la materia personal con el temario leído del programa y la fecha del examen. */
export async function crearMateriaPersonal(
  userId: string,
  datos: { nombre: string; fechaExamen: string; unidades: unknown; area?: unknown; areaConfianza?: unknown },
): Promise<number> {
  const unidades = normalizeUnits(datos.unidades).map((u, i) => ({
    ...u,
    id: u.id || `ad-u-${i + 1}`,
    topics: u.topics.map((t, j) => ({ ...t, id: t.id || `ad-u-${i + 1}-t-${j + 1}` })),
  }))
  const conArea = completarAreaDelPrograma({
    materia: datos.nombre,
    perfil: {
      level: 'Superior',
      degree: '',
      academicYear: '',
      complexity: 'intermedia',
      assessmentStyle: 'mixto',
      methodology: 'Me preparo solo para un examen.',
      ...(typeof datos.area === 'string' ? { area: datos.area, areaConfianza: Number(datos.areaConfianza ?? 0.5), areaOrigen: 'ia' } : {}),
    },
    unidades,
  })
  const [fila] = (await sql`
    INSERT INTO teacher_programs (user_id, subject_name, icon_name, color_name, pedagogy_profile, units, nivel, created_from, status, personal, fecha_examen, created_at, updated_at)
    VALUES (${userId}, ${datos.nombre}, 'book-open', 'teal', ${JSON.stringify(conArea.perfil)}, ${JSON.stringify(conArea.unidades)},
            'Superior', 'upload', 'active', TRUE, ${datos.fechaExamen}, NOW(), NOW())
    RETURNING id
  `) as { id: number }[]
  return Number(fila.id)
}

export interface MateriaConPlan {
  id: number
  nombre: string
  fechaExamen: string | null
  unidades: ProgramUnit[]
  area: string | null
  hizoDiagnostico: boolean
  practicas: number
  estados: ReturnType<typeof estadoPorTema>
  plan: ReturnType<typeof planHastaElExamen>
  /** E2: lo gratis que queda, o el pase vigente. */
  acceso: Acceso
  /** E2: el precio del pase (MAESTRIA_PRECIO_PASE_ALUMNO); null sin la variable. */
  precioPase: number | null
}

/** La materia personal del alumno, con lo que ya sabe, lo que tiene que reforzar y el plan. null si no es suya. */
export async function leerMateriaPersonal(userId: string, id: number, ahora = new Date()): Promise<MateriaConPlan | null> {
  const [f] = (await sql`
    SELECT id, subject_name, fecha_examen, units, pedagogy_profile, to_jsonb(teacher_programs) ->> 'pase_hasta' AS pase_hasta
    FROM teacher_programs
    WHERE id = ${id} AND user_id = ${userId} AND personal = TRUE AND status = 'active'
  `) as Record<string, unknown>[]
  if (!f) return null
  const acceso = await accesoConUsos(userId, id, f.pase_hasta as string | null, ahora)
  const resultados = (await sql`
    SELECT tipo, por_tema FROM autodidacta_resultados WHERE user_id = ${userId} AND program_id = ${id} ORDER BY creado_el
  `) as { tipo: TipoDeResultado; por_tema: ResultadoDeTema[] }[]
  const unidades = normalizeUnits(f.units)
  const temas = unidades.flatMap((u) => u.topics.map((t) => t.name))
  const estados = estadoPorTema(temas, resultados)
  const fechaExamen = f.fecha_examen ? new Date(String(f.fecha_examen)).toISOString().slice(0, 10) : null
  return {
    id: Number(f.id),
    nombre: String(f.subject_name),
    fechaExamen,
    unidades,
    area: ((f.pedagogy_profile ?? {}) as { area?: string }).area ?? null,
    hizoDiagnostico: resultados.some((r) => r.tipo === 'diagnostico'),
    practicas: resultados.filter((r) => r.tipo === 'practica').length,
    estados,
    plan: fechaExamen ? planHastaElExamen({ temas: estados, hoy: ahora, fechaExamen }) : [],
    acceso,
    precioPase: precioDeLista({ plan: 'pase_alumno', forma: 'pase', cantidad: 1 }),
  }
}

/** Sin límite: sin la 041 la materia personal se usa como en E1. */
const SIN_LIMITE: Acceso = { pase: null, quedan: { diagnostico: null, practica: null, simulacro: null } }

async function accesoConUsos(userId: string, programId: number, paseHasta: string | null, ahora: Date): Promise<Acceso> {
  try {
    const filas = (await sql`
      SELECT tipo, COUNT(*)::int AS n FROM autodidacta_usos WHERE user_id = ${userId} AND program_id = ${programId} GROUP BY tipo
    `) as { tipo: TipoDeResultado; n: number }[]
    const usos = Object.fromEntries(filas.map((f) => [f.tipo, Number(f.n)])) as Partial<Record<TipoDeResultado, number>>
    return accesoALaMateria({ paseHasta, usos, hoy: ahora })
  } catch (error) {
    if (faltaLaMigracion(error)) return SIN_LIMITE
    throw error
  }
}

/**
 * E2 · Para generar: la materia personal de ESTE alumno y lo que le queda. null
 * si no es suya (o no es personal). `ajena: true` si es la materia personal de
 * otra persona: nadie genera con ella.
 */
export async function accesoParaGenerar(
  userId: string,
  programId: number,
  ahora = new Date(),
): Promise<{ personal: false } | { personal: true; ajena: true } | { personal: true; ajena: false; acceso: Acceso }> {
  let filas: Record<string, unknown>[]
  try {
    filas = (await sql`
      SELECT user_id, to_jsonb(teacher_programs) ->> 'pase_hasta' AS pase_hasta
      FROM teacher_programs
      WHERE id = ${programId} AND COALESCE((to_jsonb(teacher_programs) ->> 'personal')::boolean, false) = true
    `) as Record<string, unknown>[]
  } catch (error) {
    if (faltaLaMigracion(error)) return { personal: false }
    throw error
  }
  const f = filas[0]
  if (!f) return { personal: false }
  if (String(f.user_id) !== userId) return { personal: true, ajena: true }
  return { personal: true, ajena: false, acceso: await accesoConUsos(userId, programId, f.pase_hasta as string | null, ahora) }
}

/** E2 · Anota un cuestionario generado (para contar lo gratis). Sin la 041, nada. */
export async function registrarUso(userId: string, programId: number, tipo: TipoDeResultado): Promise<void> {
  try {
    await sql`INSERT INTO autodidacta_usos (user_id, program_id, tipo) VALUES (${userId}, ${programId}, ${tipo})`
  } catch (error) {
    if (!faltaLaMigracion(error)) throw error
  }
}

/** E2 · Para pagar el pase: la materia personal de este alumno, con su fecha de examen. */
export async function materiaParaElPase(userId: string, programId: number): Promise<{ id: number; nombre: string; fechaExamen: string | null } | null> {
  try {
    const [f] = (await sql`
      SELECT id, subject_name, fecha_examen FROM teacher_programs
      WHERE id = ${programId} AND user_id = ${userId} AND personal = TRUE AND status = 'active'
    `) as Record<string, unknown>[]
    if (!f) return null
    return { id: Number(f.id), nombre: String(f.subject_name), fechaExamen: f.fecha_examen ? new Date(String(f.fecha_examen)).toISOString().slice(0, 10) : null }
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}

/**
 * E2 · Acredita el pase de la materia (lo llama el webhook al aprobarse un pago
 * `pase_alumno`): hasta el examen + 7. Si ya tenía un pase más largo, lo deja.
 * false si la materia no es de esa persona.
 */
export async function acreditarPase(userId: string, programId: number, ahora = new Date()): Promise<boolean> {
  const materia = await materiaParaElPase(userId, programId)
  if (!materia) return false
  const hasta = paseHastaPara(materia.fechaExamen, ahora)
  const filas = (await sql`
    UPDATE teacher_programs SET pase_hasta = GREATEST(COALESCE(pase_hasta, ${hasta}::date), ${hasta}::date), updated_at = NOW()
    WHERE id = ${programId} AND user_id = ${userId} AND personal = TRUE
    RETURNING id
  `) as unknown[]
  return filas.length > 0
}

/** Guarda el resultado de un diagnóstico, una práctica o un simulacro. false si la materia no es suya. */
export async function guardarResultado(
  userId: string,
  programId: number,
  tipo: TipoDeResultado,
  porTema: ResultadoDeTema[],
  nota: number | null,
): Promise<boolean> {
  const filas = (await sql`
    INSERT INTO autodidacta_resultados (user_id, program_id, tipo, por_tema, nota)
    SELECT ${userId}, id, ${tipo}, ${JSON.stringify(porTema)}, ${nota}
    FROM teacher_programs WHERE id = ${programId} AND user_id = ${userId} AND personal = TRUE
    RETURNING id
  `) as unknown[]
  return filas.length > 0
}
