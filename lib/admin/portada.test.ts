import { describe, expect, it } from 'vitest'
import { resumirPlanes, type PlanCrudo } from './portada'

const AHORA = new Date('2026-11-22T15:00:00Z')
const dias = (n: number) => new Date(AHORA.getTime() + n * 86_400_000).toISOString()
const plan = (p: Partial<PlanCrudo>): PlanCrudo => ({ email: 'x@ejemplo.com', nivel: 0, venceEl: null, pruebaIniciadaEl: null, alumnos: 0, ...p })
const nadieExento = () => false

describe('P1 · la tarjeta de Planes', () => {
  it('cuenta en prueba, que vencen esta semana y vencidos', () => {
    const r = resumirPlanes(
      [
        plan({ pruebaIniciadaEl: dias(-1) }), // prueba, vence en 29 días
        plan({ pruebaIniciadaEl: dias(-27) }), // prueba, vence en 3 días
        plan({ nivel: 2, venceEl: dias(5) }), // pago, vence en 5 días
        plan({ nivel: 2, venceEl: dias(20) }), // pago, lejos
        plan({ pruebaIniciadaEl: dias(-40) }), // prueba terminada
        plan({ nivel: 1, venceEl: dias(-2), alumnos: 30 }), // pago vencido
      ],
      nadieExento,
      AHORA,
    )
    expect(r).toEqual({ prueba: 2, vencenEstaSemana: 2, vencidos: 2 })
  })

  it('el exento y la válvula (sin nivel) no cuentan', () => {
    const r = resumirPlanes([plan({ email: 'admin@ejemplo.com' }), plan({ nivel: null })], (e) => e === 'admin@ejemplo.com', AHORA)
    expect(r).toEqual({ prueba: 0, vencenEstaSemana: 0, vencidos: 0 })
  })
})
