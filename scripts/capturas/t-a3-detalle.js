(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const nav = [...document.querySelectorAll('a,button')].find((x) => x.textContent.trim() === 'Mis materias')
  if (nav) nav.click()
  for (let i = 0; i < 80 && ![...document.querySelectorAll('p')].some((p) => /Matemática y su Didáctica/.test(p.textContent)); i++) await esperar(250)
  const p = [...document.querySelectorAll('p')].find((x) => /Matemática y su Didáctica/.test(x.textContent))
  if (!p) throw new Error('LISTA sin tarjeta: ' + document.body.innerText.slice(0, 300))
  const card = p.closest('[data-slot="card"]') || p.parentElement.parentElement
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await esperar(1500)
})()
