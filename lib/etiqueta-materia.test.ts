import { describe, expect, it } from 'vitest'
import { etiquetaDeMateria, nombreRepetido, type MateriaConNivel } from './etiqueta-materia'

const m = (id: number, nombre: string, nivel: string | null = null, grado: string | null = null): MateriaConNivel => ({
  id,
  nombre,
  nivel,
  grado,
})

describe('etiquetaDeMateria (H6)', () => {
  it('nombre único: no se agrega nada', () => {
    const todas = [m(1, 'Matemática', 'Secundario', '3er Año'), m(2, 'Lengua', 'Primario', '4to Año')]
    expect(etiquetaDeMateria(todas[0], todas)).toBe('Matemática')
    expect(etiquetaDeMateria(todas[1], todas)).toBe('Lengua')
  })

  it('nombre repetido: nivel y año, para todas las que lo comparten', () => {
    const todas = [
      m(1, 'Matemática', 'Superior', '1er Año'),
      m(2, 'Matemática', 'Secundario', '3er Año'),
      m(3, 'Matemática y su Didáctica', 'Superior', '2do Año'),
    ]
    expect(etiquetaDeMateria(todas[0], todas)).toBe('Matemática · 1.º Sup.')
    expect(etiquetaDeMateria(todas[1], todas)).toBe('Matemática · 3.º Sec.')
    // Otro nombre, aunque empiece igual: único.
    expect(etiquetaDeMateria(todas[2], todas)).toBe('Matemática y su Didáctica')
  })

  it('repetida y sin nivel cargado: "(sin nivel)"', () => {
    const todas = [m(1, 'Matemática', 'Secundario', '1er Año'), m(2, 'Matemática')]
    expect(etiquetaDeMateria(todas[1], todas)).toBe('Matemática (sin nivel)')
    expect(etiquetaDeMateria(todas[0], todas)).toBe('Matemática · 1.º Sec.')
  })

  it('con nivel y sin año: sólo el nivel; un año que no es un número, tal cual', () => {
    const todas = [m(1, 'Física', 'Superior'), m(2, 'Física', 'Superior', 'Ciclo básico'), m(3, 'Física', 'Primario', 'sexto')]
    expect(etiquetaDeMateria(todas[0], todas)).toBe('Física · Sup.')
    expect(etiquetaDeMateria(todas[1], todas)).toBe('Física · Sup. · Ciclo básico')
    expect(etiquetaDeMateria(todas[2], todas)).toBe('Física · 6.º Prim.')
  })

  it('compara sin mayúsculas, tildes ni espacios de más', () => {
    const todas = [m(1, 'Matemática', 'Secundario', '1er Año'), m(2, ' matematica ', 'Secundario', '2do Año')]
    expect(etiquetaDeMateria(todas[0], todas)).toBe('Matemática · 1.º Sec.')
    expect(etiquetaDeMateria(todas[1], todas)).toBe('matematica · 2.º Sec.')
  })

  it('el caso de producción: cuatro "Matemática", dos en el mismo año, se numeran', () => {
    const todas = [
      m(1, 'Matemática', 'Superior', '1er Año'),
      m(2, 'Matemática', 'Secundario', '3er Año'),
      m(3, 'Matemática', 'Secundario', '3er Año'),
      m(4, 'Matemática'),
    ]
    const etiquetas = todas.map((materia) => etiquetaDeMateria(materia, todas))
    expect(etiquetas).toEqual([
      'Matemática · 1.º Sup.',
      'Matemática · 3.º Sec.',
      'Matemática · 3.º Sec. (2)',
      'Matemática (sin nivel)',
    ])
    expect(new Set(etiquetas).size).toBe(4)
  })

  it('una materia que no está en la lista se compara igual contra las demás', () => {
    const otras = [m(1, 'Matemática', 'Secundario', '1er Año')]
    expect(etiquetaDeMateria(m(9, 'Matemática', 'Secundario', '2do Año'), otras)).toBe('Matemática · 2.º Sec.')
  })
})

describe('nombreRepetido', () => {
  it('compara con los demás, no consigo mismo', () => {
    const todos = [
      { id: 1, subjectName: 'Matemática' },
      { id: 2, subjectName: 'matematica' },
      { id: 3, subjectName: 'Lengua' },
    ]
    expect(nombreRepetido(todos[0], todos)).toBe(true)
    expect(nombreRepetido(todos[2], todos)).toBe(false)
  })
})
