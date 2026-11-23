/**
 * Ronda Y · Y4 — Gemini contra Claude Haiku, SÓLO MEDICIÓN. No cambia el
 * modelo por defecto: la app sigue usando `AI_MODEL` (lib/ai-model.ts); acá
 * `generateQuiz` recibe el modelo a medir por su parámetro de medición.
 *
 * Las mismas 40 generaciones con los dos modelos (10 temas de primario a
 * superior × 4 combinaciones de modo y tipos), contra staging (sólo lectura):
 *   - funcionaron, preguntas entregadas contra pedidas, tipos que no salieron;
 *   - lo que devolvió el modelo y lo que descartaron los validadores;
 *   - tiempo (promedio y p90), tokens y costo estimado;
 *   - 10 pares de preguntas para comparar A CIEGAS (A/B al azar con semilla),
 *     con la clave en un archivo aparte.
 *
 *   npx tsx scripts/qa/comparar-gemini-claude.ts --env=staging
 *     → docs/calidad/gemini-vs-claude-<fecha>.md y …-clave.md
 *   npx tsx scripts/qa/comparar-gemini-claude.ts --env=staging --simulado
 *     → los dos modelos simulados (sin clave, sin gasto), al scratch: prueba el script.
 *
 * Sin ANTHROPIC_API_KEY (en el entorno o en .env.staging.local) no hace nada:
 * dice el paso manual y termina.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= staging.GOOGLE_GENERATIVE_AI_API_KEY || leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY || ''
process.env.ANTHROPIC_API_KEY ||= staging.ANTHROPIC_API_KEY || ''
const SIMULADO = process.argv.includes('--simulado')
const CLAUDE = 'claude-haiku-5-5'

if (!SIMULADO && !process.env.ANTHROPIC_API_KEY) {
  console.log(`No hay ANTHROPIC_API_KEY (ni en el entorno ni en .env.staging.local): la medición se saltea.

Paso manual para Mauro (PowerShell, desde la carpeta del repo):
  $env:ANTHROPIC_API_KEY = "\${claveDeAnthropic}"
  npx tsx scripts/qa/comparar-gemini-claude.ts --env=staging

Escribe docs/calidad/gemini-vs-claude-<fecha>.md (métricas y 10 pares a ciegas) y la clave aparte.`)
  process.exit(0)
}

type Tipo = 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer' | 'multiple_response' | 'matching' | 'ordering'
const TEMAS: { materia: string; nivel: string; grado: string; tema: string }[] = [
  { materia: 'Matemática', nivel: 'Primario', grado: '5', tema: 'Fracciones equivalentes' },
  { materia: 'Ciencias Naturales', nivel: 'Primario', grado: '6', tema: 'El sistema digestivo' },
  { materia: 'Matemática', nivel: 'Secundario', grado: '3', tema: 'Función lineal: pendiente y ordenada al origen' },
  { materia: 'Lengua', nivel: 'Secundario', grado: '2', tema: 'El texto argumentativo' },
  { materia: 'Historia', nivel: 'Secundario', grado: '4', tema: 'La Revolución de Mayo' },
  { materia: 'Química', nivel: 'Secundario', grado: '4', tema: 'Estequiometría básica' },
  { materia: 'Análisis Matemático I', nivel: 'Superior', grado: '1', tema: 'Límites y continuidad' },
  { materia: 'Contabilidad', nivel: 'Superior', grado: '1', tema: 'El patrimonio y sus variaciones' },
  { materia: 'Antropología', nivel: 'Superior', grado: '1', tema: 'El concepto de cultura' },
  { materia: 'Enfermería', nivel: 'Superior', grado: '2', tema: 'Control de signos vitales' },
]
const COMBINACIONES: { modo: 'teorico' | 'practico' | 'mixto'; tipos: Tipo[] }[] = [
  { modo: 'teorico', tipos: ['multiple_choice'] },
  { modo: 'practico', tipos: ['multiple_choice', 'numeric', 'short_answer'] },
  { modo: 'mixto', tipos: ['multiple_choice', 'true_false', 'short_answer'] },
  { modo: 'practico', tipos: ['multiple_response', 'matching', 'ordering', 'multiple_choice'] },
]
const PREGUNTAS = 6

interface Corrida {
  caso: number
  tema: string
  combinacion: number
  ok: boolean
  error?: string
  entregadas: number
  crudas: number
  descartadas: number
  avisosDeTipos: number
  ms: number
  entrada: number
  salida: number
  preguntas: Record<string, unknown>[]
}

/** Un modelo simulado: devuelve, en JSON, tantas preguntas de opción múltiple como pida el prompt. */
async function modeloSimulado(nombre: string) {
  const { MockLanguageModelV3 } = await import('ai/test')
  return new MockLanguageModelV3({
    modelId: nombre,
    doGenerate: async (opciones) => {
      const texto = JSON.stringify(opciones.prompt)
      const n = Number(texto.match(/Genera (\d+) preguntas/)?.[1] ?? 3)
      const questions = Array.from({ length: n }, (_, i) => ({
        id: `q${i + 1}`,
        type: 'multiple_choice',
        topic: 't1',
        topicName: 'Tema',
        question: `[${nombre}] Pregunta simulada ${i + 1} ${Math.random().toString(36).slice(2, 8)}: ¿cuál es la correcta?`,
        options: ['La primera', 'La segunda', 'La tercera', 'La cuarta'],
        correctAnswer: i % 4,
        explanation: 'Porque así lo dice el modelo simulado.',
      }))
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ questions }) }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 3000, noCache: 3000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 120 * n, text: 120 * n, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

/** El Haiku real, sin temperature/topP/topK (Claude Haiku 5.5 rechaza valores que no son los de fábrica). */
async function haikuReal() {
  const { anthropic } = await import('@ai-sdk/anthropic')
  const { wrapLanguageModel } = await import('ai')
  return wrapLanguageModel({
    model: anthropic(CLAUDE),
    middleware: { specificationVersion: 'v3', transformParams: async ({ params }) => ({ ...params, temperature: undefined, topP: undefined, topK: undefined }) },
  })
}

function aleatorio(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0
    return (s % 1_000_000) / 1_000_000
  }
}

const p90 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.9))] : 0)
const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace('.', ',')} %` : '—')
const usd = (v: number) => `US$${v.toFixed(4).replace('.', ',')}`

function enTexto(q: Record<string, unknown>): string {
  const partes = [`**${String(q.question ?? '')}**`]
  if (Array.isArray(q.options)) partes.push((q.options as string[]).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  \n'))
  if (Array.isArray(q.pairs)) partes.push((q.pairs as { left: string; right: string }[]).map((p) => `${p.left} → ${p.right}`).join('  \n'))
  if (Array.isArray(q.items)) partes.push(`Orden: ${(q.items as string[]).join(' → ')}`)
  const correcta =
    q.type === 'multiple_choice' && Array.isArray(q.options)
      ? String((q.options as string[])[Number(q.correctAnswer)])
      : q.type === 'true_false'
        ? q.correctAnswer
          ? 'Verdadero'
          : 'Falso'
        : q.type === 'numeric'
          ? String(q.correctAnswer)
          : Array.isArray(q.acceptedAnswers)
            ? (q.acceptedAnswers as string[]).join(' / ')
            : Array.isArray(q.correctAnswers) && Array.isArray(q.options)
              ? (q.correctAnswers as number[]).map((i) => (q.options as string[])[i]).join(', ')
              : ''
  if (correcta) partes.push(`*Correcta:* ${correcta}`)
  if (q.explanation) partes.push(`*Explicación:* ${String(q.explanation)}`)
  return partes.join('\n\n')
}

async function main() {
  const { generateQuiz } = await import('../../lib/quiz-generation')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  const modelos: { nombre: string; precio: string; modelo: unknown }[] = [
    { nombre: AI_MODEL, precio: AI_MODEL, modelo: SIMULADO ? await modeloSimulado(AI_MODEL) : undefined },
    { nombre: CLAUDE, precio: CLAUDE, modelo: SIMULADO ? await modeloSimulado(CLAUDE) : await haikuReal() },
  ]
  const casos = TEMAS.flatMap((t, i) => COMBINACIONES.map((c, j) => ({ caso: i * COMBINACIONES.length + j + 1, t, c, j })))
  const solo = Number(process.argv.find((a) => a.startsWith('--casos='))?.slice(8)) || casos.length
  const resultados: Record<string, Corrida[]> = {}

  for (const m of modelos) {
    resultados[m.nombre] = []
    for (const { caso, t, c, j } of casos.slice(0, solo)) {
      const topics = [{ id: 't1', name: t.tema }]
      const cuenta = { crudas: 0, descartadas: 0, entrada: 0, salida: 0 }
      const inicio = Date.now()
      let corrida: Corrida
      try {
        const r = await generateQuiz(
          {
            subject: t.materia,
            subjectUnits: [{ name: 'Unidad 1', topics }],
            topics,
            mode: c.modo,
            previousQuestions: [],
            questionCount: PREGUNTAS,
            nivel: t.nivel,
            grado: t.grado,
            carrera: '',
            difficulty: 'intermedio',
            explicitQuestionTypes: c.tipos as never[],
          },
          (u) => {
            cuenta.entrada += u?.inputTokens ?? 0
            cuenta.salida += u?.outputTokens ?? 0
          },
          { tanda: (ps) => (cuenta.crudas += ps.length), descarte: () => cuenta.descartadas++ },
          m.modelo ? { modelo: m.modelo as never } : undefined,
        )
        corrida = {
          caso,
          tema: t.tema,
          combinacion: j + 1,
          ok: r.ok,
          error: r.ok ? undefined : r.message,
          entregadas: r.ok ? r.questions.length : 0,
          crudas: cuenta.crudas,
          descartadas: cuenta.descartadas,
          avisosDeTipos: r.ok ? (r.avisosDeTipos?.length ?? 0) : 0,
          ms: Date.now() - inicio,
          entrada: cuenta.entrada,
          salida: cuenta.salida,
          preguntas: r.ok ? (r.questions as unknown as Record<string, unknown>[]) : [],
        }
      } catch (e) {
        corrida = { caso, tema: t.tema, combinacion: j + 1, ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e), entregadas: 0, crudas: cuenta.crudas, descartadas: cuenta.descartadas, avisosDeTipos: 0, ms: Date.now() - inicio, entrada: cuenta.entrada, salida: cuenta.salida, preguntas: [] }
      }
      resultados[m.nombre].push(corrida)
      const gastado = resultados[m.nombre].reduce((s, x) => s + estimateCostUsd(m.precio, x.entrada, x.salida), 0)
      console.log(`${m.nombre} · caso ${caso}: ${corrida.ok ? 'ok' : `ERROR ${corrida.error}`} · ${corrida.entregadas}/${PREGUNTAS} · ${corrida.ms} ms · ${usd(gastado)} acumulado`)
    }
  }

  // Las métricas.
  const fila = (m: (typeof modelos)[number]) => {
    const rs = resultados[m.nombre]
    const ok = rs.filter((r) => r.ok)
    const crudas = rs.reduce((s, r) => s + r.crudas, 0)
    const descartadas = rs.reduce((s, r) => s + r.descartadas, 0)
    const costo = rs.reduce((s, r) => s + estimateCostUsd(m.precio, r.entrada, r.salida), 0)
    return {
      nombre: m.nombre,
      funcionaron: `${ok.length} de ${rs.length}`,
      entregadas: pct(rs.reduce((s, r) => s + r.entregadas, 0), rs.length * PREGUNTAS),
      descarte: pct(descartadas, crudas),
      avisos: rs.reduce((s, r) => s + r.avisosDeTipos, 0),
      ms: `${(prom(rs.map((r) => r.ms)) / 1000).toFixed(1).replace('.', ',')} s / ${(p90(rs.map((r) => r.ms)) / 1000).toFixed(1).replace('.', ',')} s`,
      tokens: `${Math.round(prom(rs.map((r) => r.entrada)))} / ${Math.round(prom(rs.map((r) => r.salida)))}`,
      costo: usd(costo),
      costoPorGeneracion: usd(costo / Math.max(1, rs.length)),
      okN: ok.length,
      descarteN: crudas > 0 ? descartadas / crudas : 1,
      costoN: costo,
    }
  }
  const [g, c] = modelos.map(fila)

  // 10 pares a ciegas: de 10 casos al azar (con semilla), la primera pregunta de cada modelo, A/B al azar.
  const azar = aleatorio(20261123)
  const conAmbos = casos.slice(0, solo).filter((k) => resultados[g.nombre][k.caso - 1]?.preguntas.length && resultados[c.nombre][k.caso - 1]?.preguntas.length)
  const elegidos = [...conAmbos].sort(() => azar() - 0.5).slice(0, 10)
  const pares = elegidos.map((k, i) => {
    const deG = resultados[g.nombre][k.caso - 1].preguntas[0]
    const deC = resultados[c.nombre][k.caso - 1].preguntas[0]
    const gEsA = azar() < 0.5
    return { n: i + 1, k, A: gEsA ? deG : deC, B: gEsA ? deC : deG, A_es: gEsA ? g.nombre : c.nombre, B_es: gEsA ? c.nombre : g.nombre }
  })

  const recomendacion =
    c.okN >= g.okN && c.descarteN <= g.descarteN && c.costoN <= g.costoN
      ? `Claude Haiku funcionó igual o mejor, descartó igual o menos y costó igual o menos. **Recomiendo** mirar los 10 pares a ciegas: si también ganan las preguntas, probarlo **en staging** detrás de una variable (no en producción) durante una semana antes de decidir. El modelo por defecto **no se cambió**.`
      : `Claude Haiku no ganó en todo: funcionó ${c.funcionaron} contra ${g.funcionaron}, con un descarte de ${c.descarte} contra ${g.descarte} y un costo de ${c.costo} contra ${g.costo}. **Recomiendo quedarse con ${g.nombre}** salvo que los 10 pares a ciegas muestren una diferencia clara de calidad a favor de Claude. El modelo por defecto **no se cambió**.`

  const fecha = new Date().toISOString().slice(0, 10)
  const carpeta = SIMULADO ? join(tmpdir(), 'maestria-comparacion-simulada') : join('docs', 'calidad')
  mkdirSync(carpeta, { recursive: true })
  const base = join(carpeta, `gemini-vs-claude-${fecha}${SIMULADO ? '-simulado' : ''}`)
  const informe = `# Gemini contra Claude Haiku (${fecha})${SIMULADO ? ' — SIMULADO' : ''}

Sólo medición (ronda Y · Y4): **el modelo por defecto no se cambió.** Las mismas ${casos.slice(0, solo).length} generaciones de ${PREGUNTAS} preguntas con los dos modelos, contra staging (sólo lectura): ${TEMAS.length} temas de primario a superior × ${COMBINACIONES.length} combinaciones de modo y tipos. Generado por \`scripts/qa/comparar-gemini-claude.ts\`.

## Métricas

| | ${g.nombre} | ${c.nombre} |
|---|---|---|
| Generaciones que funcionaron | ${g.funcionaron} | ${c.funcionaron} |
| Preguntas entregadas / pedidas | ${g.entregadas} | ${c.entregadas} |
| Descartadas por los validadores (de lo que devolvió el modelo) | ${g.descarte} | ${c.descarte} |
| Tipos pedidos que no salieron (avisos de U1) | ${g.avisos} | ${c.avisos} |
| Tiempo por generación (promedio / p90) | ${g.ms} | ${c.ms} |
| Tokens por generación (entrada / salida) | ${g.tokens} | ${c.tokens} |
| Costo estimado total | ${g.costo} | ${c.costo} |
| Costo por generación | ${g.costoPorGeneracion} | ${c.costoPorGeneracion} |

## Recomendación

${recomendacion}

## 10 pares a ciegas

En cada par, una pregunta es de cada modelo, en orden al azar. Leelas sin mirar la clave (\`${base.split(/[\\/]/).pop()}-clave.md\`) y anotá cuál preferís y por qué (claridad, nivel, distractores, explicación).

${pares.map((p) => `### Par ${p.n} · ${p.k.t.materia} (${p.k.t.nivel}) · ${p.k.t.tema}\n\n**A**\n\n${enTexto(p.A)}\n\n**B**\n\n${enTexto(p.B)}\n\nPrefiero: ___ · Por qué: ___`).join('\n\n')}
`
  const clave = `# Clave de los 10 pares a ciegas (${fecha})\n\n| Par | A | B |\n|---|---|---|\n${pares.map((p) => `| ${p.n} | ${p.A_es} | ${p.B_es} |`).join('\n')}\n`
  writeFileSync(`${base}.md`, informe)
  writeFileSync(`${base}-clave.md`, clave)
  console.log(`\nListo: ${base}.md y ${base}-clave.md`)
}
main()
