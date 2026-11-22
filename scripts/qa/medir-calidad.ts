/**
 * O14 · Medición de calidad de la generación, en STAGING y con la IA real.
 *
 *   npx tsx scripts/qa/medir-calidad.ts --env=staging [--solo=3] [--preguntas=8] [--salida=docs/calidad/2026-11-22.md]
 *
 * Genera cuestionarios con `generateQuiz` (el mismo núcleo de la app, con su
 * filtro de calidad) para una grilla de nivel × materia × modo, y mide sobre
 * lo que devuelve, con los validadores que ya existen:
 *   - tipo que no encaja con la consigna (`problemaDeTipo`, M2);
 *   - consigna que pide más de un resultado (`pideMasDeUnValor`, K3);
 *   - factorización sin `forma: 'factorizacion'` (L3);
 *   - el GIFT de la exportación a Moodle con errores (`validarGift`, M5;
 *     incluye las llaves de conjunto);
 *   - preguntas repetidas dentro del cuestionario (`normalizeQuestionText` y
 *     `numericSignature`, question-dedup);
 *   - temas fuera de los elegidos (el tema de la pregunta no se ubica entre los
 *     pedidos, con el mismo puente que "A reforzar").
 *
 * SÓLO STAGING: sin `--env=staging` no corre. No escribe en la base (lee el
 * currículum y dos programas de Irina). La key de Gemini sale de `.env.local`,
 * como en `npm run dev:staging`. Imprime el gasto estimado al final.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

function leerEnv(archivo: string): Record<string, string> {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  )
}

if (!process.argv.includes('--env=staging')) {
  console.error('Sólo corre contra staging: agregá --env=staging.')
  process.exit(1)
}
const staging = leerEnv('.env.staging.local')
process.env.DATABASE_URL = staging.DATABASE_URL
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY ?? ''

const arg = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1]
const SOLO = Number(arg('solo') ?? 0)
const PREGUNTAS = Number(arg('preguntas') ?? 8)
const SALIDA = arg('salida') ?? 'docs/calidad/2026-11-22.md'

type Unidad = { name: string; topics: { name: string }[] }
interface Caso {
  nivel: 'Primario' | 'Secundario' | 'Superior'
  materia: string
  grado: string
  carrera?: string
  unidades: Unidad[]
  temas: string[]
  modo: 'teorico' | 'practico'
}

async function main() {
  const { sql } = await import('../../lib/db')
  const { generateQuiz } = await import('../../lib/quiz-generation')
  const { problemaDeTipo } = await import('../../lib/validar-tipo-de-pregunta')
  const { pideMasDeUnValor } = await import('../../lib/consigna-multiple')
  const { normalizeQuestionText, numericSignature } = await import('../../lib/question-dedup')
  const { convertQuizToGift } = await import('../../lib/moodle-export')
  const { validarGift } = await import('../../lib/gift-validar')
  const { temaDelPrograma } = await import('../../lib/a-reforzar')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')

  const [marca] = (await sql`SELECT environment FROM deployment_env LIMIT 1`) as { environment: string }[]
  if (marca?.environment !== 'staging') throw new Error('La base no está marcada como staging.')

  const delCurriculum = async (nivel: string, materia: string, grado: string, carrera?: string): Promise<Unidad[]> => {
    const filas = (await sql`
      SELECT eje, temas FROM curriculum
      WHERE nivel = ${nivel} AND materia = ${materia} AND grado = ${grado}
        AND (${carrera ?? null}::text IS NULL OR carrera = ${carrera ?? null})
      ORDER BY id
    `) as { eje: string; temas: string[] }[]
    return filas.map((f) => ({ name: f.eje, topics: (f.temas ?? []).map((t) => ({ name: t })) }))
  }
  const delPrograma = async (id: number): Promise<Unidad[]> => {
    const [p] = (await sql`SELECT units FROM teacher_programs WHERE id = ${id}`) as { units: Unidad[] }[]
    return (p?.units ?? []).map((u) => ({ name: u.name, topics: (u.topics ?? []).map((t) => ({ name: t.name })) }))
  }

  const primario = await delCurriculum('Primario', 'Matemática', '4to Año')
  const secundario = await delCurriculum('Secundario', 'Matemática', '3er Año')
  const sistemas = await delCurriculum('Superior', 'Matemática', '1er Año', 'Tecnicatura Superior en Análisis de Sistemas')
  const didactica = await delPrograma(16)
  const programacion = await delPrograma(5)

  const temasDe = (unidades: Unidad[], u: number, n = 2) => (unidades[u]?.topics ?? []).slice(0, n).map((t) => t.name)
  const base = ([
    { nivel: 'Primario', materia: 'Matemática', grado: '4to Año', unidades: primario, temas: temasDe(primario, 0) },
    { nivel: 'Primario', materia: 'Matemática', grado: '4to Año', unidades: primario, temas: temasDe(primario, 1) },
    { nivel: 'Secundario', materia: 'Matemática', grado: '3er Año', unidades: secundario, temas: temasDe(secundario, 0) },
    { nivel: 'Secundario', materia: 'Matemática', grado: '3er Año', unidades: secundario, temas: temasDe(secundario, 1) },
    ...[1, 4, 0].map((u) => ({ nivel: 'Superior' as const, materia: 'Matemática', grado: '1er Año', carrera: 'Tecnicatura Superior en Análisis de Sistemas', unidades: sistemas, temas: temasDe(sistemas, u) })),
    ...[0, 1, 2].map((u) => ({ nivel: 'Superior' as const, materia: 'Matemática y su Didáctica', grado: '1er Año', carrera: 'Profesorado de Educación Primaria', unidades: didactica, temas: temasDe(didactica, u) })),
    ...[0, 1].map((u) => ({ nivel: 'Superior' as const, materia: 'Programación', grado: '1er Año', unidades: programacion, temas: temasDe(programacion, u) })),
  ] as Omit<Caso, 'modo'>[]).filter((c) => c.temas.length > 0)
  const casos: Caso[] = base.flatMap((c) => (['teorico', 'practico'] as const).map((modo) => ({ ...c, modo })))
  const aCorrer = SOLO > 0 ? casos.slice(0, SOLO) : casos

  type Pregunta = { type: string; question: string; topic?: string; topicName?: string; forma?: string }
  const filas: { caso: Caso; preguntas: Pregunta[]; gift: number; error?: string }[] = []
  let entrada = 0
  let salida = 0

  for (const [i, caso] of aCorrer.entries()) {
    const temas = caso.temas.map((t, j) => ({ id: `t${j + 1}`, name: t }))
    const resultado = await generateQuiz(
      {
        subject: caso.materia,
        subjectUnits: caso.unidades,
        topics: temas,
        mode: caso.modo,
        previousQuestions: [],
        questionCount: PREGUNTAS,
        nivel: caso.nivel,
        grado: caso.grado,
        carrera: caso.carrera ?? '',
        difficulty: 'intermedio',
        explicitQuestionTypes: ['multiple_choice', 'true_false', 'numeric', 'short_answer'],
      } as Parameters<typeof generateQuiz>[0],
      (u) => {
        entrada += u?.inputTokens ?? 0
        salida += u?.outputTokens ?? 0
      },
    )
    const preguntas = (resultado.ok ? resultado.questions : []) as Pregunta[]
    const gift = preguntas.length
      ? validarGift(convertQuizToGift({ title: caso.materia, subjectName: caso.materia, questions: preguntas } as never)).length
      : 0
    filas.push({ caso, preguntas, gift, error: resultado.ok ? undefined : resultado.message })
    console.log(
      `${i + 1}/${aCorrer.length} ${caso.nivel} · ${caso.materia} · ${caso.modo}: ${preguntas.length} preguntas` +
        ` · US$${estimateCostUsd(AI_MODEL, entrada, salida).toFixed(4)} acumulado${resultado.ok ? '' : ` · ERROR ${resultado.message}`}`,
    )
  }

  // ── Métricas ──────────────────────────────────────────────────────────────
  const problemas = ['tipo', 'dosResultados', 'factorizacion', 'repetida', 'fueraDeTema'] as const
  type Problema = (typeof problemas)[number]
  const marcar = (p: Pregunta, todas: Pregunta[], temas: string[], i: number): Record<Problema, boolean> => {
    const norm = normalizeQuestionText(p.question)
    const firma = numericSignature(p)
    const repetida = todas.slice(0, i).some((o) => normalizeQuestionText(o.question) === norm || (firma !== null && numericSignature(o) === firma))
    const pideFactorizar = /factoriz|descompon\w* en (factores )?primos/i.test(p.question)
    return {
      tipo: problemaDeTipo(p) !== null,
      dosResultados: pideMasDeUnValor(p),
      factorizacion: p.type === 'numeric' && pideFactorizar && p.forma !== 'factorizacion',
      repetida,
      // Dentro: el id que se le pasó (t1, t2…) o un nombre que se ubica entre los pedidos.
      fueraDeTema: !temas.some((_, j) => p.topic === `t${j + 1}`) && temaDelPrograma(p.topicName ?? '', temas) === null,
    }
  }

  const porGrupo = new Map<string, { preguntas: number; cuestionarios: number; giftMal: number } & Record<Problema, number>>()
  const sumar = (clave: string, marcas: Record<Problema, boolean> | null, cuestionario?: { gift: number }) => {
    const g = porGrupo.get(clave) ?? { preguntas: 0, cuestionarios: 0, giftMal: 0, tipo: 0, dosResultados: 0, factorizacion: 0, repetida: 0, fueraDeTema: 0 }
    if (marcas) {
      g.preguntas++
      for (const p of problemas) if (marcas[p]) g[p]++
    }
    if (cuestionario) {
      g.cuestionarios++
      if (cuestionario.gift > 0) g.giftMal++
    }
    porGrupo.set(clave, g)
  }
  const ejemplos: string[] = []
  for (const f of filas) {
    const nivel = f.caso.nivel === 'Superior' ? `Superior · ${f.caso.materia}` : f.caso.nivel
    sumar(`nivel|${nivel}`, null, { gift: f.gift })
    sumar('total|Total', null, { gift: f.gift })
    f.preguntas.forEach((p, i) => {
      const m = marcar(p, f.preguntas, f.caso.temas, i)
      sumar(`nivel|${nivel}`, m)
      sumar(`tipo|${p.type}`, m)
      sumar('total|Total', m)
      for (const prob of problemas) {
        if (!m[prob] || ejemplos.length >= 25) continue
        const detalle = prob === 'fueraDeTema' ? ` — tema de la pregunta: «${p.topicName ?? ''}»; pedidos: ${f.caso.temas.map((t) => `«${t}»`).join(', ')}` : ''
        ejemplos.push(`- **${prob}** (${nivel}, ${p.type}): ${p.question.replace(/\s+/g, ' ').slice(0, 200)}${detalle}`)
      }
    })
  }

  const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)} %`)
  const tabla = (prefijo: string, titulo: string) => {
    const lineas = [`| ${titulo} | Preguntas | Tipo (M2) | Dos resultados (K3) | Factorización (L3) | Repetidas | Fuera de tema | GIFT con errores (M5) |`, '|---|---|---|---|---|---|---|---|']
    for (const [clave, g] of porGrupo) {
      if (!clave.startsWith(prefijo)) continue
      lineas.push(
        `| ${clave.split('|')[1]} | ${g.preguntas} | ${pct(g.tipo, g.preguntas)} | ${pct(g.dosResultados, g.preguntas)} | ${pct(g.factorizacion, g.preguntas)} | ${pct(g.repetida, g.preguntas)} | ${pct(g.fueraDeTema, g.preguntas)} | ${g.cuestionarios ? `${g.giftMal} de ${g.cuestionarios}` : '—'} |`,
      )
    }
    return lineas.join('\n')
  }
  const costo = estimateCostUsd(AI_MODEL, entrada, salida)
  const errores = filas.filter((f) => f.error)
  const informe = [
    '# Calidad de la generación · 22/11/2026 (O14)',
    '',
    `Staging, IA real (\`${AI_MODEL}\`), con el mismo núcleo de la app (\`generateQuiz\` y su filtro). ${filas.length} cuestionarios de ${PREGUNTAS} preguntas pedidas, con los cuatro tipos permitidos; teórico y práctico. Gasto estimado: US$${costo.toFixed(4)} (${entrada} tokens de entrada, ${salida} de salida).`,
    '',
    'Qué mide cada columna (sobre lo que devuelve la generación, después de su filtro): **Tipo** = `problemaDeTipo` (M2); **Dos resultados** = `pideMasDeUnValor` (K3); **Factorización** = numérica que pide factorizar sin `forma: factorizacion` (L3); **Repetidas** = misma consigna o misma cuenta dentro del cuestionario; **Fuera de tema** = el tema de la pregunta no se ubica entre los pedidos; **GIFT** = cuestionarios cuya exportación a Moodle tiene errores de `validarGift` (M5, incluye llaves de conjunto).',
    '',
    '## Por nivel y materia',
    '',
    tabla('nivel|', 'Nivel'),
    '',
    '## Por tipo de pregunta',
    '',
    tabla('tipo|', 'Tipo'),
    '',
    '## Total',
    '',
    tabla('total|', ''),
    '',
    errores.length ? `## Generaciones que fallaron\n\n${errores.map((e) => `- ${e.caso.nivel} · ${e.caso.materia} · ${e.caso.modo}: ${e.error}`).join('\n')}\n` : '',
    '## Ejemplos de lo marcado',
    '',
    ejemplos.length ? ejemplos.join('\n') : 'Nada marcado.',
    '',
  ].join('\n')
  writeFileSync(SALIDA, informe)
  console.log(`\nInforme en ${SALIDA} · US$${costo.toFixed(4)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
