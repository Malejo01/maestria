// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ShareQuizDialog } from './share-quiz-dialog'
import type { TeacherQuiz } from '@/lib/types'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ classrooms: [], alumnos: [] }), { status: 200 })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const tarea = (status: TeacherQuiz['status']) =>
  ({ id: 9, teacherProgramId: 3, title: 'T', subjectName: 'M', status, selectedTopics: [], questions: [], questionCount: 0 }) as unknown as TeacherQuiz

describe('ShareQuizDialog · AC2: la compuerta', () => {
  it('con una tarea sin aprobar no deja mandar: lleva a «Revisá y aprobá»', () => {
    render(<ShareQuizDialog open onOpenChange={() => {}} onExportMoodle={() => {}} quiz={tarea('pending_share')} />)
    expect(screen.getByText('Antes de mandarla, revisala')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Revisá y aprobá' }).getAttribute('href')).toBe('/teacher?seccion=tareas&revisar=9')
    expect(screen.queryByRole('button', { name: 'Mandar la tarea' })).toBeNull()
  })
  it('con una tarea aprobada (guardada), el diálogo de mandar de siempre, sin pedir la revisión otra vez', () => {
    render(<ShareQuizDialog open onOpenChange={() => {}} onExportMoodle={() => {}} quiz={tarea('saved')} />)
    expect(screen.queryByText('Antes de mandarla, revisala')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Mandar la tarea' })).toBeTruthy()
  })
})

/**
 * Cada camino que abre el diálogo de mandar pasa por la compuerta de arriba
 * (está adentro del diálogo). Este test lista los que hay hoy: si aparece uno
 * nuevo, falla hasta que alguien mire si respeta «Revisá y aprobá».
 */
describe('AC2 · los caminos que abren el diálogo de mandar', () => {
  const RAIZ = join(__dirname, '..')
  const archivos: string[] = []
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre)) archivos.push(ruta)
    }
  }
  recorrer(join(RAIZ, 'app'))
  recorrer(join(RAIZ, 'components'))

  it('son estos, y todos usan el mismo ShareQuizDialog (con la compuerta)', () => {
    const conDialogo = archivos
      .filter((ruta) => /<ShareQuizDialog\b/.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => ruta.slice(RAIZ.length + 1).split(String.fromCharCode(92)).join('/'))
      .sort()
    expect(conDialogo).toEqual([
      'components/docente/arranque-guiado.tsx', // AB4: la tarea más nueva (guardada; si está sin aprobar, la compuerta)
      'components/docente/grupo/mandar-tarea-al-grupo.tsx', // una tarea guardada, desde la página del grupo
      'components/docente/grupo/tareas-del-grupo.tsx', // duplicar una tarea ya mandada a otro grupo
      'components/docente/mis-tareas.tsx', // «Mandar a mi grupo» y «Duplicar y mandar» (sin aprobar → revisión)
      'components/subject-content.tsx', // «Compartir» después de generar → revisión → «Aprobar todas y mandar»
    ])
  })
})
