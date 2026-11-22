(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60 && !document.querySelector('form'); i++) await esperar(250)
  if (document.querySelector('[data-codigo="FUNDADORA-SIL"]')) return
  const set = (el, v) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  const f = document.querySelector('form')
  const [codigo, porcentaje, meses, usos, vence, nota] = [...f.querySelectorAll('input')].filter((i) => i.type !== 'checkbox')
  const [aplica, forma] = f.querySelectorAll('select')
  set(codigo, 'FUNDADORA-SIL'); set(porcentaje, '50'); set(aplica, 'particular'); set(forma, 'mensual'); set(meses, '6'); set(usos, '1')
  set(nota, 'Prueba en staging (ronda T, C1): el código de Silvana')
  f.querySelector('input[type=checkbox]').click()
  await esperar(200)
  f.querySelector('button[type=submit]').click()
  for (let i = 0; i < 40 && !document.querySelector('[data-codigo="FUNDADORA-SIL"]'); i++) await esperar(250)
  if (!document.querySelector('[data-codigo="FUNDADORA-SIL"]')) throw new Error('LISTA no se creó: ' + document.body.innerText.slice(0, 400))
})()
