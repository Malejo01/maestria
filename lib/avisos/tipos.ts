/**
 * P2 · El modelo común de los avisos de la campanita, para el docente y para
 * el alumno (P3). Docente y alumno cambian sólo las fuentes de datos: el aviso
 * que llega a la pantalla tiene siempre esta forma, y un solo componente lo
 * dibuja (components/sistema/aviso-item.tsx).
 *
 * Es una unión discriminada por `tipo`: cada tipo fija su rol semántico (el
 * tinte del círculo) y su ícono en ESTILO_DEL_AVISO, así que no hay forma de
 * armar un "reporte" verde o una "tarea terminada" con bandera.
 */

/** El rol semántico del aviso: decide el tinte del círculo del ícono (tokens de app/tokens.css). */
export type RolDeAviso = 'exito' | 'informacion' | 'atencion'

/** Íconos de lucide, por nombre del sistema (el componente los resuelve). */
export type IconoDeAviso = 'checkLista' | 'personaMas' | 'bandera' | 'tareaNueva' | 'reloj' | 'diagnostico' | 'resuelto' | 'trofeo' | 'llama'

export type TipoDeAviso =
  // Docente (O10)
  | 'tareaTerminada'
  | 'alumnosNuevos'
  | 'reporte'
  // Docente (ronda T · C2): el pago desde la app se acreditó
  | 'pagoAcreditado'
  // Docente (ronda V · V3): un docente que recomendó pagó, +30 días
  | 'referidoPremio'
  // Alumno (P3)
  | 'tareaNueva'
  | 'vencePronto'
  | 'diagnosticoNuevo'
  | 'reporteResuelto'
  | 'temaSuperado'
  | 'rachaEnRiesgo'

export const ESTILO_DEL_AVISO: Record<TipoDeAviso, { rol: RolDeAviso; icono: IconoDeAviso }> = {
  tareaTerminada: { rol: 'exito', icono: 'checkLista' },
  alumnosNuevos: { rol: 'informacion', icono: 'personaMas' },
  reporte: { rol: 'atencion', icono: 'bandera' },
  pagoAcreditado: { rol: 'exito', icono: 'resuelto' },
  referidoPremio: { rol: 'exito', icono: 'trofeo' },
  tareaNueva: { rol: 'informacion', icono: 'tareaNueva' },
  vencePronto: { rol: 'atencion', icono: 'reloj' },
  diagnosticoNuevo: { rol: 'informacion', icono: 'diagnostico' },
  reporteResuelto: { rol: 'exito', icono: 'resuelto' },
  temaSuperado: { rol: 'exito', icono: 'trofeo' },
  rachaEnRiesgo: { rol: 'atencion', icono: 'llama' },
}

interface AvisoBase<T extends TipoDeAviso> {
  tipo: T
  /** Estable entre pedidos: la clave de React y de la animación. */
  clave: string
  rol: (typeof ESTILO_DEL_AVISO)[T]['rol']
  icono: (typeof ESTILO_DEL_AVISO)[T]['icono']
  /** Corto, en negrita: "8 terminaron la tarea". */
  titulo: string
  /** Una línea: "Matemática 1 Virtual · Práctica de funciones". */
  detalle: string
  /** A dónde lleva tocar la fila. */
  href: string
  /** El evento más nuevo del aviso (ISO). Decide el orden, el grupo del día y si es no leído. */
  fecha: string
  noLeido: boolean
}

export type Aviso = { [T in TipoDeAviso]: AvisoBase<T> }[TipoDeAviso]

/** Lo que devuelven las dos APIs de la campanita. */
export interface RespuestaDeAvisos {
  avisos: Aviso[]
  vistoEl: string | null
  /**
   * Si se puede guardar "leído". Falso con la válvula (sin la 035/034): la
   * campanita muestra los avisos sin contador ni "Marcar todo como leído".
   */
  puedeMarcar: boolean
}

/**
 * Cuándo se miró la campanita por última vez. `puedeMarcar` falso es la
 * válvula (falta la columna o la tabla): nada cuenta como no leído.
 */
export interface Lectura {
  vistoEl: string | null
  puedeMarcar: boolean
}

export function esNoLeido(fecha: string, lectura: Lectura): boolean {
  return lectura.puedeMarcar && (!lectura.vistoEl || fecha > lectura.vistoEl)
}

/** Arma un aviso con el estilo de su tipo. Todas las fuentes pasan por acá. */
export function crearAviso<T extends TipoDeAviso>(
  tipo: T,
  datos: { clave: string; titulo: string; detalle: string; href: string; fecha: string },
  lectura: Lectura,
): AvisoBase<T> {
  const { rol, icono } = ESTILO_DEL_AVISO[tipo]
  return { tipo, ...datos, rol, icono, noLeido: esNoLeido(datos.fecha, lectura) } as AvisoBase<T>
}
