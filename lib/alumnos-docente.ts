/**
 * Mis alumnos: el panel del docente organizado por personas.
 *
 * Un profesor particular tiene ocho alumnos y cada uno prepara algo distinto;
 * la unidad mental es la persona, no la materia. Este módulo toma lo que hay
 * en la base —miembros de sus grupos, invitaciones, intentos— y arma UNA fila
 * por persona, cruzando grupos.
 *
 * Es la parte pura: reglas y cuentas, con tests. Las consultas están en
 * lib/alumnos-docente-server.ts.
 *
 * ─── De dónde sale "cómo le va en un tema" ───────────────────────────────────
 * De `quiz_attempts.topics[]`, que son los temas que se eligieron al armar el
 * cuestionario: nombres del temario, estables. NO de `quiz_answers.topic_name`
 * ni de `student_misconceptions.topic_id`, que los escribe la IA pregunta por
 * pregunta (358 valores distintos en 1.680 respuestas, medido en el roadmap), y
 * NO de `topic_mastery`, que sólo escribe cuando el alumno aprueba.
 *
 * El costo: la cuenta es por intento, no por pregunta. Un intento que cubre
 * tres temas le suma sus aciertos a los tres. Con tareas de uno o dos temas,
 * que es lo normal, la lectura es buena; con tareas de diez temas se aplana.
 */

/** Los tres estados del chip de tema (design-reference/sistema/componentes/ChipTema). */
export type EstadoTema = 'dominado' | 'flojo' | 'sin_datos'

/**
 * Con menos respuestas calificadas que esto, el tema está "sin datos". Un tema
 * que el alumno casi no practicó no se pinta de naranja: le haría creer al
 * docente que hay un problema donde sólo hay silencio.
 */
export const MINIMO_DE_RESPUESTAS = 5

/**
 * Desde esta proporción de aciertos el tema cuenta como dominado; por debajo,
 * flojo. Es el mismo corte con el que la app ya da por aprobado un intento
 * (nota 6 sobre 10), subido un escalón: "dominado" pide más que aprobar justo.
 * Es un criterio de producto: si Mauro quiere otro, se cambia acá y nada más.
 */
export const UMBRAL_DOMINADO = 0.7

export function estadoDeTema(correctas: number, calificadas: number): EstadoTema {
  if (calificadas < MINIMO_DE_RESPUESTAS) return 'sin_datos'
  return correctas / calificadas >= UMBRAL_DOMINADO ? 'dominado' : 'flojo'
}

export interface TemaDeAlumno {
  tema: string
  correctas: number
  calificadas: number
  estado: EstadoTema
}

export function armarTemas(filas: { tema: string; correctas: number; calificadas: number }[]): TemaDeAlumno[] {
  return filas
    .map((fila) => ({ ...fila, estado: estadoDeTema(fila.correctas, fila.calificadas) }))
    .sort((a, b) => a.tema.localeCompare(b.tema, 'es'))
}

const proporcion = (tema: TemaDeAlumno) => (tema.calificadas > 0 ? tema.correctas / tema.calificadas : 0)

/**
 * Los chips de la fila: hasta dos, el mejor y el peor. El resto vive en la
 * ficha — una fila con cinco chips no se lee.
 */
export function chipsDeFila(temas: TemaDeAlumno[]): TemaDeAlumno[] {
  const dominados = temas.filter((tema) => tema.estado === 'dominado').sort((a, b) => proporcion(b) - proporcion(a))
  const flojos = temas.filter((tema) => tema.estado === 'flojo').sort((a, b) => proporcion(a) - proporcion(b))

  const mejor = dominados[0]
  const peor = flojos[0]
  if (mejor && peor) return [mejor, peor]
  if (peor) return flojos.slice(0, 2)
  if (mejor) return dominados.slice(0, 2)
  return []
}

/** El tema en el que peor le va, o null si no tiene ninguno flojo. */
export function temaMasFlojoDe(temas: TemaDeAlumno[]): TemaDeAlumno | null {
  return temas.filter((tema) => tema.estado === 'flojo').sort((a, b) => proporcion(a) - proporcion(b))[0] ?? null
}

/** Largo a partir del cual un nombre de tema se acorta para una fila o una frase. */
const LARGO_TEMA_CORTO = 32

/**
 * El nombre de un tema para lugares angostos: un chip de fila, la sugerencia,
 * el resumen. Los temarios reales traen temas como "Clases de palabras:
 * sustantivos propios y comunes. El adjetivo calificativo…": lo que identifica
 * al tema es lo que va antes de los dos puntos. La ficha muestra el nombre
 * entero.
 */
export function temaCorto(tema: string): string {
  const titulo = tema.split(/[:.(]/)[0].trim() || tema.trim()
  if (titulo.length <= LARGO_TEMA_CORTO) return titulo
  const recorte = titulo.slice(0, LARGO_TEMA_CORTO)
  return `${recorte.slice(0, Math.max(recorte.lastIndexOf(' '), 12)).trimEnd()}…`
}

// ─── Nombres ──────────────────────────────────────────────────────────────────

/** Para comparar nombres: sin tildes, sin mayúsculas, sin espacios de más. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

const MS_POR_DIA = 86_400_000

/** Días calendario enteros entre dos momentos. Hoy = 0, ayer = 1. */
export function diasDesde(fecha: Date, ahora: Date): number {
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((dia(ahora) - dia(fecha)) / MS_POR_DIA))
}

/** "hoy", "ayer", "hace 6 d", "hace 3 sem", "hace 2 m". Corto: va en una columna de 72 px. */
export function haceCuanto(fecha: Date | null, ahora: Date): string {
  if (!fecha) return 'todavía no'
  const dias = diasDesde(fecha, ahora)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} d`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} sem`
  return `hace ${Math.floor(dias / 30)} m`
}

// ─── Filas ────────────────────────────────────────────────────────────────────

export interface MiembroCrudo {
  userId: string
  nombre: string
  contexto: string | null
  grupoId: number
  grupoNombre: string
  materia: string
  materiaId: number
  esInvitadoSinCuenta: boolean
  seSumoEl: string
}

export interface InvitacionCruda {
  id: number
  nombre: string
  contexto: string | null
  grupoId: number
  grupoNombre: string
  materia: string
  materiaId: number
  codigo: string
  creadaEl: string
}

export interface ActividadCruda {
  userId: string
  ultimaVez: string | null
  intentos: number
  tareasEntregadas: number
  correctas: number
  calificadas: number
}

export interface FilaAlumno {
  /** Estable para React y para el link a la ficha. Un pendiente no tiene ficha. */
  clave: string
  userId: string | null
  /** Invitación sin miembro: lo agregó el docente y todavía no entró. */
  pendiente: { invitacionId: number; codigo: string } | null
  nombre: string
  /** Qué prepara y para cuándo, en palabras del docente. Si no escribió nada, la materia. */
  contexto: string
  materias: { id: number; nombre: string }[]
  chips: TemaDeAlumno[]
  temaMasFlojo: string | null
  ultimaVez: string | null
  intentos: number
  tareasEntregadas: number
  correctas: number
  calificadas: number
}

/**
 * Una fila por persona. Un alumno que está en dos grupos del mismo docente es
 * UNA fila; una invitación cuyo nombre coincide con un miembro de ese grupo no
 * se muestra aparte: el miembro hereda su contexto.
 */
export function armarFilas(
  miembros: MiembroCrudo[],
  invitaciones: InvitacionCruda[],
  actividad: ActividadCruda[],
  temasPorAlumno: Map<string, TemaDeAlumno[]>,
): FilaAlumno[] {
  const actividadDe = new Map(actividad.map((fila) => [fila.userId, fila]))
  const porPersona = new Map<string, MiembroCrudo[]>()
  for (const miembro of miembros) {
    porPersona.set(miembro.userId, [...(porPersona.get(miembro.userId) ?? []), miembro])
  }

  const invitacionesUsadas = new Set<number>()
  const filas: FilaAlumno[] = []

  for (const [userId, membresias] of porPersona) {
    // La invitación que le corresponde: mismo grupo, mismo nombre.
    const suInvitacion = invitaciones.find(
      (invitacion) =>
        membresias.some(
          (m) => m.grupoId === invitacion.grupoId && normalizarNombre(m.nombre) === normalizarNombre(invitacion.nombre),
        ),
    )
    if (suInvitacion) invitacionesUsadas.add(suInvitacion.id)

    const contextoEscrito = membresias.find((m) => m.contexto?.trim())?.contexto?.trim() ?? suInvitacion?.contexto?.trim()
    const materias = unicasPorId(membresias.map((m) => ({ id: m.materiaId, nombre: m.materia })))
    const temas = temasPorAlumno.get(userId) ?? []
    const suActividad = actividadDe.get(userId)

    filas.push({
      clave: `alumno-${userId}`,
      userId,
      pendiente: null,
      nombre: membresias[0].nombre,
      contexto: contextoEscrito || materias.map((m) => m.nombre).join(' · '),
      materias,
      chips: chipsDeFila(temas),
      temaMasFlojo: temaMasFlojoDe(temas)?.tema ?? null,
      ultimaVez: suActividad?.ultimaVez ?? null,
      intentos: suActividad?.intentos ?? 0,
      tareasEntregadas: suActividad?.tareasEntregadas ?? 0,
      correctas: suActividad?.correctas ?? 0,
      calificadas: suActividad?.calificadas ?? 0,
    })
  }

  for (const invitacion of invitaciones) {
    if (invitacionesUsadas.has(invitacion.id)) continue
    filas.push({
      clave: `invitacion-${invitacion.id}`,
      userId: null,
      pendiente: { invitacionId: invitacion.id, codigo: invitacion.codigo },
      nombre: invitacion.nombre,
      contexto: invitacion.contexto?.trim() || invitacion.materia,
      materias: [{ id: invitacion.materiaId, nombre: invitacion.materia }],
      chips: [],
      temaMasFlojo: null,
      ultimaVez: null,
      intentos: 0,
      tareasEntregadas: 0,
      correctas: 0,
      calificadas: 0,
    })
  }

  // Los que practicaron hace menos, arriba; los que nunca, al final; a igual
  // fecha, por nombre. Los pendientes quedan abajo de todo.
  return filas.sort((a, b) => {
    if (Boolean(a.pendiente) !== Boolean(b.pendiente)) return a.pendiente ? 1 : -1
    if (a.ultimaVez !== b.ultimaVez) {
      if (!a.ultimaVez) return 1
      if (!b.ultimaVez) return -1
      return a.ultimaVez > b.ultimaVez ? -1 : 1
    }
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

function unicasPorId<T extends { id: number }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

// ─── Sugerencia y resumen ─────────────────────────────────────────────────────

/** A partir de cuántos días sin practicar vale la pena avisar. */
export const DIAS_PARA_SUGERIR = 3

export interface Sugerencia {
  userId: string
  nombre: string
  /** Días sin practicar, si ese es el hecho que motiva la sugerencia. */
  dias: number | null
  tema: string | null
  materiaId: number | null
}

/**
 * La sugerencia que cierra el listado. UNA sola: si todo sugiere, nada sugiere.
 *
 * Gana quien lleva más días sin practicar teniendo un tema flojo; si nadie
 * está inactivo, quien tiene el tema más flojo. Si no hay ningún tema flojo y
 * nadie está inactivo, no hay sugerencia: un panel que inventa una acción
 * cuando no hace falta enseña a ignorarlo.
 */
export function elegirSugerencia(filas: FilaAlumno[], ahora: Date): Sugerencia | null {
  const conActividad = filas.filter((fila) => fila.userId && fila.ultimaVez)

  const inactivos = conActividad
    .map((fila) => ({ fila, dias: diasDesde(new Date(fila.ultimaVez as string), ahora) }))
    .filter(({ dias }) => dias >= DIAS_PARA_SUGERIR)
    .sort((a, b) => Number(Boolean(b.fila.temaMasFlojo)) - Number(Boolean(a.fila.temaMasFlojo)) || b.dias - a.dias)

  const elegido = inactivos[0]
  if (elegido) {
    return {
      userId: elegido.fila.userId as string,
      nombre: elegido.fila.nombre,
      dias: elegido.dias,
      tema: elegido.fila.temaMasFlojo,
      materiaId: elegido.fila.materias[0]?.id ?? null,
    }
  }

  const conFlojo = conActividad.find((fila) => fila.temaMasFlojo)
  if (!conFlojo) return null
  return {
    userId: conFlojo.userId as string,
    nombre: conFlojo.nombre,
    dias: null,
    tema: conFlojo.temaMasFlojo,
    materiaId: conFlojo.materias[0]?.id ?? null,
  }
}

export interface ResumenAlumnos {
  /** Tareas (intentos de algo asignado) entregadas en los últimos 7 días. */
  tareasEstaSemana: number
  /** El tema flojo para más alumnos, y cuántos son sobre el total que ya practicó. */
  temaMasFlojo: { tema: string; alumnos: number; deCuantos: number } | null
}

export function resumir(
  temasPorAlumno: Map<string, TemaDeAlumno[]>,
  tareasEstaSemana: number,
): ResumenAlumnos {
  const cuenta = new Map<string, number>()
  let conDatos = 0
  for (const temas of temasPorAlumno.values()) {
    if (temas.some((tema) => tema.estado !== 'sin_datos')) conDatos++
    for (const tema of temas) {
      if (tema.estado === 'flojo') cuenta.set(tema.tema, (cuenta.get(tema.tema) ?? 0) + 1)
    }
  }

  const masFlojo = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0]

  return {
    tareasEstaSemana,
    temaMasFlojo: masFlojo ? { tema: masFlojo[0], alumnos: masFlojo[1], deCuantos: conDatos } : null,
  }
}
