import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { esPara, novedadesParaAvisar, ordenarNovedades, parsearNovedad, type Novedad } from './novedades'

const md = (datos: string, cuerpo = 'Texto.') => `---\n${datos}\n---\n${cuerpo}`

describe('parsearNovedad', () => {
  it('lee el encabezado y el cuerpo', () => {
    expect(parsearNovedad(md('titulo: Lo nuevo\nfecha: 2026-11-23\npara: docentes\nresumen: Una línea.'), 'lo-nuevo')).toEqual({
      slug: 'lo-nuevo',
      titulo: 'Lo nuevo',
      fecha: '2026-11-23',
      para: 'docentes',
      resumen: 'Una línea.',
      markdown: 'Texto.',
    })
  })
  it('sin título, sin fecha válida o con un slug raro, no; "para" desconocido es para todos', () => {
    expect(parsearNovedad(md('fecha: 2026-11-23'), 'x')).toBeNull()
    expect(parsearNovedad(md('titulo: A\nfecha: 23/11'), 'x')).toBeNull()
    expect(parsearNovedad(md('titulo: A\nfecha: 2026-11-23'), '../x')).toBeNull()
    expect(parsearNovedad(md('titulo: A\nfecha: 2026-11-23\npara: nadie'), 'a')?.para).toBe('todos')
  })
})

describe('qué va a la campanita', () => {
  const n = (slug: string, fecha: string, para: Novedad['para'] = 'todos'): Novedad => ({ slug, titulo: slug, fecha, para, resumen: '', markdown: '' })
  const AHORA = new Date('2026-11-23T15:00:00Z')
  it('de ese rol, ya publicada y de los últimos 30 días', () => {
    const todas = [n('hoy', '2026-11-23'), n('vieja', '2026-10-01'), n('manana', '2026-11-24'), n('docentes', '2026-11-20', 'docentes')]
    expect(novedadesParaAvisar(todas, 'alumno', AHORA).map((x) => x.slug)).toEqual(['hoy'])
    expect(novedadesParaAvisar(todas, 'docente', AHORA).map((x) => x.slug)).toEqual(['hoy', 'docentes'])
  })
  it('antes de que empiece (en Argentina) el día publicado, todavía no', () => {
    expect(novedadesParaAvisar([n('hoy', '2026-11-23')], 'alumno', new Date('2026-11-23T02:00:00Z'))).toEqual([])
    expect(novedadesParaAvisar([n('hoy', '2026-11-23')], 'alumno', new Date('2026-11-23T04:00:00Z'))).toHaveLength(1)
  })
  it('el orden y a quién', () => {
    expect(ordenarNovedades([n('a', '2026-11-01'), null, n('b', '2026-11-20')]).map((x) => x.slug)).toEqual(['b', 'a'])
    expect(esPara(n('x', '2026-11-01', 'alumnos'), 'docente')).toBe(false)
  })
})

describe('content/novedades', () => {
  it('cada archivo se lee bien (y está la primera, de las rondas O a T)', () => {
    const dir = join(__dirname, '..', 'content', 'novedades')
    const archivos = readdirSync(dir).filter((f) => f.endsWith('.md'))
    expect(archivos.length).toBeGreaterThan(0)
    for (const f of archivos) expect(parsearNovedad(readFileSync(join(dir, f), 'utf8'), f.replace(/\.md$/, '')), f).not.toBeNull()
    expect(archivos).toContain('lo-nuevo-de-noviembre.md')
  })
})
