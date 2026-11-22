(async () => {
  // La IA simulada: no gasta. Diez preguntas de prueba y el simulacro de 10 en 15 minutos.
  const original = window.fetch
  window.fetch = (url, init) => {
    if (String(url).includes('/api/generate-quiz')) {
      const questions = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, type: 'multiple_choice', topic: 't', topicName: 'El concepto de cultura', question: 'Según Geertz, ¿cómo se entiende la cultura? (' + (i + 1) + ')', options: ['Como una trama de significados', 'Como una herencia biológica', 'Como un conjunto de objetos', 'Como el arte de una élite'], correctAnswer: 0, explanation: 'Geertz la define como una trama de significados.' }))
      return Promise.resolve(new Response(JSON.stringify({ questions }), { headers: { 'Content-Type': 'application/json' } }))
    }
    return original(url, init)
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 40 && ![...document.querySelectorAll('button')].some((b) => b.textContent.includes('10 preguntas en 15 minutos')); i++) await esperar(250)
  ;[...document.querySelectorAll('button')].find((b) => b.textContent.includes('10 preguntas en 15 minutos')).click()
  for (let i = 0; i < 40 && ![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Empezar'); i++) await esperar(250)
  if (window.__SOLO_AVISO) return
  ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Empezar').click()
  for (let i = 0; i < 40 && !document.querySelector('[role="timer"]'); i++) await esperar(250)
  await esperar(2500)
})()
