import { describe, expect, it } from 'vitest'
import { SECCIONES_ADMIN, seccionActiva } from './secciones'

describe('P1 · secciones del panel de admin', () => {
  it('están las cuatro páginas de antes, la portada, Códigos (C1) y Docentes', () => {
    expect(SECCIONES_ADMIN.map((s) => s.href)).toEqual([
      '/admin',
      '/admin/reportes',
      '/admin/embudo',
      '/admin/ai-usage',
      '/admin/planes',
      '/admin/codigos',
      '/admin/docentes',
    ])
  })

  it('marca la sección abierta, también en una subpágina', () => {
    expect(seccionActiva('/admin')).toBe('inicio')
    expect(seccionActiva('/admin/')).toBe('inicio')
    expect(seccionActiva('/admin/ai-usage')).toBe('usoDeIA')
    expect(seccionActiva('/admin/docentes/abc-123')).toBe('docentes')
    expect(seccionActiva('/admin/reportesx')).toBeNull()
    expect(seccionActiva('/teacher')).toBeNull()
  })
})
