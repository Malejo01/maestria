import { describe, expect, it } from 'vitest'
import {
  ariaSort,
  claveDeNombre,
  coincideLaBusqueda,
  cuantasPorFiltro,
  ESTADO_INICIAL,
  estadoALaUrl,
  estadoDesdeLaUrl,
  filasVisibles,
  normalizarTexto,
  ordenar,
  tocarEncabezado,
  type FilaDePlanilla,
} from './planilla-grupo'

const fila = (nombre: string, f: Partial<FilaDePlanilla> = {}): FilaDePlanilla => ({
  nombre,
  resueltos: 1,
  promedio: 7,
  mejor: 8,
  ultimaActividad: '2026-11-20T15:00:00.000Z',
  temasFlojos: 0,
  ...f,
})

const grupo = [
  fila('clarita Zolorza', { promedio: 5.5, mejor: 6, temasFlojos: 2 }),
  fila('Bruno Quiroga', { promedio: 8.48, mejor: 10, ultimaActividad: '2026-11-21T10:00:00.000Z' }),
  fila('Ana Pérez', { resueltos: 0, promedio: null, mejor: null, ultimaActividad: null }),
  fila('Tomás Álvarez', { promedio: 8.48, mejor: 9, temasFlojos: 1 }),
  fila('Lucía Díaz', { promedio: 3, mejor: 4, temasFlojos: 3, ultimaActividad: '2026-11-19T08:00:00.000Z' }),
]
const nombres = (filas: FilaDePlanilla[]) => filas.map((f) => f.nombre)

describe('nombres', () => {
  it('ordena por apellido cuando se puede separar', () => {
    expect(claveDeNombre('Bruno Quiroga')).toBe('quiroga bruno')
    expect(claveDeNombre('Zolorza, Clara')).toBe('zolorza clara')
    expect(claveDeNombre('Sofía')).toBe('sofia')
  })

  it('A→Z por apellido, sin que importen tildes ni mayúsculas', () => {
    expect(nombres(ordenar(grupo, 'alumno', 'asc'))).toEqual([
      'Tomás Álvarez',
      'Lucía Díaz',
      'Ana Pérez',
      'Bruno Quiroga',
      'clarita Zolorza',
    ])
  })
})

describe('ordenar', () => {
  it('los vacíos van al final en los dos sentidos', () => {
    expect(nombres(ordenar(grupo, 'promedio', 'desc')).at(-1)).toBe('Ana Pérez')
    expect(nombres(ordenar(grupo, 'promedio', 'asc')).at(-1)).toBe('Ana Pérez')
    expect(nombres(ordenar(grupo, 'actividad', 'asc')).at(-1)).toBe('Ana Pérez')
    expect(nombres(ordenar(grupo, 'mejor', 'asc')).at(-1)).toBe('Ana Pérez')
  })

  it('los empates se desempatan por nombre (A→Z), en los dos sentidos', () => {
    // Bruno Quiroga y Tomás Álvarez tienen 8,48: va primero Álvarez.
    expect(nombres(ordenar(grupo, 'promedio', 'desc')).slice(0, 2)).toEqual(['Tomás Álvarez', 'Bruno Quiroga'])
    expect(nombres(ordenar(grupo, 'promedio', 'asc')).slice(2, 4)).toEqual(['Tomás Álvarez', 'Bruno Quiroga'])
  })

  it('por promedio, mejor, resueltos, actividad y temas flojos', () => {
    expect(nombres(ordenar(grupo, 'promedio', 'asc')).slice(0, 2)).toEqual(['Lucía Díaz', 'clarita Zolorza'])
    expect(nombres(ordenar(grupo, 'mejor', 'desc'))[0]).toBe('Bruno Quiroga')
    expect(nombres(ordenar(grupo, 'resueltos', 'asc'))[0]).toBe('Ana Pérez')
    expect(nombres(ordenar(grupo, 'actividad', 'desc'))[0]).toBe('Bruno Quiroga')
    expect(nombres(ordenar(grupo, 'temas', 'desc')).slice(0, 3)).toEqual(['Lucía Díaz', 'clarita Zolorza', 'Tomás Álvarez'])
  })

  it('no toca el arreglo original', () => {
    const copia = [...grupo]
    ordenar(grupo, 'promedio', 'desc')
    expect(grupo).toEqual(copia)
  })
})

describe('buscar', () => {
  it('sin distinguir tildes ni mayúsculas ("Zolorza" / "zolorza")', () => {
    expect(coincideLaBusqueda(fila('clarita Zolorza'), 'zolorza')).toBe(true)
    expect(coincideLaBusqueda(fila('clarita zolorza'), 'Zolorza')).toBe(true)
    expect(coincideLaBusqueda(fila('Ana Pérez'), 'perez')).toBe(true)
    expect(coincideLaBusqueda(fila('Tomás Álvarez'), 'ALVAREZ tomas')).toBe(true)
    expect(coincideLaBusqueda(fila('Tomás Álvarez'), 'quiroga')).toBe(false)
    expect(normalizarTexto('  Lucía   DÍAZ ')).toBe('lucia diaz')
  })
})

describe('filtros combinados con orden', () => {
  it('"Debajo de 6" usa la nota de aprobación y deja afuera a quien no tiene nota', () => {
    expect(nombres(filasVisibles(grupo, { ...ESTADO_INICIAL, filtro: 'debajo', orden: 'promedio', dir: 'asc' }))).toEqual([
      'Lucía Díaz',
      'clarita Zolorza',
    ])
  })

  it('"No respondieron nada" y "Con temas flojos"', () => {
    expect(nombres(filasVisibles(grupo, { ...ESTADO_INICIAL, filtro: 'nada' }))).toEqual(['Ana Pérez'])
    expect(nombres(filasVisibles(grupo, { ...ESTADO_INICIAL, filtro: 'flojos', orden: 'temas', dir: 'asc' }))).toEqual([
      'Tomás Álvarez',
      'clarita Zolorza',
      'Lucía Díaz',
    ])
  })

  it('filtro + búsqueda + orden juntos', () => {
    const estado = { orden: 'promedio' as const, dir: 'desc' as const, filtro: 'flojos' as const, busqueda: 'z' }
    // Con temas flojos y una "z" en el nombre: Álvarez, Díaz, Zolorza; por promedio de mayor a menor.
    expect(nombres(filasVisibles(grupo, estado))).toEqual(['Tomás Álvarez', 'clarita Zolorza', 'Lucía Díaz'])
  })

  it('cuántos hay en cada chip', () => {
    expect(cuantasPorFiltro(grupo)).toEqual({ todos: 5, nada: 1, debajo: 2, flojos: 3 })
  })
})

describe('encabezados y URL', () => {
  it('tocar invierte; otra columna arranca en su sentido', () => {
    const porPromedio = tocarEncabezado(ESTADO_INICIAL, 'promedio')
    expect(porPromedio).toMatchObject({ orden: 'promedio', dir: 'desc' })
    expect(tocarEncabezado(porPromedio, 'promedio')).toMatchObject({ orden: 'promedio', dir: 'asc' })
    expect(tocarEncabezado(porPromedio, 'alumno')).toMatchObject({ orden: 'alumno', dir: 'asc' })
    expect(tocarEncabezado(ESTADO_INICIAL, 'alumno')).toMatchObject({ orden: 'alumno', dir: 'desc' })
  })

  it('aria-sort sólo en la columna ordenada', () => {
    const estado = { ...ESTADO_INICIAL, orden: 'promedio' as const, dir: 'desc' as const }
    expect(ariaSort(estado, 'promedio')).toBe('descending')
    expect(ariaSort(estado, 'alumno')).toBe('none')
  })

  it('ida y vuelta por la URL, conservando la pestaña', () => {
    const estado = { orden: 'promedio' as const, dir: 'desc' as const, filtro: 'debajo' as const, busqueda: '' }
    const params = estadoALaUrl(estado, new URLSearchParams('pestaña=alumnos'))
    expect(params.toString()).toBe('pesta%C3%B1a=alumnos&orden=promedio&filtro=debajo')
    expect(estadoDesdeLaUrl(params)).toEqual(estado)
    expect(estadoALaUrl({ ...estado, dir: 'asc' }, new URLSearchParams()).toString()).toBe('orden=promedio&dir=asc&filtro=debajo')
    expect(estadoDesdeLaUrl(new URLSearchParams('orden=cualquiera&filtro=x'))).toEqual(ESTADO_INICIAL)
  })

  it('con prefijo, dos planillas en la misma URL no se pisan', () => {
    const params = estadoALaUrl({ ...ESTADO_INICIAL, orden: 'mejor', dir: 'desc' }, new URLSearchParams('orden=promedio'), 't-')
    expect(params.get('orden')).toBe('promedio')
    expect(estadoDesdeLaUrl(params, 't-').orden).toBe('mejor')
  })
})
