/**
 * Ronda V · V2 — Las materias de ejemplo: un docente nuevo (o Mauro grabando
 * un video) elige un área y en un clic tiene materia, grupo con alumnos
 * ficticios que ya respondieron y una tarea con resultados, para ver la ficha,
 * el diagnóstico y la planilla sin cargar nada ni mostrar alumnos reales.
 *
 * Todo esto es contenido fijo, escrito a mano (no lo genera la IA, no cuesta
 * nada) y puro. Los resultados de cada alumno salen de una semilla: siempre
 * iguales, y variados (hay quien domina, quien está a mitad de camino y quien
 * tiene que reforzar).
 */
import type { AreaId } from '@/lib/areas'

export const AREAS_DE_EJEMPLO = ['matematica', 'economia', 'antropologia', 'enfermeria', 'derecho', 'didactica'] as const
export type AreaDeEjemplo = (typeof AREAS_DE_EJEMPLO)[number]

export const esAreaDeEjemplo = (v: unknown): v is AreaDeEjemplo => typeof v === 'string' && (AREAS_DE_EJEMPLO as readonly string[]).includes(v)

export interface PreguntaDeEjemplo {
  tema: string
  type: 'multiple_choice' | 'true_false'
  question: string
  options?: string[]
  correctAnswer: number | boolean
  explanation: string
}

export interface MateriaDeEjemplo {
  nombre: string
  /** El área de lib/areas.ts con la que se guarda. */
  area: AreaId
  carrera: string
  nivel: 'Superior'
  grado: string
  unidades: { nombre: string; temas: string[] }[]
  preguntas: PreguntaDeEjemplo[]
}

const mc = (tema: string, question: string, options: string[], explanation: string): PreguntaDeEjemplo => ({
  tema,
  type: 'multiple_choice',
  question,
  options,
  correctAnswer: 0,
  explanation,
})
const vf = (tema: string, question: string, correcta: boolean, explanation: string): PreguntaDeEjemplo => ({
  tema,
  type: 'true_false',
  question,
  correctAnswer: correcta,
  explanation,
})

export const MATERIAS_DE_EJEMPLO: Record<AreaDeEjemplo, MateriaDeEjemplo> = {
  matematica: {
    nombre: 'Matemática I (ejemplo)',
    area: 'matematica',
    carrera: 'Tecnicatura Superior en Análisis de Sistemas',
    nivel: 'Superior',
    grado: '1er año',
    unidades: [
      { nombre: 'Unidad 1: Números reales', temas: ['Operaciones con fracciones', 'Potencias y raíces'] },
      { nombre: 'Unidad 2: Ecuaciones', temas: ['Ecuaciones lineales', 'Sistemas de ecuaciones'] },
    ],
    preguntas: [
      mc('Operaciones con fracciones', '¿Cuánto es 3/4 + 1/8?', ['7/8', '4/12', '1/2', '5/8'], '3/4 = 6/8, y 6/8 + 1/8 = 7/8.'),
      vf('Operaciones con fracciones', 'Dividir por 1/2 es lo mismo que multiplicar por 2.', true, 'Dividir por una fracción es multiplicar por su inversa.'),
      mc('Potencias y raíces', '¿Cuánto es 2^5?', ['32', '10', '25', '64'], '2·2·2·2·2 = 32.'),
      vf('Potencias y raíces', 'La raíz cuadrada de 16 + 9 es 7.', false, '√(16 + 9) = √25 = 5; no es √16 + √9.'),
      mc('Ecuaciones lineales', 'Si 3x − 5 = 10, ¿cuánto vale x?', ['5', '15', '3', '−5'], '3x = 15, así que x = 5.'),
      vf('Ecuaciones lineales', 'La ecuación 2x + 1 = 2x + 3 no tiene solución.', true, 'Al restar 2x queda 1 = 3, que es falso.'),
      mc('Sistemas de ecuaciones', 'Si x + y = 10 y x − y = 2, ¿cuánto vale x?', ['6', '4', '8', '5'], 'Sumando las dos: 2x = 12, x = 6.'),
      vf('Sistemas de ecuaciones', 'Dos rectas paralelas distintas forman un sistema con infinitas soluciones.', false, 'Paralelas distintas no se cortan: no hay solución.'),
    ],
  },
  economia: {
    nombre: 'Introducción a la Economía (ejemplo)',
    area: 'economia',
    carrera: 'Licenciatura en Administración',
    nivel: 'Superior',
    grado: '1er año',
    unidades: [
      { nombre: 'Unidad 1: Mercados', temas: ['Oferta y demanda', 'Elasticidad'] },
      { nombre: 'Unidad 2: Macroeconomía', temas: ['Inflación', 'Producto bruto'] },
    ],
    preguntas: [
      mc('Oferta y demanda', 'Si sube el precio de un bien, ¿qué pasa con la cantidad demandada?', ['Baja', 'Sube', 'No cambia', 'Se duplica'], 'Es la ley de la demanda.'),
      vf('Oferta y demanda', 'Un aumento del ingreso desplaza la demanda de un bien normal hacia la derecha.', true, 'Con más ingreso se demanda más a cada precio.'),
      mc('Elasticidad', 'Si el precio sube 10 % y la cantidad baja 20 %, la demanda es…', ['elástica', 'inelástica', 'unitaria', 'perfectamente inelástica'], '|E| = 20/10 = 2, mayor que 1.'),
      vf('Elasticidad', 'Los bienes de primera necesidad suelen tener demanda elástica.', false, 'Suelen ser inelásticos: se compran igual.'),
      mc('Inflación', '¿Qué mide el índice de precios al consumidor?', ['La variación de precios de una canasta', 'El producto del país', 'El desempleo', 'La tasa de interés'], 'Sigue el precio de una canasta de consumo.'),
      vf('Inflación', 'Con inflación, el mismo sueldo nominal compra menos.', true, 'Baja el poder de compra.'),
      mc('Producto bruto', 'El PBI mide…', ['el valor de la producción final de un país en un período', 'la riqueza acumulada', 'las exportaciones', 'el gasto público'], 'Producción final, en un período.'),
      vf('Producto bruto', 'El PBI incluye el valor de los bienes intermedios por separado.', false, 'Se cuentan sólo los finales, para no contar dos veces.'),
    ],
  },
  antropologia: {
    nombre: 'Antropología Cultural (ejemplo)',
    area: 'sociales',
    carrera: 'Licenciatura en Psicología',
    nivel: 'Superior',
    grado: '1er año',
    unidades: [
      { nombre: 'Unidad 1: La cultura', temas: ['Concepto de cultura', 'Etnocentrismo y relativismo'] },
      { nombre: 'Unidad 2: El trabajo de campo', temas: ['Observación participante', 'Ritos de paso'] },
    ],
    preguntas: [
      mc('Concepto de cultura', 'Para la antropología, la cultura…', ['se aprende y se comparte', 'se hereda biológicamente', 'es sólo el arte', 'es individual'], 'Es aprendida y compartida.'),
      vf('Concepto de cultura', 'Todas las sociedades humanas tienen cultura.', true, 'No hay sociedad humana sin cultura.'),
      mc('Etnocentrismo y relativismo', 'Juzgar otra cultura con los valores de la propia es…', ['etnocentrismo', 'relativismo', 'evolucionismo', 'funcionalismo'], 'Tomar la propia cultura como medida.'),
      vf('Etnocentrismo y relativismo', 'El relativismo cultural propone entender cada cultura en sus propios términos.', true, 'Es su idea central.'),
      mc('Observación participante', '¿A quién se asocia la observación participante?', ['Malinowski', 'Durkheim', 'Weber', 'Marx'], 'Malinowski la sistematizó en las Trobriand.'),
      vf('Observación participante', 'En la observación participante el investigador no convive con el grupo.', false, 'Justamente convive y participa.'),
      mc('Ritos de paso', 'Los ritos de paso marcan…', ['el paso de una etapa de la vida a otra', 'las estaciones del año', 'los cambios de gobierno', 'los viajes'], 'Van Gennep los describió.'),
      vf('Ritos de paso', 'Un casamiento puede analizarse como un rito de paso.', true, 'Marca el paso a otro estado social.'),
    ],
  },
  enfermeria: {
    nombre: 'Enfermería Comunitaria (ejemplo)',
    area: 'salud',
    carrera: 'Tecnicatura Superior en Enfermería',
    nivel: 'Superior',
    grado: '1er año',
    unidades: [
      { nombre: 'Unidad 1: Salud pública', temas: ['Atención primaria de la salud', 'Promoción y prevención'] },
      { nombre: 'Unidad 2: Cuidados básicos', temas: ['Signos vitales', 'Bioseguridad'] },
    ],
    preguntas: [
      mc('Atención primaria de la salud', 'La atención primaria de la salud es…', ['el primer nivel de contacto con el sistema de salud', 'la atención en terapia intensiva', 'sólo la vacunación', 'la cirugía de urgencia'], 'Es la puerta de entrada al sistema.'),
      vf('Atención primaria de la salud', 'La participación de la comunidad es un principio de la atención primaria.', true, 'Está en Alma-Ata (1978).'),
      mc('Promoción y prevención', 'Vacunar a la población es un ejemplo de…', ['prevención primaria', 'prevención terciaria', 'rehabilitación', 'diagnóstico'], 'Evita que aparezca la enfermedad.'),
      vf('Promoción y prevención', 'La prevención terciaria busca evitar que la enfermedad aparezca.', false, 'Ésa es la primaria; la terciaria limita secuelas.'),
      mc('Signos vitales', '¿Cuál es un valor normal de frecuencia cardíaca en un adulto en reposo?', ['60 a 100 latidos por minuto', '20 a 40', '120 a 160', '200'], 'Entre 60 y 100.'),
      vf('Signos vitales', 'La temperatura axilar de 36,5 °C es normal.', true, 'Está dentro del rango normal.'),
      mc('Bioseguridad', 'El lavado de manos debe hacerse…', ['antes y después de cada contacto con el paciente', 'sólo al terminar el turno', 'sólo si hay sangre', 'una vez al día'], 'Es la medida más eficaz.'),
      vf('Bioseguridad', 'Las agujas usadas se recapuchan antes de descartarlas.', false, 'No se recapuchan: van directo al descartador.'),
    ],
  },
  derecho: {
    nombre: 'Derecho Civil I (ejemplo)',
    area: 'derecho',
    carrera: 'Abogacía',
    nivel: 'Superior',
    grado: '2do año',
    unidades: [
      { nombre: 'Unidad 1: La persona', temas: ['Persona humana', 'Capacidad'] },
      { nombre: 'Unidad 2: Hechos y actos jurídicos', temas: ['Hechos jurídicos', 'Actos jurídicos'] },
    ],
    preguntas: [
      mc('Persona humana', 'Según el Código Civil y Comercial, la existencia de la persona humana comienza…', ['con la concepción', 'con el nacimiento', 'a los 18 años', 'con la inscripción'], 'Art. 19 del CCyC.'),
      vf('Persona humana', 'El nombre es un atributo de la persona.', true, 'Junto con el domicilio, el estado y la capacidad.'),
      mc('Capacidad', 'La mayoría de edad en Argentina se alcanza a los…', ['18 años', '21 años', '16 años', '13 años'], 'Art. 25 del CCyC.'),
      vf('Capacidad', 'La capacidad de derecho puede faltar por completo en una persona humana.', false, 'Se la puede limitar, pero no suprimir del todo.'),
      mc('Hechos jurídicos', 'Un hecho jurídico es…', ['un acontecimiento que produce efectos jurídicos', 'cualquier hecho de la naturaleza', 'sólo un contrato', 'una ley'], 'Lo que el derecho toma para producir efectos.'),
      vf('Hechos jurídicos', 'El nacimiento es un hecho jurídico.', true, 'Produce efectos jurídicos.'),
      mc('Actos jurídicos', 'El acto jurídico es un hecho…', ['voluntario y lícito con un fin jurídico', 'involuntario', 'ilícito', 'natural'], 'Art. 259 del CCyC.'),
      vf('Actos jurídicos', 'Un contrato es un acto jurídico.', true, 'Es voluntario, lícito y busca efectos jurídicos.'),
    ],
  },
  didactica: {
    nombre: 'Matemática y su Didáctica (ejemplo)',
    area: 'educacion',
    carrera: 'Profesorado de Educación Primaria',
    nivel: 'Superior',
    grado: '2do año',
    unidades: [
      { nombre: 'Unidad 1: El sistema de numeración', temas: ['Valor posicional', 'Errores frecuentes en la numeración'] },
      { nombre: 'Unidad 2: Las operaciones', temas: ['Estrategias de cálculo mental', 'Problemas de reparto'] },
    ],
    preguntas: [
      mc('Valor posicional', 'En 3.405, el 4 vale…', ['400', '4', '40', '4.000'], 'Está en el lugar de las centenas.'),
      vf('Valor posicional', 'Nuestro sistema de numeración es posicional y de base 10.', true, 'El valor depende de la posición.'),
      mc('Errores frecuentes en la numeración', 'Un chico escribe "100035" para "mil treinta y cinco". El error tiene que ver con…', ['escribir como se dice el número', 'no saber contar', 'confundir pares e impares', 'la letra'], 'Yuxtapone lo que oye: 1000 y 35.'),
      vf('Errores frecuentes en la numeración', 'Ese tipo de error muestra que el alumno no sabe nada de números.', false, 'Muestra una hipótesis razonable sobre la escritura.'),
      mc('Estrategias de cálculo mental', 'Para calcular 99 + 47, una buena estrategia es…', ['hacer 100 + 47 y restar 1', 'contar de a uno', 'usar la calculadora', 'escribir la cuenta parada'], 'Redondear y compensar.'),
      vf('Estrategias de cálculo mental', 'El cálculo mental sólo sirve para números chicos.', false, 'Se apoya en propiedades que sirven siempre.'),
      mc('Problemas de reparto', '"Repartir 24 figuritas entre 4 chicos en partes iguales" es un problema de…', ['división', 'suma', 'resta', 'multiplicación'], 'Reparto equitativo: división.'),
      vf('Problemas de reparto', 'Un problema de reparto puede resolverse antes de conocer el algoritmo de la división.', true, 'Con dibujos, sumas o restas sucesivas.'),
    ],
  },
}

/** Los alumnos ficticios: nombres inventados, los mismos en todas las materias. */
export const ALUMNOS_DE_EJEMPLO = [
  { nombre: 'Camila Ríos', nivel: 0.92 },
  { nombre: 'Tomás Herrera', nivel: 0.8 },
  { nombre: 'Valentina Soria', nivel: 0.72 },
  { nombre: 'Joaquín Benítez', nivel: 0.6 },
  { nombre: 'Martina Acosta', nivel: 0.5 },
  { nombre: 'Lautaro Medina', nivel: 0.38 },
  { nombre: 'Sofía Quiroga', nivel: 0.27 },
] as const

/** Un número entre 0 y 1, siempre el mismo para la misma semilla. */
function azar(semilla: string): number {
  let h = 2166136261
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  return (h >>> 0) / 4294967296
}

/** Lo difícil de cada tema (en el orden del temario): hay uno fácil, dos intermedios y uno flojo. */
const DIFICULTAD_DEL_TEMA = [-0.3, -0.15, -0.05, 0.1]

/**
 * Si el alumno acierta la pregunta: con su nivel, menos lo difícil del tema
 * (cada tema tiene dos preguntas, en orden) y un poco más en la segunda.
 * `vuelta` cambia el sorteo (el diagnóstico y la tarea no dan igual).
 */
export function aciertaEjemplo(alumno: number, pregunta: number, area: AreaDeEjemplo, vuelta = 0): boolean {
  const { nivel } = ALUMNOS_DE_EJEMPLO[alumno]
  const dificultad = (DIFICULTAD_DEL_TEMA[Math.floor(pregunta / 2) % 4] ?? 0) + (pregunta % 2 === 1 ? 0.03 : 0)
  return azar(`${area}:${vuelta}:${alumno}:${pregunta}`) < nivel - dificultad
}

/** La respuesta que dio (la correcta, o una incorrecta fija). */
export function respuestaDeEjemplo(p: PreguntaDeEjemplo, acierta: boolean): number | boolean {
  if (p.type === 'true_false') return acierta ? p.correctAnswer : !p.correctAnswer
  return acierta ? p.correctAnswer : 1
}

/** El temario con ids, como lo guarda teacher_programs.units. */
export function unidadesDeEjemplo(m: MateriaDeEjemplo) {
  return m.unidades.map((u, i) => ({
    id: `ej-u${i + 1}`,
    name: u.nombre,
    topics: u.temas.map((t, j) => ({ id: `ej-u${i + 1}-t${j + 1}`, name: t })),
  }))
}

/** Las preguntas en el formato de la app (con el id del tema). */
export function preguntasDeEjemplo(m: MateriaDeEjemplo) {
  const unidades = unidadesDeEjemplo(m)
  const idDelTema = new Map(unidades.flatMap((u) => u.topics.map((t) => [t.name, t.id] as const)))
  return m.preguntas.map((p, i) => ({
    id: `q${i + 1}`,
    type: p.type,
    question: p.question,
    ...(p.options ? { options: p.options } : {}),
    correctAnswer: p.correctAnswer,
    explanation: p.explanation,
    topic: idDelTema.get(p.tema) ?? 'ej',
    topicName: p.tema,
  }))
}
