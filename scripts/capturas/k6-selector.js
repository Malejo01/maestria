// K6: muestra abiertas, como lista, las opciones del selector "Materia" de la ficha (un <select> no sale abierto en una captura).
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  let select
  for (let i = 0; i < 40 && !(select = document.querySelector('select[id$="-materia"]')); i++) await esperar(300)
  if (!select) throw new Error('No está el selector de materia')
  select.size = select.options.length
  select.style.height = 'auto'
  select.scrollIntoView({ block: 'center' })
  window.__opciones = [...select.options].map((o) => o.textContent)
})()
