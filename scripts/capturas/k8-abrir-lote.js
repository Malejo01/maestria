// K8: abre "Quitar a los que nunca respondieron" (sin confirmar) para ver a quiénes y su última actividad.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  let boton
  for (let i = 0; i < 40 && !boton; i++) {
    boton = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('nunca respondieron'))
    if (!boton) await esperar(300)
  }
  if (!boton) throw new Error('No está el botón del lote')
  boton.click()
  await esperar(800)
  if (!document.querySelector('[role="dialog"]')) throw new Error('No abrió la confirmación')
})()
