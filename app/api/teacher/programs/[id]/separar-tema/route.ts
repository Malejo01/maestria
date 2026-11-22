import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { sql } from '@/lib/db'
import { guardAiCall } from '@/lib/ai-guard'
import { sumUsage } from '@/lib/ai-usage'
import { separarTemaLargo } from '@/lib/temas-granulares'
import { dividirParrafosConIA } from '@/lib/dividir-parrafo-server'
import { aplicarSeparacion, validarPedazos, type UnidadGuardada } from '@/lib/separar-guardado'
import { captureRouteFailure } from '@/lib/observability'
import { SEPARAR_EN_TEMAS as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · D2 — "Separar en temas" un tema largo de una materia guardada.
 *
 *   { unidadId, temaId, accion: 'proponer' }            → { pedazos, viaIA }
 *   { unidadId, temaId, accion: 'aplicar', pedazos }    → guarda lo revisado
 *
 * Proponer usa el corte seguro (D1); si no hay, la IA divide sólo ese párrafo
 * (verificado), y eso pasa por el plan y el límite. Aplicar guarda lo que el
 * docente revisó: el primer tema conserva el id original.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const docente = await getTeacherViewer()
  if (!docente) return NextResponse.json({ error: 'Sólo docentes' }, { status: 403 })
  const programId = Number((await params).id)
  const cuerpo = (await req.json().catch(() => null)) as { unidadId?: unknown; temaId?: unknown; accion?: unknown; pedazos?: unknown } | null
  if (!Number.isInteger(programId) || programId <= 0 || typeof cuerpo?.unidadId !== 'string' || typeof cuerpo?.temaId !== 'string') {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  try {
    const [programa] = (await sql`
      SELECT units FROM teacher_programs WHERE id = ${programId} AND user_id = ${docente.id} AND status = 'active'
    `) as { units: UnidadGuardada[] | null }[]
    if (!programa) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    const unidades = Array.isArray(programa.units) ? programa.units : []
    const tema = unidades.find((u) => u.id === cuerpo.unidadId)?.topics.find((t) => t.id === cuerpo.temaId)
    if (!tema) return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })

    if (cuerpo.accion === 'aplicar') {
      const pedazos = validarPedazos(cuerpo.pedazos)
      if (!pedazos) return NextResponse.json({ error: T.pedazosInvalidos }, { status: 400 })
      const nuevas = aplicarSeparacion(unidades, cuerpo.unidadId, cuerpo.temaId, pedazos)!
      await sql`UPDATE teacher_programs SET units = ${JSON.stringify(nuevas)}, updated_at = NOW() WHERE id = ${programId} AND user_id = ${docente.id}`
      return NextResponse.json({ units: nuevas })
    }

    const separado = separarTemaLargo(tema.name)
    if (separado.seguro || separado.pedazos.length > 1) return NextResponse.json({ pedazos: separado.pedazos, viaIA: false })

    const guard = await guardAiCall({ bucket: 'program_extraction', actor: 'docente', errorBody: () => ({ pedazos: [tema.name], viaIA: false }) })
    if (!guard.ok) return guard.response
    const { divisiones, usos } = await dividirParrafosConIA([tema.name])
    await guard.finish(sumUsage(...usos))
    const dividido = divisiones.get(tema.name.replace(/\s+/g, ' ').trim())
    return NextResponse.json({ pedazos: dividido ?? [tema.name], viaIA: Boolean(dividido) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/programs/[id]/separar-tema', operation: 'POST' })
    return NextResponse.json({ error: T.noSePudo }, { status: 500 })
  }
}
