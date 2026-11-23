/**
 * Ronda W · W5 — Prueba chica, con el modelo real, de las dos llamadas del
 * ensayo: proponer la rúbrica y sugerir la corrección de dos respuestas (una
 * buena y una floja). No escribe en ninguna base. Imprime el gasto.
 *
 *   npx tsx scripts/qa/probar-ensayo-ia.ts --env=staging
 */
import { existsSync, readFileSync } from 'node:fs'

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
  console.error('Sólo corre con --env=staging (no toca ninguna base, pero así se acuerda con el resto de scripts/qa).')
  process.exit(1)
}
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= leerEnv('.env.staging.local').GOOGLE_GENERATIVE_AI_API_KEY || leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY || ''

async function main() {
  const { proponerRubrica, sugerirCorreccion } = await import('../../lib/ensayo-ia')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  let entrada = 0
  let salida = 0
  const contar = (u: { inputTokens?: number; outputTokens?: number } | undefined) => {
    entrada += u?.inputTokens ?? 0
    salida += u?.outputTokens ?? 0
  }
  const consigna = 'Explicá con tus palabras qué es un texto argumentativo y da un ejemplo de tu vida cotidiana.'
  const guia = 'Una tesis, argumentos que la sostienen y una conclusión.'
  const rubrica = await proponerRubrica({ materia: 'Lengua', consigna, guia, onUsage: contar })
  console.log('Rúbrica propuesta:', rubrica.map((c) => c.criterio))
  const respuestas = [
    'Un texto argumentativo defiende una postura, la tesis, con argumentos que la sostienen, y cierra con una conclusión. Por ejemplo, cuando le explico a mi familia por qué conviene adoptar un perro: digo que hace compañía, que nos hace salir a caminar y que hay muchos esperando un hogar.',
    'Es un texto que cuenta algo.',
  ]
  for (const respuesta of respuestas) {
    const s = await sugerirCorreccion({ materia: 'Lengua', consigna, guia, rubrica, respuesta, onUsage: contar })
    console.log(`\n«${respuesta.slice(0, 50)}…»\n`, JSON.stringify(s, null, 1))
  }
  console.log(`\nGasto: US$${estimateCostUsd(AI_MODEL, entrada, salida).toFixed(4)}`)
}
main()
