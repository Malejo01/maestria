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
 *
 * Cinco alcanzan para SOSPECHAR que un tema está flojo: el costo de equivocarse
 * es mandar una tarea de más.
 */
export const RESPUESTAS_PARA_FLOJO = 5

/**
 * Para AFIRMAR que un tema está dominado hacen falta más. Con cinco respuestas,
 * cuatro aciertos son un 80 % que puede ser una buena tarde; y el costo de
 * equivocarse acá es el caro: el docente deja de mirar un tema que no estaba.
 * Hasta el 16/11/2026 las dos cosas se decidían con la misma cantidad.
 *
 * Entre las dos (5 a 7 respuestas, y le va bien) el tema sigue "sin datos":
 * todavía no se puede decir ninguna de las dos cosas.
 */
export const RESPUESTAS_PARA_DOMINADO = 8

/**
 * Desde esta proporción de aciertos el tema cuenta como dominado; por debajo,
 * flojo. Es el mismo corte con el que la app ya da por aprobado un intento
 * (nota 6 sobre 10), subido un escalón: "dominado" pide más que aprobar justo.
 * Es un criterio de producto: si Mauro quiere otro, se cambia acá y nada más.
 */
export const UMBRAL_DOMINADO = 0.7

export function estadoDeTema(correctas: number, calificadas: number): EstadoTema {
  if (calificadas < RESPUESTAS_PARA_FLOJO) return 'sin_datos'
  if (correctas / calificadas < UMBRAL_DOMINADO) return 'flojo'
  return calificadas >= RESPUESTAS_PARA_DOMINADO ? 'dominado' : 'sin_datos'
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

/** Cuántos temas se nombran en una celda antes de resumir el resto. */
export const TEMAS_A_LA_VISTA = 3

/**
 * Los temas de una práctica para una celda de tabla. Una tarea puede cubrir
 * siete temas de 120 caracteres cada uno: escritos enteros y separados por
 * comas eran un párrafo de cinco renglones que le comía el ancho a la columna
 * del resultado, que es la que el docente vino a mirar. Acá van los nombres
 * cortos de los primeros y la cuenta del resto; `completo` es para el `title`
 * y para quien lee con lector de pantalla.
 */
export function resumirTemas(temas: string[]): { visibles: string[]; resto: number; completo: string } {
  const limpios = temas.map((tema) => tema.trim()).filter(Boolean)
  return {
    visibles: limpios.slice(0, TEMAS_A_LA_VISTA).map(temaCorto),
    resto: Math.max(limpios.length - TEMAS_A_LA_VISTA, 0),
    // Punto y coma, no coma: los nombres de tema traen comas y puntos adentro.
    completo: limpios.map((tema) => tema.replace(/[.\s]+$/, '')).join('; '),
  }
}

// ─── Nombres ──────────────────────────────────────────────────────────────────

/**
 * Para comparar nombres: sin tildes, sin mayúsculas, sin espacios de más y
 * sin importar el orden de las palabras. J2: los alumnos que entran solos
 * escriben "ayarde sofia" donde el docente había puesto "Sofía Ayarde"; con el
 * orden importando, la invitación no se fundía y el alumno no heredaba su
 * ficha.
 */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
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
  /**
   * J2: la invitación con la que entró (o la pendiente misma). Es por donde se
   * encuentra la ficha armada antes de que el alumno entrara.
   */
  invitacionId: number | null
  /** J2: la fecha del examen de su ficha (AAAA-MM-DD), para "Rinde en N días". */
  fechaExamen: string | null
  /**
   * K8: si respondió algo en MaestrIA alguna vez, dentro o fuera de los grupos
   * del docente. Sólo sí o no: cuándo y qué practicó por su cuenta es del alumno.
   * Ausente: se mira sólo `intentos`.
   */
  respondioAlgunaVez?: boolean
  /**
   * P5 (O13, propuesta 3): cuándo entró a su primer grupo del docente. Null en
   * un pendiente (todavía no entró).
   */
  seSumoEl?: string | null
}

/**
 * Cuántos lugares ocupa el docente, con la MISMA regla de fusión que
 * `armarFilas`: una persona en dos grupos es un lugar, y una invitación cuyo
 * nombre coincide con un miembro de su grupo no suma aparte. Las invitaciones
 * pendientes sí ocupan: el docente ya sumó a ese alumno. Es el número contra el
 * que se mide el cupo del plan (lib/planes.ts).
 *
 * J1: un alumno quitado no ocupa lugar, y la invitación con la que había
 * entrado tampoco: ya se usó. Sin ese cruce, quitar a alguien que entró por
 * una invitación la hacía reaparecer como "Todavía no entró" y el lugar
 * seguía ocupado.
 */
export function contarLugares(
  miembros: Pick<MiembroCrudo, 'userId' | 'nombre' | 'grupoId'>[],
  invitaciones: Pick<InvitacionCruda, 'id' | 'nombre' | 'grupoId'>[],
  quitados: Pick<MiembroCrudo, 'nombre' | 'grupoId'>[] = [],
): number {
  const porPersona = new Map<string, Pick<MiembroCrudo, 'nombre' | 'grupoId'>[]>()
  for (const miembro of miembros) {
    porPersona.set(miembro.userId, [...(porPersona.get(miembro.userId) ?? []), miembro])
  }
  const usadas = invitacionesDeQuitados(invitaciones, quitados)
  for (const membresias of porPersona.values()) {
    const suya = invitaciones.find((invitacion) =>
      membresias.some(
        (m) => m.grupoId === invitacion.grupoId && normalizarNombre(m.nombre) === normalizarNombre(invitacion.nombre),
      ),
    )
    if (suya) usadas.add(suya.id)
  }
  return porPersona.size + invitaciones.filter((invitacion) => !usadas.has(invitacion.id)).length
}

/**
 * Ronda T · B1 · Los lugares por tipo, para el plan gratis ("2 particulares +
 * 1 curso de hasta 35") y el Aula. **Particular**: quien tiene una invitación
 * con su nombre (lo sumó el docente) o una invitación todavía sin usar.
 * **Curso**: quien entró a un grupo con el código, sin invitación; se cuenta
 * en cada grupo en el que está así.
 */
export function lugaresPorTipo(
  miembros: Pick<MiembroCrudo, 'userId' | 'nombre' | 'grupoId'>[],
  invitaciones: Pick<InvitacionCruda, 'id' | 'nombre' | 'grupoId'>[],
  quitados: Pick<MiembroCrudo, 'nombre' | 'grupoId'>[] = [],
): { particulares: number; cursos: number[]; porGrupo: Map<number, number> } {
  const porPersona = new Map<string, Pick<MiembroCrudo, 'nombre' | 'grupoId'>[]>()
  for (const miembro of miembros) {
    porPersona.set(miembro.userId, [...(porPersona.get(miembro.userId) ?? []), miembro])
  }
  const usadas = invitacionesDeQuitados(invitaciones, quitados)
  let particulares = 0
  const porGrupo = new Map<number, number>()
  for (const membresias of porPersona.values()) {
    const suya = invitaciones.find((invitacion) =>
      membresias.some(
        (m) => m.grupoId === invitacion.grupoId && normalizarNombre(m.nombre) === normalizarNombre(invitacion.nombre),
      ),
    )
    if (suya) {
      usadas.add(suya.id)
      particulares++
      continue
    }
    for (const grupoId of new Set(membresias.map((m) => m.grupoId))) porGrupo.set(grupoId, (porGrupo.get(grupoId) ?? 0) + 1)
  }
  particulares += invitaciones.filter((invitacion) => !usadas.has(invitacion.id)).length
  return { particulares, cursos: [...porGrupo.values()], porGrupo }
}

/** La invitación que le corresponde a un miembro: mismo grupo, mismo nombre. */
export function invitacionDe<I extends Pick<InvitacionCruda, 'nombre' | 'grupoId'>>(
  membresias: Pick<MiembroCrudo, 'nombre' | 'grupoId'>[],
  invitaciones: I[],
): I | undefined {
  return invitaciones.find((invitacion) =>
    membresias.some(
      (m) => m.grupoId === invitacion.grupoId && normalizarNombre(m.nombre) === normalizarNombre(invitacion.nombre),
    ),
  )
}

/**
 * Las invitaciones que ya usó alguien que después fue quitado: mismo grupo,
 * mismo nombre. No se muestran ni ocupan lugar.
 */
function invitacionesDeQuitados(
  invitaciones: Pick<InvitacionCruda, 'id' | 'nombre' | 'grupoId'>[],
  quitados: Pick<MiembroCrudo, 'nombre' | 'grupoId'>[],
): Set<number> {
  return new Set(
    invitaciones
      .filter((invitacion) =>
        quitados.some(
          (q) => q.grupoId === invitacion.grupoId && normalizarNombre(q.nombre) === normalizarNombre(invitacion.nombre),
        ),
      )
      .map((invitacion) => invitacion.id),
  )
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
  quitados: Pick<MiembroCrudo, 'nombre' | 'grupoId'>[] = [],
): FilaAlumno[] {
  const actividadDe = new Map(actividad.map((fila) => [fila.userId, fila]))
  const porPersona = new Map<string, MiembroCrudo[]>()
  for (const miembro of miembros) {
    porPersona.set(miembro.userId, [...(porPersona.get(miembro.userId) ?? []), miembro])
  }

  const invitacionesUsadas = invitacionesDeQuitados(invitaciones, quitados)
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
      invitacionId: suInvitacion?.id ?? null,
      fechaExamen: null,
      seSumoEl: membresias.map((m) => m.seSumoEl).filter(Boolean).sort()[0] ?? null,
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
      invitacionId: invitacion.id,
      fechaExamen: null,
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

// ─── Quitar alumnos (J1) ──────────────────────────────────────────────────────

/**
 * Los que entraron y nunca respondieron nada en los grupos del docente: el
 * caso exacto de fin de cuatrimestre. Los que todavía no entraron no cuentan
 * acá: no son alumnos que se fueron, son links sin usar, y se quitan con su X.
 */
/**
 * Los que nunca respondieron NADA en MaestrIA (K8): ni en los grupos del
 * docente ni por su cuenta. Antes alcanzaba con no tener intentos en el grupo,
 * y el lote se llevaba a alumnos que sí habían practicado.
 */
/**
 * P5 (O13, propuesta 3): a un alumno que entró hace menos de esto no se le
 * ofrece quitarlo por no haber respondido: recién llegó. Para un docente nuevo
 * era lo primero que veía debajo de su único alumno.
 */
export const DIAS_PARA_OFRECER_QUITAR = 7

export function nuncaRespondieron(
  filas: FilaAlumno[],
  ahora: Date = new Date(),
): { userId: string; nombre: string; ultimaVez: string | null }[] {
  const corte = ahora.getTime() - DIAS_PARA_OFRECER_QUITAR * 86_400_000
  return filas
    .filter((fila) => fila.userId && !fila.pendiente && fila.intentos === 0 && !fila.respondioAlgunaVez)
    // Sin fecha (una fila armada antes de P5), como antes: se ofrece.
    .filter((fila) => !fila.seSumoEl || new Date(fila.seSumoEl).getTime() <= corte)
    .map((fila) => ({ userId: fila.userId as string, nombre: fila.nombre, ultimaVez: fila.ultimaVez }))
}

/** K8: la última actividad, dicha para el que confirma: "nunca", "practicó hoy", "practicó hace 12 días". */
export function ultimaActividad(ultimaVez: string | null, ahora: Date): string {
  if (!ultimaVez) return 'nunca'
  const dias = diasDesde(new Date(ultimaVez), ahora)
  if (dias === 0) return 'practicó hoy'
  if (dias === 1) return 'practicó ayer'
  return `practicó hace ${dias} días`
}

export interface QuitadoCrudo {
  userId: string
  nombre: string
  materia: string
  materiaId: number
  /** `removed_at`, o `updated_at` si la 027 no corrió. */
  quitadoEl: string
}

export interface FilaQuitado {
  userId: string
  nombre: string
  materias: { id: number; nombre: string }[]
  quitadoEl: string
}

/**
 * Una fila por persona quitada. Quien sigue activo en otro grupo del docente
 * no está "quitado": sigue en el listado.
 */
export function armarQuitados(quitados: QuitadoCrudo[], activos: Set<string>): FilaQuitado[] {
  const porPersona = new Map<string, QuitadoCrudo[]>()
  for (const fila of quitados) {
    if (activos.has(fila.userId)) continue
    porPersona.set(fila.userId, [...(porPersona.get(fila.userId) ?? []), fila])
  }
  return [...porPersona.entries()]
    .map(([userId, filas]) => ({
      userId,
      nombre: filas[0].nombre,
      materias: unicasPorId(filas.map((f) => ({ id: f.materiaId, nombre: f.materia }))),
      quitadoEl: filas.map((f) => f.quitadoEl).sort().at(-1) as string,
    }))
    .sort((a, b) => (a.quitadoEl === b.quitadoEl ? a.nombre.localeCompare(b.nombre, 'es') : a.quitadoEl > b.quitadoEl ? -1 : 1))
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
