// K4: después de j4-generar, cierra el diálogo y deja a la vista la sección del diagnóstico de la ficha (sin recargar).
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const cerrar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Cerrar')
  if (!cerrar) throw new Error('No está "Cerrar"')
  cerrar.click()
  await esperar(2500)
  if (document.querySelector('[role="dialog"]')) throw new Error('El diálogo no se cerró')
  const seccion = document.querySelector('[aria-labelledby="ficha-diagnostico"]')
  seccion?.scrollIntoView({ block: 'start' })
  window.scrollBy(0, -70)
})()
