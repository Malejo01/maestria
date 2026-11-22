import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O10. Los avisos del docente: texto, orden, no leídos, y el servidor con su válvula. */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))
let responder: (texto: string) => unknown = () => []

vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))

import { armarAvisos, noLeidos, type FilaDeAviso } from './avisos-docente'
import { avisosDelDocente, marcarAvisosVistos } from './avisos-docente-server'

const filas: FilaDeAviso[] = [
  { tipo: 'tarea', grupoId: 4, grupo: 'Matemática 1 Virtual', tarea: 'Práctica de funciones', dia: '2026-11-21', alumnos: 8, ultimo: '2026-11-21T22:00:00.000Z' },
  { tipo: 'nuevos', grupoId: 2, grupo: '1er Año', dia: '2026-11-22', alumnos: 3, ultimo: '2026-11-22T02:00:00.000Z' },
  { tipo: 'reporte', grupoId: 4, grupo: 'Matemática 1 Virtual', dia: '2026-11-20', reportes: 1, ultimo: '2026-11-20T15:00:00.000Z' },
  { tipo: 'tarea', grupoId: 4, grupo: 'X', tarea: 'Y', dia: '2026-11-22', alumnos: 0, ultimo: '2026-11-22T03:00:00.000Z' },
]

describe('armarAvisos', () => {
  it('los textos del pedido, del más nuevo al más viejo, sin los vacíos', () => {
    const a = armarAvisos(filas, null)
    expect(a.map((x) => x.texto)).toEqual([
      '3 alumnos nuevos entraron a 1er Año',
      '8 alumnos de Matemática 1 Virtual terminaron «Práctica de funciones»',
      'Reportaron un problema en Matemática 1 Virtual',
    ])
    expect(a[1].href).toBe('/teacher/grupos/4?pestaña=tareas')
  })

  it('no leído = pasó después de la última vez que abrió la campanita', () => {
    const a = armarAvisos(filas, '2026-11-21T23:00:00.000Z')
    expect(a.map((x) => x.noLeido)).toEqual([true, false, false])
    expect(noLeidos(a)).toBe(1)
    expect(noLeidos(armarAvisos(filas, null))).toBe(3)
  })

  it('el singular', () => {
    const [a] = armarAvisos([{ tipo: 'tarea', grupoId: 1, grupo: 'G', tarea: 'T', dia: '2026-11-22', alumnos: 1, ultimo: '2026-11-22T00:00:00.000Z' }], null)
    expect(a.texto).toBe('1 alumno de G terminó «T»')
  })
})

describe('avisosDelDocente', () => {
  beforeEach(() => {
    consultas.length = 0
    responder = () => []
  })

  it('todo filtrado por el docente', async () => {
    await avisosDelDocente('irina')
    const deDatos = consultas.filter((c) => !c.texto.includes('avisos_docente_visto_el'))
    expect(deDatos.every((c) => c.valores.includes('irina'))).toBe(true)
  })

  it('sin la 034 (o sin la 029), todo como no leído y sin error', async () => {
    responder = (t) => {
      if (t.includes('avisos_docente_visto_el') || t.includes('feedback_reports')) throw Object.assign(new Error('x'), { code: '42703' })
      if (t.includes('quiz_attempts')) return [{ grupo_id: 4, grupo: 'G', tarea: 'T', dia: '2026-11-22', alumnos: 2, ultimo: '2026-11-22T01:00:00Z' }]
      return []
    }
    const r = await avisosDelDocente('irina')
    expect(r.vistoEl).toBeNull()
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0].noLeido).toBe(true)
    await expect(marcarAvisosVistos('irina')).resolves.toBeUndefined()
  })
})
