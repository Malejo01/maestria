/**
 * Los cuatro contextos de la app y la navegación de cada uno.
 *
 * Una persona está siempre en un solo contexto, y el contexto decide qué barra
 * ve. Es una función pura a propósito: la regla de "quién ve qué" es la que
 * más se rompía en la versión anterior (una sola barra para todos, con un
 * desplegable que cambiaba el rol en caliente), así que vive acá, con tests, y
 * no repartida en condicionales de JSX.
 *
 *  - visitante: sin cuenta ni cookie de invitado. No tiene navegación.
 *  - invitado:  entró a un grupo con su nombre. Ve su grupo y nada más.
 *  - alumno:    Mis tareas / Practicar / Mi progreso.
 *  - docente:   Mis alumnos / Mis materias / Mis tareas.
 *
 * El docente NO ve la navegación del alumno… salvo cuando abre a propósito la
 * vista de alumno (otra pestaña, desde el menú de su cuenta). Ahí ve la barra
 * de alumno con un aviso encima, y su rol no cambia: `vistaPrevia` lo marca.
 */
import { NAVEGACION } from '@/lib/textos'
import type { UserRole } from '@/lib/types'

export type Contexto = 'visitante' | 'invitado' | 'alumno' | 'docente'

export interface QuienMira {
  rol: UserRole | null
  esInvitado: boolean
}

export type IconoNav = 'personas' | 'libro' | 'tarea' | 'lapiz' | 'avance'

export interface EntradaNav {
  id: string
  etiqueta: string
  href: string
  icono: IconoNav
}

export type SeccionDocente = 'alumnos' | 'materias' | 'tareas'

export const SECCION_DOCENTE_POR_DEFECTO: SeccionDocente = 'alumnos'

const NAV_ALUMNO: EntradaNav[] = [
  { id: 'tareas', etiqueta: NAVEGACION.alumno.tareas, href: '/aulas', icono: 'tarea' },
  { id: 'practicar', etiqueta: NAVEGACION.alumno.practicar, href: '/practicar', icono: 'lapiz' },
  { id: 'progreso', etiqueta: NAVEGACION.alumno.progreso, href: '/history', icono: 'avance' },
]

const NAV_DOCENTE: EntradaNav[] = [
  { id: 'alumnos', etiqueta: NAVEGACION.docente.alumnos, href: '/teacher', icono: 'personas' },
  { id: 'materias', etiqueta: NAVEGACION.docente.materias, href: '/teacher?seccion=materias', icono: 'libro' },
  { id: 'tareas', etiqueta: NAVEGACION.docente.tareas, href: '/teacher?seccion=tareas', icono: 'tarea' },
]

function esRutaDocente(pathname: string): boolean {
  return pathname === '/teacher' || pathname.startsWith('/teacher/')
}

/** Las pantallas legales las ve cualquiera y no pertenecen a ningún rol. */
function esRutaNeutral(pathname: string): boolean {
  return pathname === '/terminos' || pathname === '/privacidad'
}

export function esSeccionDocente(valor: string | null | undefined): valor is SeccionDocente {
  return valor === 'alumnos' || valor === 'materias' || valor === 'tareas'
}

/**
 * P3: qué campanita va en la barra. El docente, la suya (sus grupos); el
 * alumno y el invitado, la suya (sus tareas). Ninguna para el visitante ni en
 * la vista previa: el docente no tiene avisos de alumno y mostrarle los de
 * otro sería peor que nada.
 */
export type Campanita = 'docente' | 'alumno' | null

export interface Caparazon {
  contexto: Contexto
  entradas: EntradaNav[]
  /** Un docente mirando las pantallas de alumno. Su rol sigue siendo DOCENTE. */
  vistaPrevia: boolean
  campanita: Campanita
}

export function resolverCaparazon(quien: QuienMira | null, pathname: string): Caparazon {
  if (!quien) return { contexto: 'visitante', entradas: [], vistaPrevia: false, campanita: null }
  if (quien.esInvitado) return { contexto: 'invitado', entradas: [], vistaPrevia: false, campanita: 'alumno' }

  if (quien.rol === 'DOCENTE') {
    if (esRutaDocente(pathname) || esRutaNeutral(pathname)) {
      return { contexto: 'docente', entradas: NAV_DOCENTE, vistaPrevia: false, campanita: 'docente' }
    }
    return { contexto: 'alumno', entradas: NAV_ALUMNO, vistaPrevia: true, campanita: null }
  }

  // ALUMNO, o una cuenta que todavía no eligió rol: mientras no elija, la
  // pantalla de bienvenida tapa todo, así que esta barra no llega a verse.
  return { contexto: 'alumno', entradas: NAV_ALUMNO, vistaPrevia: false, campanita: 'alumno' }
}

/** Qué entrada de la barra corresponde a la URL actual, o null si ninguna. */
export function entradaActiva(
  contexto: Contexto,
  pathname: string,
  seccion: string | null | undefined,
): string | null {
  if (contexto === 'docente') {
    if (!esRutaDocente(pathname)) return null
    // /teacher/diagnostico cuelga de "Mis alumnos": es lo más cerca que está.
    if (pathname !== '/teacher') return 'alumnos'
    return esSeccionDocente(seccion) ? seccion : SECCION_DOCENTE_POR_DEFECTO
  }

  if (contexto === 'alumno') {
    if (pathname === '/aulas' || pathname.startsWith('/aulas/')) return 'tareas'
    if (pathname === '/practicar' || pathname.startsWith('/practicar/')) return 'practicar'
    if (pathname === '/history' || pathname === '/tips') return 'progreso'
  }

  return null
}

/** A dónde va cada quien cuando entra a la raíz del sitio. Null = se queda en la entrada. */
export function inicioDe(quien: QuienMira | null): string | null {
  if (!quien) return null
  if (quien.esInvitado) return '/aulas'
  if (quien.rol === 'DOCENTE') return '/teacher'
  if (quien.rol === 'ALUMNO') return '/aulas'
  return null
}
