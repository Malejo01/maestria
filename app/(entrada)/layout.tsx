import { BotonModo } from '@/components/sistema/boton-modo'
import { EnlacesLegales } from '@/components/legal-notice'

/**
 * Marco de las pantallas de entrada: la raíz, el ingreso y el link de grupo.
 *
 * Sin barra de navegación y sin nada que distraiga: cada una de estas pantallas
 * pide una sola decisión. Lo único fijo es el botón de modo arriba y los links
 * legales al pie.
 */
export default function EntradaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-superficie-base">
      <div className="flex justify-end px-4 pt-4">
        <BotonModo />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">{children}</main>
      <footer className="flex justify-center px-4 pb-4">
        <EnlacesLegales />
      </footer>
    </div>
  )
}
