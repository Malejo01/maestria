(async () => {
  // La IA simulada: un emparejamiento (no gasta).
  const original = window.fetch
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [{ id: 'c3', type: 'matching', topic: 't', topicName: 'Autores', question: 'Uní cada autor con su concepto.', pairs: [{ left: 'Clifford Geertz', right: 'Descripción densa' }, { left: 'Claude Lévi-Strauss', right: 'Estructuralismo' }, { left: 'Bronisław Malinowski', right: 'Observación participante' }, { left: 'Franz Boas', right: 'Particularismo histórico' }], distractors: ['Evolucionismo unilineal'], explanation: 'Cada autor con el concepto que lo identifica.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-pareja]'); i++) await esperar(250)
  const elegir = (i, valor) => {
    const s = document.querySelector(`[data-pareja="${i}"]`)
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    set.call(s, valor)
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }
  elegir(0, 'Descripción densa')
  elegir(1, 'Evolucionismo unilineal')
  elegir(2, 'Observación participante')
  elegir(3, 'Particularismo histórico')
  await esperar(300)
  if (window.__VERIFICAR) {
    boton('Verificar').click()
    await esperar(1200)
  }
})()
