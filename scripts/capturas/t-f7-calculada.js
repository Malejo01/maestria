(async () => {
  // La IA simulada: una calculada ya instanciada (no gasta).
  const original = window.fetch
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [{ id: 'c8', type: 'calculated', topic: 't', topicName: 'Precios', question: 'Un bien cuesta 250 pesos y su precio sube un 12 %. ¿Cuánto cuesta después de la suba?', plantilla: 'Un bien cuesta {p} pesos y su precio sube un {x} %. ¿Cuánto cuesta después de la suba?', formula: '{p} * (1 + {x} / 100)', variables: [{ name: 'p', min: 100, max: 900, decimals: 0 }, { name: 'x', min: 5, max: 25, decimals: 0 }], valores: { p: 250, x: 12 }, correctAnswer: 280, tolerance: 0.01, explanation: '250 × 1,12 = 280.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('input[inputmode="decimal"], input[type="text"]'); i++) await esperar(250)
  const campo = document.querySelector('input[inputmode="decimal"], input[type="text"]')
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(campo, '279,5')
  campo.dispatchEvent(new Event('input', { bubbles: true }))
  await esperar(300)
  boton('Verificar').click()
  await esperar(1200)
})()
