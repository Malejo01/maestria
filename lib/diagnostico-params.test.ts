import { describe, expect, it, vi } from 'vitest'

/** Ronda T · A4: el diagnóstico genera con el área del programa del grupo. */
vi.mock('@/lib/db', () => ({ sql: vi.fn(async () => []) }))
vi.mock('@/lib/fichas-server', () => ({ perfilSinRomper: async () => null, faltaLa027: () => false }))
vi.mock('@/lib/valoraciones-server', () => ({ preguntasAEvitar: async () => [] }))

import { parametrosDeGeneracion } from './diagnostico-server'

describe('parametrosDeGeneracion (diagnóstico)', () => {
  it('lleva el programa del grupo (el área sale de ahí), tipos por defecto y la metodología', async () => {
    const params = await parametrosDeGeneracion(
      'doc',
      {
        materia: 'Temas de Antropología Cultural en Psicología',
        unidades: [],
        nivel: 'Superior',
        grado: '1er Año',
        carrera: 'Psicología',
        pedagogia: 'Metodología: casos',
        materiaId: 18,
      },
      { temas: [{ id: 't', nombre: 'Etnocentrismo' }], total: 5 } as never,
    )
    expect(params.teacherProgramId).toBe(18)
    expect(params.tiposPorDefecto).toBe(true)
    expect(params.pedagogyContext).toContain('Metodología: casos')
  })
})
