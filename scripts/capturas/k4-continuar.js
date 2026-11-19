// K4: en la pantalla de resultados, "Continuar" (vuelve a Mis aulas sin navegar) y espera; deja a la vista la tarea DIAGNOSTICO_A_RENDIR.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  let continuar
  for (let i = 0; i < 60 && !continuar; i++) {
    continuar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continuar')
    if (!continuar) await esperar(500)
  }
  if (!continuar) throw new Error('No llegó a resultados')
  await esperar(1500)
  continuar.click()
  await esperar(3000)
  const titulo = window.DIAGNOSTICO_A_RENDIR ?? 'Diagnóstico'
  const fila = [...document.querySelectorAll('li, article')].find((el) => el.textContent.includes(titulo))
  if (!fila) throw new Error('No encontré la tarea ' + titulo)
  fila.scrollIntoView({ block: 'center' })
  window.__textoTarea = fila.innerText
})()
