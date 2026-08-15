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
}

function parseNumeroGrado(gradoStr?: string): number {
  if (!gradoStr) return 1
  const match = gradoStr.match(/\d+/)
  return match ? parseInt(match[0], 10) : 1
}

function getSubjectStrategy(materia: string): string {
  const m = materia.toLowerCase()
  if (m.includes('matemát') || m.includes('matemat') || m.includes('álgebra') || m.includes('algebra') || m.includes('análisis') || m.includes('analisis') || m.includes('geometría') || m.includes('probabilidad')) {
    return `ESTRATEGIA MATEMÁTICA:
- Prioriza ejemplos concretos, problemas contextualizados y representaciones claras.
- Distractores diagnósticos: Errores de operación inversa, confusión de propiedades, fallas de conteo/signo o aplicación de fórmulas fuera de contexto.`
  }
  if (m.includes('natural') || m.includes('biolog') || m.includes('física') || m.includes('química') || m.includes('quimica') || m.includes('fisica')) {
    return `ESTRATEGIA CIENCIAS NATURALES:
- Basada en la observación directa de la naturaleza, seres vivos, cuerpo humano y fenómenos del entorno cotidiano.
- Distractores diagnósticos: Confusiones frecuentes entre procesos biológicos/físicos paralelos (ej: fotosíntesis vs respiración, fusión vs evaporación, masa vs peso).`
  }
  if (m.includes('social') || m.includes('histor') || m.includes('geograf') || m.includes('econ') || m.includes('formación') || m.includes('ética')) {
    return `ESTRATEGIA CIENCIAS SOCIALES:
- Enfocada en narrativas claras, procesos históricos de causa-efecto, comprensión del espacio geográfico y la vida en sociedad.
- Distractores diagnósticos: Confusiones de causalidad (confundir causa con consecuencia), anacronismos o mezcla de actores sociales.`
  }
  if (m.includes('lengua') || m.includes('literat') || m.includes('español') || m.includes('idioma') || m.includes('english')) {
    return `ESTRATEGIA LENGUA Y COMUNICACIÓN:
- Enfocada en comprensión lectora, funciones de la palabra, tipos de texto y comunicación cotidiana.
- Distractores diagnósticos: Interpretaciones literales de textos figurados, confusión de funciones gramaticales o de intención comunicativa.`
  }
  return `ESTRATEGIA GENERAL DISCIPLINAR:
- Plantea preguntas claras con relación directa a los temas curriculares.
- Distractores diagnósticos: Confusiones conceptuales típicas del tema.`
}

export function getEducationContext(
  nivelStr?: string,
  gradoStr?: string,
  materia: string = 'la materia'
): EducationContext {
  const nivel = (nivelStr === 'Primario' || nivelStr === 'Secundario' || nivelStr === 'Superior')
    ? nivelStr
    : 'Secundario'

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
- Las opciones pueden contener matices conceptuales bien diferenciados.`

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
- Plantea problemas con precisión conceptual y lenguaje universitario sin simplificaciones artificiales.`

  if (materia.toLowerCase().includes('matemát') || materia.toLowerCase().includes('matemat') || materia.toLowerCase().includes('álgebra') || materia.toLowerCase().includes('algebra') || materia.toLowerCase().includes('análisis') || materia.toLowerCase().includes('analisis') || materia.toLowerCase().includes('cálculo')) {
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
  }
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
function buildProfessionalContextSection(ctx: ContextoProfesionalCarrera | undefined): string {
  if (!ctx || ctx.unidades.length === 0) return ''

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
1. Al menos la MITAD de las preguntas deben estar situadas en un problema real del dominio profesional listado arriba (por ejemplo: validar un algoritmo con tablas de verdad, modelar el crecimiento de usuarios de una aplicación, optimizar un inventario, consultar una base de datos con operaciones de conjuntos).
2. Usá el vocabulario del dominio (usuarios, registros, consultas, procesos, inventario, costos, rendimiento) en los enunciados situados.
3. El rigor matemático NO se relaja al contextualizar: el problema se sitúa, la exigencia formal se mantiene.
4. Evitá el ejercicio descontextualizado ("resolvé la siguiente ecuación", "hallá el dominio de f(x)") cuando el tema admite una situación profesional. Reservalo sólo para lo puramente instrumental.`
}

export function buildEducationSystemPrompt({
  nivel,
  grado,
  materia,
  difficulty = 'intermedio',
  contextoProfesional,
}: {
  nivel?: string
  grado?: string
  materia: string
  difficulty?: string
  contextoProfesional?: ContextoProfesionalCarrera
}): string {
  const ctx = getEducationContext(nivel, grado, materia)

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
${buildProfessionalContextSection(contextoProfesional)}

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

