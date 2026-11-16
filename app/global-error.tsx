'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Los colores van escritos a mano y es la única pantalla donde eso está bien:
 * cuando esto se muestra, la hoja de estilos de la app no cargó, así que no hay
 * variables CSS que leer. Son el espejo de los tokens `texto`, `texto-suave`,
 * `superficie-base` y `superficie-tarjeta` del modo claro.
 *
 * Último recurso: sólo se muestra cuando revienta el layout raíz, es decir
 * cuando la app entera no pudo montar. Reemplaza al `<html>`, así que tiene que
 * traer sus propias etiquetas y no puede apoyarse en nada del layout.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          background: '#f6f7f9',
          color: '#15181d',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>Algo se rompió de nuestro lado</h1>
          <p style={{ color: '#667085', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
            Ya nos llegó el aviso y lo estamos mirando. Probá recargar la página; si sigue igual,
            volvé en un rato.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.4rem',
              fontSize: '1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#15181d',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  )
}
