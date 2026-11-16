import { redirect } from 'next/navigation'

/**
 * Los tips dejaron de ser una pantalla aparte: son una pestaña de Mi progreso.
 * Esta ruta queda para no romper links viejos.
 */
export default function TipsPage() {
  redirect('/history?tab=tips')
}
