// J4: elige el modo (MODO_DIAGNOSTICO en window, por defecto por unidad), genera y espera a que termine.
(async () => {
  const modo = window.MODO_DIAGNOSTICO ?? 'por_unidad'
  document.querySelector(`input[name="modo-diagnostico"][value="${modo}"]`)?.click()
  await new Promise((r) => setTimeout(r, 300))
  const generar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes('Generar y asignar'))
  if (!generar) throw new Error('No está "Generar y asignar"')
  generar.click()
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const texto = document.querySelector('[role="dialog"]')?.textContent ?? ''
    if (/Listo\.|no se pudo generar|no se pudieron/.test(texto)) return
  }
  throw new Error('No terminó en 200 s')
})()
