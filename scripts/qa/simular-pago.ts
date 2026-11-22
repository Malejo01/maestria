/**
 * Ronda T · C2 — Un pago de punta a punta contra STAGING, con Mercado Pago
 * SIMULADO (nunca credenciales reales):
 *
 *   1. el checkout de un docente, con un código (crea la fila en `pagos` y le
 *      "pide" la preferencia a un Mercado Pago falso que responde como el real);
 *   2. el webhook: el Mercado Pago falso dice que el pago está aprobado;
 *   3. una segunda notificación del mismo pago (no tiene que acreditar otra vez);
 *   4. muestra cómo quedó: el pago, el plan del docente, el uso del código y la
 *      marca de fundadora.
 *
 * Uso (sólo staging):
 *   npx tsx scripts/qa/simular-pago.ts --env=staging --docente=<id> [--codigo=FUNDADORA-SIL] [--cantidad=1]
 *
 * E2 · El pase por materia de un alumno (`--docente` es entonces el alumno):
 *   npx tsx scripts/qa/simular-pago.ts --env=staging --docente=<alumno> --materia=<id> [--codigo=…]
 */
import { readFileSync } from 'node:fs'

function leer(archivo: string, clave: string): string | undefined {
  try {
    return readFileSync(archivo, 'utf8').match(new RegExp(`^${clave}=(.*)$`, 'm'))?.[1]?.replace(/^["']|["']$/g, '')
  } catch {
    return undefined
  }
}
if (!process.argv.includes('--env=staging')) {
  console.error('Sólo corre contra staging: agregá --env=staging.')
  process.exit(1)
}
process.env.DATABASE_URL = leer('.env.staging.local', 'DATABASE_URL')
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-simulado'
process.env.MAESTRIA_PRECIO_MENSUAL_BLOQUE ||= '20000'
process.env.MAESTRIA_PRECIO_PASE_BLOQUE ||= '50000'
process.env.MAESTRIA_PRECIO_PASE_ALUMNO ||= '6000'

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)

async function main() {
  const docente = arg('docente')
  if (!docente) throw new Error('Falta --docente=<id>')
  const { sql } = await import('../../lib/db')
  const [env] = (await sql`SELECT environment FROM deployment_env LIMIT 1`) as { environment: string }[]
  if (env?.environment !== 'staging') throw new Error('Sólo contra una base marcada staging')
  const { iniciarCheckout, procesarNotificacion } = await import('../../lib/pagos-server')

  // El Mercado Pago falso: crea la preferencia y, al consultar, dice "aprobado"
  // con el monto que se pidió (lo recuerda de la preferencia).
  let referencia = ''
  let monto = 0
  const falso = async (url: string, init?: RequestInit) => {
    if (url.endsWith('/checkout/preferences')) {
      const cuerpo = JSON.parse(String(init?.body))
      referencia = cuerpo.external_reference
      monto = cuerpo.items[0].unit_price
      return new Response(JSON.stringify({ id: `pref-sim-${referencia}`, init_point: 'https://mp.simulado/real', sandbox_init_point: 'https://mp.simulado/sandbox' }))
    }
    return new Response(JSON.stringify({ id: `sim-${referencia}`, status: 'approved', external_reference: referencia, transaction_amount: monto }))
  }

  const checkout = await iniciarCheckout({
    userId: docente,
    email: null,
    pedido: arg('materia')
      ? { plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: Number(arg('materia')) }
      : { plan: 'particular', forma: 'mensual', cantidad: Number(arg('cantidad') ?? 1) },
    textoDelCodigo: arg('codigo') ?? '',
    urlBase: 'http://localhost:3000',
    pedir: falso,
  })
  console.log('1. checkout:', checkout)
  if (!checkout.ok) return
  console.log('2. webhook (aprobado):', await procesarNotificacion(`sim-${checkout.pagoId}`, falso))
  console.log('3. webhook repetido:', await procesarNotificacion(`sim-${checkout.pagoId}`, falso))

  const [pago] = (await sql`SELECT id, estado, monto_lista, monto, codigo, acreditado_el FROM pagos WHERE id = ${checkout.pagoId}`) as unknown[]
  const [usuario] = (await sql`SELECT plan_nivel, plan_vence_el, plan_tipo, fundadora_desde FROM users WHERE id = ${docente}`) as unknown[]
  const usos = (await sql`SELECT c.codigo, u.primer_uso_el FROM codigos_descuento_usos u JOIN codigos_descuento c ON c.id = u.codigo_id WHERE u.user_id = ${docente}`) as unknown[]
  console.log('4. pago:', pago)
  console.log('   docente:', usuario)
  console.log('   usos de códigos:', usos)
  if (arg('materia')) console.log('   la materia:', (await sql`SELECT id, subject_name, fecha_examen, pase_hasta FROM teacher_programs WHERE id = ${Number(arg('materia'))}`)[0])
  console.log(`   /precios/gracias?pago=${checkout.pagoId}`)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
