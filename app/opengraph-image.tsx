import { ImageResponse } from 'next/og'
import { tokensDelSistema } from '@/lib/tokens-del-sistema'
import { MARCA, PORTADA } from '@/lib/textos'

/**
 * Ronda V · V5 — La imagen para compartir (Open Graph): el nombre y la tesis,
 * con los colores de app/tokens.css (leídos del archivo: la imagen se dibuja
 * en el servidor y no ve las variables de CSS).
 */
export const runtime = 'nodejs'
export const alt = `${MARCA.nombre}: ${PORTADA.titular}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function ImagenParaCompartir() {
  const t = await tokensDelSistema('claro')
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: t['superficie-base'],
          color: t.texto,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>
          <span>Maestr</span>
          <span style={{ color: t.accion }}>IA</span>
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{PORTADA.titular}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, color: t['texto-suave'] }}>
          <div style={{ display: 'flex', width: 56, height: 8, borderRadius: 4, background: t.accion }} />
          <span>Tareas y práctica con IA, para cualquier materia</span>
        </div>
      </div>
    ),
    size,
  )
}
