// Saca del DOM el aviso de bienvenida de la prueba (sin cerrarlo: cerrarlo arranca la prueba) y lleva a la vista a NOMBRE_ALUMNO.
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  await esperar(2500)
  for (const d of document.querySelectorAll('[role="dialog"], [data-radix-portal], [data-state="open"][aria-hidden="true"]')) {
    if (d.textContent.includes('Rediseñamos')) (d.closest('[data-radix-portal]') ?? d).remove()
  }
  document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => el.removeAttribute('aria-hidden'))
  document.body.style.pointerEvents = ''
  for (const el of document.querySelectorAll('div.fixed.inset-0')) if (!el.querySelector('nav')) el.remove()
  const nombre = window.NOMBRE_ALUMNO ?? 'Bruno Quiroga'
  const fila = [...document.querySelectorAll('li, tr, article')].find((el) => el.textContent.includes(nombre) && !el.querySelector('li, article'))
  if (fila) { fila.scrollIntoView({ block: 'center' }); window.__fila = fila.innerText }
})()
