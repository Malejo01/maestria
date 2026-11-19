// J5: abre "Diagnóstico integral" desde Mis tareas del alumno y pasa el aviso.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const titulo = window.DIAGNOSTICO_A_RENDIR ?? 'Diagnóstico integral'
  let boton
  for (let i = 0; i < 30 && !boton; i++) {
    const fila = [...document.querySelectorAll('li, article, section > div')].find((el) => el.textContent.includes(titulo) && el.querySelector('button'))
    boton = fila?.querySelector('button')
    if (!boton) await esperar(300)
  }
  if (!boton) throw new Error('No encontré la tarea ' + titulo)
  boton.click()
  for (let i = 0; i < 30; i++) {
    await esperar(300)
    const empezar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Empezar')
    if (empezar) {
      window.__avisoVisto = document.body.innerText.includes('Esto es un diagnóstico')
      empezar.click()
      await esperar(500)
      return
    }
  }
  throw new Error('No apareció el aviso del diagnóstico')
})()
