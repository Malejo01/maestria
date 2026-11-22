import { seccionPerfilAlumnos, type PerfilAlumnos } from '@/lib/perfil-alumnos'
import { ESTRATEGIA_GENERAL, ESTRATEGIA_LENGUA, ESTRATEGIA_MATEMATICA, ESTRATEGIA_NATURALES, ESTRATEGIA_SOCIALES } from '@/lib/areas'

export interface EducationContext {
  nivel: 'Primario' | 'Secundario' | 'Superior'
  grado: string
  edadMin: number
  edadMax: number
  etapaDesarrollo: string
  rolDocente: string
  registroLinguistico: string
  maxOpcionesPalabras: number
  instruccionesExplicacion: string
  contextualizacion: string
  estrategiaMateria: string
  rubricaRespuestaCorta: string
  /**
   * Los emojis son contenido pedagógico SÓLO para Primario. En Secundario y
   * Superior el texto que escribe la IA no lleva ninguno: se le pide en el
   * prompt y, como el modelo no siempre obedece, `quitarEmojis` lo garantiza
   * sobre la salida.
   */
  permiteEmojis: boolean
}

export type NivelEducativo = EducationContext['nivel']

/**
 * Lleva a uno de los tres niveles lo que en la práctica llega escrito de
 * muchas formas: el perfil del alumno dice "Secundario", pero el programa de
 * un docente puede decir "secundaria", "Nivel Primario" o "Terciario". Antes
 * sólo se aceptaba la forma exacta y todo lo demás caía, callado, al default.
 *
 * Devuelve `null` si no reconoce nada, para que quien llama pueda seguir
 * buscando en otra fuente antes de resignarse al default.
 */
export function normalizarNivel(valor?: string | null): NivelEducativo | null {
  if (!valor) return null
  const v = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (/primari/.test(v)) return 'Primario'
  if (/secundari|bachiller|polimodal/.test(v)) return 'Secundario'
  if (/superior|terciari|universi|profesorado|tecnicatura|licenciatura|facultad/.test(v)) return 'Superior'
  return null
}

const NIVEL_POR_DEFECTO: NivelEducativo = 'Secundario'

const SIN_EMOJIS =
  '- PROHIBIDO usar emojis, emoticones o pictogramas: ni en títulos, ni en el texto, ni en las opciones.'

function parseNumeroGrado(gradoStr?: string): number {
  if (!gradoStr) return 1
  const match = gradoStr.match(/\d+/)
  return match ? parseInt(match[0], 10) : 1
}

/**
 * M2: que el tipo de pregunta coincida con la consigna. Vale para todas las
 * materias (los reportes #2, #3, #4 y #6 son de Matemática y de Didáctica), y
 * lo que se escapa lo agarra lib/validar-tipo-de-pregunta.ts después.
 */
export const COHERENCIA_DE_TIPOS = `COHERENCIA ENTRE TIPO Y CONSIGNA:
- "true_false": la consigna es SIEMPRE una AFIRMACIÓN que se puede juzgar verdadera o falsa, sin "¿" y sin "?" al final ("El sentido de la desigualdad se invierte al multiplicar por un negativo."). Nunca una pregunta abierta ("¿qué sucede…?", "¿cómo…?", "¿por qué…?", "¿favorecen o dificultan…?"): ésas no se contestan con Verdadero o Falso.
- "numeric": sólo cuando la respuesta es UN NÚMERO. Un concepto, un procedimiento, una propiedad o un nombre ("¿qué concepto se emplea?", "¿cómo se llama…?") van como "short_answer" o "multiple_choice".`

function getSubjectStrategy(materia: string): string {
  return `${estrategiaDeLaMateria(materia)}
${COHERENCIA_DE_TIPOS}`
}

/**
 * La estrategia de distractores por palabra clave de la materia. Los textos
 * viven en lib/areas.ts (ronda T, A1): cuando el área de la materia se conoce,
 * `getSubjectStrategy` usa la del perfil; sin área, esta cadena de siempre.
 */
function estrategiaDeLaMateria(materia: string): string {
  const m = materia.toLowerCase()
  if (m.includes('matemát') || m.includes('matemat') || m.includes('álgebra') || m.includes('algebra') || m.includes('análisis') || m.includes('analisis') || m.includes('geometría') || m.includes('probabilidad')) {
    return ESTRATEGIA_MATEMATICA
  }
  if (m.includes('natural') || m.includes('biolog') || m.includes('física') || m.includes('química') || m.includes('quimica') || m.includes('fisica')) {
    return ESTRATEGIA_NATURALES
  }
  if (m.includes('social') || m.includes('histor') || m.includes('geograf') || m.includes('econ') || m.includes('formación') || m.includes('ética')) {
    return ESTRATEGIA_SOCIALES
  }
  if (m.includes('lengua') || m.includes('literat') || m.includes('español') || m.includes('idioma') || m.includes('english')) {
    return ESTRATEGIA_LENGUA
  }
  return ESTRATEGIA_GENERAL
}

/**
 * O3 · ¿Es contenido de didáctica (de la matemática)? La persona de Superior +
 * Matemática exige demostración y pone 0-40 % al resultado sin desarrollo: no
 * calza con una unidad que pregunta cómo se enseña. Cuenta como didáctica si
 * lo dice la materia ("Matemática y su Didáctica", "Didáctica de la
 * Matemática"), alguna unidad, o la mitad de los temas.
 */
const DIDACTICA =
  /did[aá]ctic|ense[nñ]anza|aprendizaje|transposici[oó]n|secuencia did|planificaci[oó]n|obst[aá]culo|dise[nñ]o curricular|interven(ci[oó]n|ir) docente|errores? (de|en) los alumnos/i

export function esContenidoDeDidactica(fuentes: { materia?: string | null; unidades?: readonly string[]; temas?: readonly string[] }): boolean {
  if (DIDACTICA.test(fuentes.materia ?? '')) return true
  if ((fuentes.unidades ?? []).some((u) => DIDACTICA.test(u))) return true
  const temas = (fuentes.temas ?? []).filter((t) => t.trim())
  return temas.length > 0 && temas.filter((t) => DIDACTICA.test(t)).length * 2 >= temas.length
}

export function getEducationContext(
  nivelStr?: string,
  gradoStr?: string,
  materia: string = 'la materia',
  /** O3: unidades y temas de lo que se genera, para reconocer una unidad de didáctica. */
  contenido?: { unidades?: readonly string[]; temas?: readonly string[] },
): EducationContext {
  const nivel = normalizarNivel(nivelStr) ?? NIVEL_POR_DEFECTO

  const numGrado = parseNumeroGrado(gradoStr)
  const estrategiaMateria = getSubjectStrategy(materia)

  if (nivel === 'Primario') {
    const gradoNum = Math.min(Math.max(numGrado, 1), 7)
    const edadMin = 5 + gradoNum // 1er -> 6, 3er -> 8, 7mo -> 12
    const edadMax = edadMin + 1   // 1er -> 7, 3er -> 9, 7mo -> 13

    let etapaDesarrollo = 'Infancia temprana'
    let maxPalabras = 10
    let emojiInstruction = ''
    let rubricaCorta = ''
    let rolDocente = `Maestro/a de Grado especialista en ${materia} para Nivel Primario`
    let registroLinguistico = ''
    let instruccionesExplicacion = ''

    if (gradoNum <= 2) {
      // Persona 1: Alumno 1º/2º Grado
      etapaDesarrollo = 'Infancia temprana'
      maxPalabras = 10
      emojiInstruction = `
USO PEDAGÓGICO DE EMOJIS (1º/2º GRADO):
- Incluye emojis sutiles, simpáticos e ilustrativos al lado de palabras clave en el enunciado y en las opciones (ej: pollitos 🐥, tortugas 🐢, pájaros 🐦, huevo 🥚, agua 💧, sol ☀️, plantas 🌱, números 🔢).
- Coloca 1 emoji relevante por opción y 1-2 en la pregunta para enriquecer la lectura visual de los niños sin recargar ni distraer.`
      rolDocente = 'Tutor lúdico y motivador'
      registroLinguistico = `LENGUAJE PARA NIÑOS DE ${edadMin} A ${edadMax} AÑOS:
- Muy empático, cálido, motivador y lúdico. Lenguaje extremadamente simple, oraciones cortas, vocabulario cotidiano.
- Usa oraciones breves, simples y directas (máximo 15 palabras por oración).
- Actúas como un compañero de aventuras, no como una autoridad severa.
- PROHIBICIÓN ABSOLUTA DE LENGUAJE TÉCNICO.
- Contextualiza las situaciones con la vida cotidiana infantil (la escuela, la familia, la naturaleza, animales, juegos).
${emojiInstruction}`
      instruccionesExplicacion = `TONO DE EXPLICACIÓN:
- Tono súper cálido, amigable, empático y festivo (voseo/tuteo respetuoso).
- Desdramatiza los errores con frases entusiastas: "¡Casi! Estás muy cerca..."`
      rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (1º/2º Grado):
- Excelente (100%): Responde a la idea principal con sus propias palabras. (Ej. "¡Súper bien! 🌟 Lo entendiste perfecto.")
- Parcial (70%): Se acerca mucho a la idea, pero falta un pequeño detalle. (Ej. "¡Vas genial! 🚀 ¿Qué te parece si también pensamos en...?")
- A mejorar (40%): La respuesta no tiene relación o muestra incomprensión, pero se valida el esfuerzo fuertemente. (Ej. "¡Me encanta tu esfuerzo! 💪 Vamos a mirarlo juntos otra vez...")
(Se ignora la ortografía si la fonética es comprensible)`
    } else {
      // Persona 2: Docente de Primaria
      etapaDesarrollo = 'Infancia media'
      maxPalabras = 14
      emojiInstruction = `
USO DE EMOJIS:
- Usa emojis de forma muy mínima (solo 1 por pregunta si aporta claridad visual a un concepto clave).`
      rolDocente = `Docente de Primaria contenedor y didáctico (especialista en ${materia})`
      registroLinguistico = `LENGUAJE PARA ALUMNOS DE ${edadMin} A ${edadMax} AÑOS:
- Colegial, didáctico, de soporte pedagógico constante. Paciente y constructivo.
- Foco en la contención emocional del alumno, la evaluación formativa y el aprendizaje andamiado.
- Usa lenguaje claro pero introduce sutilmente vocabulario específico de las materias.
- Oraciones directas (máximo 15-20 palabras).
- PROHIBICIÓN ABSOLUTA DE LENGUAJE TÉCNICO DE SECUNDARIA.
- Contextualiza las situaciones con la vida cotidiana infantil y entorno escolar.
${emojiInstruction}`
      instruccionesExplicacion = `TONO DE EXPLICACIÓN (PRIMARIA MAYOR):
- Desdramatiza los errores. Interviene con preguntas socráticas simples para reconducir el razonamiento y fomentar el auto-descubrimiento.
- NUNCA felicites al alumno diciendo "¡Excelente!" cuando esté leyendo la explicación de una respuesta que respondió MAL.`
      rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Primaria Mayor):
- Excelente (100%): Demuestra comprensión clara del concepto y lo explica de forma coherente.
- Parcial (70%): Comprende el concepto general, pero falta precisión o desarrollo en la respuesta. (Feedback: Ofrece una guía pedagógica o pregunta disparadora).
- A mejorar (40%): Hay un error conceptual claro. (Feedback: Nunca digas "está mal"; interviene con preguntas socráticas simples para reconducir el razonamiento sin frustrar).`
    }

    return {
      nivel: 'Primario',
      grado: `${gradoNum}º Grado`,
      edadMin,
      edadMax,
      etapaDesarrollo,
      rolDocente,
      registroLinguistico,
      maxOpcionesPalabras: maxPalabras,
      instruccionesExplicacion,
      contextualizacion: 'Contextualiza las situaciones dentro de entornos locales y cotidianos de Argentina, usando la región o provincia correspondiente al estudiante cuando sea relevante.',
      estrategiaMateria,
      rubricaRespuestaCorta: rubricaCorta,
      permiteEmojis: true,
    }
  }

  if (nivel === 'Secundario') {
    const anioNum = Math.min(Math.max(numGrado, 1), 6)
    const edadMin = 11 + anioNum // 1er -> 12, 6to -> 17
    const edadMax = edadMin + 1   // 1er -> 13, 6to -> 18

    let etapaDesarrollo = 'Adolescencia temprana'
    if (anioNum >= 3 && anioNum <= 4) {
      etapaDesarrollo = 'Adolescencia media'
    } else if (anioNum >= 5) {
      etapaDesarrollo = 'Adolescencia tardía (Pre-universitaria)'
    }

    let rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Secundaria General):
- Excelente (100%): Respuesta correcta, coherente y bien argumentada.
- Parcial (70%): Concepto general correcto pero falta profundidad o hay errores menores.
- A mejorar (40%): Error conceptual grave o respuesta muy incompleta.`

    let rolDocente = `Profesor/a de ${materia} del Nivel Secundario`
    let registroLinguistico = `LENGUAJE PARA ADOLESCENTES DE ${edadMin} A ${edadMax} AÑOS:
- Usa vocabulario disciplinar propio de ${materia} acorde a ${anioNum}º Año de secundaria.
- Las oraciones pueden ser compuestas y requerir relaciones de causa-efecto o análisis crítico.
- Evita el infantilismo, dirigiéndote al estudiante con empatía, claridad y estímulo al pensamiento autónomo.
- Las opciones pueden contener matices conceptuales bien diferenciados.
${SIN_EMOJIS}`

    if (materia.toLowerCase().includes('histor') || materia.toLowerCase().includes('social')) {
      // Persona 3: Historia
      rolDocente = `Profesor/a de Historia/Sociales analítico y crítico`
      registroLinguistico += `\n- Tono académico, analítico y reflexivo. Fomenta constantemente el pensamiento crítico, cuestionando el "por qué" y el "para qué". Usa lenguaje formal y propio de las ciencias sociales.`
      rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Historia / Sociales):
- Excelente (100%): Identifica correctamente causas y consecuencias, ubica el hecho de forma precisa en su contexto histórico (tiempo y espacio) y presenta una redacción clara y argumentada.
- Parcial (70%): Menciona los datos o hechos correctos, pero carece de profundidad en el análisis multicausal o presenta imprecisiones menores en el contexto temporal.
- A mejorar (40%): Confusión grave de épocas, anacronismos inaceptables, reducción de un proceso histórico a un evento aislado o falta total de argumentación.`
    } else if (materia.toLowerCase().includes('lengua') || materia.toLowerCase().includes('literat') || materia.toLowerCase().includes('español')) {
      // Persona 4: Lengua
      rolDocente = `Profesor/a de Lengua y Literatura estricto e inspirador`
      registroLinguistico += `\n- Culto, preciso, elegante e inspirador respecto al amor por la lectura. Muy meticuloso en las devoluciones. Apunta a la belleza y corrección del lenguaje.`
      rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Lengua y Literatura):
- Excelente (100%): Respuesta analítica correcta, con excelente cohesión, coherencia y riqueza léxica. Cero errores ortográficos o gramaticales.
- Parcial (70%): Comprensión lectora adecuada y argumento válido, pero presenta de 1 a 3 errores normativos (tildes, puntuación, sintaxis) o resulta redundante en su expresión.
- A mejorar (40%): Errores ortográficos o sintácticos graves que dificultan la lectura, uso de registro informal inapropiado, o incapacidad manifiesta para interpretar la consigna textual.`
    }

    return {
      nivel: 'Secundario',
      grado: `${anioNum}º Año`,
      edadMin,
      edadMax,
      etapaDesarrollo,
      rolDocente,
      registroLinguistico,
      maxOpcionesPalabras: 25,
      instruccionesExplicacion: `TONO DE EXPLICACIÓN (SECUNDARIO):
- Tono motivador, claro y con rigor académico adecuado para la secundaria.
- Explica la lógica paso a paso, destacando el principio teórico subyacente y cómo aplicarlo a futuros ejercicios.`,
      contextualizacion: 'Incluye referencias a situaciones reales, aplicaciones prácticas del conocimiento y contexto regional o nacional argentino cuando sea relevante.',
      estrategiaMateria,
      rubricaRespuestaCorta: rubricaCorta,
      permiteEmojis: false,
    }
  }

  // Nivel Superior
  let rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Superior General):
- Excelente (100%): Demostración precisa y formal del concepto, usando lenguaje técnico adecuado.
- Parcial (70%): Razonamiento correcto pero omisión de algún detalle formal o error menor de cálculo/nomenclatura.
- A mejorar (40%): Falta de rigor formal, saltos lógicos sin justificar, o error conceptual de base.`

  let rolDocente = `Profesor/a Universitario/a especialista en ${materia}`
  let registroLinguistico = `LENGUAJE DE EDUCACIÓN SUPERIOR:
- Emplea terminología técnica, formal y académica rigurosa de ${materia}.
- Plantea problemas con precisión conceptual y lenguaje universitario sin simplificaciones artificiales.
${SIN_EMOJIS}`

  const esMatematica = materia.toLowerCase().includes('matemát') || materia.toLowerCase().includes('matemat') || materia.toLowerCase().includes('álgebra') || materia.toLowerCase().includes('algebra') || materia.toLowerCase().includes('análisis') || materia.toLowerCase().includes('analisis') || materia.toLowerCase().includes('cálculo')
  if (esMatematica && esContenidoDeDidactica({ materia, ...contenido })) {
    // Persona 5b (O3): Didáctica de la Matemática en Superior. Sigue siendo
    // formal y rigurosa en la matemática, pero lo que se evalúa es el saber
    // didáctico (cómo se enseña, qué errores aparecen, qué consigna elegir):
    // no se exige demostración ni se castiga la respuesta sin desarrollo formal.
    rolDocente = `Profesor/a de Didáctica de la Matemática en un profesorado`
    registroLinguistico += `\n- Formal y preciso en la matemática, pero el foco es didáctico: situaciones de aula, producciones de alumnos, consignas, errores frecuentes y decisiones de enseñanza. NO pidas demostraciones formales.`
    rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Didáctica de la Matemática):
- Excelente (100%): Fundamenta la decisión o el análisis didáctico con un criterio claro (qué se enseña, por qué, qué error se previene) y la matemática involucrada es correcta.
- Parcial (70%): La idea didáctica es correcta pero está poco fundamentada, o hay una imprecisión matemática menor.
- A mejorar (40%): Respuesta genérica sin criterio didáctico, o con un error conceptual matemático.`
  } else if (esMatematica) {
    // Persona 5: Matemática Superior
    rolDocente = `Profesor/a Universitario/a de Matemática implacable en lógica y rigor`
    registroLinguistico += `\n- Estrictamente formal, objetivo, riguroso e implacable en la lógica. Uso absoluto de terminología matemática precisa. Fomenta el pensamiento abstracto y la demostración.`
    rubricaCorta = `RÚBRICA PARA RESPUESTA CORTA (Matemática Superior):
- Excelente (100%): Procedimiento lógico impecable, detallado paso a paso. Uso estricto y correcto de la notación matemática. Justificación explícita de los teoremas o propiedades aplicadas. Resultado final correcto.
- Parcial (70%): El razonamiento abstracto es correcto, pero se cometió un error algebraico o aritmético menor (error de arrastre o signo) que alteró el resultado final, o bien, se omitió formalizar un paso intermedio. El feedback debe aislar exactamente en qué paso lógico ocurrió el fallo.
- A mejorar (40%): El estudiante entregó solo el resultado correcto sin desarrollo (0% a 40%), o el desarrollo presenta falencias lógicas graves (ej. saltos inferenciales "mágicos", cancelar términos ignorando restricciones del dominio como dividir por cero, aplicación de teoremas fuera de sus hipótesis).`
  }

  return {
    nivel: 'Superior',
    grado: gradoStr || 'Nivel Terciario / Universitario',
    edadMin: 18,
    edadMax: 99,
    etapaDesarrollo: 'Educación Superior / Adultos',
    rolDocente,
    registroLinguistico,
    maxOpcionesPalabras: 35,
    instruccionesExplicacion: `TONO DE EXPLICACIÓN (SUPERIOR):
- Tono académico, profesional y formalmente didáctico.
- Justifica formalmente basándote en axiomas, teoremas, definiciones oficiales o marcos teóricos de la disciplina.`,
    contextualizacion: 'Enfocado en estándares de la cátedra universitaria y aplicación profesional de la materia.',
    estrategiaMateria,
    rubricaRespuestaCorta: rubricaCorta,
    permiteEmojis: false,
  }
}

// ── De dónde sale el nivel ──────────────────────────────────────────────────

/**
 * Decide con qué nivel y año se le habla al alumno, en este orden:
 *
 *   1. lo que manda quien llama (el cuestionario sabe de qué grupo es),
 *   2. lo que dice el contexto pedagógico del programa ("Nivel: …"),
 *   3. el perfil del alumno,
 *   4. Secundario.
 *
 * El grupo va antes que el perfil a propósito: un alumno registrado como
 * Primario que hace una tarea de un grupo de 4.º año de secundaria tiene que
 * recibir la explicación de secundaria. El nivel y el año se toman de la misma
 * fuente: mezclar el nivel del grupo con el año del perfil da "7.º de Superior".
 */
export function resolverNivelYGrado(fuentes: {
  nivel?: string | null
  grado?: string | null
  pedagogyContext?: string | null
  perfil?: { nivel?: string | null; grado?: string | null } | null
}): { nivel: NivelEducativo; grado?: string } {
  const explicito = normalizarNivel(fuentes.nivel)
  if (explicito) return { nivel: explicito, grado: fuentes.grado || undefined }

  const contexto = typeof fuentes.pedagogyContext === 'string' ? fuentes.pedagogyContext : ''
  const delContexto = normalizarNivel(contexto.match(/Nivel:[ \t]*([^\n|]+)/i)?.[1])
  if (delContexto) {
    const grado = contexto.match(/Grado(?:\/A[ñn]o)?:[ \t]*([^\n|]+)/i)?.[1]?.trim()
    return { nivel: delContexto, grado: fuentes.grado || grado || undefined }
  }

  const delPerfil = normalizarNivel(fuentes.perfil?.nivel)
  if (delPerfil) return { nivel: delPerfil, grado: fuentes.grado || fuentes.perfil?.grado || undefined }

  return { nivel: NIVEL_POR_DEFECTO, grado: fuentes.grado || undefined }
}

// ── Emojis ──────────────────────────────────────────────────────────────────

/**
 * Qué cuenta como emoji acá. NO es `\p{Extended_Pictographic}` a secas: esa
 * clase incluye símbolos que en una explicación son contenido (↔ en lógica,
 * ©, ™, ✔). Se quitan los que se dibujan a color por defecto, y los de texto
 * sólo cuando vienen con el selector que los vuelve emoji (U+FE0F).
 */
const EMOJI = String.raw`(?:\p{Extended_Pictographic}️|[\p{Emoji_Presentation}\p{Emoji_Modifier}‍️])`
/** "1️⃣": un dígito convertido en tecla. El dígito es contenido; la tecla no. */
const TECLA = /([0-9#*])️?⃣/gu
/** Emojis que abren un renglón, después del marcador de título o de lista. */
const EMOJIS_AL_PRINCIPIO = new RegExp(
  String.raw`^([ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)*)${EMOJI}+[ \t]*`,
  'gmu',
)
const EMOJIS_EN_EL_MEDIO = new RegExp(String.raw`[ \t]*${EMOJI}+`, 'gu')

/**
 * Saca los emojis de un texto generado sin dejar huecos: "## 1. 🧠 ¿Por qué?"
 * queda "## 1. ¿Por qué?". No toca fórmulas, flechas ni símbolos matemáticos.
 */
export function quitarEmojis(texto: string): string {
  return texto.replace(TECLA, '$1').replace(EMOJIS_AL_PRINCIPIO, '$1').replace(EMOJIS_EN_EL_MEDIO, '')
}

// ── Explicación de un error ─────────────────────────────────────────────────

/**
 * El prompt con el que se le explica al alumno por qué erró. Vivía entero en
 * `app/api/explain-error/route.ts`, con UN formato para todos los niveles: los
 * títulos traían emojis escritos a mano y el cuerpo pedía "elementos
 * visuales/emojis" y hablaba de "su edad". El registro de Primario llegaba así
 * a un 4.º año de secundaria aunque `registroLinguistico` dijera otra cosa.
 *
 * Los cuatro títulos conservan su numeración ("## 1." … "## 4.") en todos los
 * niveles: la ruta saca de ahí el diagnóstico y el tip que guarda.
 */
export function buildExplainErrorPrompt({
  ctx,
  question,
  selectedText,
  correctText,
  topic,
  subject,
  pedagogyContext,
}: {
  ctx: EducationContext
  question: string
  selectedText: string
  correctText: string
  topic?: string
  subject?: string
  pedagogyContext?: string
}): string {
  const pedagogySection =
    typeof pedagogyContext === 'string' && pedagogyContext.trim().length > 0
      ? `\nREFERENCIAS PEDAGÓGICAS ADICIONALES:\n${pedagogyContext}\n`
      : ''

  const destinatario =
    ctx.nivel === 'Superior' ? 'Educación Superior' : `edad ${ctx.edadMin}-${ctx.edadMax} años`

  const formato = ctx.permiteEmojis
    ? `Explica de forma muy visual, cercana y estructurada usando EXACTAMENTE este formato de 4 secciones:

## 1. 🧠 ¿Por qué elegiste esta opción? (Diagnóstico de tu respuesta)
Analiza específicamente lo que respondió el estudiante ("${selectedText}"). Explícale de forma empática por qué es muy común cometer esa confusión a su edad. Marca el detalle con calidez ("¡Atención!", "¡Casi!", "Es muy normal confundirse aquí porque..."). NUNCA lo felicites por haberse equivocado (no digas "¡Excelente!" ni "¡Lo hiciste genial!").

## 2. 💡 Explicación paso a paso
Muestra cómo llegar a la respuesta correcta ("${correctText}") con un ejemplo claro y elementos visuales/emojis (🌱, ☀️, 💧, 🔢 según la materia). Sé conciso e ilustrativo.

## 3. 📌 ¿Por qué la respuesta correcta es la única válida?
Resume en 1 o 2 frases el concepto clave.

## 4. ⭐ Tip o consejo para recordar
Un tip práctico, regla mnemotécnica o truco amigable para no volver a tener esa confusión en el futuro.`
    : `Explica de forma clara, sobria y estructurada usando EXACTAMENTE este formato de 4 secciones (los títulos van tal cual, sin agregarles nada):

## 1. ¿Por qué elegiste esta opción?
Analiza específicamente lo que respondió el estudiante ("${selectedText}") e identifica con precisión qué razonamiento lleva a esa respuesta y dónde falla. Trátalo como a ${ctx.nivel === 'Superior' ? 'un adulto' : 'un adolescente'} capaz: sin infantilizar, sin diminutivos y sin exclamaciones de aliento. NUNCA lo felicites por haberse equivocado.

## 2. Explicación paso a paso
Muestra cómo llegar a la respuesta correcta ("${correctText}") con el razonamiento ordenado en pasos. Sé conciso.

## 3. Por qué la respuesta correcta es la única válida
Resume en 1 o 2 frases el concepto clave.

## 4. Cómo recordarlo
Un criterio práctico o una regla para no repetir la confusión.`

  const reglasDeRegistro = ctx.permiteEmojis
    ? '- Usa emojis sutiles (🌱, ☀️, 💧, 🐥, 🔢) para hacer la lectura cálida y visual.'
    : `- NO uses emojis, emoticones ni pictogramas en ninguna parte de la respuesta.
- NO te dirijas al estudiante como a un niño: nada de "aventura", "magia", "truco mágico" ni comparaciones infantiles.`

  return `ROL E IDENTIDAD:
${ctx.rolDocente}.

OBJETIVO:
Un estudiante de ${ctx.grado} (${destinatario}) respondió incorrectamente la siguiente pregunta. Tu tarea es explicarle el error con empatía y un lenguaje perfectamente adaptado a su nivel educativo.

${ctx.registroLinguistico}
${ctx.instruccionesExplicacion}

${ctx.estrategiaMateria}
TEMA: ${topic}
MATERIA: ${subject || 'General'}
${pedagogySection}

PREGUNTA:
${question}

RESPUESTA DEL ESTUDIANTE: ${selectedText}
RESPUESTA CORRECTA: ${correctText}

${formato}

REGLAS CRÍTICAS:
${reglasDeRegistro}
- Usa notación LaTeX solo si hay fórmulas ($x^2$, $\\frac{a}{b}$).
- NUNCA agregues notas ni aclaraciones entre paréntesis sobre LaTeX (ej: NO escribas "(Nota: En este caso no aplica notación LaTeX)").
- Sé muy ágil y directo al punto.`
}

/** Aplicación profesional de una unidad, tal como la declara el programa de cátedra. */
export interface ContextoProfesionalUnidad {
  eje: string
  aplicacion: string
  herramientas: string[]
}

/**
 * Contexto profesional de una carrera terciaria, armado desde
 * `curriculum.contexto_profesional` (migración 022).
 *
 * Existe porque el resto de este módulo deriva todo de (nivel, grado, materia),
 * y eso alcanza para saber que hay que hablarle a un adulto con rigor formal
 * pero no para saber que ese adulto estudia sistemas. Sin esto, "Funciones" en
 * una tecnicatura en análisis de sistemas genera los mismos ejercicios que
 * "Funciones" en un profesorado de educación física.
 */
export interface ContextoProfesionalCarrera {
  carrera: string
  unidades: ContextoProfesionalUnidad[]
}

/**
 * Sección de prompt que sitúa los ejercicios en el dominio profesional.
 *
 * La regla es deliberadamente imperativa y cuantificada ("al menos la mitad").
 * Una indicación blanda del tipo "podés contextualizar" se pierde entre las
 * otras quince reglas del prompt y el modelo vuelve al ejercicio genérico, que
 * es el default de cualquier corpus de matemática.
 */
/**
 * O3 · Los ejemplos y el vocabulario de la regla de contextualización, según
 * la carrera. Estaban escritos a mano para Sistemas (algoritmos, usuarios de
 * una app, bases de datos) y se filtraban a cualquier carrera con contexto
 * profesional cargado: el Profesorado recibía ejemplos de inventarios.
 *   - Sistemas / Informática → los de siempre.
 *   - Profesorado / Educación → situaciones de aula de primaria.
 *   - Otra carrera → sin ejemplos (mejor nada que los de otra).
 */
export function ejemplosDeCarrera(carrera: string | null | undefined): { ejemplos: string; vocabulario: string } | null {
  const c = (carrera ?? '').toLowerCase()
  if (/sistem|inform[aá]t|computaci|software|programaci/.test(c)) {
    return {
      ejemplos:
        'validar un algoritmo con tablas de verdad, modelar el crecimiento de usuarios de una aplicación, optimizar un inventario, consultar una base de datos con operaciones de conjuntos',
      vocabulario: 'usuarios, registros, consultas, procesos, inventario, costos, rendimiento',
    }
  }
  if (/profesorad|docen|magisteri|educaci[oó]n (primaria|inicial|b[aá]sica)|maestr/.test(c)) {
    return {
      ejemplos:
        'analizar la resolución de un alumno de 4.º grado que suma fracciones sumando numeradores y denominadores, elegir el problema para introducir la división en 3.er grado, anticipar los errores de una consigna de proporcionalidad, ordenar una secuencia de actividades sobre el sistema de numeración',
      vocabulario: 'alumnos, consigna, producción, error, intervención docente, secuencia, grado, aula',
    }
  }
  return null
}

function buildProfessionalContextSection(ctx: ContextoProfesionalCarrera | undefined): string {
  if (!ctx || ctx.unidades.length === 0 || !ctx.carrera.trim()) return ''
  const deLaCarrera = ejemplosDeCarrera(ctx.carrera)

  const unidades = ctx.unidades
    .map((u) => {
      const herramientas = u.herramientas.length > 0
        ? ` Herramientas de la cátedra: ${u.herramientas.join(', ')}.`
        : ''
      return `- ${u.eje}\n  Aplicación profesional: ${u.aplicacion}.${herramientas}`
    })
    .join('\n')

  return `
CONTEXTO PROFESIONAL DE LA CARRERA (OBLIGATORIO):
Los estudiantes cursan ${ctx.carrera}. Esta no es una materia de matemática general: el programa de cátedra define para cada unidad una aplicación profesional concreta.

${unidades}

REGLAS DE CONTEXTUALIZACIÓN:
1. Al menos la MITAD de las preguntas deben estar situadas en un problema real del dominio profesional listado arriba${deLaCarrera ? ` (por ejemplo: ${deLaCarrera.ejemplos})` : ''}.
2. Usá el vocabulario del dominio${deLaCarrera ? ` (${deLaCarrera.vocabulario})` : ''} en los enunciados situados.
3. El rigor matemático NO se relaja al contextualizar: el problema se sitúa, la exigencia formal se mantiene.
4. Evitá el ejercicio descontextualizado ("resolvé la siguiente ecuación", "hallá el dominio de f(x)") cuando el tema admite una situación profesional. Reservalo sólo para lo puramente instrumental.`
}

export function buildEducationSystemPrompt({
  nivel,
  grado,
  materia,
  difficulty = 'intermedio',
  contextoProfesional,
  perfilAlumnos,
  contenido,
}: {
  nivel?: string
  grado?: string
  materia: string
  difficulty?: string
  /** O3: unidades y temas que se generan (reconoce una unidad de didáctica). */
  contenido?: { unidades?: readonly string[]; temas?: readonly string[] }
  contextoProfesional?: ContextoProfesionalCarrera
  /** J3: lo pedagógico de la ficha de los alumnos del grupo. Ver lib/perfil-alumnos.ts. */
  perfilAlumnos?: PerfilAlumnos | null
}): string {
  const ctx = getEducationContext(nivel, grado, materia, contenido)

  let difficultyCognitiveInstruction = ''
  if (difficulty === 'basico') {
    difficultyCognitiveInstruction = `
NIVEL DE DIFICULTAD: BÁSICO
- Operaciones cognitivas: Reconocimiento directo, identificación de hechos clave, definiciones simples o aplicación inmediata de una sola regla.
- RESTRICCIÓN ABSOLUTA: Las preguntas deben ser sencillas dentro del nivel del alumno (${ctx.grado}, ${ctx.edadMin}-${ctx.edadMax} años).`
  } else if (difficulty === 'avanzado') {
    difficultyCognitiveInstruction = `
NIVEL DE DIFICULTAD: AVANZADO
- Operaciones cognitivas: Relación entre múltiples conceptos, análisis de casos o resolución de problemas aplicados.
- RESTRICCIÓN ABSOLUTA DE EDAD: Aunque la dificultad sea AVANZADA, el vocabulario, la sintaxis y las situaciones planteadas deben mantenerse ESTRICTAMENTE DENTRO DE LA CAPACIDAD DE COMPRENSIÓN de un estudiante de ${ctx.grado} (${ctx.edadMin}-${ctx.edadMax} años). JAMÁS uses temas ni conceptos de años/grados superiores.`
  } else {
    difficultyCognitiveInstruction = `
NIVEL DE DIFICULTAD: INTERMEDIO
- Operaciones cognitivas: Aplicación de conceptos a situaciones prácticas concretas, comparación de propiedades o interpretación de datos simples.
- RESTRICCIÓN ABSOLUTA: Mantén las preguntas totalmente adecuadas para un alumno de ${ctx.grado} (${ctx.edadMin}-${ctx.edadMax} años).`
  }

  return `ROL E IDENTIDAD DEL EVALUADOR:
${ctx.rolDocente}.
Tu objetivo es diseñar un cuestionario académico de alta calidad pedagógica adaptado al estudiante.

PÚBLICO OBJETIVO Y EDAD:
- Nivel Educativo: ${ctx.nivel} (${ctx.grado})
- Rango de Edad: ${ctx.nivel === 'Superior' ? 'Adultos (18+ años)' : `${ctx.edadMin} a ${ctx.edadMax} años (${ctx.etapaDesarrollo})`}

DISCIPLINA Y MATERIA:
${ctx.estrategiaMateria}
${buildProfessionalContextSection(contextoProfesional)}${seccionPerfilAlumnos(perfilAlumnos)}

REGISTRO LINGÜÍSTICO Y FORMATO:
${ctx.registroLinguistico}
- Longitud máxima por opción de respuesta: aproximadamente ${ctx.maxOpcionesPalabras} palabras.

${difficultyCognitiveInstruction}

CONSTRUCCIÓN DE OPCIONES INCORRECTAS (DISTRACTORES DIAGNÓSTICOS):
- Cada opción incorrecta DEBE ser plausible y representar una confusión conceptual real y típica en estudiantes de ${ctx.grado} (${ctx.edadMin}-${ctx.edadMax} años), tales como: confusión de conceptos parecidos, inversión de operaciones, sobregeneralización o lecturas incompletas. Nunca uses distractores ilógicos o absurdos.

${ctx.instruccionesExplicacion}

REGLAS DE SEGURIDAD CONTRA ALUCINACIONES PEDAGÓGICAS Y FORMATO:
1. No incluyas contenido ni fórmulas que no pertenezcan al programa oficial del grado/año seleccionado (${ctx.grado}).
2. Cada enunciado debe tener una única respuesta indiscutiblemente correcta.
3. Las opciones incorrectas deben basarse en confusiones típicas de aprendizaje para esta edad y nivel.
4. REGLA OBLIGATORIA DE LATEX Y SÍMBOLOS DE MONEDA: NUNCA uses el símbolo '$' para representar dinero o precios (ej. NO escribas '$5' ni '5$'). Usa la palabra 'pesos' o 'USD' (ej. '5 pesos'). Reserva el símbolo '$' o '$$' ÚNICAMENTE para expresiones matemáticas cerradas (ej. '$x$', '$y$', '$f(x) = 5x$'). JAMÁS envuelvas oraciones enteras o frases en texto plano dentro de '$ ... $'.`
}

