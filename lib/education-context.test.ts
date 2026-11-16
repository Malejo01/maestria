import { describe, expect, it } from 'vitest'
import {
  buildEducationSystemPrompt,
  buildExplainErrorPrompt,
  getEducationContext,
  normalizarNivel,
  quitarEmojis,
  resolverNivelYGrado,
  type ContextoProfesionalCarrera,
} from './education-context'

/**
 * El contexto profesional es la diferencia entre que un alumno de una
 * tecnicatura en sistemas reciba "modelá el crecimiento de usuarios de una app"
 * y que reciba "hallá el dominio de f(x)". Lo que se prueba acá no es el texto
 * exacto del prompt sino las dos garantías que lo hacen funcionar: que la
 * sección aparezca con lo que declara el programa, y que desaparezca entera
 * cuando no hay programa que declarar.
 */
const SISTEMAS: ContextoProfesionalCarrera = {
  carrera: 'Tecnicatura Superior en Análisis de Sistemas',
  unidades: [
    {
      eje: 'Unidad 1 — Fundamentos de Lógica y Razonamiento Matemático',
      aplicacion: 'Diseño de algoritmos, validación de procesos',
      herramientas: ['GeoGebra', 'Simulador de lógica'],
    },
  ],
}

describe('buildEducationSystemPrompt · contexto profesional', () => {
  it('incluye carrera, aplicación y herramientas cuando el programa las declara', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: SISTEMAS,
    })

    expect(prompt).toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
    expect(prompt).toContain('Tecnicatura Superior en Análisis de Sistemas')
    expect(prompt).toContain('Diseño de algoritmos, validación de procesos')
    expect(prompt).toContain('GeoGebra, Simulador de lógica')
    expect(prompt).toContain('Unidad 1 — Fundamentos de Lógica y Razonamiento Matemático')
  })

  it('exige contextualizar de forma cuantificada, no como sugerencia', () => {
    // Una indicación blanda se pierde entre las otras reglas del prompt y el
    // modelo vuelve al ejercicio genérico. Si alguien suaviza esta regla, la
    // funcionalidad deja de tener efecto sin que falle nada más.
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: SISTEMAS,
    })

    expect(prompt).toContain('MITAD')
  })

  it('omite la sección entera cuando no hay contexto profesional', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
  })

  it('omite la sección cuando la carrera no tiene unidades con contexto', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: { carrera: 'Tecnicatura en Enfermería', unidades: [] },
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
  })

  it('no altera el prompt de K-12, que nunca lleva contexto profesional', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Secundario',
      grado: '4to Año',
      materia: 'Matemática',
    })

    expect(prompt).not.toContain('CONTEXTO PROFESIONAL DE LA CARRERA')
    expect(prompt).toContain('Nivel Educativo: Secundario')
  })

  it('tolera una unidad sin herramientas declaradas', () => {
    const prompt = buildEducationSystemPrompt({
      nivel: 'Superior',
      grado: '1er Año',
      materia: 'Matemática',
      contextoProfesional: {
        carrera: 'Tecnicatura Superior en Análisis de Sistemas',
        unidades: [{ eje: 'Unidad 7 — Derivadas', aplicacion: 'Optimización de recursos', herramientas: [] }],
      },
    })

    expect(prompt).toContain('Optimización de recursos')
    expect(prompt).not.toContain('Herramientas de la cátedra:')
  })
})

/**
 * A2 (16/11/2026): una explicación de un tema de 4.º año salió con el tono y
 * los emojis de Primario. No era el nivel por defecto —ese siempre fue
 * Secundario—: el formato de la explicación traía los emojis escritos a mano
 * para todos los niveles, y el nivel del grupo no llegaba a la ruta.
 */
const HAY_EMOJI = /\p{Extended_Pictographic}/u

function promptDeExplicacion(nivel: string, grado: string, materia = 'Lengua') {
  return buildExplainErrorPrompt({
    ctx: getEducationContext(nivel, grado, materia),
    question: '¿En qué tiempo verbal está "comió"?',
    selectedText: 'Futuro',
    correctText: 'Pasado',
    topic: 'El verbo',
    subject: materia,
  })
}

describe('registro de la explicación, por nivel', () => {
  it('Primario: registro infantil, con emojis pedidos', () => {
    const ctx = getEducationContext('Primario', '2do Grado', 'Lengua')
    const prompt = promptDeExplicacion('Primario', '2do Grado')
    expect(ctx.permiteEmojis).toBe(true)
    expect(prompt).toContain('LENGUAJE PARA NIÑOS')
    expect(prompt).toContain('Usa emojis sutiles')
    expect(prompt).toMatch(HAY_EMOJI)
  })

  it('Secundario: registro adolescente, sin un solo emoji en el prompt', () => {
    const ctx = getEducationContext('Secundario', '4to Año', 'Lengua')
    const prompt = promptDeExplicacion('Secundario', '4to Año')
    expect(ctx.permiteEmojis).toBe(false)
    expect(prompt).toContain('LENGUAJE PARA ADOLESCENTES DE 15 A 16 AÑOS')
    expect(prompt).toContain('TONO DE EXPLICACIÓN (SECUNDARIO)')
    expect(prompt).toContain('NO uses emojis')
    // Ni siquiera como ejemplo: un emoji en el prompt es una invitación.
    expect(prompt).not.toMatch(HAY_EMOJI)
    expect(prompt).not.toContain('a su edad')
  })

  it('Superior (terciario): registro académico, sin un solo emoji en el prompt', () => {
    const ctx = getEducationContext('Superior', '1er Año', 'Matemática')
    const prompt = promptDeExplicacion('Superior', '1er Año', 'Matemática')
    expect(ctx.permiteEmojis).toBe(false)
    expect(prompt).toContain('LENGUAJE DE EDUCACIÓN SUPERIOR')
    expect(prompt).toContain('TONO DE EXPLICACIÓN (SUPERIOR)')
    expect(prompt).toContain('Educación Superior')
    expect(prompt).toContain('NO uses emojis')
    expect(prompt).not.toMatch(HAY_EMOJI)
  })

  it('los cuatro títulos conservan su numeración en todos los niveles (la ruta los busca)', () => {
    for (const [nivel, grado] of [['Primario', '2do'], ['Secundario', '4to'], ['Superior', '1er']]) {
      const prompt = promptDeExplicacion(nivel, grado)
      for (const n of [1, 2, 3, 4]) expect(prompt, `${nivel} · sección ${n}`).toContain(`## ${n}. `)
    }
  })

  it('la generación de preguntas de Secundario y Superior también prohíbe los emojis', () => {
    for (const nivel of ['Secundario', 'Superior']) {
      const prompt = buildEducationSystemPrompt({ nivel, grado: '1er Año', materia: 'Historia' })
      expect(prompt, nivel).toContain('PROHIBIDO usar emojis')
      expect(prompt, nivel).not.toMatch(HAY_EMOJI)
    }
  })
})

describe('normalizarNivel', () => {
  it.each([
    ['Primario', 'Primario'],
    ['primaria', 'Primario'],
    ['Nivel Primario', 'Primario'],
    ['Secundario', 'Secundario'],
    ['SECUNDARIA', 'Secundario'],
    ['Superior', 'Superior'],
    ['Terciario', 'Superior'],
    ['Universitario', 'Superior'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarNivel(entrada)).toBe(esperado)
  })

  it('lo que no reconoce es null, no un nivel inventado', () => {
    expect(normalizarNivel('')).toBeNull()
    expect(normalizarNivel(undefined)).toBeNull()
    expect(normalizarNivel('4to Año')).toBeNull()
  })

  it('un nivel que antes caía al default ahora se respeta', () => {
    expect(getEducationContext('Terciario', '1er Año', 'Matemática').nivel).toBe('Superior')
    expect(getEducationContext('primaria', '3er Grado', 'Lengua').nivel).toBe('Primario')
  })

  it('sin nivel, el default es Secundario: nunca Primario', () => {
    expect(getEducationContext(undefined, undefined, 'Lengua').nivel).toBe('Secundario')
    expect(getEducationContext('cualquier cosa', '2do', 'Lengua').permiteEmojis).toBe(false)
  })
})

describe('resolverNivelYGrado: el grupo manda sobre el perfil', () => {
  const perfilPrimario = { nivel: 'Primario', grado: '4to Grado' }

  it('lo que manda el cuestionario gana', () => {
    expect(
      resolverNivelYGrado({ nivel: 'Secundario', grado: '4to Año', perfil: perfilPrimario }),
    ).toEqual({ nivel: 'Secundario', grado: '4to Año' })
  })

  it('sin eso, el contexto del programa gana sobre el perfil, y trae su propio año', () => {
    expect(
      resolverNivelYGrado({
        pedagogyContext: 'Nivel: Superior\nGrado/Año: 1er Año\nCarrera: Análisis de Sistemas',
        perfil: perfilPrimario,
      }),
    ).toEqual({ nivel: 'Superior', grado: '1er Año' })
  })

  it('el nivel del programa escrito a su manera también vale', () => {
    expect(resolverNivelYGrado({ pedagogyContext: 'Nivel: Terciario | Grado: 2do' })).toEqual({
      nivel: 'Superior',
      grado: '2do',
    })
  })

  it('sin grupo ni programa, el perfil (Mi progreso no manda nada más)', () => {
    expect(resolverNivelYGrado({ perfil: perfilPrimario })).toEqual({ nivel: 'Primario', grado: '4to Grado' })
  })

  it('sin nada, Secundario', () => {
    expect(resolverNivelYGrado({})).toEqual({ nivel: 'Secundario', grado: undefined })
    expect(resolverNivelYGrado({ perfil: { nivel: null, grado: null } }).nivel).toBe('Secundario')
  })
})

describe('quitarEmojis', () => {
  it('limpia títulos, texto y listas sin dejar huecos', () => {
    const sucio = [
      '## 1. 🧠 ¿Por qué elegiste esta opción?',
      '¡Casi! Elegiste futuro ☀️. Imaginá una manzana 🍎:',
      '- 🍎 **Presente:** la comés ahora 😋',
      '🔍✨ Un truco',
      '1️⃣ Primero',
    ].join('\n')
    expect(quitarEmojis(sucio)).toBe(
      [
        '## 1. ¿Por qué elegiste esta opción?',
        '¡Casi! Elegiste futuro. Imaginá una manzana:',
        '- **Presente:** la comés ahora',
        'Un truco',
        '1 Primero',
      ].join('\n'),
    )
    expect(quitarEmojis(sucio)).not.toMatch(HAY_EMOJI)
  })

  it('no toca lo que es contenido: fórmulas, flechas, símbolos y sangrías', () => {
    const contenido = [
      'Si $p \\rightarrow q$ entonces p → q, y p ↔ q ✓',
      '  - sublista con sangría © 2026 ™',
      'x² ≥ 0, ½ + ¼ = ¾ (100%)',
    ].join('\n')
    expect(quitarEmojis(contenido)).toBe(contenido)
  })

  it('emojis compuestos (familia, tono de piel, bandera) salen enteros', () => {
    expect(quitarEmojis('Hola 👨‍👩‍👧 y 👍🏽 desde 🇦🇷.')).toBe('Hola y desde.')
  })
})
