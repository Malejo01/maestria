import { AppGuards } from '@/components/app-guards'
import { Caparazon } from '@/components/caparazon/caparazon'
import { getViewer } from '@/lib/auth-session'
import { quienEntroDe } from '@/lib/quien-entro'

/**
 * Marco de las pantallas de la app (todo lo que no es entrada ni cuestionario a
 * pantalla completa). Resuelve en el servidor quién está mirando —cuenta o
 * invitado, por la misma vía que las rutas: getViewer()— para que la barra
 * correcta salga en el primer pintado y no después de un fetch. También si es
 * de la lista de admin, que es una variable de entorno que el navegador no ve.
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()

  return (
    <AppGuards>
      <Caparazon quien={quienEntroDe(viewer)}>{children}</Caparazon>
    </AppGuards>
  )
}
