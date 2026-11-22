import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getViewer } from '@/lib/auth-session'
import { guardarResultado } from '@/lib/autodidacta-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/** Ronda T · E1 — POST: el resultado de un diagnóstico, una práctica o un simulacro, tema por tema. */
const esquema = z.object({
  tipo: z.enum(['diagnostico', 'practica', 'simulacro']),
  porTema: z.array(z.object({ tema: z.string().min(1).max(300), correctas: z.number().int().min(0), total: z.number().int().min(1) })).max(60),
  nota: z.number().min(0).max(10).nullable().default(null),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  const id = Number((await params).id)
  const datos = esquema.safeParse(await req.json().catch(() => null))
  if (!Number.isInteger(id) || id <= 0 || !datos.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  if (datos.data.porTema.some((t) => t.correctas > t.total)) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  try {
    const ok = await guardarResultado(viewer.id, id, datos.data.tipo, datos.data.porTema, datos.data.nota)
    if (!ok) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta/[id]/resultados', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
