(async () => {
  for (let i = 0; i < 30 && !document.body.innerText.includes('Por unidad, armado'); i++) await new Promise((r) => setTimeout(r, 300))
  const p = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Por unidad, armado'))
  if (!p) throw new Error('No está el diagnóstico por unidad')
  p.scrollIntoView({ block: 'start' })
  window.scrollBy(0, -70)
})()
