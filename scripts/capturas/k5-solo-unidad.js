// K5: en "Armar diagnóstico" (por unidad), deja tildada sólo la unidad UNIDAD (window, por defecto "Unidad III").
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const unidad = window.UNIDAD ?? 'Unidad III'
  await esperar(300)
  const casillas = [...document.querySelectorAll('[role="dialog"] input[type="checkbox"]')]
  if (casillas.length === 0) throw new Error('No hay unidades para elegir')
  for (const c of casillas) {
    const quiero = (c.closest('label')?.textContent ?? '').includes(unidad)
    if (c.checked !== quiero) c.click()
    await esperar(80)
  }
})()
