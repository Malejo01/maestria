// J4: abre "Armar diagnóstico" en la ficha.
(async () => {
  for (let i = 0; i < 20 && ![...document.querySelectorAll('button')].some((b) => /Armar (otro )?diagn/.test(b.textContent)); i++) {
    await new Promise((r) => setTimeout(r, 300))
  }
  const boton = [...document.querySelectorAll('button')].find((b) => /Armar (otro )?diagn/.test(b.textContent))
  if (!boton) throw new Error('No está "Armar diagnóstico"')
  boton.click()
  await new Promise((r) => setTimeout(r, 700))
  if (!document.querySelector('[role="dialog"]')) throw new Error('No abrió el diálogo')
})()
