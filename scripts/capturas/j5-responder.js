// J5: responde preguntas (la primera opción, o 1 en las numéricas). RESPONDER_CUANTAS en window, o todas.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const cuantas = window.RESPONDER_CUANTAS ?? 99
  for (let n = 0; n < cuantas; n++) {
    await esperar(400)
    const accion = [...document.querySelectorAll('button')].find((b) => ['Siguiente', 'Terminar'].includes(b.textContent.trim()))
    if (!accion) return
    const numero = document.querySelector('input[inputmode="decimal"], input[type="number"], input[inputmode="numeric"]')
    if (numero) {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(numero, '1')
      numero.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      // Cada opción es un botón alineado a la izquierda (components/quiz-answer-inputs).
      const opcion = document.querySelector('button.text-left')
      if (!opcion) throw new Error('No encontré opciones en la pregunta ' + (n + 1))
      opcion.click()
    }
    await esperar(300)
    const boton = [...document.querySelectorAll('button')].find((b) => ['Siguiente', 'Terminar'].includes(b.textContent.trim()))
    if (!boton || boton.disabled) throw new Error('No se pudo responder la pregunta ' + (n + 1))
    boton.click()
    await esperar(1200)
  }
})()
