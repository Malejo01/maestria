(async () => {
  // La IA simulada: los dos tipos de huecos (no gasta). window.__ARRASTRAR elige cuál.
  const original = window.fetch
  const comun = { topic: 't', topicName: 'Mercado', explanation: 'Es la ley de la demanda.', text: 'Si sube el [[1]] de un bien, baja la [[2]] demandada: la curva de [[3]] tiene pendiente negativa.', choices: ['precio', 'cantidad', 'demanda', 'oferta', 'renta'] }
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = [window.__ARRASTRAR ? { ...comun, id: 'c6', type: 'ddwtos', question: 'Poné cada palabra en su hueco.' } : { ...comun, id: 'c5', type: 'gapselect', question: 'Completá el texto con las palabras que faltan.' }]
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent.trim()).startsWith(t))
  for (let i = 0; i < 40 && !boton('Práctica de hoy'); i++) await esperar(250)
  boton('Práctica de hoy').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-hueco]'); i++) await esperar(250)
  await esperar(200)
  if (window.__ARRASTRAR) {
    document.querySelector('[data-palabra="0"]').click()
    await esperar(150)
    document.querySelector('[data-hueco="1"]').click()
    await esperar(150)
    document.querySelector('[data-palabra="2"]').click()
    await esperar(300)
  } else {
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    for (const [h, v] of [[1, '0'], [2, '3']]) {
      const s = document.querySelector(`[data-hueco="${h}"]`)
      set.call(s, v)
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }
    await esperar(300)
  }
})()
