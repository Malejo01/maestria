// J1: abre la confirmación de "Quitar a los que nunca respondieron".
(async () => {
  const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('nunca respondieron'))
  if (!boton) throw new Error('No está el botón del lote')
  boton.click()
  await new Promise((r) => setTimeout(r, 600))
  if (!document.querySelector('[role="dialog"]')) throw new Error('No abrió el diálogo')
})()
