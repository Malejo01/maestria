'use client'

import type { PlanDelPanel } from '@/components/docente/use-plan-docente'
import { PLAN } from '@/lib/textos'

const T = PLAN.contador

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

/**
 * El texto del contador, o null si no corresponde mostrar nada.
 *
 *   gratis, particular        "2 de 2 alumnos · plan gratis"
 *   gratis, curso o sin dato  "Particulares 1 de 2 · Curso 18 de 35" (sin
 *                             alumnos de curso: "1 de 2 alumnos · plan gratis")
 *   prueba   "6 de 10 alumnos · prueba, quedan 18 días"
 *   activo   "12 de 15 alumnos · tu plan vence el 15/12"
 *   vencido  "12 de 15 alumnos · tu plan venció el 15/12"
 *
 * AC3: nunca «5 de 2»: en el gratis con curso se cuentan por separado, y si un
 * particular conserva más de los que entran, se dice cuántos sin el cupo.
 */
export function textoDelContador(datos: PlanDelPanel | null): string | null {
  return contadorDelPlan(datos)?.texto ?? null
}

/** El texto y si está en el tope (el único caso en naranja). */
export function contadorDelPlan(datos: PlanDelPanel | null): { texto: string; lleno: boolean } | null {
  const plan = datos?.plan
  if (!plan || plan.estado === 'exento' || plan.cupo === null) return null
  if (plan.estado === 'gratis') return contadorDelGratis(plan)
  const texto = textoFueraDelGratis(plan)
  return texto === null ? null : { texto, lleno: plan.alumnos >= plan.cupo }
}

function contadorDelGratis(plan: NonNullable<PlanDelPanel['plan']>): { texto: string; lleno: boolean } {
  const cupo = plan.cupoGratis
  const lugares = plan.lugares
  // B1 (curso o sin dato) con alumnos de curso: por separado.
  if (plan.modalidad !== 'particular' && lugares && lugares.curso > 0) {
    return {
      texto: T.porTipo(lugares.particulares, cupo, lugares.curso, plan.alumnosPorCurso),
      lleno: lugares.particulares >= cupo || lugares.curso >= plan.alumnosPorCurso,
    }
  }
  const alumnos = plan.modalidad === 'particular' || !lugares ? plan.alumnos : lugares.particulares
  // Un particular que ya tenía más de los que entran los conserva: sin «3 de 2».
  if (alumnos > cupo) return { texto: `${T.soloAlumnos(alumnos)} · ${T.gratis}`, lleno: true }
  return { texto: `${T.alumnos(alumnos, cupo)} · ${T.gratis}`, lleno: alumnos >= cupo }
}

function textoFueraDelGratis(plan: NonNullable<PlanDelPanel['plan']>): string | null {
  if (plan.cupo === null) return null
  const alumnos = T.alumnos(plan.alumnos, plan.cupo)
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
  const contador = contadorDelPlan(datos)
  if (!contador) return null
  // AC3: naranja sólo en el tope.
  return (
    <p className={`nota ${contador.lleno ? 'font-semibold text-flojo' : 'text-texto-suave'}`} aria-live="polite" data-lleno={contador.lleno ? 'si' : 'no'}>
      {contador.texto}
    </p>
  )
}
