/** Para `ANTES=` de scripts/capturas.mjs, en /history?tab=reforzar: abre el diálogo de la primera materia. */
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60; i++) {
    const tarjeta = [...document.querySelectorAll('.cursor-pointer')].find((e) => e.textContent.includes('Matemática'))
    if (tarjeta) {
      tarjeta.click()
      await esperar(800)
      if (document.querySelector('[role=dialog]')) return 'ok'
    }
    await esperar(250)
  }
  throw new Error('No apareció la tarjeta de temas a reforzar: ' + document.body.innerText.slice(0, 300))
})()
