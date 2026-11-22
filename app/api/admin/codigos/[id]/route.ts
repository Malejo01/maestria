import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { activarCodigo } from '@/lib/codigos-descuento-server'

/** Ronda T · C1 — Activar o desactivar un código. Sólo ADMIN_EMAILS. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const id = Number((await params).id)
  const datos = z.object({ activo: z.boolean() }).safeParse(await req.json().catch(() => null))
  if (!Number.isInteger(id) || id <= 0 || !datos.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  try {
    const ok = await activarCodigo(id, datos.data.activo)
    if (ok === 'sin_migracion') return NextResponse.json({ error: 'Falta correr la migración 038.' }, { status: 409 })
    if (!ok) return NextResponse.json({ error: 'Ese código no existe.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/codigos/[id]', operation: 'PATCH' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
