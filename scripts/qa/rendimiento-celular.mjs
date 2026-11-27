// Tanda AA · AA3 — Rendimiento de una página en celular, como lo mide Lighthouse
// (que no está instalado en esta máquina): Chromium de Playwright, pantalla de
// celular, CPU 4 veces más lenta y red "4G lenta" (150 ms, 1,6 Mbps). Mide FCP,
// LCP, CLS y el bloqueo del hilo principal (TBT) y calcula el puntaje con las
// curvas de Lighthouse 10 para móvil (FCP 10 %, SI 10 %, LCP 25 %, TBT 30 %,
// CLS 25 %; el Speed Index se aproxima con el FCP). Es una aproximación: sirve
// para saber si está lejos o cerca de 85, no para reemplazar a Lighthouse.
//
// Correr contra un BUILD de producción (next build + next start), no contra
// `next dev`, que no minifica ni comprime:
//   node scripts/qa/rendimiento-celular.mjs http://localhost:3100/profes [veces=3]
import { chromium } from '@playwright/test'

const url = process.argv[2]
const veces = Number(process.argv[3] ?? 3)
if (!url) {
  console.error('Uso: node scripts/qa/rendimiento-celular.mjs <url> [veces]')
  process.exit(1)
}

// Curva log-normal de Lighthouse: puntaje entre 0 y 1 para un valor, dado p10 y la mediana.
function puntaje(valor, p10, mediana) {
  if (valor <= 0) return 1
  const INVERSA_ERFC_UN_QUINTO = 0.9061938024368232
  const ubicacion = Math.log(mediana)
  const forma = Math.abs(Math.log(p10) - ubicacion) / (Math.SQRT2 * INVERSA_ERFC_UN_QUINTO)
  const z = (Math.log(valor) - ubicacion) / (Math.SQRT2 * forma)
  // erfc aproximada (Abramowitz y Stegun 7.1.26)
  const t = 1 / (1 + 0.3275911 * Math.abs(z))
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z)
  const erfc = z >= 0 ? y : 2 - y
  return Math.min(1, Math.max(0, erfc / 2))
}

const navegador = await chromium.launch()
const resultados = []
for (let i = 0; i < veces; i++) {
  const contexto = await navegador.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  })
  const pagina = await contexto.newPage()
  const cdp = await contexto.newCDPSession(pagina)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await pagina.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, tbt: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50) }).observe({ type: 'longtask', buffered: true })
  })
  await pagina.goto(url, { waitUntil: 'load', timeout: 120_000 })
  await pagina.waitForTimeout(3000)
  const m = await pagina.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    return { fcp, lcp: window.__m.lcp, cls: window.__m.cls, tbt: window.__m.tbt }
  })
  const s = {
    fcp: puntaje(m.fcp, 1800, 3000),
    si: puntaje(m.fcp * 1.1, 3387, 5800),
    lcp: puntaje(m.lcp, 2500, 4000),
    tbt: puntaje(m.tbt, 200, 600),
    cls: puntaje(m.cls, 0.1, 0.25),
  }
  const total = Math.round(100 * (0.1 * s.fcp + 0.1 * s.si + 0.25 * s.lcp + 0.3 * s.tbt + 0.25 * s.cls))
  resultados.push({ ...m, total })
  console.log(`corrida ${i + 1}: FCP ${Math.round(m.fcp)} ms · LCP ${Math.round(m.lcp)} ms · TBT ${Math.round(m.tbt)} ms · CLS ${m.cls.toFixed(3)} → ≈ ${total}`)
  await contexto.close()
}
await navegador.close()
const mediana = resultados.map((r) => r.total).sort((a, b) => a - b)[Math.floor(resultados.length / 2)]
console.log(`Puntaje aproximado (mediana de ${resultados.length}): ${mediana}`)
