(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const g = [...document.querySelectorAll('[data-separar-tema] button')].find((b) => b.textContent.trim() === 'Guardar')
  g.click()
  for (let i = 0; i < 40 && document.querySelector('[data-separar-tema]'); i++) await esperar(250)
  await esperar(500)
})()
