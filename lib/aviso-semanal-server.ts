import { sql } from '@/lib/db'
import { guardarAviso } from '@/lib/avisos-guardados-server'
import { leerEstaSemana } from '@/lib/esta-semana-server'
import { armarAvisoSemanal, recibeElAviso } from '@/lib/aviso-semanal'
import { captureRouteFailure } from '@/lib/observability'
import { AVISO_SEMANAL } from '@/lib/textos'

export interface ResultadoDelAvisoSemanal {
  docentes: number
  creados: number
  /** Ya tenían el de este lunes (el cron corrió dos veces). */
  yaEstaban: number
  /** Sin alumnos, de ejemplo o de prueba. */
  omitidos: number
  fallidos: number
}

/**
 * AC5 · Para cada docente con al menos un alumno, el resumen de «Esta semana»
 * en la campanita. Idempotente: la clave es el lunes (`avisos_guardados`,
 * ON CONFLICT DO NOTHING). Sin la 050, `guardarAviso` no escribe: todo cuenta
 * como «ya estaba» y no se rompe nada.
 */
export async function correrAvisoSemanal(ahora: Date = new Date()): Promise<ResultadoDelAvisoSemanal> {
  const docentes = (await sql`
    SELECT id, name, COALESCE((to_jsonb(users) ->> 'ejemplo')::boolean, false) AS ejemplo
    FROM users
    WHERE role = 'DOCENTE' AND COALESCE(is_guest, false) = false
    ORDER BY created_at
  `) as { id: string; name: string | null; ejemplo: boolean }[]

  const r: ResultadoDelAvisoSemanal = { docentes: docentes.length, creados: 0, yaEstaban: 0, omitidos: 0, fallidos: 0 }
  for (const d of docentes) {
    try {
      const datos = { id: String(d.id), nombre: d.name, ejemplo: d.ejemplo }
      const { resumen } = await leerEstaSemana(datos.id)
      if (!recibeElAviso(datos, resumen)) {
        r.omitidos++
        continue
      }
      const aviso = armarAvisoSemanal(resumen, ahora, AVISO_SEMANAL.titulo)
      const guardado = await guardarAviso({ userId: datos.id, tipo: 'resumenSemanal', ...aviso })
      if (guardado) r.creados++
      else r.yaEstaban++
    } catch (error) {
      r.fallidos++
      captureRouteFailure(error, { endpoint: '/api/cron/aviso-semanal', operation: 'docente' })
    }
  }
  return r
}
