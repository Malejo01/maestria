import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIAS, ordenarGuias, parsearGuia } from './ayuda'

const guia = `---
titulo: Probar
resumen: Una línea.
orden: 2
accion: /teacher
accionTexto: Ir
---
Texto **con** negrita.

![Una captura](/ayuda/x.png)

- una lista
![no es imagen porque no está sola](/ayuda/y.png) en el medio
![de afuera](https://evil.com/a.png)
`

describe('parsearGuia (V6)', () => {
  it('lee los datos, el texto y las capturas', () => {
    const g = parsearGuia(guia, 'diagnostico')!
    expect(g).toMatchObject({ titulo: 'Probar', resumen: 'Una línea.', orden: 2, accion: '/teacher', accionTexto: 'Ir' })
    expect(g.partes.map((p) => p.tipo)).toEqual(['texto', 'imagen', 'texto'])
    expect(g.partes[1]).toEqual({ tipo: 'imagen', src: '/ayuda/x.png', alt: 'Una captura' })
    // Una imagen de afuera, o en medio de una línea, no se toma como captura.
    expect(g.partes[2]).toMatchObject({ tipo: 'texto' })
  })
  it('sin datos o sin título, null; una acción que no es de la app, no va', () => {
    expect(parsearGuia('# Hola', 'diagnostico')).toBeNull()
    expect(parsearGuia('---\nresumen: x\n---\nhola', 'diagnostico')).toBeNull()
    expect(parsearGuia('---\ntitulo: T\naccion: https://evil.com\n---\nhola', 'diagnostico')?.accion).toBeNull()
    expect(parsearGuia('---\ntitulo: T\naccion: //evil.com\n---\nhola', 'diagnostico')?.accion).toBeNull()
  })
  it('ordena por orden y deja afuera las que no se leyeron', () => {
    const a = parsearGuia('---\ntitulo: B\norden: 2\n---\nx', 'diagnostico')
    const b = parsearGuia('---\ntitulo: A\norden: 1\n---\nx', 'grupos-y-alumnos')
    expect(ordenarGuias([a, null, b]).map((g) => g.titulo)).toEqual(['A', 'B'])
  })
})

describe('las guías del repo', () => {
  it.each(GUIAS)('%s: se lee, tiene texto y sus capturas existen', (slug) => {
    const fuente = readFileSync(join(process.cwd(), 'content', 'ayuda', `${slug}.md`), 'utf8')
    const g = parsearGuia(fuente, slug)
    expect(g).not.toBeNull()
    expect(g!.resumen.length).toBeGreaterThan(10)
    expect(g!.partes.some((p) => p.tipo === 'texto')).toBe(true)
    for (const p of g!.partes) if (p.tipo === 'imagen') expect(existsSync(join(process.cwd(), 'public', p.src))).toBe(true)
    // Voseo y sin signo de exclamación de apertura (sistema de diseño).
    expect(fuente).not.toMatch(/¡/)
  })
})
