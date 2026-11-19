import { sql } from '@/lib/db'
import { invitacionDe } from '@/lib/alumnos-docente'
import { leerInvitaciones, leerMiembros } from '@/lib/alumnos-docente-server'
import { normalizeUnits } from '@/lib/teacher-programs'
import { FICHA_VACIA, fichaDesdeContexto, fichaDesdeFila, type DatosFicha, type MateriaConTemas } from '@/lib/fichas'

/**
 * Lectura y escritura de la ficha del alumno (J2).
 *
 * LA VÁLVULA: sin `fichas_alumno` (la 027 no corrió) la ficha no está
 * `disponible` y la pantalla sigue mostrando el campo único de siempre. Nada
 * de esto tira 500 por la tabla que falta.
 *
 * DE INVITACIÓN A ALUMNO: el docente puede armar la ficha de alguien que
 * todavía no entró; esa fila cuelga de la invitación. Cuando el alumno entra
 * con el mismo nombre, la lista los funde al leer (lib/alumnos-docente.ts) y
 * acá su ficha se encuentra por la misma invitación. La primera vez que el
 * docente la guarda desde la ficha del alumno, la ficha pasa al alumno
 * (user_id) y la invitación, ya usada, se borra: si no, al corregirle el
 * nombre ("ayarde sofia" → "Sofía Ayarde") dejaba de coincidir y volvía a
 * aparecer como "Todavía no entró".
 */

type Fila = Record<string, unknown>

export type Destino = { userId: string } | { invitacionId: number }

export type { MateriaConTemas }

export interface FichaLeida {
  /** false si la 027 no corrió: la UI muestra el campo de siempre. */
  disponible: boolean
  nombre: string
  ficha: DatosFicha
  /** De dónde salió lo que se ve: la tabla, la ficha de su invitación, o el contexto viejo. */
  origen: 'ficha' | 'invitacion' | 'contexto' | 'vacia'
  materias: MateriaConTemas[]
  /** Para una invitación: el grupo y su código, para el link. */
  grupo: { id: number; codigo: string; materiaId: number } | null
}

/** 42P01: la tabla no existe. 42703: la columna no existe. La 027 no corrió. */
export function faltaLa027(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === '42703'
}

async function leerMaterias(teacherId: string): Promise<MateriaConTemas[]> {
  const filas = (await sql`
    SELECT id, subject_name, units
    FROM teacher_programs
    WHERE user_id = ${teacherId} AND status = 'active'
    ORDER BY created_at ASC, id ASC
  `) as Fila[]
  return filas.map((fila) => ({
    id: Number(fila.id),
    nombre: String(fila.subject_name),
    unidades: normalizeUnits(fila.units),
  }))
}

interface Resuelto {
  nombre: string
  /** El contexto viejo (025), para migrarlo si no hay ficha. */
  contexto: string | null
  /** La invitación de la que puede colgar su ficha. */
  invitacionId: number | null
  grupo: FichaLeida['grupo']
}

/** Quién es ese destino para este docente, o null si no es suyo. */
async function resolver(teacherId: string, destino: Destino): Promise<Resuelto | null> {
  const invitaciones = await leerInvitaciones(teacherId)

  if ('invitacionId' in destino) {
    const invitacion = invitaciones.find((i) => i.id === destino.invitacionId)
    if (!invitacion) return null
    return {
      nombre: invitacion.nombre,
      contexto: invitacion.contexto,
      invitacionId: invitacion.id,
      grupo: { id: invitacion.grupoId, codigo: invitacion.codigo, materiaId: invitacion.materiaId },
    }
  }

  const membresias = (await leerMiembros(teacherId)).filter((m) => m.userId === destino.userId)
  if (membresias.length === 0) return null
  const suya = invitacionDe(membresias, invitaciones)
  return {
    nombre: membresias[0].nombre,
    contexto: membresias.find((m) => m.contexto?.trim())?.contexto ?? suya?.contexto ?? null,
    invitacionId: suya?.id ?? null,
    grupo: null,
  }
}

async function leerFilaDeFicha(teacherId: string, destino: Destino, invitacionId: number | null) {
  if ('userId' in destino) {
    const propias = (await sql`
      SELECT * FROM fichas_alumno WHERE teacher_id = ${teacherId} AND user_id = ${destino.userId} LIMIT 1
    `) as Fila[]
    if (propias[0]) return { fila: propias[0], origen: 'ficha' as const }
  }
  if (invitacionId !== null) {
    const deInvitacion = (await sql`
      SELECT * FROM fichas_alumno WHERE teacher_id = ${teacherId} AND invitation_id = ${invitacionId} LIMIT 1
    `) as Fila[]
    if (deInvitacion[0]) return { fila: deInvitacion[0], origen: 'userId' in destino ? ('invitacion' as const) : ('ficha' as const) }
  }
  return null
}

/** La ficha de un alumno o de una invitación, o null si no es de este docente. */
export async function leerFicha(teacherId: string, destino: Destino): Promise<FichaLeida | null> {
  const quien = await resolver(teacherId, destino)
  if (!quien) return null
  const materias = await leerMaterias(teacherId)

  try {
    const encontrada = await leerFilaDeFicha(teacherId, destino, quien.invitacionId)
    if (encontrada) {
      return { disponible: true, nombre: quien.nombre, ficha: fichaDesdeFila(encontrada.fila), origen: encontrada.origen, materias, grupo: quien.grupo }
    }
  } catch (error) {
    if (!faltaLa027(error)) throw error
    return { disponible: false, nombre: quien.nombre, ficha: FICHA_VACIA, origen: 'vacia', materias, grupo: quien.grupo }
  }

  const ficha = fichaDesdeContexto(quien.contexto)
  // Sin ficha todavía, la materia del grupo es el mejor punto de partida.
  if (quien.grupo) ficha.materiaId = quien.grupo.materiaId
  return {
    disponible: true,
    nombre: quien.nombre,
    ficha,
    origen: ficha.observaciones ? 'contexto' : 'vacia',
    materias,
    grupo: quien.grupo,
  }
}

/**
 * Guarda la ficha y el nombre. Devuelve false si el destino no es de este
 * docente. Lanza si la 027 no corrió (la ruta responde 409: la pantalla no
 * debería haber ofrecido la ficha).
 */
export async function guardarFicha(teacherId: string, destino: Destino, nombre: string, datos: DatosFicha): Promise<boolean> {
  const quien = await resolver(teacherId, destino)
  if (!quien) return false

  // Una materia que no es suya no se guarda.
  const materias = await leerMaterias(teacherId)
  const materia = materias.find((m) => m.id === datos.materiaId)
  const materiaId = materia ? materia.id : null
  const temasValidos = new Set(materia?.unidades.flatMap((u) => u.topics.map((t) => t.id)) ?? [])
  const temas = datos.temasDificiles.filter((id) => temasValidos.has(id))

  const valores = [
    datos.edad,
    datos.anioCursa || null,
    datos.institucion || null,
    datos.orientacion || null,
    materiaId,
    datos.fechaExamen,
    datos.comoEvalua || null,
    JSON.stringify(temas),
    datos.observaciones || null,
    datos.contacto || null,
    datos.responsable || null,
  ] as const

  if ('invitacionId' in destino) {
    await sql`
      INSERT INTO fichas_alumno (teacher_id, invitation_id, edad, anio_cursa, institucion, orientacion, materia_id,
                                 fecha_examen, como_evalua, temas_dificiles, observaciones, contacto, responsable)
      VALUES (${teacherId}, ${destino.invitacionId}, ${valores[0]}, ${valores[1]}, ${valores[2]}, ${valores[3]}, ${valores[4]},
              ${valores[5]}, ${valores[6]}, ${valores[7]}::jsonb, ${valores[8]}, ${valores[9]}, ${valores[10]})
      ON CONFLICT (invitation_id) WHERE invitation_id IS NOT NULL DO UPDATE SET
        edad = EXCLUDED.edad, anio_cursa = EXCLUDED.anio_cursa, institucion = EXCLUDED.institucion,
        orientacion = EXCLUDED.orientacion, materia_id = EXCLUDED.materia_id, fecha_examen = EXCLUDED.fecha_examen,
        como_evalua = EXCLUDED.como_evalua, temas_dificiles = EXCLUDED.temas_dificiles,
        observaciones = EXCLUDED.observaciones, contacto = EXCLUDED.contacto, responsable = EXCLUDED.responsable,
        updated_at = NOW()
    `
    await sql`
      UPDATE classroom_invitations i SET nombre = ${nombre}
      FROM classrooms c
      WHERE c.id = i.classroom_id AND c.teacher_id = ${teacherId} AND i.id = ${destino.invitacionId}
    `
    return true
  }

  const userId = destino.userId

  // La ficha armada antes de que entrara pasa a ser suya (si no tiene una propia).
  if (quien.invitacionId !== null) {
    await sql`
      UPDATE fichas_alumno SET user_id = ${userId}, invitation_id = NULL, updated_at = NOW()
      WHERE teacher_id = ${teacherId} AND invitation_id = ${quien.invitacionId}
        AND NOT EXISTS (SELECT 1 FROM fichas_alumno f WHERE f.teacher_id = ${teacherId} AND f.user_id = ${userId})
    `
  }

  await sql`
    INSERT INTO fichas_alumno (teacher_id, user_id, edad, anio_cursa, institucion, orientacion, materia_id,
                               fecha_examen, como_evalua, temas_dificiles, observaciones, contacto, responsable)
    VALUES (${teacherId}, ${userId}, ${valores[0]}, ${valores[1]}, ${valores[2]}, ${valores[3]}, ${valores[4]},
            ${valores[5]}, ${valores[6]}, ${valores[7]}::jsonb, ${valores[8]}, ${valores[9]}, ${valores[10]})
    ON CONFLICT (teacher_id, user_id) WHERE user_id IS NOT NULL DO UPDATE SET
      edad = EXCLUDED.edad, anio_cursa = EXCLUDED.anio_cursa, institucion = EXCLUDED.institucion,
      orientacion = EXCLUDED.orientacion, materia_id = EXCLUDED.materia_id, fecha_examen = EXCLUDED.fecha_examen,
      como_evalua = EXCLUDED.como_evalua, temas_dificiles = EXCLUDED.temas_dificiles,
      observaciones = EXCLUDED.observaciones, contacto = EXCLUDED.contacto, responsable = EXCLUDED.responsable,
      updated_at = NOW()
  `

  if (quien.invitacionId !== null) {
    // Los resultados impresos cargados antes de que entrara también pasan a él.
    await sql`
      UPDATE diagnostico_resultados_impresos SET user_id = ${userId}, invitation_id = NULL
      WHERE invitation_id = ${quien.invitacionId}
    `
    // La invitación ya se usó: se borra, para que corregirle el nombre no la
    // haga reaparecer como pendiente.
    await sql`
      DELETE FROM classroom_invitations i USING classrooms c
      WHERE c.id = i.classroom_id AND c.teacher_id = ${teacherId} AND i.id = ${quien.invitacionId}
    `
  }

  await sql`
    UPDATE classroom_members m SET display_name = ${nombre}, updated_at = NOW()
    FROM classrooms c
    WHERE c.id = m.classroom_id AND c.teacher_id = ${teacherId} AND m.user_id = ${userId}
  `
  return true
}

/**
 * Para la lista de Mis alumnos: lo mínimo de cada ficha del docente (fecha del
 * examen y observaciones), por alumno y por invitación. Vacío si la 027 no
 * corrió.
 */
export async function leerResumenDeFichas(teacherId: string): Promise<{
  porAlumno: Map<string, { fechaExamen: string | null; observaciones: string }>
  porInvitacion: Map<number, { fechaExamen: string | null; observaciones: string }>
}> {
  const vacio = { porAlumno: new Map(), porInvitacion: new Map() }
  let filas: Fila[]
  try {
    filas = (await sql`
      SELECT user_id, invitation_id, fecha_examen, observaciones FROM fichas_alumno WHERE teacher_id = ${teacherId}
    `) as Fila[]
  } catch (error) {
    if (faltaLa027(error)) return vacio
    throw error
  }
  for (const fila of filas) {
    const ficha = fichaDesdeFila(fila)
    const resumen = { fechaExamen: ficha.fechaExamen, observaciones: ficha.observaciones }
    if (fila.user_id) vacio.porAlumno.set(String(fila.user_id), resumen)
    else if (fila.invitation_id) vacio.porInvitacion.set(Number(fila.invitation_id), resumen)
  }
  return vacio
}
