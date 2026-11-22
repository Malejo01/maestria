// Relativo: lo importa scripts/qa/areas-de-programas.ts, que corre bajo tsx.
import { PERFILES, type AreaId, type Caracter } from './areas'

/**
 * Ronda T · A2 — El área de una materia, sin IA.
 *
 * Es el respaldo de la detección que hace la IA al leer el programa (en la
 * misma llamada de extracción): se usa cuando la IA no devuelve el área o la
 * devuelve con confianza baja, y para los programas ya guardados, que se
 * infieren al leerlos y se guardan la primera vez que el docente los abre o
 * los edita. Palabras clave, sin modelo.
 *
 * El nombre de la materia manda: "Temas de Antropología Cultural en
 * Psicología" es antropología que se da en la carrera de psicología. Por eso
 * lo que va después de " en ", " para " o " aplicada a " pesa como la carrera,
 * no como la materia.
 */

interface Regla {
  area: AreaId
  patron: RegExp
}

/**
 * Las frases que ganan antes que cualquier palabra suelta. Van primero en la
 * materia y deciden solas.
 */
const FRASES: Regla[] = [
  { area: 'educacion', patron: /\by su did[aá]ctica\b|\bdid[aá]ctica (de|del|de la|de las|de los)\b/ },
  { area: 'informatica', patron: /\ban[aá]lisis (de|y dise[nñ]o de) sistemas\b|\bsistemas de informaci[oó]n\b/ },
  { area: 'contabilidad', patron: /\bmatem[aá]tica financiera\b|\bc[aá]lculo financiero\b/ },
  { area: 'estadistica', patron: /\bprobabilidad(es)? y estad[ií]stica\b/ },
  { area: 'lengua', patron: /\bpr[aá]cticas del lenguaje\b/ },
]

/** Palabras por área. Se buscan sobre el texto sin tildes y en minúscula. */
const PALABRAS: Regla[] = [
  { area: 'matematica', patron: /\b(matematica|algebra|analisis matematico|calculo|geometria|trigonometria|aritmetica|logica matematica|ecuaciones|funciones|derivadas|integrales|matrices)/ },
  { area: 'estadistica', patron: /\b(estadistic|probabilidad|bioestadistic|muestreo|inferencia)/ },
  { area: 'fisica', patron: /\b(fisica|mecanica|electromagnetismo|termodinamica|optica|cinematica|dinamica)/ },
  { area: 'quimica', patron: /\b(quimic|estequiometr|bioquimic)/ },
  { area: 'biologia', patron: /\b(biolog|ciencias naturales|genetica|ecologia|anatomia|fisiologia|botanica|zoologia|microbiolog|histolog|celula)/ },
  { area: 'informatica', patron: /\b(programacion|informatica|tecnolog|algoritmo|estructuras? de datos|bases? de datos|redes|sistemas operativos|software|computacion|desarrollo web|ingenieria de software)/ },
  { area: 'contabilidad', patron: /\b(contab|costos|finanzas|financier|auditoria|impuestos|tributari|liquidacion de sueldos)/ },
  { area: 'economia', patron: /\b(economia|microeconomia|macroeconomia|economic)/ },
  { area: 'administracion', patron: /\b(marketing|administracion|gestion|comercializacion|recursos humanos|organizaciones|emprendedor|negocios|publicidad|management)/ },
  { area: 'salud', patron: /\b(enfermeria|medicina|kinesiolog|nutricion|farmacolog|salud|obstetricia|odontolog|semiolog|primeros auxilios|cuidados)/ },
  { area: 'psicologia', patron: /\b(psicolog|psicoanalisis|psicopatolog)/ },
  { area: 'sociales', patron: /\b(antropolog|sociolog|historia|filosofia|geografia|comunicacion social|ciencias sociales|ciencia politica|etica|formacion ciudadana|construccion de ciudadania|cultura)/ },
  { area: 'educacion', patron: /\b(didactica|pedagog|educacion|educacional|practica docente|curriculum|ensenanza|instituciones educativas)/ },
  { area: 'derecho', patron: /\b(derecho|juridic|legislacion|constitucional|penal|procesal|laboral)/ },
  { area: 'lengua', patron: /\b(lengua|literatura|ingles|frances|portugues|italiano|aleman|idioma|gramatica|linguistica|lectura y escritura|redaccion)/ },
  { area: 'artes', patron: /\b(diseno|arte|artes|musica|musical|plastica|dibujo|fotografia|audiovisual|comunicacion visual|teatro)/ },
]

/** Lo que hace cuantitativa a una unidad, en cualquier área. */
const CUANTITATIVO =
  /\b(numeros?|numerica|fracciones|decimales|proporcionalidad|porcentaje|ecuacion|inecuacion|funcion|funciones|geometria|medida|areas? y perimetros?|calculo|algebra|estadistic|probabilidad|operaciones|aritmetica|derivad|integral|matrices|vectores|sucesiones|logaritm|trigonometr|estequiometr|interes (simple|compuesto)|amortizacion|elasticidad)/
/** Lo que hace conceptual a una unidad aunque el área sea cuantitativa. */
const CONCEPTUAL =
  /\b(didactic|ensenanza|aprendizaje|transposicion|obstaculo|planificacion|secuencia|evaluacion de los aprendizajes|historia de la|epistemolog|curriculum|intervencion docente|errores de los alumnos)/

function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Parte "X en Y" / "X para Y" / "X aplicada a Y": X es la materia, Y el contexto. */
export function separarMateriaDeContexto(materia: string): { nucleo: string; contexto: string } {
  const texto = sinTildes(materia).replace(/^temas de\s+/, '')
  const corte = texto.match(/\s(en|para|aplicad[ao]s? a(l| la| las| los)?)\s/)
  if (!corte || corte.index === undefined) return { nucleo: texto, contexto: '' }
  return { nucleo: texto.slice(0, corte.index), contexto: texto.slice(corte.index + corte[0].length) }
}

export interface UnidadParaInferir {
  name?: unknown
  topics?: { name?: unknown }[]
}

export interface AreaInferida {
  area: AreaId
  /** 0 a 1. Por debajo de `CONFIANZA_BAJA`, la interfaz dice "Nos parece que es…". */
  confianza: number
  /** El carácter de cada unidad, en el mismo orden. */
  caracteres: Caracter[]
}

export const CONFIANZA_BAJA = 0.6

function contar(texto: string, peso: number, puntos: Map<AreaId, number>) {
  if (!texto) return
  for (const regla of PALABRAS) {
    if (regla.patron.test(texto)) puntos.set(regla.area, (puntos.get(regla.area) ?? 0) + peso)
  }
}

function textoDeUnidad(unidad: UnidadParaInferir): string {
  const nombre = typeof unidad?.name === 'string' ? unidad.name : ''
  const temas = Array.isArray(unidad?.topics) ? unidad.topics.map((t) => (typeof t?.name === 'string' ? t.name : '')) : []
  return sinTildes([nombre, ...temas].join(' · '))
}

/** El área de una materia, por palabras clave. */
export function inferirArea(materia: string, carrera?: string | null, unidades: readonly UnidadParaInferir[] = []): AreaInferida {
  const area = elegirArea(materia, carrera, unidades)
  return { ...area, caracteres: unidades.map((u) => inferirCaracterDeUnidad(area.area, u)) }
}

function elegirArea(materia: string, carrera: string | null | undefined, unidades: readonly UnidadParaInferir[]): Omit<AreaInferida, 'caracteres'> {
  const { nucleo, contexto } = separarMateriaDeContexto(materia ?? '')

  for (const frase of FRASES) {
    if (frase.patron.test(nucleo)) return { area: frase.area, confianza: 0.9 }
  }

  const puntos = new Map<AreaId, number>()
  contar(nucleo, 6, puntos)
  contar(contexto, 1, puntos)
  contar(sinTildes(carrera ?? ''), 1, puntos)
  for (const unidad of unidades) contar(textoDeUnidad(unidad), 0.5, puntos)

  const orden = [...puntos.entries()].sort((a, b) => b[1] - a[1])
  if (orden.length === 0) return { area: 'otra', confianza: 0.3 }

  const [primera, segunda] = orden
  const ventaja = primera[1] - (segunda?.[1] ?? 0)
  // La materia sola (6 puntos) sin empate ya es una certeza alta; lo que sale
  // sólo de las unidades o de la carrera, no.
  const confianza = primera[1] >= 6 && ventaja >= 3 ? 0.9 : ventaja >= 2 ? 0.7 : 0.45
  return { area: primera[0], confianza }
}

/**
 * El carácter de una unidad: lo conceptual de didáctica manda (en una
 * didáctica, "Enseñanza de las fracciones" es conceptual), después lo
 * cuantitativo, y si no, el carácter del área.
 */
export function inferirCaracterDeUnidad(area: AreaId, unidad: UnidadParaInferir): Caracter {
  const nombre = sinTildes(typeof unidad?.name === 'string' ? unidad.name : '')
  const perfil = PERFILES[area]

  if (CONCEPTUAL.test(nombre)) return 'conceptual'
  if (perfil.caracter === 'cuantitativo') return 'cuantitativo'
  if (CUANTITATIVO.test(nombre)) return 'cuantitativo'

  const temas = Array.isArray(unidad?.topics) ? unidad.topics.map((t) => sinTildes(typeof t?.name === 'string' ? t.name : '')) : []
  const deCalculo = temas.filter((t) => CUANTITATIVO.test(t) && !CONCEPTUAL.test(t)).length
  if (temas.length > 0 && deCalculo * 2 > temas.length) {
    return perfil.caracter === 'conceptual' && area !== 'educacion' ? 'mixto' : 'cuantitativo'
  }
  return perfil.caracter
}
