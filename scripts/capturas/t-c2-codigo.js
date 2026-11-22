(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 80 && !document.querySelector('[data-total]'); i++) await esperar(250)
  if (!document.querySelector('[data-total]')) throw new Error('LISTA sin total: ' + document.body.innerText.slice(0, 300))
})()
