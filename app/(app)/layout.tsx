import { AppGuards } from '@/components/app-guards'
import { Caparazon } from '@/components/caparazon/caparazon'
import { getViewer } from '@/lib/auth-session'

/**
 * Marco de las pantallas de la app (todo lo que no es entrada ni cuestionario a
 * pantalla completa). Resuelve en el servidor quién está mirando —cuenta o
 * invitado, por la misma vía que las rutas: getViewer()— para que la barra
 * correcta salga en el primer pintado y no después de un fetch.
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()

  return (
    <AppGuards>
      <Caparazon
        quien={
          viewer
            ? {
                nombre: viewer.displayName,
                email: viewer.email,
                rol: viewer.role,
                esInvitado: viewer.isGuest,
              }
            : null
        }
      >
        {children}
      </Caparazon>
    </AppGuards>
  )
}
