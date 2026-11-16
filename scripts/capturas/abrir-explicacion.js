/**
 * Para `ANTES=` de scripts/capturas.mjs, parado en /aulas con una alumna que
 * tenga una tarea disponible: empieza la tarea, contesta hasta errar una
 * pregunta de opción múltiple y abre "Explicar mi error con la IA".
 *
 * La explicación NO se le pide al modelo: se responde desde acá con un texto
 * fijo que trae los cuatro casos (encabezado, negrita, lista, fórmula), para
 * que la captura sea la misma cada vez y no gaste cuota.
 */
(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const boton = (texto) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes(texto) && !b.disabled)
  const hasta = async (fn, que) => {
    for (let i = 0; i < 60; i++) {
      const v = fn()
      if (v) return v
      await esperar(250)
    }
    throw new Error('No apareció: ' + que)
  }

  const EXPLICACION = [
    '## 1. ¿Por qué elegiste esta opción?',
    'Es **muy común** confundirse acá: sumaste los exponentes en lugar de mirar la base.',
    '',
    '## 2. Explicación paso a paso',
    '1. Identificá la **base** de cada potencia.',
    '2. Si las bases son iguales, sumá los exponentes: $x^2 \\cdot x^3 = x^{2+3}$.',
    '3. Escribí el resultado: $x^5$.',
    '',
    '### Para tener a mano',
    '- Producto de potencias: `a^m · a^n = a^(m+n)`',
    '- Cociente: $\\frac{a^m}{a^n} = a^{m-n}$',
    '',
    '$$x^2 \\cdot x^3 = x^5$$',
    '',
    '## 3. Tip para recordar',
    'Misma base, *se suman* los exponentes. Nunca se multiplican.',
  ].join('\n')

  const fetchReal = window.fetch
  window.fetch = (url, opciones) =>
    String(url).includes('/api/explain-error')
      ? Promise.resolve(
          new Response(JSON.stringify({ explanation: EXPLICACION, misconceptionType: 'Sumó los exponentes sin mirar la base', tipText: 'Misma base, se suman los exponentes.' }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      : fetchReal(url, opciones)

  ;(await hasta(() => boton('Empezar tarea') || boton('Seguir') || boton('Reintentar'), 'el botón de la tarea')).click()
  await hasta(() => boton('Verificar') || document.querySelector('button[class*="rounded"] span'), 'la primera pregunta')

  for (let pregunta = 0; pregunta < 20; pregunta++) {
    await esperar(600)
    // Las opciones son los botones que tienen la letra A–D en un <span>.
    const opciones = [...document.querySelectorAll('button')].filter((b) => /^[A-D]/.test(b.textContent.trim()) && b.querySelector('span'))
    if (opciones.length < 2) throw new Error('La pregunta no es de opción múltiple; este script sólo sabe errar esas.')
    opciones[opciones.length - 1].click()
    await esperar(200)
    ;(await hasta(() => boton('Verificar'), 'Verificar')).click()
    await hasta(() => boton('Siguiente') || boton('Ver resultados') || boton('Finalizar'), 'el resultado de la pregunta')
    const explicar = boton('Explicar mi error con la IA')
    if (explicar) {
      explicar.click()
      await hasta(() => document.querySelector('[role="dialog"] h3'), 'la explicación formateada')
      // El texto se revela de a poco: esperar a que esté entero.
      await hasta(() => document.querySelector('[role="dialog"] .katex-display'), 'la fórmula en bloque')
      await esperar(1500)
      return 'ok'
    }
    boton('Siguiente').click()
  }
  throw new Error('No erré ninguna pregunta.')
})()
