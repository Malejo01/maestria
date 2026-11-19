// J7: marca bien / mal / sin responder según window.MARCAS_IMPRESO (por defecto bien, bien, mal, bien, mal, y la última sin tocar).
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 30 && !document.querySelector('[role="radiogroup"]'); i++) await esperar(300)
  const grupos = [...document.querySelectorAll('[role="radiogroup"]')]
  if (grupos.length === 0) throw new Error('No están las preguntas')
  const marcas = window.MARCAS_IMPRESO ?? ['Bien', 'Bien', 'Mal', 'Bien', 'Mal']
  marcas.forEach((m, i) => [...(grupos[i]?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === m)?.click())
  await esperar(300)
  if (window.GUARDAR_IMPRESO) {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Guardar resultados')?.click()
    for (let i = 0; i < 30 && !document.body.innerText.includes('Guardado.'); i++) await esperar(300)
    if (!document.body.innerText.includes('Guardado.')) throw new Error('No se guardó')
  }
  window.scrollTo(0, document.body.scrollHeight)
})()
