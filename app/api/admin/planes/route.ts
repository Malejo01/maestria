import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { NIVELES, sumarDias, type NivelPlan } from '@/lib/planes'
import { acreditarPlan } from '@/lib/planes-server'

/**
 * POST /api/admin/planes — { docenteId, nivel, dias? | venceEl?, nota }
 *
 * G4: Mauro acredita a mano lo que un docente pagó por un link de
 * MercadoPago. Fija nivel y vencimiento y AGREGA una línea a `plan_notas` con
 * quién acreditó y cuándo: toda acreditación queda registrada, y nada se
 * edita en la base a mano. Sólo la lista de ADMIN_EMAILS; para el resto, 404.
 */
const esquema = z
  .object({
    docenteId: z.string().min(1),
    nivel: z.number().int().refine((n) => (NIVELES as readonly number[]).includes(n)),
    // Desde hoy: 30 (mensual) o 90 (pase). O una fecha exacta.
    dias: z.number().int().min(1).max(400).optional(),
    venceEl: z.string().datetime({ offset: true }).optional(),
    nota: z.string().max(300).default(''),
    // B1: el plan Aula, con sus cursos (Particular si no viene).
    tipo: z.enum(['particular', 'aula']).optional(),
    cursos: z.number().int().min(1).max(50).optional(),
  })
  .refine((datos) => datos.dias !== undefined || datos.venceEl !== undefined, 'Falta hasta cuándo')

export async function POST(req: Request) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const datos = esquema.safeParse(await req.json().catch(() => null))
  if (!datos.success) {
    return NextResponse.json({ error: 'Elegí el nivel (o los cursos) y hasta cuándo.' }, { status: 400 })
  }

  const ahora = new Date()
  const venceEl = datos.data.venceEl ? new Date(datos.data.venceEl) : sumarDias(ahora, datos.data.dias!)
  try {
    const acreditado = await acreditarPlan({
      docenteId: datos.data.docenteId,
      nivel: datos.data.nivel as NivelPlan,
      venceEl,
      nota: datos.data.nota,
      acreditadoPor: admin.email ?? admin.displayName,
      ahora,
      tipo: datos.data.tipo,
      cursos: datos.data.cursos,
    })
    if (!acreditado) return NextResponse.json({ error: 'Ese docente no existe.' }, { status: 404 })
    return NextResponse.json({ ok: true, venceEl: venceEl.toISOString() })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/planes', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo acreditar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
