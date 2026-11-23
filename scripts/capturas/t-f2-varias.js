(async () => {
  // La IA simulada: dos preguntas de varias correctas (no gasta).
  const original = window.fetch
  const opciones = ['Se aprende', 'Es innata', 'Se comparte', 'Es individual', 'Es simbólica']
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [{ id: 'c1', type: 'multiple_response', topic: 't', topicName: 'Rasgos de la cultura', question: '¿Cuáles son rasgos de la cultura para la antropología? Marcá todas las que correspondan.', options: opciones, correctAnswers: [0, 2, 4], explanation: 'La cultura se aprende, se comparte y es simbólica.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-opcion-varias]'); i++) await esperar(250)
  const casillas = document.querySelectorAll('[data-opcion-varias]')
  casillas[0].click()
  await esperar(100)
  casillas[1].click()
  await esperar(100)
  casillas[2].click()
  await esperar(300)
  if (window.__VERIFICAR) {
    boton('Verificar').click()
    await esperar(1200)
  }
})()
