/**
 * Para `ANTES=` de scripts/capturas.mjs: escribe tres temas a reforzar en el
 * progreso guardado del navegador (no en la base) y recarga. Va antes de
 * abrir-temas-a-reforzar.js. Sólo toca localStorage del navegador de capturas.
 */
(() => {
  const clave = 'maestria-storage'
  const guardado = JSON.parse(localStorage.getItem(clave) || '{"state":{},"version":0}')
  const progreso = guardado.state.userProgress || {}
  progreso.weakPoints = [
    { topic: 'reales', topicName: 'Números Reales: concepto, representación. Operaciones.', subject: 'Matemática', count: 3, nivel: 'Secundario', grado: '3er Año', misconceptionType: 'conceptual' },
    { topic: 'irracionales', topicName: 'Números Irracionales: Concepto. Representación de los números de la forma √n.', subject: 'Matemática', count: 2, nivel: 'Secundario', grado: '3er Año' },
    { topic: 'funcion', topicName: 'Función: concepto y lectura de gráficos.', subject: 'Matemática', count: 1, nivel: 'Secundario', grado: '3er Año' },
  ]
  guardado.state.userProgress = progreso
  localStorage.setItem(clave, JSON.stringify(guardado))
  setTimeout(() => location.reload(), 50)
  return 'ok'
})()
