// J1: confirma el lote abierto por j1-lote.js y espera a que se relea el listado.
(async () => {
  const boton = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^Quitar a \d/.test(b.textContent.trim()))
  if (!boton) throw new Error('No está el botón de confirmar')
  boton.click()
  for (let i = 0; i < 40 && document.querySelector('[role="dialog"]'); i++) await new Promise((r) => setTimeout(r, 250))
  if (document.querySelector('[role="dialog"]')) throw new Error('El diálogo no se cerró')
  await new Promise((r) => setTimeout(r, 1500))
})()
