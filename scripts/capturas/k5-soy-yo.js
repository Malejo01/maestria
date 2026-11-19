// K5: en /aula/[código], toca "Soy NOMBRE_ALUMNO" y espera a llegar a Mis aulas.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const nombre = window.NOMBRE_ALUMNO ?? 'Bruno Quiroga'
  let boton
  for (let i = 0; i < 40 && !boton; i++) {
    boton = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === `Soy ${nombre}`)
    if (!boton) await esperar(300)
  }
  if (!boton) throw new Error('No está "Soy ' + nombre + '"')
  boton.click()
  for (let i = 0; i < 60 && location.pathname !== '/aulas'; i++) await esperar(300)
  if (location.pathname !== '/aulas') throw new Error('No llegó a Mis aulas')
  for (let i = 0; i < 40 && !document.body.innerText.includes('Diagnóstico'); i++) await esperar(300)
})()
