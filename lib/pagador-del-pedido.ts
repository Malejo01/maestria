import { getTeacherViewer, getViewer } from '@/lib/auth-session'
import { materiaParaElPase } from '@/lib/autodidacta-server'
import type { PedidoDePago } from '@/lib/pagos'

/**
 * E2 · Quién paga: el plan de docente lo paga la cuenta de docente; el pase de
 * alumno, el alumno con cuenta (no invitado) dueño de esa materia personal.
 */
export async function pagadorDelPedido(
  pedido: PedidoDePago,
): Promise<{ ok: true; id: string; email: string | null; materia: string | null } | { ok: false; status: 401 | 404 }> {
  if (pedido.plan !== 'pase_alumno') {
    const docente = await getTeacherViewer()
    return docente ? { ok: true, id: docente.id, email: docente.email ?? null, materia: null } : { ok: false, status: 401 }
  }
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return { ok: false, status: 401 }
  const materia = pedido.materia ? await materiaParaElPase(viewer.id, pedido.materia) : null
  if (!materia) return { ok: false, status: 404 }
  return { ok: true, id: viewer.id, email: viewer.email ?? null, materia: materia.nombre }
}
