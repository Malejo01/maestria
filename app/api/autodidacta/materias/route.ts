import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getViewer } from '@/lib/auth-session'
import { crearMateriaPersonal, leerAutodidacta } from '@/lib/autodidacta-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · E1 — POST: crea la materia personal (el temario que leyó la
 * subida del programa, la fecha del examen y el área detectada). Sólo con la
 * declaración de mayor de 18 hecha.
 */
const esquema = z.object({
  nombre: z.string().trim().min(2).max(120),
  fechaExamen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unidades: z.array(z.object({ name: z.string(), topics: z.array(z.object({ name: z.string() })).min(1) })).min(1).max(30),
  area: z.string().optional(),
  areaConfianza: z.number().optional(),
})

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  const datos = esquema.safeParse(await req.json().catch(() => null))
  if (!datos.success) return NextResponse.json({ error: 'Faltan el nombre, la fecha del examen o el temario.' }, { status: 400 })
  try {
    const estado = await leerAutodidacta(viewer.id)
    if (!estado.disponible) return NextResponse.json({ error: 'Todavía no está disponible.' }, { status: 409 })
    if (!estado.mayorDeEdad) return NextResponse.json({ error: 'Tenés que declarar que sos mayor de 18.' }, { status: 403 })
    const id = await crearMateriaPersonal(viewer.id, datos.data)
    return NextResponse.json({ id })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta/materias', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo crear la materia' }, { status: 500 })
  }
}
