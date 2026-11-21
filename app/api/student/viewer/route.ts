import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'

/**
 * M1: quién es el que mira, para el navegador. Las claves del borrador local
 * y de los resultados pendientes llevan el id de la persona (un celular
 * compartido entre hermanos no mezcla cuestionarios), y un invitado no tiene
 * sesión de NextAuth de donde leerlo: sólo su cookie firmada, que el cliente
 * no puede abrir.
 */
export async function GET() {
  try {
    const viewer = await getViewer()
    return NextResponse.json(
      { id: viewer?.id ?? null, isGuest: viewer?.isGuest ?? false },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    // Sin base no hay borrador con clave de persona; el cuestionario anda igual.
    return NextResponse.json({ id: null, isGuest: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
