/**
 * Ronda U · U4 — Medición de los tipos como en Moodle con la IA real, en STAGING.
 *
 *   1) Generar:
 *      npx tsx scripts/qa/medir-tipos-moodle.ts --env=staging --generar=tipos.json
 *      … --solo=antropologia      sólo ese programa
 *      … --corrida=2              sólo esa corrida (1, 2 o 3)
 *
 *   2) Analizar (uno o varios archivos; el último manda en los ejemplos):
 *      npx tsx scripts/qa/medir-tipos-moodle.ts --env=staging --analizar=tipos.json[,otro.json] --salida=docs/calidad/tipos-moodle-2026-11-23.md
 *
 * Seis programas de prueba (scripts/qa/fixtures/areas.ts, ninguno real) y tres
 * cuestionarios de 8 preguntas por programa, con "Más tipos":
 *
 *   1. práctico: varias correctas, emparejamiento, ordenamiento, palabra faltante y opción múltiple;
 *   2. práctico: seleccionar, arrastrar, emparejamiento, calculada y verdadero o falso;
 *   3. mixto: los siete tipos de Moodle.
 *
 * Mide, por tipo: el % que descartan los validadores (forma, F2 a F7, y
 * calidad, U3) sobre lo que devolvió el modelo; los tipos pedidos contra los
 * obtenidos (U1) y 2 ejemplos por tipo. Usa el observador de `generateQuiz`.
 *
 * SÓLO STAGING (no escribe nada en la base). La key de Gemini sale de
 * `.env.local`. Imprime el gasto acumulado.
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

const PROGRAMAS_U4 = ['matematica-i', 'microeconomia', 'antropologia', 'contabilidad', 'enfermeria', 'matematica-didactica']
const MOODLE = ['multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'calculated']
const CORRIDAS: { modo: 'practico' | 'mixto'; tipos: string[] }[] = [
  { modo: 'practico', tipos: ['multiple_response', 'matching', 'ordering', 'missing_word', 'multiple_choice'] },
  { modo: 'practico', tipos: ['gapselect', 'ddwtos', 'matching', 'calculated', 'true_false'] },
  { modo: 'mixto', tipos: MOODLE },
]
const PREGUNTAS = 8

interface Descarte {
  tipo: string
  motivo: string
  pregunta: string
}
interface Corrida {
  programa: string
  corrida: number
  modo: string
  pedidos: string[]
  ok: boolean
  error?: string
  avisos: { tipo: string; motivo: string }[]
  crudas: Record<string, number>
  descartes: Descarte[]
  preguntas: Record<string, unknown>[]
}

function temasDe(programa: ProgramaDePrueba) {
  return programa.unidades.flatMap((u) => u.topics).filter((t) => programa.temas.includes(t.name))
}

async function generar(salida: string) {
  const { generateQuiz } = await import('../../lib/quiz-generation')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  const solo = arg('solo')
  const soloCorrida = arg('corrida') ? Number(arg('corrida')) : null
  let entrada = 0
  let salidaTokens = 0
  const corridas: Corrida[] = []

  for (const id of PROGRAMAS_U4.filter((p) => !solo || p === solo)) {
    const programa = PROGRAMAS.find((p) => p.id === id)!
    for (const [i, c] of CORRIDAS.entries()) {
      if (soloCorrida && soloCorrida !== i + 1) continue
      const crudas: Record<string, number> = {}
      const descartes: Descarte[] = []
      let resultado: Awaited<ReturnType<typeof generateQuiz>> | null = null
      let error: string | undefined
      try {
        resultado = await generateQuiz(
          {
            subject: programa.materia,
            subjectUnits: programa.unidades,
            topics: temasDe(programa),
            mode: c.modo,
            previousQuestions: [],
            questionCount: PREGUNTAS,
            nivel: 'Superior',
            grado: programa.grado,
            carrera: programa.carrera,
            difficulty: 'intermedio',
            explicitQuestionTypes: c.tipos as never[],
          },
          (u) => {
            entrada += u?.inputTokens ?? 0
            salidaTokens += u?.outputTokens ?? 0
          },
          {
            tanda: (ps) => ps.forEach((p) => (crudas[String(p.type)] = (crudas[String(p.type)] ?? 0) + 1)),
            descarte: (p, motivo) => descartes.push({ tipo: String(p.type), motivo, pregunta: String(p.question ?? '').replace(/\s+/g, ' ').slice(0, 200) }),
          },
        )
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
      const ok = resultado?.ok === true
      corridas.push({
        programa: id,
        corrida: i + 1,
        modo: c.modo,
        pedidos: c.tipos,
        ok,
        error: ok ? undefined : error ?? (resultado && !resultado.ok ? resultado.message : 'sin resultado'),
        avisos: ok && resultado?.ok ? (resultado.avisosDeTipos ?? []) : [],
        crudas,
        descartes,
        preguntas: ok && resultado?.ok ? (resultado.questions as unknown as Record<string, unknown>[]) : [],
      })
      console.log(`${id} · corrida ${i + 1}: ${ok ? 'ok' : 'ERROR'} · US$${estimateCostUsd(AI_MODEL, entrada, salidaTokens).toFixed(4)} acumulado`)
    }
  }
  writeFileSync(salida, JSON.stringify({ costoUsd: estimateCostUsd(AI_MODEL, entrada, salidaTokens), corridas }, null, 1))
  console.log(`Listo: ${salida}`)
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—')
const unaLinea = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim()

function enTexto(p: Record<string, unknown>): string {
  const q = unaLinea(p.question)
  switch (p.type) {
    case 'matching':
      return `${q} — ${(p.pairs as { left: string; right: string }[]).map((x) => `${unaLinea(x.left)} → ${unaLinea(x.right)}`).join(' · ')}`
    case 'ordering':
      return `${q} — ${(p.items as string[]).map((x, i) => `${i + 1}. ${unaLinea(x)}`).join(' · ')}`
    case 'gapselect':
    case 'ddwtos':
      return `${q} — ${unaLinea(p.text)} [${(p.choices as string[]).join(', ')}]`
    case 'missing_word':
      return `${unaLinea(p.text)} [${(p.options as string[]).map((o, i) => (i === p.correctAnswer ? `**${o}**` : o)).join(', ')}]`
    case 'calculated':
      return `${unaLinea(p.plantilla ?? q)} — fórmula \`${p.formula}\` (con ${JSON.stringify(p.valores)}: ${p.correctAnswer})`
    case 'multiple_response':
      return `${q} [${(p.options as string[]).map((o, i) => ((p.correctAnswers as number[]).includes(i) ? `**${o}**` : o)).join(', ')}]`
    default:
      return q
  }
}

async function analizar(archivos: string[], salida: string) {
  const conjuntos = archivos.map((a) => ({ nombre: a.replace(/^.*[\\/]/, ''), ...(JSON.parse(readFileSync(a, 'utf8')) as { costoUsd: number; corridas: Corrida[] }) }))
  // El último archivo pisa las corridas del mismo programa y número (las re-mediciones).
  const porClave = new Map<string, Corrida>()
  for (const c of conjuntos) for (const r of c.corridas) porClave.set(`${r.programa}#${r.corrida}`, r)
  const corridas = [...porClave.values()]
  const costo = conjuntos.reduce((s, c) => s + c.costoUsd, 0)

  const tipos = [...MOODLE, 'multiple_choice', 'true_false']
  const esDeValidador = (d: Descarte) => d.motivo.startsWith('forma:') || d.motivo.startsWith('calidad:')
  /** Por tipo: descartadas por el validador / devueltas, y cuántas quedaron. */
  const tasas = (cs: Corrida[]) =>
    new Map(
      tipos.map((t) => {
        const crudas = cs.reduce((s, r) => s + (r.crudas[t] ?? 0), 0)
        const malas = cs.flatMap((r) => r.descartes).filter((d) => d.tipo === t && esDeValidador(d)).length
        const finales = cs.reduce((s, r) => s + r.preguntas.filter((p) => p.type === t).length, 0)
        return [t, { crudas, malas, finales }]
      }),
    )
  const comparacion: string[] = []
  if (conjuntos.length > 1) {
    const antes = tasas(conjuntos[0].corridas)
    const despues = tasas(corridas)
    for (const t of MOODLE) {
      const a = antes.get(t)!
      const d = despues.get(t)!
      comparacion.push(`| ${t} | ${a.malas}/${a.crudas} (${pct(a.malas, a.crudas)}) · ${a.finales} finales | ${d.malas}/${d.crudas} (${pct(d.malas, d.crudas)}) · ${d.finales} finales |`)
    }
  }
  const filasTipo: string[] = []
  for (const t of tipos) {
    const crudas = corridas.reduce((s, r) => s + (r.crudas[t] ?? 0), 0)
    const deValidador = corridas.flatMap((r) => r.descartes).filter((d) => d.tipo === t && (d.motivo.startsWith('forma:') || d.motivo.startsWith('calidad:')))
    const otros = corridas.flatMap((r) => r.descartes).filter((d) => d.tipo === t && !(d.motivo.startsWith('forma:') || d.motivo.startsWith('calidad:')))
    const finales = corridas.reduce((s, r) => s + r.preguntas.filter((p) => p.type === t).length, 0)
    if (!crudas && !finales) continue
    const motivos = [...new Set(deValidador.map((d) => d.motivo))].map((m) => `${m} (${deValidador.filter((d) => d.motivo === m).length})`).join(', ')
    filasTipo.push(`| ${t} | ${crudas} | ${deValidador.length} (${pct(deValidador.length, crudas)}) | ${motivos || '—'} | ${otros.length} | ${finales} |`)
  }

  const filasCorrida: string[] = []
  let completas = 0
  let posibles = 0
  for (const r of corridas.sort((a, b) => PROGRAMAS_U4.indexOf(a.programa) - PROGRAMAS_U4.indexOf(b.programa) || a.corrida - b.corrida)) {
    const obtenidos = [...new Set(r.preguntas.map((p) => String(p.type)))]
    const faltan = r.pedidos.filter((t) => !obtenidos.includes(t))
    const explicados = faltan.filter((t) => r.avisos.some((a) => a.tipo === t))
    if (r.ok) {
      posibles++
      if (faltan.length === explicados.length) completas++
    }
    const avisos = r.avisos.map((a) => `${a.tipo}: ${a.motivo}`).join(', ')
    filasCorrida.push(
      `| ${r.programa} | ${r.corrida} (${r.modo}) | ${r.ok ? 'ok' : `ERROR: ${r.error}`} | ${r.pedidos.length} | ${obtenidos.length} | ${faltan.join(', ') || '—'} | ${avisos || '—'} |`,
    )
  }

  const ejemplos: string[] = []
  for (const t of MOODLE) {
    const de = corridas.flatMap((r) => r.preguntas.filter((p) => p.type === t).map((p) => ({ programa: r.programa, p }))).filter((x, i, a) => a.findIndex((y) => y.programa === x.programa) === i)
    if (de.length === 0) continue
    ejemplos.push(`**${t}**\n\n${de.slice(0, 2).map((x) => `- *${x.programa}* — ${enTexto(x.p)}`).join('\n')}`)
  }

  const descartesMuestra = corridas
    .flatMap((r) => r.descartes.filter((d) => d.motivo.startsWith('forma:') || d.motivo.startsWith('calidad:')).map((d) => `- *${r.programa}* · ${d.tipo} · \`${d.motivo}\` — ${d.pregunta}`))
    .slice(0, 25)

  const informe = `# Tipos como en Moodle con la IA real · 23/11/2026 (ronda U · U4)

Seis programas de prueba ([scripts/qa/fixtures/areas.ts](../../scripts/qa/fixtures/areas.ts), ninguno real): ${PROGRAMAS_U4.join(', ')}. Tres cuestionarios de ${PREGUNTAS} preguntas por programa con "Más tipos" (dos prácticos con cinco tipos y un mixto con los siete de Moodle). Generado con \`generateQuiz\` de \`main\` (con U1 y U3), modelo real, contra staging. Gasto: **US$${costo.toFixed(4)}**. Archivos: ${conjuntos.map((c) => `\`${c.nombre}\``).join(', ')}.

Cómo se lee:

- **Devueltas:** las preguntas de ese tipo que devolvió el modelo, antes de filtrar.
- **Descartadas por el validador:** las que sacaron los validadores de forma (F2 a F7) o de calidad (U3). La meta es ≤ 5 %.
- **Otros descartes:** repetidas, del área (A5), de un tipo no pedido. No cuentan para la meta.
- **Finales:** las que quedaron en los cuestionarios.

${comparacion.length ? `## Antes y después de los ajustes

La primera corrida (\`${conjuntos[0].nombre}\`) contra el resultado final, con los cuestionarios que se volvieron a medir después de los ajustes. Descartadas por el validador / devueltas.

| Tipo | Antes | Después |
|---|---|---|
${comparacion.join('\n')}

` : ''}## Descartes por tipo (resultado final)

| Tipo | Devueltas | Descartadas por el validador | Motivos | Otros descartes | Finales |
|---|---|---|---|---|---|
${filasTipo.join('\n')}

## Tipos pedidos contra obtenidos (U1)

**${completas} de ${posibles}** cuestionarios tienen todos los tipos pedidos, o un aviso que explica el que falta.

| Programa | Cuestionario | Resultado | Pedidos | Obtenidos | Faltan | Avisos |
|---|---|---|---|---|---|---|
${filasCorrida.join('\n')}

## Lo que descartaron los validadores (muestra)

${descartesMuestra.join('\n') || 'Ninguna.'}

## Dos ejemplos por tipo

${ejemplos.join('\n\n')}
`
  writeFileSync(salida, informe)
  console.log(`Informe: ${salida}`)
}

async function main() {
  const g = arg('generar')
  const a = arg('analizar')
  if (g) await generar(g)
  else if (a) await analizar(a.split(','), arg('salida') ?? 'docs/calidad/tipos-moodle-2026-11-23.md')
  else console.error('Usá --generar=archivo.json o --analizar=archivo.json')
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
