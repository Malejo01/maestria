import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { APLICA_A, FORMAS, codigoValido, normalizarCodigo } from '@/lib/codigos-descuento'
import { crearCodigo, listarCodigos } from '@/lib/codigos-descuento-server'

/**
 * Ronda T · C1 — Los códigos de descuento del admin. GET: la lista con sus
 * usos. POST: crea uno. Sólo ADMIN_EMAILS; para el resto, 404.
 */
const esquema = z.object({
  codigo: z.string().transform(normalizarCodigo).refine(codigoValido, 'Código inválido'),
  porcentaje: z.number().int().min(1).max(100),
  aplica: z.enum(APLICA_A as unknown as [string, ...string[]]),
  forma: z.enum(FORMAS as unknown as [string, ...string[]]),
  meses: z.number().int().min(1).max(36).nullable().default(null),
  usosMaximos: z.number().int().min(1).max(1000).default(1),
  venceEl: z.string().datetime({ offset: true }).nullable().default(null),
  fundadora: z.boolean().default(false),
  nota: z.string().max(300).default(''),
})

export async function GET() {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  try {
    const codigos = await listarCodigos()
    if (codigos === 'sin_migracion') return NextResponse.json({ error: 'Falta correr la migración 038.' }, { status: 409 })
    return NextResponse.json({ codigos })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/codigos', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer los códigos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const datos = esquema.safeParse(await req.json().catch(() => null))
  if (!datos.success) {
    return NextResponse.json({ error: 'Revisá el código (letras, números y guiones), el porcentaje y a qué aplica.' }, { status: 400 })
  }
  try {
    const creado = await crearCodigo({
      ...datos.data,
      aplica: datos.data.aplica as never,
      forma: datos.data.forma as never,
      creadoPor: admin.email ?? admin.displayName,
    })
    if (creado === 'sin_migracion') return NextResponse.json({ error: 'Falta correr la migración 038.' }, { status: 409 })
    if (creado === 'repetido') return NextResponse.json({ error: 'Ya existe un código con ese nombre.' }, { status: 409 })
    return NextResponse.json({ ok: true, id: creado.id })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/codigos', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo crear el código' }, { status: 500 })
  }
}
