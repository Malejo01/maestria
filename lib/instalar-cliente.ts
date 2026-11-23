/**
 * Ronda X · X4 — Lo del navegador para instalar MaestrIA (sólo cliente).
 * `beforeinstallprompt` llega temprano, en cualquier página: se guarda acá
 * para usarlo cuando corresponda (lib/pwa.ts `debeOfrecerInstalar`).
 */
interface EventoDeInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoDeInstalacion | null = null
let escuchando = false
const CLAVE_PRACTICAS = 'maestria:practicas-terminadas'
const CLAVE_ULTIMA = 'maestria:ultima-practica-contada'
const CLAVE_OFRECIDO = 'maestria:instalar-ofrecido'

export function escucharInstalacion(): void {
  if (escuchando || typeof window === 'undefined') return
  escuchando = true
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sin la barrita automática de Chrome: se ofrece una vez, en su momento.
    e.preventDefault()
    evento = e as EventoDeInstalacion
  })
  window.addEventListener('appinstalled', () => {
    evento = null
  })
}

export function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** iPhone o iPad con Safari: no hay `beforeinstallprompt`, se explica cómo. */
export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function sePuedeInstalar(): boolean {
  return evento !== null || (esIOS() && !estaInstalada())
}

export async function pedirInstalacion(): Promise<boolean> {
  if (!evento) return false
  await evento.prompt()
  const { outcome } = await evento.userChoice
  evento = null
  return outcome === 'accepted'
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento (modo privado): no se ofrece, y está bien.
  }
}

/** Cuenta una práctica terminada (una vez por intento) y devuelve cuántas van. */
export function contarPractica(intento: string): number {
  const van = Number(leer(CLAVE_PRACTICAS) ?? 0) || 0
  if (leer(CLAVE_ULTIMA) === intento) return van
  escribir(CLAVE_ULTIMA, intento)
  escribir(CLAVE_PRACTICAS, String(van + 1))
  return van + 1
}

export const yaSeOfrecio = () => leer(CLAVE_OFRECIDO) === '1'
export const marcarOfrecido = () => escribir(CLAVE_OFRECIDO, '1')
