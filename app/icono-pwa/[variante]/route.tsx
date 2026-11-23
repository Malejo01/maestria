import { ImageResponse } from 'next/og'
import { tokensDelSistema } from '@/lib/tokens-del-sistema'

/**
 * Ronda X · X4 — Los íconos de la app instalada, dibujados desde los tokens
 * (`accion` de fondo, `texto-sobre-accion` en la M), como el favicon.
 *   /icono-pwa/192, /icono-pwa/512   con las esquinas redondeadas;
 *   /icono-pwa/maskable-512          a sangre, con la M dentro de la zona
 *                                    segura (el 80 % del centro), para que el
 *                                    sistema le ponga la forma que quiera.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-static'

const VARIANTES = { '192': { lado: 192, enmascarable: false }, '512': { lado: 512, enmascarable: false }, 'maskable-512': { lado: 512, enmascarable: true } } as const

export function generateStaticParams() {
  return Object.keys(VARIANTES).map((variante) => ({ variante }))
}

/** La M del logo (la misma del favicon), en un trazo del color que se pida. */
function laM(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22.2 -29.7 144.4 144.4"><g fill="none" stroke="${color}" stroke-width="9.5" stroke-linejoin="round"><path d="M-11.8 0 L-11.8 85 A11.8 11.8 0 0 0 11.8 85 L11.8 0 A11.8 11.8 0 0 0 -11.8 0 Z"/><path d="M88.2 0 L88.2 85 A11.8 11.8 0 0 0 111.8 85 L111.8 0 A11.8 11.8 0 0 0 88.2 0 Z"/><path d="M-8.34 8.34 L41.66 58.34 A11.8 11.8 0 0 0 58.34 41.66 L8.34 -8.34 A11.8 11.8 0 0 0 -8.34 8.34 Z"/><path d="M91.66 -8.34 L41.66 41.66 A11.8 11.8 0 0 0 58.34 58.34 L108.34 8.34 A11.8 11.8 0 0 0 91.66 -8.34 Z"/></g></svg>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ variante: string }> }) {
  const v = VARIANTES[(await params).variante as keyof typeof VARIANTES]
  if (!v) return new Response('No existe', { status: 404 })
  const t = await tokensDelSistema('claro')
  const m = `data:image/svg+xml;base64,${Buffer.from(laM(t['texto-sobre-accion'])).toString('base64')}`
  const ladoM = Math.round(v.lado * (v.enmascarable ? 0.5 : 0.7))
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: t.accion,
          borderRadius: v.enmascarable ? 0 : Math.round(v.lado * 0.27),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m} width={ladoM} height={ladoM} alt="" />
      </div>
    ),
    { width: v.lado, height: v.lado },
  )
}
