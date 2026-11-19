// K5: completa la ficha (por id de campo que termina en -edad, -materia, -fecha, -evalua, -obs, y los de texto) y la guarda.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 40 && !document.querySelector('[id$="-edad"]'); i++) await esperar(300)
  const campo = (fin) => document.querySelector(`[id$="-${fin}"]`)
  const poner = (el, valor) => {
    if (!el) return
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  poner(campo('edad'), '16')
  poner(campo('institucion'), 'EET N.º 3')
  poner(campo('anioCursa'), '4.º año')
  poner(campo('orientacion'), 'Técnica en electrónica')
  poner(campo('materia'), String(window.MATERIA_ID ?? 13))
  poner(campo('fecha'), '2026-12-10')
  poner(campo('evalua'), 'Escrito de 2 horas, con ejercicios de fracciones y estadística.')
  poner(campo('obs'), 'Se traba con fracciones. Viene los martes.')
  await esperar(500)
  const guardar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Guardar la ficha')
  if (!guardar) throw new Error('No está "Guardar la ficha"')
  guardar.click()
  for (let i = 0; i < 30 && guardar.textContent.includes('Guardando'); i++) await esperar(300)
  await esperar(1500)
  guardar.scrollIntoView({ block: 'center' })
})()
