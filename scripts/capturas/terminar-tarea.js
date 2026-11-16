/**
 * Para `ANTES=` de scripts/capturas.mjs, parado en /aulas con una alumna que
 * tenga una tarea disponible: hace la tarea entera (contesta siempre lo
 * último que se ofrece, así que erra bastante), llega a la pantalla de
 * resultados y abre la lista de incorrectas.
 *
 * Escribe un intento de verdad en la base: sólo contra staging.
 */
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (texto) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.toLowerCase().includes(texto.toLowerCase()) && !b.disabled,
    )
  const hasta = async (fn, que) => {
    for (let i = 0; i < 80; i++) {
      const v = fn()
      if (v) return v
      await esperar(250)
    }
    const aLaVista = [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 30)).filter(Boolean)
    throw new Error(`No apareció: ${que}. Botones a la vista: ${aLaVista.join(' | ')}`)
  }
  const escribir = (campo, valor) => {
    const prototipo = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  }

  ;(await hasta(() => boton('Empezar tarea') || boton('Seguir') || boton('Reintentar') || boton('Volver a hacer'), 'el botón de la tarea')).click()
  await hasta(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Verificar'), 'la primera pregunta')

  for (let pregunta = 0; pregunta < 40; pregunta++) {
    await esperar(500)
    const opciones = [...document.querySelectorAll('button')].filter(
      (b) => /^[A-D]/.test(b.textContent.trim()) && b.querySelector('span') && !b.disabled,
    )
    const falso = boton('Falso')
    const campo = document.querySelector('main input:not([type=hidden]), main textarea, input[inputmode], textarea')
    if (opciones.length >= 2) opciones[opciones.length - 1].click()
    else if (falso) falso.click()
    else if (campo) escribir(campo, '0')
    else throw new Error('No sé contestar esta pregunta.')

    await esperar(200)
    ;(await hasta(() => boton('Verificar'), 'Verificar')).click()
    const sigue = await hasta(
      () => boton('Siguiente') || boton('Ver resultados') || boton('Finalizar') || boton('Terminar'),
      'cómo seguir después de verificar',
    )
    const eraLaUltima = !sigue.textContent.includes('Siguiente')
    // El botón aparece antes de que la respuesta termine de guardarse: un
    // click inmediato sobre "Ver Resultados" no hace nada.
    await esperar(900)
    sigue.click()
    if (eraLaUltima) break
    // La última pregunta también puede decir "Siguiente": si ya no hay
    // "Verificar" a la vista, se terminó.
    await esperar(700)
    if (![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Verificar')) break
  }

  // Reintento: a veces el primer click sobre "Ver Resultados" no cambia de
  // pantalla (no se llegó a saber por qué; a mano no pasa).
  for (let i = 0; i < 5 && boton('Ver resultados'); i++) {
    boton('Ver resultados').click()
    await esperar(1500)
  }
  await hasta(() => /\d+ de \d+ correctas/.test(document.body.textContent), 'la pantalla de resultados')
  await esperar(800)
  const incorrectas = [...document.querySelectorAll('[data-slot="card"], div')].find(
    (d) => d.className.includes('cursor-pointer') && d.textContent.includes('Incorrectas'),
  )
  if (incorrectas) incorrectas.click()
  await esperar(600)
  const lista = [...document.querySelectorAll('h3')].find((h) => h.textContent.includes('Respuestas Incorrectas'))
  if (lista) lista.scrollIntoView({ block: 'start' })
  return 'ok'
})()
