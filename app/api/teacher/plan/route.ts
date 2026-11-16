import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { opcionDePago, nivelQueAlcanza } from '@/lib/planes'
import { resumenDelPlan } from '@/lib/planes-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/plan — el plan del docente que mira el panel: estado,
 * alumnos contados (invitados incluidos), cupo, vencimiento y si le falta ver
 * el aviso de la prueba. Con la 026 sin correr, o para la cuenta exenta,
 * devuelve `exento` y la UI no muestra nada.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  try {
    const resumen = await resumenDelPlan(teacher.id, teacher.email)
    // Lo que se le ofrecería si quisiera pasar al nivel siguiente: la pantalla
    // de vencimiento y el banner lo usan para el botón de pago.
    const necesita = Math.max(resumen.alumnos, 1)
    const nivel = resumen.nivel !== null && resumen.nivel > 0 ? resumen.nivel : nivelQueAlcanza(necesita)
    return NextResponse.json({ plan: resumen, renovar: nivel === null ? null : opcionDePago(nivel) })
  } catch (error) {
    // La válvula: un error leyendo el plan nunca cierra el panel.
    captureRouteFailure(error, { endpoint: '/api/teacher/plan', operation: 'GET' })
    return NextResponse.json({
      plan: {
        estado: 'exento',
        nivel: null,
        cupo: null,
        alumnos: 0,
        venceEl: null,
        diasRestantes: null,
        avisoDePruebaPendiente: false,
      },
      renovar: null,
    })
  }
}
