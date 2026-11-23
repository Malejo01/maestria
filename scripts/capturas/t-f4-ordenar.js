(async () => {
  // La IA simulada: un ordenamiento (no gasta).
  const original = window.fetch
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [{ id: 'c4', type: 'ordering', topic: 't', topicName: 'Trabajo de campo', question: 'Ordená los pasos del trabajo de campo etnográfico.', items: ['Elegir el problema', 'Entrar al campo', 'Observar y registrar', 'Analizar los registros', 'Escribir la etnografía'], explanation: 'Del problema a la escritura.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent.trim()).startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-elemento-orden]'); i++) await esperar(250)
  await esperar(300)
  if (window.__VERIFICAR) {
    boton('Subir: Elegir el problema')?.click()
    await esperar(300)
    boton('Verificar').click()
    await esperar(1200)
  }
})()
