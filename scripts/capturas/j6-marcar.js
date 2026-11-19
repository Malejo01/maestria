// J6: abre "Marcar los N temas que falló…" y confirma.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('que falló como tema'))
  if (!boton) throw new Error('No está el botón de marcar')
  boton.scrollIntoView({ block: 'center' })
  boton.click()
  await esperar(500)
  const confirmar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Sumarlos')
  if (!confirmar) throw new Error('No abrió la confirmación')
  if (window.SOLO_ABRIR) return
  confirmar.click()
  for (let i = 0; i < 30 && document.querySelector('[role="dialog"]'); i++) await esperar(300)
  await esperar(1500)
})()
