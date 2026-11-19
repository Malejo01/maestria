// J1: despliega la lista de quitados y la lleva a la vista.
(async () => {
  const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ver quitados'))
  if (!boton) throw new Error('No está "Ver quitados"')
  boton.click()
  await new Promise((r) => setTimeout(r, 400))
  const lista = [...document.querySelectorAll('section')].find((s) => s.getAttribute('aria-label')?.startsWith('Quitados'))
  lista?.scrollIntoView({ block: 'center' })
})()
