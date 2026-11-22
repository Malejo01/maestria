import { describe, expect, it } from 'vitest'
import {
  alumnosMaximosPorCurso,
  cabeEnElGratis,
  cuerpoDeBloqueo,
  cuestionariosDelMes,
  cupoDeCursosAula,
  cupoVigente,
  cursoTieneLugar,
  estadoDelPlan,
  leerBloqueo,
  permiteImprimirYMoodle,
  permiteIndividual,
  practicasExtraPorAlumnoMes,
  puedeCrearCurso,
  tipoDePlan,
  type DatosDelPlan,
  type ResumenDelPlan,
} from './planes'
import { lugaresPorTipo } from './alumnos-docente'
import { estadoDePracticaExtra } from './practica-extra'

const AHORA = new Date('2026-11-22T15:00:00-03:00')
const datos = (extra: Partial<DatosDelPlan>): DatosDelPlan => ({
  nivel: 1,
  venceEl: '2026-12-22T00:00:00Z',
  pruebaIniciadaEl: null,
  esExento: false,
  ahora: AHORA,
  alumnosActuales: 0,
  ...extra,
})

describe('B1 · tipo de plan', () => {
  it('sin la 037 (o con basura), particular', () => {
    expect(tipoDePlan(undefined)).toBe('particular')
    expect(tipoDePlan('otra cosa')).toBe('particular')
    expect(tipoDePlan('aula')).toBe('aula')
  })

  it('los cursos del Aula: un entero ≥ 0', () => {
    expect(cupoDeCursosAula(2)).toBe(2)
    expect(cupoDeCursosAula('3')).toBe(3)
    expect(cupoDeCursosAula(null)).toBe(0)
    expect(cupoDeCursosAula(-1)).toBe(0)
  })

  it('35 alumnos por curso, desde la variable', () => {
    expect(alumnosMaximosPorCurso({})).toBe(35)
    expect(alumnosMaximosPorCurso({ MAESTRIA_AULA_ALUMNOS_POR_CURSO: '40' })).toBe(40)
  })
})

describe('B1 · la tabla de controles', () => {
  it('cuestionarios cada 30 días: gratis 10, Aula 60, Particular sin tope', () => {
    expect(cuestionariosDelMes('particular', 'gratis', {})).toBe(10)
    expect(cuestionariosDelMes('aula', 'activo', {})).toBe(60)
    expect(cuestionariosDelMes('particular', 'activo', {})).toBeNull()
    expect(cuestionariosDelMes('particular', 'prueba', {})).toBeNull()
  })

  it('prácticas extra: 10 por alumno por mes sólo en el Aula vigente', () => {
    expect(practicasExtraPorAlumnoMes('aula', 'activo')).toBe(10)
    expect(practicasExtraPorAlumnoMes('particular', 'activo')).toBeNull()
    expect(practicasExtraPorAlumnoMes('aula', 'gratis')).toBeNull()
  })

  it('funciones individuales: no en el Aula vigente', () => {
    expect(permiteIndividual('aula', 'activo')).toBe(false)
    expect(permiteIndividual('particular', 'activo')).toBe(true)
    expect(permiteIndividual('particular', 'gratis')).toBe(true)
    // Un Aula vencida vuelve a las reglas del gratis.
    expect(permiteIndividual('aula', 'gratis')).toBe(true)
  })

  it('informe para imprimir y Moodle: no en el gratis', () => {
    expect(permiteImprimirYMoodle('gratis')).toBe(false)
    expect(permiteImprimirYMoodle('activo')).toBe(true)
    expect(permiteImprimirYMoodle('prueba')).toBe(true)
  })

  it('Aula: los cursos pagos son el tope de grupos abiertos', () => {
    expect(puedeCrearCurso('aula', 'activo', 0, 1)).toBe(true)
    expect(puedeCrearCurso('aula', 'activo', 1, 1)).toBe(false)
    expect(puedeCrearCurso('particular', 'activo', 9, 0)).toBe(true)
  })

  it('Aula: el cupo de alumnos es cursos × 35', () => {
    expect(cupoVigente('activo', 1, {}, { tipo: 'aula', cursos: 2 })).toBe(70)
    expect(cupoVigente('activo', 1, {}, { tipo: 'particular', cursos: 0 })).toBe(5)
  })
})

describe('B1 · el curso tiene lugar (el alumno 36 no entra)', () => {
  it('Aula: hasta 35 por curso', () => {
    expect(cursoTieneLugar({ estado: 'activo', tipo: 'aula', enEsteCurso: 34, otrosCursosConAlumnos: 0, env: {} })).toBe(true)
    expect(cursoTieneLugar({ estado: 'activo', tipo: 'aula', enEsteCurso: 35, otrosCursosConAlumnos: 0, env: {} })).toBe(false)
  })

  it('gratis: un solo curso de hasta 35', () => {
    expect(cursoTieneLugar({ estado: 'gratis', tipo: 'particular', enEsteCurso: 0, otrosCursosConAlumnos: 0, env: {} })).toBe(true)
    expect(cursoTieneLugar({ estado: 'gratis', tipo: 'particular', enEsteCurso: 0, otrosCursosConAlumnos: 1, env: {} })).toBe(false)
    expect(cursoTieneLugar({ estado: 'gratis', tipo: 'particular', enEsteCurso: 20, otrosCursosConAlumnos: 1, env: {} })).toBe(true)
    expect(cursoTieneLugar({ estado: 'gratis', tipo: 'particular', enEsteCurso: 35, otrosCursosConAlumnos: 0, env: {} })).toBe(false)
  })

  it('Particular y exento: como siempre (decide el cupo)', () => {
    expect(cursoTieneLugar({ estado: 'activo', tipo: 'particular', enEsteCurso: 200, otrosCursosConAlumnos: 9, env: {} })).toBe(true)
    expect(cursoTieneLugar({ estado: 'exento', tipo: 'aula', enEsteCurso: 200, otrosCursosConAlumnos: 9, env: {} })).toBe(true)
  })
})

describe('B1 · el gratis: 2 particulares + 1 curso de hasta 35', () => {
  it('cabe', () => {
    expect(cabeEnElGratis({ particulares: 2, cursos: [35] }, {})).toBe(true)
    expect(cabeEnElGratis({ particulares: 0, cursos: [] }, {})).toBe(true)
  })

  it('no cabe: un tercer particular, un segundo curso, o un curso de 36', () => {
    expect(cabeEnElGratis({ particulares: 3, cursos: [] }, {})).toBe(false)
    expect(cabeEnElGratis({ particulares: 0, cursos: [10, 4] }, {})).toBe(false)
    expect(cabeEnElGratis({ particulares: 0, cursos: [36] }, {})).toBe(false)
  })

  it('al terminar la prueba, con lugares por tipo decide el gratis nuevo', () => {
    const vencido = { venceEl: '2026-11-01T00:00:00Z' }
    expect(estadoDelPlan(datos({ ...vencido, alumnosActuales: 30, lugares: { particulares: 1, cursos: [29] } }), {})).toBe('gratis')
    expect(estadoDelPlan(datos({ ...vencido, alumnosActuales: 3, lugares: { particulares: 3, cursos: [] } }), {})).toBe('vencido')
  })

  it('sin lugares por tipo (la válvula), la regla de antes', () => {
    const vencido = { venceEl: '2026-11-01T00:00:00Z' }
    expect(estadoDelPlan(datos({ ...vencido, alumnosActuales: 2 }), {})).toBe('gratis')
    expect(estadoDelPlan(datos({ ...vencido, alumnosActuales: 3 }), {})).toBe('vencido')
  })
})

describe('B1 · ningún docente actual pierde nada', () => {
  it('un Particular con plan vigente sigue igual: mismo estado, mismo cupo, todo permitido', () => {
    const d = datos({ nivel: 2, alumnosActuales: 9 })
    const estado = estadoDelPlan(d, {})
    expect(estado).toBe('activo')
    expect(cupoVigente(estado, 2, {}, { tipo: undefined, cursos: undefined })).toBe(10)
    expect(permiteIndividual(tipoDePlan(undefined), estado)).toBe(true)
    expect(permiteImprimirYMoodle(estado)).toBe(true)
    expect(cuestionariosDelMes(tipoDePlan(undefined), estado, {})).toBeNull()
  })

  it('quien ya cabía en el gratis de antes (≤ 2 alumnos), sigue cabiendo en el nuevo', () => {
    for (const lugares of [
      { particulares: 2, cursos: [] },
      { particulares: 1, cursos: [1] },
      { particulares: 0, cursos: [2] },
    ]) {
      expect(cabeEnElGratis(lugares, {})).toBe(true)
    }
  })
})

describe('B1 · los motivos de bloqueo nuevos se leen en la UI', () => {
  const resumen = { estado: 'activo', tipo: 'aula', topeCuestionarios: 60, alumnos: 1, nivel: 1, cupoGratis: 2 } as unknown as ResumenDelPlan
  it('sin cursos, sólo con Particular, con un plan', () => {
    for (const motivo of ['sin_cursos', 'solo_particular', 'con_un_plan'] as const) {
      const cuerpo = cuerpoDeBloqueo(resumen, motivo, {})
      expect(leerBloqueo(cuerpo)?.plan.motivo).toBe(motivo)
      expect(cuerpo.error.length).toBeGreaterThan(0)
    }
    expect(cuerpoDeBloqueo(resumen, 'tope_cuestionarios', {}).error).toContain('plan Aula')
  })
})

describe('B1 · lugares por tipo', () => {
  it('con invitación, particular; por código, del curso (por grupo); las invitaciones sin usar, particulares', () => {
    const miembros = [
      { userId: 'a', nombre: 'Ana', grupoId: 1 },
      { userId: 'b', nombre: 'Beto', grupoId: 2 },
      { userId: 'c', nombre: 'Caro', grupoId: 2 },
      { userId: 'c', nombre: 'Caro', grupoId: 3 },
    ]
    const invitaciones = [
      { id: 10, nombre: 'Ana', grupoId: 1 },
      { id: 11, nombre: 'Dani', grupoId: 1 },
    ]
    const r = lugaresPorTipo(miembros, invitaciones)
    expect(r.particulares).toBe(2)
    expect(r.porGrupo.get(2)).toBe(2)
    expect(r.porGrupo.get(3)).toBe(1)
  })
})

describe('B1 · prácticas extra del mes (Aula)', () => {
  const base = { hayMigracion: true, esDelAlumno: true, esDiagnostico: false, planVencido: false, hechasHoy: 0 }
  it('con 10 en el mes, el botón da paso al texto del tope del mes', () => {
    expect(estadoDePracticaExtra({ ...base, delMes: { hechas: 10, tope: 10 } })).toMatchObject({ disponible: false, motivo: 'topeMes' })
    expect(estadoDePracticaExtra({ ...base, delMes: { hechas: 9, tope: 10 } }).disponible).toBe(true)
    expect(estadoDePracticaExtra({ ...base, delMes: null }).disponible).toBe(true)
  })
})
