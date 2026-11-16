import { describe, expect, it } from 'vitest'
import {
  armarFilas,
  armarTemas,
  chipsDeFila,
  diasDesde,
  elegirSugerencia,
  estadoDeTema,
  haceCuanto,
  normalizarNombre,
  RESPUESTAS_PARA_DOMINADO,
  RESPUESTAS_PARA_FLOJO,
  resumir,
  resumirTemas,
  temaCorto,
  type ActividadCruda,
  type InvitacionCruda,
  type MiembroCrudo,
  type TemaDeAlumno,
} from './alumnos-docente'

const AHORA = new Date(2026, 10, 15, 18, 0)
const hace = (dias: number) => new Date(2026, 10, 15 - dias, 9, 0).toISOString()

const miembro = (parcial: Partial<MiembroCrudo> = {}): MiembroCrudo => ({
  userId: 'u1',
  nombre: 'Sofía Ramírez',
  contexto: null,
  grupoId: 1,
  grupoNombre: 'Análisis I',
  materia: 'Análisis I',
  materiaId: 10,
  esInvitadoSinCuenta: false,
  seSumoEl: hace(30),
  ...parcial,
})

const invitacion = (parcial: Partial<InvitacionCruda> = {}): InvitacionCruda => ({
  id: 1,
  nombre: 'Sofía Ramírez',
  contexto: 'Análisis I · rinde el 12/12',
  grupoId: 1,
  grupoNombre: 'Análisis I',
  materia: 'Análisis I',
  materiaId: 10,
  codigo: '7K4P2M',
  creadaEl: hace(31),
  ...parcial,
})

const actividad = (parcial: Partial<ActividadCruda> = {}): ActividadCruda => ({
  userId: 'u1',
  ultimaVez: hace(2),
  intentos: 3,
  tareasEntregadas: 1,
  correctas: 20,
  calificadas: 30,
  ...parcial,
})

const tema = (nombre: string, correctas: number, calificadas: number): TemaDeAlumno =>
  armarTemas([{ tema: nombre, correctas, calificadas }])[0]

describe('estadoDeTema', () => {
  it('con pocas respuestas es "sin datos", no flojo: silencio no es problema', () => {
    expect(estadoDeTema(0, 4)).toBe('sin_datos')
    expect(estadoDeTema(0, 0)).toBe('sin_datos')
  })

  it('desde 70 % es dominado; por debajo, flojo', () => {
    expect(estadoDeTema(7, 10)).toBe('dominado')
    expect(estadoDeTema(6, 10)).toBe('flojo')
  })

  it('las dos reglas tienen su número, con nombre, y son distintos', () => {
    expect(RESPUESTAS_PARA_FLOJO).toBe(5)
    expect(RESPUESTAS_PARA_DOMINADO).toBe(8)
  })

  it('cinco respuestas alcanzan para sospechar que está flojo', () => {
    expect(estadoDeTema(1, RESPUESTAS_PARA_FLOJO)).toBe('flojo')
    expect(estadoDeTema(1, RESPUESTAS_PARA_FLOJO - 1)).toBe('sin_datos')
  })

  it('cinco respuestas NO alcanzan para afirmar que está dominado', () => {
    // 5 de 5 es un 100 % que todavía puede ser una buena tarde.
    expect(estadoDeTema(5, 5)).toBe('sin_datos')
    expect(estadoDeTema(7, RESPUESTAS_PARA_DOMINADO - 1)).toBe('sin_datos')
    expect(estadoDeTema(6, RESPUESTAS_PARA_DOMINADO)).toBe('dominado')
    expect(estadoDeTema(8, RESPUESTAS_PARA_DOMINADO)).toBe('dominado')
  })

  it('entre 5 y 7 respuestas, mal sigue siendo flojo: la sospecha no espera', () => {
    expect(estadoDeTema(3, 7)).toBe('flojo')
  })
})

describe('chipsDeFila — hasta dos: el mejor y el peor', () => {
  it('con dominados y flojos muestra el mejor y el peor, en ese orden', () => {
    const chips = chipsDeFila([tema('Límites', 9, 10), tema('Continuidad', 8, 10), tema('Derivadas', 2, 10), tema('Integrales', 5, 10)])
    expect(chips.map((c) => c.tema)).toEqual(['Límites', 'Derivadas'])
  })

  it('nunca más de dos', () => {
    expect(chipsDeFila([tema('A', 1, 10), tema('B', 2, 10), tema('C', 3, 10)])).toHaveLength(2)
  })

  it('los temas sin datos no aparecen en la fila', () => {
    expect(chipsDeFila([tema('Límites', 1, 2)])).toEqual([])
  })
})

describe('normalizarNombre', () => {
  it('ignora tildes, mayúsculas y espacios de más', () => {
    expect(normalizarNombre('  SOFÍA   Ramírez ')).toBe(normalizarNombre('sofia ramirez'))
  })
})

describe('haceCuanto', () => {
  it('usa el día calendario, no las 24 horas', () => {
    expect(haceCuanto(new Date(2026, 10, 14, 23, 50), AHORA)).toBe('ayer')
    expect(haceCuanto(new Date(2026, 10, 15, 0, 5), AHORA)).toBe('hoy')
  })

  it('días, semanas y meses, siempre corto', () => {
    expect(haceCuanto(new Date(hace(6)), AHORA)).toBe('hace 6 d')
    expect(haceCuanto(new Date(hace(21)), AHORA)).toBe('hace 3 sem')
    expect(haceCuanto(new Date(hace(90)), AHORA)).toBe('hace 3 m')
  })

  it('quien nunca practicó no tiene "hace"', () => {
    expect(haceCuanto(null, AHORA)).toBe('todavía no')
  })

  it('una fecha futura (relojes desfasados) no da días negativos', () => {
    expect(diasDesde(new Date(2026, 10, 16), AHORA)).toBe(0)
  })
})

describe('armarFilas — una fila por persona', () => {
  it('un alumno en dos grupos del mismo docente es UNA fila, con sus dos materias', () => {
    const filas = armarFilas(
      [miembro(), miembro({ grupoId: 2, grupoNombre: 'Física', materia: 'Física', materiaId: 20 })],
      [],
      [actividad()],
      new Map(),
    )
    expect(filas).toHaveLength(1)
    expect(filas[0].materias.map((m) => m.nombre)).toEqual(['Análisis I', 'Física'])
  })

  it('la invitación con el mismo nombre no se duplica: el miembro hereda su contexto', () => {
    const filas = armarFilas([miembro({ nombre: 'sofia ramirez' })], [invitacion()], [], new Map())
    expect(filas).toHaveLength(1)
    expect(filas[0].pendiente).toBeNull()
    expect(filas[0].contexto).toBe('Análisis I · rinde el 12/12')
  })

  it('el contexto escrito sobre el miembro le gana al de la invitación', () => {
    const filas = armarFilas([miembro({ contexto: 'Rinde en marzo' })], [invitacion()], [], new Map())
    expect(filas[0].contexto).toBe('Rinde en marzo')
  })

  it('una invitación de OTRO grupo con el mismo nombre no se funde', () => {
    const filas = armarFilas([miembro()], [invitacion({ grupoId: 99 })], [], new Map())
    expect(filas).toHaveLength(2)
  })

  it('quien todavía no entró aparece como pendiente, sin ficha y al final', () => {
    const filas = armarFilas([miembro()], [invitacion({ id: 7, nombre: 'Tomás Villa', contexto: null })], [actividad()], new Map())
    const pendiente = filas[filas.length - 1]
    expect(pendiente.nombre).toBe('Tomás Villa')
    expect(pendiente.userId).toBeNull()
    expect(pendiente.pendiente).toEqual({ invitacionId: 7, codigo: '7K4P2M' })
    expect(pendiente.contexto).toBe('Análisis I')
  })

  it('sin contexto escrito, muestra la materia: nunca queda una línea vacía', () => {
    expect(armarFilas([miembro()], [], [], new Map())[0].contexto).toBe('Análisis I')
  })

  it('ordena por última práctica, y los que nunca practicaron van después', () => {
    const filas = armarFilas(
      [miembro({ userId: 'a', nombre: 'Ana' }), miembro({ userId: 'b', nombre: 'Beto' }), miembro({ userId: 'c', nombre: 'Caro' })],
      [],
      [actividad({ userId: 'a', ultimaVez: hace(6) }), actividad({ userId: 'c', ultimaVez: hace(1) })],
      new Map(),
    )
    expect(filas.map((f) => f.nombre)).toEqual(['Caro', 'Ana', 'Beto'])
  })

  it('los chips y el tema más flojo salen de sus temas', () => {
    const filas = armarFilas([miembro()], [], [actividad()], new Map([['u1', [tema('Límites', 9, 10), tema('Derivadas', 2, 10)]]]))
    expect(filas[0].chips.map((c) => c.tema)).toEqual(['Límites', 'Derivadas'])
    expect(filas[0].temaMasFlojo).toBe('Derivadas')
  })
})

describe('elegirSugerencia — una sola, o ninguna', () => {
  const filas = (extra: Parameters<typeof armarFilas>) => armarFilas(...extra)

  it('gana quien lleva más días sin practicar teniendo un tema flojo', () => {
    const lista = filas([
      [miembro({ userId: 'a', nombre: 'Julieta Ocampo' }), miembro({ userId: 'b', nombre: 'Tomás Villa' })],
      [],
      [actividad({ userId: 'a', ultimaVez: hace(6) }), actividad({ userId: 'b', ultimaVez: hace(9) })],
      new Map([['a', [tema('Cinemática', 2, 10)]]]),
    ])
    expect(elegirSugerencia(lista, AHORA)).toMatchObject({ nombre: 'Julieta Ocampo', dias: 6, tema: 'Cinemática' })
  })

  it('sin nadie inactivo, sugiere por el tema flojo y no inventa días', () => {
    const lista = filas([[miembro()], [], [actividad({ ultimaVez: hace(1) })], new Map([['u1', [tema('Derivadas', 2, 10)]]])])
    expect(elegirSugerencia(lista, AHORA)).toMatchObject({ dias: null, tema: 'Derivadas' })
  })

  it('si a todos les va bien y practicaron hace poco, no hay sugerencia', () => {
    const lista = filas([[miembro()], [], [actividad({ ultimaVez: hace(1) })], new Map([['u1', [tema('Límites', 9, 10)]]])])
    expect(elegirSugerencia(lista, AHORA)).toBeNull()
  })

  it('quien nunca practicó o todavía no entró no dispara la sugerencia', () => {
    const lista = filas([[miembro()], [invitacion({ id: 2, nombre: 'Otra Persona' })], [], new Map()])
    expect(elegirSugerencia(lista, AHORA)).toBeNull()
  })
})

describe('resumir', () => {
  it('el tema más flojo es el que les cuesta a más alumnos, sobre los que ya tienen datos', () => {
    const resumen = resumir(
      new Map([
        ['a', [tema('Derivadas', 2, 10), tema('Límites', 9, 10)]],
        ['b', [tema('Derivadas', 3, 10)]],
        ['c', [tema('Límites', 8, 10)]],
        ['d', [tema('Derivadas', 1, 2)]],
      ]),
      14,
    )
    expect(resumen).toEqual({ tareasEstaSemana: 14, temaMasFlojo: { tema: 'Derivadas', alumnos: 2, deCuantos: 3 } })
  })

  it('sin ningún tema flojo no hay "tema más flojo"', () => {
    expect(resumir(new Map([['a', [tema('Límites', 9, 10)]]]), 0).temaMasFlojo).toBeNull()
  })
})

describe('resumirTemas (la celda Temas de la planilla del alumno)', () => {
  // Los siete temas del temario de Lengua de staging: el caso que, escrito
  // entero, ocupaba cinco renglones y le comía el ancho a "Resultado".
  const TEMARIO = [
    'Lenguas y variedades lingüísticas: Respeto y valoración de las variedades dialectales de la comunidad.',
    'Clases de palabras: Sustantivos propios y comunes. El adjetivo calificativo. Concordancia de género y número.',
    'El verbo. Tiempo pasado, presente y futuro.',
    'Conectores temporales y causales propios de los textos narrativos.',
    'Familia de palabras. Sufijos y prefijos: Diminutivos y aumentativos, prefijación y sufijación.',
    'Separación de palabras en sílabas. Sílaba tónica. Clasificación en agudas, graves y esdrújulas. Reglas generales de acentuación.',
    'Signos de puntuación: Punto y seguido, punto y aparte, coma en enumeraciones, dos puntos, paréntesis y raya de diálogo.',
  ]

  it('nombra los tres primeros, cortos, y cuenta el resto', () => {
    const { visibles, resto } = resumirTemas(TEMARIO)
    expect(visibles).toEqual(['Lenguas y variedades…', 'Clases de palabras', 'El verbo'])
    expect(resto).toBe(4)
  })

  it('lo que queda a la vista entra en un renglón de la tabla', () => {
    const { visibles } = resumirTemas(TEMARIO)
    expect(visibles.join(' · ').length).toBeLessThan(110)
  })

  it('el detalle completo no se pierde: va entero, separado por punto y coma', () => {
    const { completo } = resumirTemas(TEMARIO)
    for (const tema of TEMARIO) expect(completo).toContain(tema.replace(/\.$/, ''))
    // El separador viejo dejaba "comunidad., Clases de palabras".
    expect(completo).not.toContain('.,')
    expect(completo).not.toContain('.;')
  })

  it('con tres temas o menos no hay resto', () => {
    expect(resumirTemas(['Derivadas', 'Integrales'])).toMatchObject({ visibles: ['Derivadas', 'Integrales'], resto: 0 })
  })

  it('sin temas, nada', () => {
    expect(resumirTemas([' ', ''])).toEqual({ visibles: [], resto: 0, completo: '' })
  })
})

describe('temaCorto', () => {
  it('un tema corto queda igual', () => {
    expect(temaCorto('Derivadas')).toBe('Derivadas')
  })

  it('de un tema con descripción se queda con lo que va antes de los dos puntos', () => {
    expect(temaCorto('Clases de palabras: Sustantivos propios y comunes. El adjetivo calificativo.')).toBe('Clases de palabras')
    expect(temaCorto('El verbo. Tiempo pasado, presente y futuro.')).toBe('El verbo')
  })

  it('si aun así es largo, corta en una palabra entera y lo marca', () => {
    const corto = temaCorto('Lenguas y variedades lingüísticas de la comunidad hablante')
    expect(corto.length).toBeLessThanOrEqual(33)
    expect(corto.endsWith('…')).toBe(true)
    expect(corto).not.toMatch(/\s…$/)
  })

  it('nunca devuelve vacío', () => {
    expect(temaCorto(': raro')).toBe(': raro')
  })
})
