(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const chips = [...document.querySelectorAll('button[data-caracter]')]
  const chip = chips[1]
  if (!chip) throw new Error('LISTA sin chips')
  const antes = chip.dataset.caracter
  chip.focus()
  chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await esperar(500)
  const opcion = [...document.querySelectorAll('[role="menuitemradio"]')].find((x) => /Mixta/.test(x.textContent))
  if (!opcion) throw new Error('LISTA sin menú: ' + document.querySelectorAll('[role="menu"]').length)
  opcion.click()
  for (let i = 0; i < 40 && document.querySelectorAll('button[data-caracter]')[1]?.dataset.caracter === antes; i++) await esperar(250)
  const despues = document.querySelectorAll('button[data-caracter]')[1]?.dataset.caracter
  if (window.__soloLeer) throw new Error('LISTA ' + antes + ' -> ' + despues)
  await esperar(500)
})()
