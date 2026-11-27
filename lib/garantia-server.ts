import { sql } from '@/lib/db'
import { DIAS_DE_GARANTIA, esCandidatoALaGarantia, type PagoParaLaGarantia } from '@/lib/garantia'

/**
 * AB8 · Los pagos aprobados de planes docentes de los últimos 14 días, con
 * cuántas veces practicó algún alumno en sus grupos desde el pago, y de ahí
 * sólo los candidatos a la garantía. Sólo lee. Sin la 039 (`pagos`) lanza:
 * quien llama lo muestra como «sin dato».
 */
export async function candidatosALaGarantia(ahora: Date = new Date()): Promise<PagoParaLaGarantia[]> {
  const filas = (await sql`
    SELECT p.id, p.monto, p.acreditado_el, p.mp_payment_id,
           u.name, u.email,
           (SELECT COUNT(*)::int FROM quiz_attempts att
              JOIN classrooms c ON c.id = att.classroom_id
             WHERE c.teacher_id = p.user_id AND att.user_id <> p.user_id
               AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
               AND att.completed_at >= p.acreditado_el) AS practicas
    FROM pagos p
    JOIN users u ON u.id = p.user_id
    WHERE p.estado = 'aprobado'
      AND p.plan IN ('particular', 'aula')
      AND p.acreditado_el >= NOW() - make_interval(days => ${DIAS_DE_GARANTIA})
    ORDER BY p.acreditado_el ASC
  `) as Record<string, unknown>[]
  return filas
    .map((f) => ({
      pagoId: Number(f.id),
      docente: String(f.name ?? ''),
      email: typeof f.email === 'string' ? f.email : null,
      monto: Number(f.monto),
      acreditadoEl: new Date(f.acreditado_el as string).toISOString(),
      mpPaymentId: f.mp_payment_id ? String(f.mp_payment_id) : null,
      practicasDesdeElPago: Number(f.practicas ?? 0),
    }))
    .filter((p) => esCandidatoALaGarantia(p, ahora))
}
