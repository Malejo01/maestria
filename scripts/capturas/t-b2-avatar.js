(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 60 && !document.querySelector('button[data-plan]'); i++) await esperar(250)
  await esperar(800)
  const a = document.querySelector('button[data-plan]')
  const r = a.getBoundingClientRect()
  const cap = a.querySelector('[data-distintivo]')?.getBoundingClientRect()
  document.body.style.zoom = '1'
  throw new Error('LISTA avatar ' + JSON.stringify({ top: r.top, left: r.left, w: r.width, cap: cap && { top: cap.top, h: cap.height }, scroll: document.documentElement.scrollWidth, ancho: innerWidth, label: a.getAttribute('aria-label') }))
})()
