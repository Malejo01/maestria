import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { marcarFundadora } from '@/lib/planes-server'

/**
 * POST /api/admin/planes/fundadora — { docenteId, fundadora }
 *
 * Ronda T · B2: la marca de docente fundadora (birrete con estrella, para
 * siempre). La pone y la saca SÓLO el admin: no se cae sola al vencer ni al
 * cambiar de plan. Queda una línea en `plan_notas`. Para el resto, 404.
 */
const esquema = z.object({ docenteId: z.string().min(1), fundadora: z.boolean() })

export async function POST(req: Request) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const datos = esquema.safeParse(await req.json().catch(() => null))
  if (!datos.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  try {
    const ok = await marcarFundadora({
      docenteId: datos.data.docenteId,
      fundadora: datos.data.fundadora,
      marcadoPor: admin.email ?? admin.displayName,
    })
    if (ok === 'sin_migracion') return NextResponse.json({ error: 'Falta correr la migración 037.' }, { status: 409 })
    if (!ok) return NextResponse.json({ error: 'Ese docente no existe.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/planes/fundadora', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
