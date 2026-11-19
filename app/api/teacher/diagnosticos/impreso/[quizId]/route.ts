import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { validarCarga } from '@/lib/diagnostico-impreso'
import { cantidadDePreguntas, guardarCarga, leerParaImprimir } from '@/lib/diagnostico-impreso-server'
import { faltaLa027, type Destino } from '@/lib/fichas-server'

export const dynamic = 'force-dynamic'

function destinoDe(alumno: unknown, invitacion: unknown): Destino | null {
  if (typeof alumno === 'string' && alumno) return { userId: alumno }
  const n = Number(invitacion)
  return Number.isInteger(n) && n > 0 ? { invitacionId: n } : null
}

/**
 * GET /api/teacher/diagnosticos/impreso/[quizId]?alumno=… | ?invitacion=…
 *
 * J7: el cuestionario para imprimir (enunciados, opciones y, aparte, las
 * respuestas correctas para la hoja del docente) y la última carga a mano.
 */
export async function GET(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const quizId = Number((await params).quizId)
  const busqueda = new URL(req.url).searchParams
  const destino = destinoDe(busqueda.get('alumno'), busqueda.get('invitacion'))
  if (!Number.isInteger(quizId) || !destino) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  try {
    const datos = await leerParaImprimir(teacher.id, quizId, destino)
    if (!datos) return NextResponse.json({ error: 'Ese cuestionario no es de este alumno' }, { status: 404 })
    return NextResponse.json(datos)
  } catch (error) {
    if (faltaLa027(error)) return NextResponse.json({ error: 'El diagnóstico todavía no está disponible.' }, { status: 409 })
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos/impreso/[quizId]', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

const cargaSchema = z.object({
  alumno: z.string().min(1).optional(),
  invitacion: z.number().int().positive().optional(),
  respuestas: z.record(z.string(), z.string()),
})

/**
 * POST /api/teacher/diagnosticos/impreso/[quizId] — { alumno | invitacion, respuestas }
 *
 * J7: guarda lo que el docente marcó desde el papel (bien / mal / sin
 * responder por pregunta). Queda sólo en el resultado del diagnóstico.
 */
export async function POST(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const quizId = Number((await params).quizId)
  const cuerpo = cargaSchema.safeParse(await req.json().catch(() => null))
  const destino = cuerpo.success ? destinoDe(cuerpo.data.alumno, cuerpo.data.invitacion) : null
  if (!Number.isInteger(quizId) || !cuerpo.success || !destino) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  try {
    const cantidad = await cantidadDePreguntas(teacher.id, quizId)
    if (cantidad === null) return NextResponse.json({ error: 'Ese cuestionario no es tuyo' }, { status: 404 })
    const respuestas = validarCarga(cuerpo.data.respuestas, cantidad)
    if (!respuestas) return NextResponse.json({ error: 'Marcá cada pregunta como bien, mal o sin responder.' }, { status: 400 })
    const guardada = await guardarCarga(teacher.id, quizId, destino, respuestas)
    if (!guardada) return NextResponse.json({ error: 'Ese cuestionario no es de este alumno' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (faltaLa027(error)) return NextResponse.json({ error: 'El diagnóstico todavía no está disponible.' }, { status: 409 })
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos/impreso/[quizId]', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo guardar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
