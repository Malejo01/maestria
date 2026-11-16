/** Para `ANTES=` de scripts/capturas.mjs, en /aulas: abre la primera tarea y espera la primera pregunta. */
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (texto) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.toLowerCase().includes(texto.toLowerCase()) && !b.disabled,
    )
  for (let i = 0; i < 80; i++) {
    const empezar = boton('Empezar tarea') || boton('Volver a hacerla') || boton('Seguir')
    if (empezar) {
      empezar.click()
      break
    }
    await esperar(250)
  }
  for (let i = 0; i < 80; i++) {
    if ([...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Verificar')) return 'ok'
    await esperar(250)
  }
  throw new Error('No apareció la primera pregunta.')
})()
