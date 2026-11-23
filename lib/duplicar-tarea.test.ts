import { describe, expect, it } from 'vitest'
import { preguntasDeLaCopia, tituloDeCopia } from './duplicar-tarea'

describe('duplicar una tarea (W2)', () => {
  it('el título de la copia no se repite', () => {
    expect(tituloDeCopia('Repaso 1', ['Repaso 1'])).toBe('Repaso 1 (copia)')
    expect(tituloDeCopia('Repaso 1', ['Repaso 1', 'Repaso 1 (copia)'])).toBe('Repaso 1 (copia 2)')
    // Duplicar una copia no apila "(copia) (copia)".
    expect(tituloDeCopia('Repaso 1 (copia)', ['Repaso 1 (copia)'])).toBe('Repaso 1 (copia 2)')
    expect(tituloDeCopia('  ', [])).toBe('Tarea (copia)')
  })
  it('las mismas preguntas, con ids en orden', () => {
    expect(preguntasDeLaCopia([{ id: 'x', question: 'a' }, null, { id: 'q9', question: 'b' }])).toEqual([
      { id: 'q1', question: 'a' },
      { id: 'q2', question: 'b' },
    ])
    expect(preguntasDeLaCopia('nada')).toEqual([])
  })
})
