# O13 · Primer uso de un docente nuevo, sin ayuda (22/11/2026)

Recorrido con Playwright, a 390 px, como un docente **recién registrado** en staging (`o13-docente-…`, sin rol ni materias): desde "¿Cómo entrás?" hasta tener alumnos y la primera tarea respondida. La IA de la generación estaba simulada. Capturas en [docs/capturas/o13-primer-uso/](../capturas/o13-primer-uso/), numeradas en el orden del recorrido.

## El camino, paso por paso

| # | Pantalla | Qué hace falta | Veredicto |
|---|---|---|---|
| 01 | ¿Cómo entrás? | "Soy docente" | Claro |
| 02, 03a | Panel con "Primeros pasos (0 de 4)" y la bienvenida de la prueba de 30 días | "Empezar los 30 días", "Crear mi materia" | Claro: la guía dice qué hacer |
| 03c | ¿Cómo querés armar tu temario? (archivo, plan oficial, escribirlo) | Elegir | Claro |
| 03–04 | Asistente de materia (nivel y año → materia → temario → cómo la das) | Cuatro pasos | Claro; la metodología es obligatoria y lo dice |
| 05–06 | "Sumá a tu primer alumno" → "El link para tu alumno" | Copiar el link | Claro; el grupo se crea solo |
| 07–08 | El alumno entra con su nombre y ve "Mis tareas" vacío | — | Claro |
| 09–10 | "Armá tu primera tarea" → "Elegí una materia" | Tocar la única materia | **Un paso de más** (ver propuestas) |
| 10b–13 | Temas → cantidad y tipo → ¿Qué querés hacer? → Mandar la tarea | Cuatro decisiones | Funciona; **el botón de generar estaba tapado** (arreglado) |
| 14 | La tarea ya está en el grupo (link + mensaje de WhatsApp) | — | Claro |
| 15–16 | El alumno hace la tarea y ve "Guardado" | — | Claro |
| 17 | El docente ve al alumno con actividad "hoy" y la campanita con avisos (O10) | — | Claro |

## Arreglado en este PR (texto o lugar de un botón)

1. **"Generar cuestionario" tapado por la barra inferior a 390.** La barra fija de abajo de "Armar tarea" estaba en `bottom-0` y la navegación del celular (Mis alumnos / Mis materias / Mis tareas) la tapaba entera: un docente nuevo en el celular **no podía generar su primera tarea** (Playwright no lo pudo tocar). Ahora se corre lo que mide la barra (`--alto-barra-inferior`, la misma variable que usa el botón de reportar) y el contenido tiene más margen abajo. Lo mismo vale para la práctica del alumno en `/aulas`, que usa el mismo componente.
2. **La tarjeta de la materia no era un botón.** En "Elegí una materia" (y en Mis materias) la tarjeta se elegía con un clic sobre un `div`: con teclado o lector de pantalla no se podía elegir (sólo aparecían "Editar materia" y "Eliminar materia"). Ahora hay un botón "Elegir Geografía" que cubre la tarjeta, con `aria-pressed`, y los botones de las esquinas quedan encima.

## Propuestas (cambios de flujo: no se tocaron)

1. **Con una sola materia, "Armar la primera tarea" debería entrar directo a esa materia** (captura 10). Hoy muestra "Elegí una materia" con una sola opción. Recomendación: elegirla sola cuando hay una.
2. **"Quitar a los que nunca respondieron (1)" aparece con el primer alumno recién entrado** (captura 09). Para un docente nuevo es lo primero que ve debajo de su único alumno, y lo invita a quitarlo. Recomendación: mostrarlo sólo con alumnos que entraron hace más de 7 días.
3. **"+ Alumno" en la barra antes de tener una materia** (capturas 02 y 03a). Lleva a "Primero armá tu materia". Recomendación: mientras no haya materia, que la barra no lo muestre (la guía ya ofrece el paso correcto).
4. **Al terminar la primera tarea, el aviso sigue diciendo "Cuando tus alumnos la resuelvan…"** aunque ya la resolvió uno (captura 17). Menor; recomendación: cambiar el texto cuando haya al menos un intento.

## No se encontró

El "Crear grupo" escondido del 21/11 ya no aparece en este camino: el grupo se crea solo al invitar al primer alumno, y "Mis grupos" tiene "Crear grupo" arriba (M3).
