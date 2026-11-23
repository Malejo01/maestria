(async () => {
  // La IA simulada: una palabra faltante (no gasta).
  const original = window.fetch
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [{ id: 'c7', type: 'missing_word', topic: 't', topicName: 'Elasticidad', question: 'Elegí la palabra que falta.', text: 'Cuando la cantidad demandada casi no cambia ante una suba del precio, la demanda es [[1]].', options: ['inelástica', 'elástica', 'unitaria', 'perfectamente elástica'], correctAnswer: 0, explanation: 'Si la cantidad casi no responde al precio, la demanda es inelástica.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-oracion-con-hueco]'); i++) await esperar(250)
  document.querySelectorAll('[role="radio"]')[0].click()
  await esperar(400)
})()
