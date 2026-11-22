/**
 * Ronda T · A5 — Medición de la generación por área, en STAGING y con la IA real.
 *
 * Dos pasos, para poder medir el "antes" con el código de antes:
 *
 *   1) Generar (con el `generateQuiz` del árbol donde se corre):
 *      npx tsx scripts/qa/medir-areas.ts --env=staging --generar=despues.json
 *      Para el "antes", copiar este archivo y `fixtures/areas.ts` a un worktree
 *      de `main` anterior a la ronda T · A4 y correrlo ahí con --generar=antes.json.
 *      Sólo importa `quiz-generation`, `ai-usage` y `ai-model`, que existen en los dos.
 *
 *   2) Analizar (con los validadores de ahora):
 *      npx tsx scripts/qa/medir-areas.ts --env=staging --analizar=antes.json,despues.json [--salida=docs/calidad/areas-2026-11-22.md]
 *
 * Por programa (8, de scripts/qa/fixtures/areas.ts, ninguno real) y por modo
 * (teórico, práctico, mixto): 2 cuestionarios de 8 preguntas. Mide:
 *   - % de preguntas con LaTeX o números (cuentas, numéricas) en unidades
 *     conceptuales (`problemaDeArea`): la meta es 0 %;
 *   - la mezcla de tipos: ninguno por encima del 50 %;
 *   - en matemática, que no empeore: `problemaDeTipo` (M2), `pideMasDeUnValor`
 *     (K3) y la factorización sin `forma` (L3);
 *   - 3 preguntas de ejemplo por área y modo.
 *
 * SÓLO STAGING: lee el currículum de la base de staging (no escribe). La key de
 * Gemini sale de `.env.local`. Imprime el gasto.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { PROGRAMAS, type ProgramaDePrueba } from './fixtures/areas'

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
process.env.DATABASE_URL = leerEnv('.env.staging.local').DATABASE_URL
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY ?? ''

const arg = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3)
const MODOS = ['teorico', 'practico', 'mixto'] as const
const POR_MODO = 2
const PREGUNTAS = 8

interface Corrida {
  programa: string
  modo: (typeof MODOS)[number]
  vuelta: number
  ok: boolean
  error?: string
  preguntas: Record<string, unknown>[]
}

async function generar(salida: string) {
  const { generateQuiz } = await import('../../lib/quiz-generation')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  const solo = arg('solo')
  let entrada = 0
  let salidaTokens = 0
  const corridas: Corrida[] = []

  for (const programa of PROGRAMAS.filter((p) => !solo || p.id === solo)) {
    const temas = temasDe(programa)
    for (const modo of MODOS) {
      for (let vuelta = 1; vuelta <= POR_MODO; vuelta++) {
        let resultado: Awaited<ReturnType<typeof generateQuiz>> | null = null
        let error: string | undefined
        try {
          resultado = await generateQuiz(
            {
              subject: programa.materia,
              subjectUnits: programa.unidades,
              topics: temas,
              mode: modo,
              previousQuestions: [],
              questionCount: PREGUNTAS,
              nivel: 'Superior',
              grado: programa.grado,
              carrera: programa.carrera,
              difficulty: 'intermedio',
              explicitQuestionTypes: programa.tipos,
            },
            (u) => {
              entrada += u?.inputTokens ?? 0
              salidaTokens += u?.outputTokens ?? 0
            },
          )
        } catch (e) {
          error = e instanceof Error ? e.message : String(e)
        }
        const ok = resultado?.ok === true
        corridas.push({
          programa: programa.id,
          modo,
          vuelta,
          ok,
          error: ok ? undefined : error ?? (resultado && !resultado.ok ? resultado.message : 'sin resultado'),
          preguntas: ok && resultado?.ok ? (resultado.questions as unknown as Record<string, unknown>[]) : [],
        })
        console.log(`${programa.id} · ${modo} · ${vuelta}: ${ok ? 'ok' : 'ERROR'} · US$${estimateCostUsd(AI_MODEL, entrada, salidaTokens).toFixed(4)} acumulado`)
      }
    }
  }
  writeFileSync(salida, JSON.stringify({ costoUsd: estimateCostUsd(AI_MODEL, entrada, salidaTokens), corridas }, null, 1))
  console.log(`Listo: ${salida}`)
}

function temasDe(programa: ProgramaDePrueba) {
  return programa.unidades.flatMap((u) => u.topics).filter((t) => programa.temas.includes(t.name))
}

async function analizar(archivos: string[], salida: string) {
  const { problemaDeArea } = await import('../../lib/validar-area')
  const { completarAreaDelPrograma } = await import('../../lib/area-del-programa')
  const { caracterDeLaPregunta, contextoDeArea } = await import('../../lib/area-para-generar')
  const { PERFILES } = await import('../../lib/areas')
  const { problemaDeTipo } = await import('../../lib/validar-tipo-de-pregunta')
  const { pideMasDeUnValor } = await import('../../lib/consigna-multiple')

  const FACTORIZAR = /factoriz|descompon\w* en (factores )?primos|producto de (potencias|primos)/i
  const tablas: string[] = []
  const ejemplos: string[] = []
  const resumen: string[] = []

  for (const archivo of archivos) {
    const datos = JSON.parse(readFileSync(archivo, 'utf8')) as { costoUsd: number; corridas: Corrida[] }
    const nombre = archivo.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
    const filas: string[] = []
    let conceptualesTotal = 0
    let conceptualesMal = 0
    let tandasSobreTope = 0
    let tandas = 0
    const mate = { total: 0, tipo: 0, k3: 0, l3: 0 }

    for (const programa of PROGRAMAS) {
      const completo = completarAreaDelPrograma({ materia: programa.materia, carrera: programa.carrera, perfil: {}, unidades: programa.unidades })
      const ctx = contextoDeArea({ area: completo.perfil.area, unidades: completo.unidades, temas: temasDe(programa) })
      for (const modo of MODOS) {
        const corridas = datos.corridas.filter((c) => c.programa === programa.id && c.modo === modo)
        const preguntas = corridas.flatMap((c) => c.preguntas)
        const errores = corridas.filter((c) => !c.ok).length
        let enConceptual = 0
        let mal = 0
        for (const p of preguntas) {
          const caracter = caracterDeLaPregunta(ctx, p.topicName)
          if (caracter !== 'conceptual') continue
          enConceptual++
          if (problemaDeArea(p, 'conceptual')) mal++
        }
        conceptualesTotal += enConceptual
        conceptualesMal += mal
        for (const c of corridas.filter((x) => x.ok)) {
          tandas++
          const cuenta = new Map<string, number>()
          for (const p of c.preguntas) cuenta.set(String(p.type), (cuenta.get(String(p.type)) ?? 0) + 1)
          if (cuenta.size > 1 ? Math.max(...cuenta.values()) > Math.ceil(c.preguntas.length / 2) : c.preguntas.length > 0 && programa.tipos.length > 1)
            tandasSobreTope++
        }
        if (programa.id === 'matematica-i') {
          for (const p of preguntas) {
            mate.total++
            if (problemaDeTipo(p)) mate.tipo++
            if (pideMasDeUnValor(p as never)) mate.k3++
            if (p.type === 'numeric' && FACTORIZAR.test(String(p.question)) && p.forma !== 'factorizacion') mate.l3++
          }
        }
        const mezcla = new Map<string, number>()
        for (const p of preguntas) mezcla.set(String(p.type), (mezcla.get(String(p.type)) ?? 0) + 1)
        const mezclaTexto = [...mezcla.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, n]) => `${t} ${Math.round((n / Math.max(1, preguntas.length)) * 100)} %`)
          .join(', ')
        filas.push(
          `| ${programa.materia} (${PERFILES[ctx.area].nombre}) | ${modo} | ${preguntas.length} | ${enConceptual ? `${mal}/${enConceptual} (${Math.round((mal / enConceptual) * 100)} %)` : '—'} | ${mezclaTexto || '—'} | ${errores} |`,
        )
        if (nombre.includes('despues')) {
          const tres = preguntas.slice(0, 3).map((p) => `  - *${p.type}* — ${String(p.question).replace(/\s+/g, ' ').slice(0, 260)}`)
          ejemplos.push(`- **${programa.materia}** · ${modo}\n${tres.join('\n')}`)
        }
      }
    }
    tablas.push(
      `### ${nombre} (US$${datos.costoUsd.toFixed(4)})\n\n| Materia (área) | Modo | Preguntas | Con LaTeX o cuentas en unidades conceptuales | Mezcla de tipos | Errores |\n|---|---|---|---|---|---|\n${filas.join('\n')}`,
    )
    resumen.push(
      `| ${nombre} | ${conceptualesMal}/${conceptualesTotal} (${conceptualesTotal ? ((conceptualesMal / conceptualesTotal) * 100).toFixed(1) : '0'} %) | ${tandasSobreTope}/${tandas} | ${mate.tipo}/${mate.total} · ${mate.k3}/${mate.total} · ${mate.l3}/${mate.total} | US$${datos.costoUsd.toFixed(4)} |`,
    )
  }

  const informe = `# Generación por área · 22/11/2026 (ronda T · A5)

Medición en staging con la IA real (\`scripts/qa/medir-areas.ts\`): 8 programas de prueba escritos para esto (ninguno real; no es el archivo de Silvana), 3 modos, ${POR_MODO} cuestionarios de ${PREGUNTAS} preguntas por modo. **Antes** = \`main\` anterior a la ronda T · A4 (sin perfiles de área); **después** = con A4 y A5. Los dos con los mismos tipos pedidos: opción múltiple, verdadero o falso y respuesta corta en las materias conceptuales, más numérica en Microeconomía, Contabilidad, Matemática I y Matemática y su Didáctica.

## Resumen

| Corrida | LaTeX o cuentas en unidades conceptuales (meta 0 %) | Cuestionarios con un tipo por encima del 50 % | Matemática I: tipo incoherente (M2) · más de un valor (K3) · factorizar sin forma (L3) | Gasto |
|---|---|---|---|---|
${resumen.join('\n')}

## Por programa y modo

${tablas.join('\n\n')}

## Tres preguntas de ejemplo por área y modo (después)

${ejemplos.join('\n')}
`
  writeFileSync(salida, informe)
  console.log(`Listo: ${salida}`)
}

async function main() {
  const generarEn = arg('generar')
  const analizarEn = arg('analizar')
  if (generarEn) return generar(generarEn)
  if (analizarEn) return analizar(analizarEn.split(','), arg('salida') ?? 'docs/calidad/areas-2026-11-22.md')
  console.error('Usá --generar=archivo.json o --analizar=antes.json,despues.json')
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
