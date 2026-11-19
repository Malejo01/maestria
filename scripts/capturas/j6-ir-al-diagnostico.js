// J6: lleva la sección Diagnóstico de la ficha a la vista.
(async () => {
  for (let i = 0; i < 30 && !document.getElementById('ficha-diagnostico'); i++) await new Promise((r) => setTimeout(r, 300))
  const titulo = document.getElementById('ficha-diagnostico')
  if (!titulo) throw new Error('No está la sección Diagnóstico')
  titulo.scrollIntoView({ block: 'start' })
  window.scrollBy(0, -70)
})()
