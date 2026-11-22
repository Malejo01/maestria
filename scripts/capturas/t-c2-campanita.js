(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60 && !document.querySelector('button[aria-label^="Avisos"]'); i++) await esperar(250)
  const b = document.querySelector('button[aria-label^="Avisos"]')
  if (!b) throw new Error('LISTA sin campanita')
  await esperar(1500)
  b.click()
  await esperar(1200)
})()
