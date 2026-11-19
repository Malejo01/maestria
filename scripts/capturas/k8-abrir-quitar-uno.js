// K8: abre "Quitar" de NOMBRE_ALUMNO (sin confirmar) para ver su última actividad.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const nombre = window.NOMBRE_ALUMNO ?? 'Julieta Ocampo'
  let boton
  for (let i = 0; i < 40 && !boton; i++) {
    boton = document.querySelector(`button[aria-label="Quitar a ${nombre} de mis grupos"]`)
    if (!boton) await esperar(300)
  }
  if (!boton) throw new Error('No está el botón de quitar de ' + nombre)
  boton.click()
  await esperar(800)
})()
