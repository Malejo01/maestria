import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O10/P2. Los avisos del docente: título y detalle, orden, no leídos, y el servidor con su válvula. */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))
let responder: (texto: string) => unknown = () => []

vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push({ texto, valores })
    return Promise.resolve().then(() => responder(texto))
  },
}))

import { contarNoLeidos } from './avisos/armar'
import { armarAvisos, type FilaDeAviso } from './avisos-docente'
import { avisosDelDocente, marcarAvisosVistos } from './avisos-docente-server'

const filas: FilaDeAviso[] = [
  { tipo: 'tarea', grupoId: 4, grupo: 'Matemática 1 Virtual', tarea: 'Práctica de funciones', dia: '2026-11-21', alumnos: 8, ultimo: '2026-11-21T22:00:00.000Z' },
  { tipo: 'nuevos', grupoId: 2, grupo: '1er Año', dia: '2026-11-22', alumnos: 3, ultimo: '2026-11-22T02:00:00.000Z' },
  { tipo: 'reporte', grupoId: 4, grupo: 'Matemática 1 Virtual', dia: '2026-11-20', reportes: 1, ultimo: '2026-11-20T15:00:00.000Z' },
  { tipo: 'tarea', grupoId: 4, grupo: 'X', tarea: 'Y', dia: '2026-11-22', alumnos: 0, ultimo: '2026-11-22T03:00:00.000Z' },
]
const SIN_LEER = { vistoEl: null, puedeMarcar: true }

describe('armarAvisos', () => {
  it('título y detalle por tipo, del más nuevo al más viejo, sin los vacíos', () => {
    const a = armarAvisos(filas, SIN_LEER)
    expect(a.map((x) => [x.tipo, x.titulo, x.detalle])).toEqual([
      ['alumnosNuevos', '3 alumnos nuevos', 'Entraron a 1er Año'],
      ['tareaTerminada', '8 terminaron la tarea', 'Matemática 1 Virtual · Práctica de funciones'],
      ['reporte', 'Reportaron un problema', 'En Matemática 1 Virtual'],
    ])
    expect(a[1].href).toBe('/teacher/grupos/4?pestaña=tareas')
  })

  it('cada tipo con su rol y su ícono', () => {
    const a = armarAvisos(filas, SIN_LEER)
    expect(a.map((x) => [x.rol, x.icono])).toEqual([
      ['informacion', 'personaMas'],
      ['exito', 'checkLista'],
      ['atencion', 'bandera'],
    ])
  })

  it('no leído = pasó después de la última vez que marcó todo como leído', () => {
    const a = armarAvisos(filas, { vistoEl: '2026-11-21T23:00:00.000Z', puedeMarcar: true })
    expect(a.map((x) => x.noLeido)).toEqual([true, false, false])
    expect(contarNoLeidos(a)).toBe(1)
    expect(contarNoLeidos(armarAvisos(filas, SIN_LEER))).toBe(3)
  })

  it('con la válvula (no se puede marcar), nada es no leído', () => {
    expect(contarNoLeidos(armarAvisos(filas, { vistoEl: null, puedeMarcar: false }))).toBe(0)
  })

  it('singular y plural', () => {
    const uno = armarAvisos(
      [
        { tipo: 'tarea', grupoId: 1, grupo: 'G', tarea: 'T', dia: '2026-11-22', alumnos: 1, ultimo: '2026-11-22T00:00:00.000Z' },
        { tipo: 'nuevos', grupoId: 1, grupo: 'G', dia: '2026-11-22', alumnos: 1, ultimo: '2026-11-22T00:00:01.000Z' },
        { tipo: 'reporte', grupoId: null, grupo: null, dia: '2026-11-22', reportes: 2, ultimo: '2026-11-22T00:00:02.000Z' },
      ],
      SIN_LEER,
    )
    expect(uno.map((x) => [x.titulo, x.detalle])).toEqual([
      ['Reportaron 2 problemas', 'En un cuestionario tuyo'],
      ['1 alumno nuevo', 'Entró a G'],
      ['1 alumno terminó la tarea', 'G · T'],
    ])
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
    expect(deDatos.length).toBeGreaterThan(0)
    expect(deDatos.every((c) => c.valores.includes('irina'))).toBe(true)
  })

  it('sin la 035 lee la 034', async () => {
    responder = (t) => {
      if (t.includes('avisos_lectura')) throw Object.assign(new Error('x'), { code: '42P01' })
      if (t.includes('avisos_docente_visto_el')) return [{ v: '2026-11-22T00:00:00Z' }]
      return []
    }
    const r = await avisosDelDocente('irina')
    expect([r.vistoEl, r.puedeMarcar]).toEqual(['2026-11-22T00:00:00.000Z', true])
    consultas.length = 0
    await marcarAvisosVistos('irina')
    expect(consultas.map((c) => c.texto.includes('avisos_lectura') ? 'tabla' : c.texto.includes('avisos_docente_visto_el') ? 'columna' : '?')).toEqual(['tabla', 'columna'])
  })

  it('con la 035, lee y escribe avisos_lectura', async () => {
    responder = (t) => (t.includes('avisos_lectura') && t.includes('SELECT') ? [{ visto_el: '2026-11-21T00:00:00Z' }] : [])
    const r = await avisosDelDocente('irina')
    expect(r.vistoEl).toBe('2026-11-21T00:00:00.000Z')
    consultas.length = 0
    await marcarAvisosVistos('irina')
    expect(consultas).toHaveLength(1)
    expect(consultas[0].texto).toContain('INSERT INTO avisos_lectura')
    expect(consultas[0].valores).toContain('irina')
  })

  it('sin la 035 ni la 034 (o sin la 029): los avisos sin "no leídos", sin error', async () => {
    responder = (t) => {
      if (t.includes('avisos_lectura')) throw Object.assign(new Error('x'), { code: '42P01' })
      if (t.includes('avisos_docente_visto_el') || t.includes('feedback_reports')) throw Object.assign(new Error('x'), { code: '42703' })
      if (t.includes('quiz_attempts')) return [{ grupo_id: 4, grupo: 'G', tarea: 'T', dia: '2026-11-22', alumnos: 2, ultimo: '2026-11-22T01:00:00Z' }]
      return []
    }
    const r = await avisosDelDocente('irina')
    expect(r.vistoEl).toBeNull()
    expect(r.puedeMarcar).toBe(false)
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0].noLeido).toBe(false)
    await expect(marcarAvisosVistos('irina')).resolves.toBeUndefined()
  })
})
