// K5: en /teacher?agregar=1, agrega a NOMBRE_ALUMNO (window, por defecto "Bruno Quiroga") en la materia MATERIA_ID y espera el link.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const nombre = window.NOMBRE_ALUMNO ?? 'Bruno Quiroga'
  let dialogo
  for (let i = 0; i < 40 && !(dialogo = document.querySelector('[role="dialog"] form')); i++) await esperar(300)
  if (!dialogo) throw new Error('No abrió "Agregar alumno"')
  const poner = (el, valor) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  const [campoNombre, campoContexto] = dialogo.querySelectorAll('input')
  poner(campoNombre, nombre)
  if (campoContexto) poner(campoContexto, 'Rinde la previa en diciembre')
  const select = dialogo.querySelector('select')
  if (select && window.MATERIA_ID) poner(select, String(window.MATERIA_ID))
  await esperar(300)
  dialogo.querySelector('button[type="submit"]').click()
  for (let i = 0; i < 40; i++) {
    await esperar(300)
    if (!document.querySelector('[role="dialog"] form')) return
  }
  throw new Error('No terminó de agregar')
})()
