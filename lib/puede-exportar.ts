import { pedirJson } from '@/lib/pedir-json'
import type { ResumenDelPlan } from '@/lib/planes'

/**
 * Ronda T · B1 — En el plan gratis no hay exportación a Moodle (ni informe
 * para imprimir). La exportación se arma en el navegador, así que el control
 * es de interfaz: se pregunta el plan antes de descargar. Si no se puede
 * saber (la lectura falla), se deja exportar: la válvula de siempre.
 */
export async function puedeExportarAMoodle(): Promise<boolean> {
  const res = await pedirJson<{ plan: ResumenDelPlan }>('/api/teacher/plan')
  if (!('data' in res)) return true
  return res.data.plan.permiteImprimirYMoodle !== false
}
