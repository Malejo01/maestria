import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerArranque } from '@/lib/arranque-docente-server'
import { linkDeWhatsApp } from '@/lib/precios'
import { ARRANQUE } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/arranque
 *
 * AB4: en qué paso del arranque guiado está el docente (subir el programa,
 * aprobar el primer cuestionario, mandárselo a 2 alumnos). Se deduce de sus
 * datos: ver lib/arranque-docente.ts.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  }
  try {
    // «Pedime que te lo cargue»: el número vive en el servidor (MAESTRIA_WHATSAPP_CONTACTO).
    const cargamelo = linkDeWhatsApp(ARRANQUE.pasos.programa.mensajeCargamelo)
    return NextResponse.json({ arranque: await leerArranque(teacher.id), cargamelo })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/arranque', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer tu arranque' }, { status: 500 })
  }
}
