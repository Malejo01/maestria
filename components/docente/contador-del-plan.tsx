'use client'

import type { PlanDelPanel } from '@/components/docente/use-plan-docente'
import { PLAN } from '@/lib/textos'

const T = PLAN.contador

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

/**
 * El texto del contador, o null si no corresponde mostrar nada.
 *
 *   gratis   "2 de 2 alumnos · plan gratis"
 *   prueba   "6 de 10 alumnos · prueba, quedan 18 días"
 *   activo   "12 de 15 alumnos · tu plan vence el 15/12"
 *   vencido  "12 de 15 alumnos · tu plan venció el 15/12"
 */
export function textoDelContador(datos: PlanDelPanel | null): string | null {
  const plan = datos?.plan
  if (!plan || plan.estado === 'exento' || plan.cupo === null) return null
  const alumnos = T.alumnos(plan.alumnos, plan.cupo)
  if (plan.estado === 'gratis') return `${alumnos} · ${T.gratis}`
  if (plan.estado === 'prueba') return `${alumnos} · ${T.prueba(plan.venceEl ? plan.diasRestantes : null)}`
  if (plan.estado === 'vencido') {
    // En solo lectura el cupo del plan que terminó ya no rige ("3 de 10"
    // confunde): sólo cuántos tiene y cuándo terminó.
    const cuantos = T.soloAlumnos(plan.alumnos)
    if (!plan.venceEl) return cuantos
    const fecha = fechaCorta(plan.venceEl)
    return `${cuantos} · ${plan.nivel === 0 ? T.pruebaTermino(fecha) : T.vencio(fecha)}`
  }
  if (!plan.venceEl) return alumnos
  return `${alumnos} · ${T.vence(fechaCorta(plan.venceEl))}`
}

/**
 * G6: arriba del panel, discreto: "12 de 15 alumnos · tu plan vence el 15/12".
 * Los alumnos se cuentan como el cupo (invitados e invitaciones pendientes
 * incluidos). Con la cuenta exenta, o sin la 026, no se muestra nada.
 */
export function ContadorDelPlan({ datos }: { datos: PlanDelPanel | null }) {
  const texto = textoDelContador(datos)
  if (!texto) return null
  const lleno = datos!.plan.cupo !== null && datos!.plan.alumnos >= datos!.plan.cupo
  return (
    <p className={`nota ${lleno ? 'font-semibold text-flojo' : 'text-texto-suave'}`} aria-live="polite">
      {texto}
    </p>
  )
}
