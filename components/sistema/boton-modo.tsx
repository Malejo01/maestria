'use client'

import { Moon, Sun } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { useTema } from '@/hooks/use-tema'
import { MODO } from '@/lib/textos'
import { TRAZO_ICONO } from '@/components/sistema/iconos'

/** El botón de la barra que alterna claro y oscuro. El claro es el modo por defecto. */
export function BotonModo({ className }: { className?: string }) {
  const { tema, cambiarTema } = useTema()
  const aOscuro = tema === 'claro'

  return (
    <Boton
      variante="icono"
      className={className}
      aria-label={aOscuro ? MODO.aOscuro : MODO.aClaro}
      onClick={() => cambiarTema(aOscuro ? 'oscuro' : 'claro')}
      // El ícono depende de localStorage, que el servidor no conoce.
      suppressHydrationWarning
    >
      {aOscuro ? (
        <Moon aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      ) : (
        <Sun aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      )}
    </Boton>
  )
}
