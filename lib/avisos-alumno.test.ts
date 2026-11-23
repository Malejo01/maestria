import { describe, expect, it } from 'vitest'
import { armarAvisosDelAlumno, rachaEnRiesgoDesde, type FilaDeAvisoAlumno } from './avisos-alumno'

/** P3 · Los avisos del alumno (puro): título, detalle y destino por tipo, y sus reglas. */
// 22/11/2026 15:00 en Buenos Aires.
const AHORA = new Date('2026-11-22T18:00:00.000Z')
const LEER = { vistoEl: null, puedeMarcar: true }
const horas = (n: number) => new Date(AHORA.getTime() + n * 3_600_000).toISOString()

describe('armarAvisosDelAlumno', () => {
  it('título, detalle y destino de cada tipo', () => {
    const filas: FilaDeAvisoAlumno[] = [
      { tipo: 'tareaNueva', asignacionId: 7, grupo: 'Análisis 1', tarea: 'Práctica de límites', disponibleDesde: horas(-2) },
      { tipo: 'diagnosticoNuevo', diagnosticoId: 3, primeraAsignacionId: 21, grupo: 'Análisis 1', cuestionarios: 2, creadoEl: horas(-30) },
      { tipo: 'reporteResuelto', reporteId: 9, respondidoPor: 'Mauro', conMensaje: true, resueltoEl: horas(-1) },
      { tipo: 'temaSuperado', misconceptionId: 4, tema: 'Derivadas', porDocente: true, superadoEl: horas(-50) },
    ]
    expect(armarAvisosDelAlumno(filas, LEER, AHORA).map((a) => [a.tipo, a.rol, a.titulo, a.detalle, a.href])).toEqual([
      ['reporteResuelto', 'exito', 'Tu reporte se resolvió', 'Mauro te dejó un mensaje', '/reportes/9'],
      ['tareaNueva', 'informacion', 'Tarea nueva', 'Análisis 1 · Práctica de límites', '/aulas?tarea=7'],
      ['diagnosticoNuevo', 'informacion', 'Diagnóstico nuevo', 'Análisis 1 · 2 cuestionarios', '/aulas?tarea=21'],
      ['temaSuperado', 'exito', 'Tema superado', 'Derivadas · lo marcó tu docente', '/history'],
    ])
  })

  it('vence pronto: sólo con menos de 24 h, y entra a la lista cuando le quedan 24 h', () => {
    const fila = (vence: number, creada = -100): FilaDeAvisoAlumno => ({ tipo: 'vencePronto', asignacionId: 1, grupo: 'G', tarea: 'T', venceEl: horas(vence), creadaEl: horas(creada) })
    const [a] = armarAvisosDelAlumno([fila(5)], LEER, AHORA)
    expect([a.titulo, a.rol, a.fecha]).toEqual(['Vence en 5 h', 'atencion', horas(5 - 24)])
    expect(armarAvisosDelAlumno([fila(0.5)], LEER, AHORA)[0].titulo).toBe('Vence en menos de 1 h')
    expect(armarAvisosDelAlumno([fila(30)], LEER, AHORA)).toEqual([])
    expect(armarAvisosDelAlumno([fila(-1)], LEER, AHORA)).toEqual([])
    // Creada hace 2 h con 5 h para hacerla: entró al crearse, no "hace 19 h".
    expect(armarAvisosDelAlumno([fila(5, -2)], LEER, AHORA)[0].fecha).toBe(horas(-2))
  })

  it('una tarea que vence pronto no se repite como "Tarea nueva"', () => {
    const avisos = armarAvisosDelAlumno(
      [
        { tipo: 'tareaNueva', asignacionId: 1, grupo: 'G', tarea: 'T', disponibleDesde: horas(-1) },
        { tipo: 'vencePronto', asignacionId: 1, grupo: 'G', tarea: 'T', venceEl: horas(3), creadaEl: horas(-1) },
      ],
      LEER,
      AHORA,
    )
    expect(avisos.map((a) => a.tipo)).toEqual(['vencePronto'])
  })

  it('reporte sin mensaje, tema superado solo, singular', () => {
    const avisos = armarAvisosDelAlumno(
      [
        { tipo: 'reporteResuelto', reporteId: 1, respondidoPor: null, conMensaje: false, resueltoEl: horas(-1) },
        { tipo: 'temaSuperado', misconceptionId: 2, tema: 'Fracciones', porDocente: false, superadoEl: horas(-2) },
        { tipo: 'diagnosticoNuevo', diagnosticoId: 3, primeraAsignacionId: 4, grupo: 'G', cuestionarios: 1, creadoEl: horas(-3) },
      ],
      LEER,
      AHORA,
    )
    expect(avisos.map((a) => a.detalle)).toEqual(['Ya está corregido. Gracias por avisar.', 'Fracciones · pasó a "Ya lo dominás"', 'G · 1 cuestionario'])
  })

  it('no leídos según la lectura; con la válvula, ninguno', () => {
    const filas: FilaDeAvisoAlumno[] = [
      { tipo: 'tareaNueva', asignacionId: 1, grupo: 'G', tarea: 'vieja', disponibleDesde: horas(-48) },
      { tipo: 'tareaNueva', asignacionId: 2, grupo: 'G', tarea: 'nueva', disponibleDesde: horas(-1) },
    ]
    expect(armarAvisosDelAlumno(filas, { vistoEl: horas(-24), puedeMarcar: true }, AHORA).map((a) => a.noLeido)).toEqual([true, false])
    expect(armarAvisosDelAlumno(filas, { vistoEl: null, puedeMarcar: false }, AHORA).some((a) => a.noLeido)).toBe(false)
  })
})

describe('racha en riesgo', () => {
  const aLas = (hora: string) => new Date(`2026-11-22T${hora}:00-03:00`)
  const ayer = '2026-11-21T20:00:00-03:00'

  it('con racha, sin practicar hoy, desde las 18 h', () => {
    expect(rachaEnRiesgoDesde(3, ayer, aLas('17:59'))).toBeNull()
    expect(rachaEnRiesgoDesde(3, ayer, aLas('18:00'))).toBe('2026-11-22T21:00:00.000Z')
    expect(rachaEnRiesgoDesde(3, ayer, aLas('23:30'))).toBe('2026-11-22T21:00:00.000Z')
  })

  it('sin racha, si ya practicó hoy, o si no practica hace más de una semana: no', () => {
    expect(rachaEnRiesgoDesde(0, ayer, aLas('20:00'))).toBeNull()
    expect(rachaEnRiesgoDesde(3, '2026-11-22T09:00:00-03:00', aLas('20:00'))).toBeNull()
    expect(rachaEnRiesgoDesde(3, '2026-11-10T09:00:00-03:00', aLas('20:00'))).toBeNull()
    expect(rachaEnRiesgoDesde(3, null, aLas('20:00'))).toBeNull()
  })

  it('el aviso: con cuenta va a practicar; el invitado, a sus tareas', () => {
    const fila: FilaDeAvisoAlumno = { tipo: 'racha', racha: 1, ultimaPractica: ayer }
    const [conCuenta] = armarAvisosDelAlumno([fila], LEER, aLas('19:00'))
    expect([conCuenta.titulo, conCuenta.detalle, conCuenta.href]).toEqual(['Tu racha de 1 aprobado está en riesgo', 'Todavía no practicaste hoy', '/practicar'])
    expect(armarAvisosDelAlumno([fila], LEER, aLas('19:00'), { esInvitado: true })[0].href).toBe('/aulas')
  })
})

describe('X2 · el repaso del día', () => {
  it('desde las 9 h, una vez por día, sólo si practicó en la semana y hay algo', async () => {
    const { armarAvisosDelAlumno, repasoDesde } = await import('./avisos-alumno')
    const lectura = { vistoEl: null, leidas: new Set<string>(), puedeMarcar: true } as never
    const temprano = new Date('2026-11-23T11:00:00Z') // 8 h en Argentina
    const tarde = new Date('2026-11-23T15:00:00Z')
    expect(repasoDesde(3, true, temprano)).toBeNull()
    expect(repasoDesde(3, true, tarde)).toBe('2026-11-23T12:00:00.000Z')
    expect(repasoDesde(0, true, tarde)).toBeNull()
    expect(repasoDesde(3, false, tarde)).toBeNull()
    const [aviso] = armarAvisosDelAlumno([{ tipo: 'repaso', cuantas: 3, practicoEnLaSemana: true }], lectura, tarde)
    expect(aviso).toMatchObject({ tipo: 'repasoDelDia', titulo: 'Tenés 3 preguntas para repasar hoy', href: '/aulas' })
    expect(aviso.clave).toBe('repasoDelDia|2026-11-23')
    expect(armarAvisosDelAlumno([{ tipo: 'repaso', cuantas: 3, practicoEnLaSemana: true }], lectura, tarde, { esInvitado: true })).toHaveLength(0)
  })
})

describe('Y3 · la novedad', () => {
  it('una por novedad, con su link', async () => {
    const { armarAvisosDelAlumno } = await import('./avisos-alumno')
    const lectura = { vistoEl: null, leidas: new Set<string>(), puedeMarcar: true } as never
    const [aviso] = armarAvisosDelAlumno(
      [{ tipo: 'novedad', slug: 'lo-nuevo-de-noviembre', titulo: 'Lo nuevo de noviembre', resumen: 'Más tipos.', fecha: '2026-11-23T12:00:00.000Z' }],
      lectura,
      new Date('2026-11-23T15:00:00Z'),
    )
    expect(aviso).toMatchObject({ tipo: 'novedad', clave: 'novedad|lo-nuevo-de-noviembre', titulo: 'Novedades de MaestrIA: Lo nuevo de noviembre', href: '/novedades/lo-nuevo-de-noviembre' })
  })
})
