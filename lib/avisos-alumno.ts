/**
 * P3 · Los avisos del alumno (con cuenta o invitado). Puro: de las filas que
 * lee lib/avisos-alumno-server.ts a avisos del modelo común. Todo sale de lo
 * que ya está en la base: sin correo ni push.
 *
 *   tareaNueva        una tarea de un grupo suyo, o una individual (L0)
 *   vencePronto       una tarea sin hacer que vence en menos de 24 h
 *   diagnosticoNuevo  le armaron un diagnóstico (J/L0) → el primer cuestionario
 *   reporteResuelto   lo de N1: su reporte se resolvió
 *   temaSuperado      un tema de "A reforzar" pasó a "Ya lo dominás" (O2)
 *   rachaEnRiesgo     tiene racha (O4) y hoy no practicó, después de las 18 h
 */
import { diasDeCalendario, diaEnArgentina, ordenarAvisos } from '@/lib/avisos/armar'
import { crearAviso, type Aviso, type Lectura } from '@/lib/avisos/tipos'
import { AVISOS_ALUMNO as T } from '@/lib/textos'

export const VENTANA_DIAS = 14
export const HORAS_VENCE_PRONTO = 24
/** Desde esta hora (de Argentina) se avisa que la racha está en riesgo. */
export const HORA_RACHA_EN_RIESGO = 18

const MS_HORA = 3_600_000

export type FilaDeAvisoAlumno =
  | { tipo: 'tareaNueva'; asignacionId: number; grupo: string; tarea: string; disponibleDesde: string }
  | { tipo: 'vencePronto'; asignacionId: number; grupo: string; tarea: string; venceEl: string; creadaEl: string }
  | { tipo: 'diagnosticoNuevo'; diagnosticoId: number; primeraAsignacionId: number; grupo: string; cuestionarios: number; creadoEl: string }
  | { tipo: 'reporteResuelto'; reporteId: number; respondidoPor: string | null; conMensaje: boolean; resueltoEl: string }
  | { tipo: 'temaSuperado'; misconceptionId: number; tema: string; porDocente: boolean; superadoEl: string }
  | { tipo: 'racha'; racha: number; ultimaPractica: string | null }

/** A una tarea de Mis tareas. Query y no `#`: la navegación de Next no avisa los cambios de `#`. */
export const hrefDeTarea = (asignacionId: number) => `/aulas?tarea=${asignacionId}`

/** Hasta cuántos días sin practicar se sigue avisando (después, ya no es "hoy no practicó"). */
export const DIAS_RACHA_EN_RIESGO = 7

/**
 * El instante en que la racha entra "en riesgo" hoy, o null si no lo está.
 * La racha de O4 cuenta cuestionarios aprobados seguidos (no días), así que
 * no se corta sola: el aviso es un empujón. Tiene racha, su último intento no
 * fue hoy (y fue en la última semana: no se insiste para siempre) y son las
 * 18 h o más en Argentina.
 */
export function rachaEnRiesgoDesde(racha: number, ultimaPractica: string | null, ahora: Date): string | null {
  if (racha <= 0 || !ultimaPractica) return null
  const dias = diasDeCalendario(new Date(ultimaPractica), ahora)
  if (dias < 1 || dias > DIAS_RACHA_EN_RIESGO) return null
  const hoy = diaEnArgentina(ahora)
  // 18 h de Argentina = 21 h UTC (no hay horario de verano desde 2009).
  const desde = new Date(`${hoy}T${String(HORA_RACHA_EN_RIESGO + 3).padStart(2, '0')}:00:00.000Z`)
  return ahora.getTime() >= desde.getTime() ? desde.toISOString() : null
}

function avisoDe(f: FilaDeAvisoAlumno, lectura: Lectura, ahora: Date, esInvitado: boolean): Aviso | null {
  switch (f.tipo) {
    case 'tareaNueva':
      return crearAviso(
        'tareaNueva',
        { clave: `tareaNueva|${f.asignacionId}`, titulo: T.tareaNueva, detalle: T.detalleTarea(f.grupo, f.tarea), href: hrefDeTarea(f.asignacionId), fecha: f.disponibleDesde },
        lectura,
      )
    case 'vencePronto': {
      const faltan = new Date(f.venceEl).getTime() - ahora.getTime()
      if (faltan <= 0 || faltan > HORAS_VENCE_PRONTO * MS_HORA) return null
      // Entra a la lista cuando le quedan 24 h (o cuando se creó, si fue después).
      const desde = Math.max(new Date(f.venceEl).getTime() - HORAS_VENCE_PRONTO * MS_HORA, new Date(f.creadaEl).getTime())
      return crearAviso(
        'vencePronto',
        {
          clave: `vencePronto|${f.asignacionId}`,
          titulo: T.vencePronto(Math.floor(faltan / MS_HORA)),
          detalle: T.detalleTarea(f.grupo, f.tarea),
          href: hrefDeTarea(f.asignacionId),
          fecha: new Date(desde).toISOString(),
        },
        lectura,
      )
    }
    case 'diagnosticoNuevo':
      return crearAviso(
        'diagnosticoNuevo',
        {
          clave: `diagnosticoNuevo|${f.diagnosticoId}`,
          titulo: T.diagnosticoNuevo,
          detalle: T.detalleDiagnostico(f.grupo, f.cuestionarios),
          href: hrefDeTarea(f.primeraAsignacionId),
          fecha: f.creadoEl,
        },
        lectura,
      )
    case 'reporteResuelto':
      return crearAviso(
        'reporteResuelto',
        {
          clave: `reporteResuelto|${f.reporteId}`,
          titulo: T.reporteResuelto,
          detalle: T.detalleReporte(f.respondidoPor, f.conMensaje),
          href: `/reportes/${f.reporteId}`,
          fecha: f.resueltoEl,
        },
        lectura,
      )
    case 'temaSuperado':
      return crearAviso(
        'temaSuperado',
        { clave: `temaSuperado|${f.misconceptionId}`, titulo: T.temaSuperado, detalle: T.detalleTema(f.tema, f.porDocente), href: '/history', fecha: f.superadoEl },
        lectura,
      )
    case 'racha': {
      const desde = rachaEnRiesgoDesde(f.racha, f.ultimaPractica, ahora)
      if (!desde) return null
      return crearAviso(
        'rachaEnRiesgo',
        {
          clave: `rachaEnRiesgo|${diaEnArgentina(ahora)}`,
          titulo: T.rachaEnRiesgo(f.racha),
          detalle: T.detalleRacha,
          // El invitado no tiene práctica libre (E2): su práctica son las tareas del grupo.
          href: esInvitado ? '/aulas' : '/practicar',
          fecha: desde,
        },
        lectura,
      )
    }
  }
}

export function armarAvisosDelAlumno(
  filas: readonly FilaDeAvisoAlumno[],
  lectura: Lectura,
  ahora: Date,
  { esInvitado = false, max = 30 }: { esInvitado?: boolean; max?: number } = {},
): Aviso[] {
  const avisos = filas.map((f) => avisoDe(f, lectura, ahora, esInvitado)).filter((a): a is Aviso => a !== null)
  // Una tarea que vence pronto ya avisa de sí misma: no se repite como "nueva".
  const vencen = new Set(avisos.filter((a) => a.tipo === 'vencePronto').map((a) => a.href))
  return ordenarAvisos(
    avisos.filter((a) => !(a.tipo === 'tareaNueva' && vencen.has(a.href))),
    max,
  )
}
