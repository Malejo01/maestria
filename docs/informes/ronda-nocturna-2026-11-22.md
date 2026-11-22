# Ronda nocturna O · 22/11/2026 — informe de la mañana

Trabajo en loop sin supervisión, desde las 00:40 (hora de Argentina). Una rama desde `main` por ítem, PR, merge con el CI en verde. **Nada contra producción**: toda migración corrió sólo en staging, dos veces.

## Estado ítem por ítem

| Ítem | Estado | PR | Qué se probó | Gasto de IA |
|---|---|---|---|---|
| N1 · Aviso al que reportó (migración 030) | hecho | [#74](https://github.com/Malejo01/maestria/pull/74) | Tests de permisos, del texto y del componente; en staging, de punta a punta con un invitado (ver abajo) | US$0 (no llama a la IA) |
| N2 · Corregir en lote las preguntas marcadas | hecho | [#75](https://github.com/Malejo01/maestria/pull/75) | Tests con el modelo simulado (sí/no → afirmación, abierta → opción múltiple, valor de verdad cambiado → rechazada, sin aplicar no se escribe); en staging, dry-run del script y "Aplicar" desde *Mis tareas* | US$0,004 |
| O1 · Pruebas de punta a punta (Playwright) | hecho | [#76](https://github.com/Malejo01/maestria/pull/76) | Los 6 recorridos en verde contra `npm run dev:staging` (7 pruebas + limpieza, 2,1 min) | US$0 (IA simulada) |
| O2 · Cerrar el ciclo de "A reforzar" (migración 031) | hecho | [#77](https://github.com/Malejo01/maestria/pull/77) | Tests de la regla con nombres reales de temas, del servidor y de permisos; simulación sobre staging; el docente marcó un tema desde la ficha; "Ya lo dominás" de Sofía; `npm run e2e` en verde | US$0 |
| O3 · La práctica del grupo usa la materia del grupo | hecho | [#78](https://github.com/Malejo01/maestria/pull/78) | Tests de los parámetros, los ejemplos por carrera y la persona de didáctica; 3 + 3 prácticas con IA real antes/después; `npm run e2e` en verde | US$0,025 |
| O4 · Textos viejos del alumno y la racha en la base (migración 032) | hecho | [#79](https://github.com/Malejo01/maestria/pull/79) | Tests de la regla, el servidor (válvula) y la migración desde el navegador; en staging Sofía hizo una tarea: racha migrada y anotada; capturas a 390; `npm run e2e` en verde | US$0 |
| O5 · Los cuestionarios viejos muestran fracciones | hecho | [#80](https://github.com/Malejo01/maestria/pull/80) | Tests de la fracción simple (exacta y periódica), cómo se muestra y la corrección con las dos formas; en staging, la revisión del cuestionario 26 muestra "5/12 (0,4167 ± 0,001)"; `npm run e2e` en verde | US$0 |
| O6 · Reporte de diagnóstico parametrizado por programa | hecho | [#81](https://github.com/Malejo01/maestria/pull/81) | Test de caracterización del 10/08 escrito antes de cambiar nada (sigue igual); vínculo por temas con tests; en staging, el 10/08 leído contra "Matemática · 3er Año" de Irina | US$0 |
| O7 · Traer alumnos de otro grupo | hecho | [#82](https://github.com/Malejo01/maestria/pull/82) | Tests del diálogo y de la API (sólo los elegidos, origen propio, plan vencido); en staging Irina trajo a Sofía de Lengua a "Prueba M3"; `npm run e2e` en verde | US$0 |
| O8 · Pulgar arriba / abajo del docente (migración 033) | hecho | [#83](https://github.com/Malejo01/maestria/pull/83) | Tests de la regla de recorte, la API (propio, válvula), y que la generación recibe "Evitá esto" (lo del cuerpo se ignora); en staging Irina valoró dos preguntas del cuestionario 39; contador en `/admin/ai-usage` | US$0 |
| O9 · Informe del grupo para imprimir | hecho | [#84](https://github.com/Malejo01/maestria/pull/84) | Tests de la parte pura; en staging el informe de Lengua ordenado por promedio, en modo impresión | US$0 |
| O10 · Avisos al docente dentro de la app (migración 034) | hecho | [#85](https://github.com/Malejo01/maestria/pull/85) | Tests de los textos, el orden, los no leídos y la válvula; en staging la campanita de Irina con avisos reales | US$0 |
| O11 · Títulos de unidad en la misma línea que los temas | hecho | [#86](https://github.com/Malejo01/maestria/pull/86) | Tests con el caso de la tanda I y casos que no se tocan; test de la ruta `extract` | US$0 |
| O12 · El embudo del docente | hecho | [#87](https://github.com/Malejo01/maestria/pull/87) | Tests de la ubicación, el orden y el conteo, y el 404 para no admins; en staging, con los 7 docentes | US$0 |
| O13 · Primer uso de un docente nuevo sin ayuda | hecho | [#88](https://github.com/Malejo01/maestria/pull/88) | Recorrido con Playwright a 390 de punta a punta en staging (docente recién creado → alumno → tarea → resultado); 2 arreglos, 4 propuestas | US$0 (IA simulada) |
| O14 · Medición de calidad de la generación | hecho | [#89](https://github.com/Malejo01/maestria/pull/89) | 22 cuestionarios con IA real en staging; "fuera de tema" 8 % → corregido en la generación → re-medido 0 % | US$0,16 |
| O19 · Limpieza: placeholders de v0 | hecho | [#90](https://github.com/Malejo01/maestria/pull/90) | `grep` sin referencias (sólo el roadmap); build en verde | US$0 |
| O15 · Esquema que usa el código contra staging | hecho | [#91](https://github.com/Malejo01/maestria/pull/91) | Test manual contra `information_schema` de staging: en verde; en el CI se salta | US$0 |
| O16 · La barra en 360, 390 y 768 px | hecho | [#92](https://github.com/Malejo01/maestria/pull/92) | `e2e/anchos.spec.ts` en visitante, alumno y docente: antes, la barra del docente desbordaba 21 px a 360; ahora en verde | US$0 |
| O17 · Accesibilidad con axe-core | hecho | (este PR) | `e2e/accesibilidad.spec.ts`: 7 problemas graves en panel docente, grupo, pregunta y resultados; corregidos, en verde | US$0 |

**Gasto de IA acumulado de la noche:** US$0,19 (US$0,0285 en `ai_usage_log` de staging — 18 llamadas desde la app —, más US$0,157 de los scripts de O14 y US$0,0005 del dry-run de N2, que llaman al modelo directo y no pasan por el registro; los scripts imprimen su gasto estimado con la misma tarifa) (tope: US$10; a los US$8 se pasa a modelos simulados).

## Detalle

### N1 · Aviso al que reportó

- Migración **030** (`scripts/030-aviso-de-reporte.sql`, runner `scripts/run-migration-030.ts`): `respuesta`, `respondido_por`, `resuelto_el`, `aviso_visto_el` en `feedback_reports`, índice parcial de pendientes y backfill de `resuelto_el` (no de `aviso_visto_el`: Clarita tiene que recibir el suyo). Se agregó **`respondido_por`**, que no estaba en el SQL del encargo: sin esa columna no hay forma de escribir "Mauro te dejó un mensaje" sin dejar el nombre fijo en el código.
- Probado en staging: un invitado ("Prueba N1 Invitada") reportó la pregunta 2 de "Prueba M1 · sin conexión"; Irina (admin temporal por `.env.development.local`, ya borrado) lo pasó a visto y a resuelto con mensaje; el invitado vio el aviso en `/aulas` a 390 y 1280; tocó Entendido; la API devolvió `[]`, la base guardó `aviso_visto_el`, y al recargar no apareció más. El buzón muestra "Lo vio el 22/11".
- Un error que encontró la prueba en staging y no los tests: con la 030 corrida, la consulta del buzón tenía columnas ambiguas (`f.*` ya las traía). Corregido antes del PR.

### N2 · Corregir en lote

- Endpoint `POST /api/teacher/quizzes/[id]/corregir-tipos` (no escribe): primero la regla de M2, después el modelo (`generateObject` + Zod, el modelo del generador), verificado: sin marcas de `problemaDeTipo`, mismo `topic`, y en verdadero o falso el modelo declara el valor de verdad y el servidor lo compara. Lo que no pasa queda como estaba, con el motivo.
- *Mis tareas* muestra "Corregir N preguntas" en cada cuestionario con marcas; *Revisar y editar*, arriba. El diálogo muestra antes → después con una casilla por pregunta. En *Mis tareas*, Aplicar guarda (con intentos ya hechos: copia y mueve las asignaciones, como *Revisar y editar*); en *Revisar y editar*, lo deja en pantalla sin guardar.
- **Numérica que pide palabras** (no estaba en el encargo): se pasa a opción múltiple, como la de verdadero o falso abierta.
- **Dry-run en staging** (cuestionario de prueba 39 con los casos reales del 20/11):
  ```
  Pregunta 1 · verdadero o falso escrito como pregunta · IA
    antes:   Aplicando el criterio de divisibilidad, ¿es el número 1.242 divisible por 9?  (V)
    después: El número 1.242 es divisible por 9 porque la suma de sus cifras es 9.  (V)
  Pregunta 2 · verdadero o falso con una pregunta abierta · IA
    después: opción múltiple, la correcta «El sentido de la desigualdad se invierte.»
  Pregunta 3 · pide un valor y la respuesta es un conjunto · regla (sin IA)
    después: Determiná el conjunto solución de $3x + 4 \leq 10$.  (+ las formas de intervalo)
  Pregunta 4 · verdadero o falso escrito como pregunta · IA
    antes:   ¿Es 91 un número primo?  (F)
    después: El número 91 es un número primo.  (F)
  marcadas: 4 · con corrección: 4 · ~US$0,0005
  ```
  La pregunta 1 traía la justificación pegada ("porque…"): el pedido ahora lo prohíbe, y en la corrida desde la pantalla salió "El número 1.242 es divisible por 9.".

### O1 · Pruebas de punta a punta

- `npm run e2e` (Playwright 1.63.0, el de los navegadores ya instalados: no se bajó nada). Seis recorridos en `e2e/`; la IA está simulada. Documentado en el README. No entra al CI.
- La primera corrida pasó los 6 recorridos. Datos en staging: una materia, un grupo y una tarea "E2E · …" por corrida (el invitado se quita del grupo al final, para no llenar el tope de 10 alumnos del plan de prueba de Irina).
- El smoke test de Auth.js del backlog queda cubierto en lo que no necesita Google (alumno bloqueado en `/teacher` y su API, sin sesión → afuera). **El login real con Google y el cambio de rol ALUMNO↔DOCENTE siguen siendo manuales de Mauro.**

### O2 · "A reforzar"

- **Regla automática** ([lib/a-reforzar.ts](../../lib/a-reforzar.ts), pura): un tema sale con **3 aciertos seguidos en ese tema del programa**, en intentos que **empezaron** después del error (el intento donde se cometió el error termina después y no cuenta). Un error en ese tema corta la racha; las respuestas de otros temas o sin ubicar no la cortan ni la suman; una respuesta corta sin corregir no cuenta.
- **El puente respuesta → tema del programa**: el `topic_name` de la respuesta contra `quiz_attempts.topics[]` (los temas del programa que se eligieron para ese intento, que salen de `teacher_programs`/`curriculum`): igual normalizado, o contenido con sentido (2 palabras y 8 letras) y único; si no, y el intento tenía un solo tema, ése; si no, **no cuenta**. Decisión: los "temas del programa" se toman de `quiz_attempts.topics[]` y no leyendo `teacher_programs.units` aparte: son los mismos nombres y ya están en la fila del intento.
- **Simulación sobre staging** (sin escribir): 40 temas pendientes de 24 alumnos; de 1.206 respuestas, 597 se ubican con certeza; la regla resolvería 1 hoy. La regla corre al guardar cada intento nuevo: no hay backfill (decisión conservadora; ver pendientes).
- **Manual**: "Ya lo superó" / "Volver a reforzar" en la ficha del alumno que se abre desde la planilla del grupo (`PATCH /api/teacher/classrooms/[id]/students/[userId]`). Probado en staging con Tomás Villa (grupo Lengua): quedó `resolved_by = stg-user-0008`.
- **Alumno**: en `/history`, pestaña "A reforzar", lo superado sale de la lista y pasa a "Ya lo dominás", plegado (Sofía, en las capturas).
- **Migración 031**: `resolved_at`, `resolved_by`; corrida dos veces en staging. Sin ella, todo marca `resolved` igual.

### O3 · Práctica del grupo

- En `/aulas`, la práctica dentro de un grupo manda **nivel, año y carrera del programa del grupo** (nunca del perfil) y **no manda tipos de pregunta** hasta que el alumno toca el selector ([lib/practica-del-grupo.ts](../../lib/practica-del-grupo.ts), puro). "No aplica" (lo que guarda el asistente sin carrera) no cuenta como carrera. Fuera de un grupo nada cambia.
- `buildProfessionalContextSection`: los ejemplos de Sistemas sólo para Sistemas; el Profesorado tiene ejemplos de aula de primaria; otra carrera, la regla sin ejemplos; sin carrera, nada.
- **Superior + Matemática en didáctica**: si la materia, alguna unidad o la mitad de los temas son de didáctica (`esContenidoDeDidactica`), la persona es "Profesor/a de Didáctica de la Matemática en un profesorado", sin demostraciones y con una rúbrica de fundamentación didáctica. Vale también para la corrección de respuesta corta y "Explicar error" cuando la materia es de didáctica (se reconoce por el nombre).
- **IA real, antes/después** (12 generaciones, US$0,025; detalle en [docs/calidad/o3-antes-despues.md](../calidad/o3-antes-despues.md)): en Sistemas, las preguntas situadas en el dominio pasaron de 0-1 de 5 a 3-5 de 5 ("en una base de datos de usuarios, el conjunto A…"); en el Profesorado aparecen situaciones de aula ("un estudiante afirma que entre 5 y 6 hay un natural: ¿qué intervención docente…?"); ninguna pide demostrar.
- **Ojo:** en staging el Profesorado no tiene contexto profesional cargado en `curriculum` (sólo Sistemas): la mejora del Profesorado viene del nivel correcto y la persona de didáctica.

### O4 · Textos del alumno y racha

- **Resultados**: la tarjeta de la racha dice "Racha" y "Aprobaste 3 cuestionarios seguidos." / "Cuando apruebes un cuestionario, empieza tu racha." (fuera "Aprobá 2 seguidos para activarla"); "Explicar Error" → "Explicame el error". **Mi progreso**: "Evaluaciones" → "Cuestionarios", "Evaluaciones recientes" → "Lo último que hiciste", el filtro de modos dice "Todos" y entra en un renglón a 390 (32 px de alto, sin desborde). Todo en `lib/textos.ts` (`RACHA`, `RESULTADOS`, `MI_PROGRESO`).
- **La racha en la base** (migración **032**, `rachas_alumno`, una fila por alumno; no existe racha por materia): `save-result` la anota en una sola sentencia atómica (la regla de siempre, `siguienteRacha`, pura) y la devuelve; al entrar, la app la lee una vez por pestaña y, si la base no tiene la de ese alumno, **la del navegador pasa una sola vez**. Un invitado que crea su cuenta se la lleva. Sin la 032, la de siempre del navegador.
- Staging: Sofía entró, su racha del navegador (0) pasó a la base (`migrada_de_local`), hizo una tarea (2/10) y la fila se anotó.
- **Lo encontró la prueba y no es de este ítem:** a 390 px el botón flotante "Reportar un problema" tapa el borde derecho de "Siguiente" en el cuestionario (Playwright no pudo tocarlo). Ya figuraba como punto (4) de la tanda H; sigue abierto.
- La pestaña "A reforzar (3)" cuenta los puntos débiles del navegador y la tarjeta "A reforzar 0" los de la base: no coinciden. Viene de antes (no lo tocó O4); con O2 se acercan, pero los del navegador siguen siendo otra fuente.

### O5 · Fracciones en los cuestionarios viejos

- `respuestaNumerica` ([lib/numeros.ts](../../lib/numeros.ts)): una `numeric` sin `fraccion` cuyo decimal es una fracción simple (denominador ≤ 20, exacta o periódica de máquina, `fraccionSimple`) se muestra "3/4 (0,75)". Con margen, sólo si es periódica ("5/12 (0,4167 ± 0,001)": ahí el margen es redondeo); "3,5 ± 0,1" es una medida y queda igual. Vale en todas las pantallas que ya usaban la función (campo del alumno, resumen, Mi progreso, revisión, hoja impresa). **No se reescribe ningún dato.**
- La corrección ya aceptaba las dos formas (K2: `3/4`, `6/8` y `0,75` valen para 0,75; `11/12` para la periódica): quedó fijado con tests.
- No encontré el cuestionario 34 de producción en staging (allá el 34 es otro); el caso equivalente es el 26 de Irina (5/12 con margen 0,001), que antes se mostraba "0,4167 (± 0,001)".
- De paso: la prueba e2e del invitado se iba a `/aulas` antes de que el intento terminara de guardarse (falló una vez de cuatro); ahora espera el "Guardado".

### O6 · Diagnóstico por programa

- Primero un **test de caracterización** del reporte del 10/08 (`lib/diagnostic-report-server.test.ts`): unidades, orden, vínculos, textos y totales como salen hoy. Pasa igual después del cambio: `/teacher/diagnostico` sin elegir nada se ve como siempre.
- `vinculoConPrograma` ([lib/diagnostic-report.ts](../../lib/diagnostic-report.ts), puro): cada unidad del diagnóstico se vincula con la unidad del programa que comparte más temas (comparados como en O2) o que se llama igual; si ninguna, "no aparece en el programa". El mapa a mano (`DIAGNOSTIC_UNIT_PROGRAM_MAP`) queda sólo como la lectura original del 10/08.
- `/teacher/diagnostico` suma "Leer contra el programa de" con las materias del docente; la API acepta `?programa=<id>` (sólo materias propias; otra → 404). El renglón "Faltan 5 de las 7 unidades… lógica, conjuntos" (escrito para Sistemas) se oculta cuando se lee contra otra materia.
- Lo que no cubre: la fecha sigue fija (10/08) y el currículum de origen también (Secundario 4.º); parametrizar eso es el paso siguiente si aparece otro diagnóstico de curso fuera de los grupos (los de L4 ya se leen por grupo).

### O7 · Traer alumnos de otro grupo

- Ya existía "Sumar alumnos de otro grupo" (M3), que copiaba el grupo **entero** con un `select`. Ahora es **"Traer alumnos de otro grupo"**: un `Dialog` donde se elige el grupo y, con casillas, a quiénes (cuentas e invitados; los que ya están no se pueden tildar). El botón final es la confirmación ("Traer 3 alumnos a …"). No los saca del grupo de origen.
- La API (`POST /api/teacher/classrooms/[id]/members`) suma `userIds` (sin ellos, todos, como antes; lista vacía → 400; sólo cuenta quien está activo en el origen).
- **Tope del plan:** traer alumnos propios no suma personas al conteo (cada alumno cuenta una vez en todos los grupos), así que no puede pasarse del cupo; con el plan vencido el endpoint frena como siempre (402 y pantalla de límite).
- Lo encontró la captura: a 390 el botón con un nombre de grupo largo desbordaba el diálogo; corregido.

### O8 · Pulgares del docente

- En *Revisar y editar*, debajo de cada pregunta: "Está bien" / "Está mal"; el segundo pide el motivo con chips (*Fuera del programa, Mal redactada, Respuesta incorrecta, Muy fácil, Muy difícil, Tipo equivocado*) y se guarda al elegirlo. Tocar el marcado lo saca. Con cambios sin guardar, los pulgares esperan (el servidor valora lo guardado).
- Migración **033**: `pregunta_valoraciones` (docente, cuestionario, materia, índice, valor, motivo, la consigna como estaba, fecha; una por pregunta y docente).
- **"Evitá esto"**: los últimos 10 pulgares abajo de ese docente en esa materia entran al prompt (generar, regenerar una pregunta, armar diagnóstico, y la práctica de sus alumnos en el grupo), cargados en el servidor. Regla de recorte (`seccionEvitar`, con test): los más nuevos, hasta 10; cada consigna hasta 220 caracteres; el total hasta 1.800, y el renglón que no entra entero no entra.
- `/admin/ai-usage` suma el contador de pulgares abajo por motivo (y el total de arriba).
- Sin la 033: no se ven guardados, guardar responde 503 con el motivo, y la generación sigue sin la sección.

### O9 · Informe para imprimir

- En la página del grupo, **"Imprimir informe"** abre `/teacher/grupos/[id]/imprimir` (en `(focus)`, sin la barra de la app) con el **orden y el filtro de la planilla** que había (se pasan por la URL, M4). Tres partes: la planilla (las mismas columnas que el CSV, con una línea que dice cómo está ordenada y filtrada), los temas flojos del grupo (del más flojo al menos) y las tareas con "18 de 25" (las individuales no van). CSS de impresión como la hoja del diagnóstico; **nada de PDF en el servidor**: el navegador imprime o guarda como PDF.

### O10 · Avisos al docente

- Una **campanita** en la barra del docente (no en la vista previa de alumno) con el número de avisos sin ver. Abierta, la lista de las últimas dos semanas, del más nuevo al más viejo: "8 alumnos de Matemática 1 Virtual terminaron «Práctica…»" (por tarea y por día), "3 alumnos nuevos entraron a 1er Año" (por grupo y por día), "Reportaron un problema en …" (M6). Cada uno lleva a su grupo. Abrirla marca todo como visto.
- Se calcula de lo que ya hay (intentos, miembros, reportes); lo único nuevo es `users.avisos_docente_visto_el` (migración **034**). Sin la 034, todo cuenta como no leído. No hay correo ni push.
- "Una alumna reportó…" del pedido quedó "Reportaron un problema": el reporte no guarda el género, y al docente no se le dice quién reportó (M6).
- A 390 la barra no entraba con la campanita (el botón de la cuenta quedaba cortado): en celular la campanita mide 40 px y los botones van más juntos; medido, sin desborde.
- Lección de la noche: al traer `main` con `stash pop`, dos ítems que suman textos en el mismo lugar de `lib/textos.ts` chocan. En O9 se commiteó con las marcas (resuelto en el mismo PR); desde O10 se verifica antes de commitear.

### O11 · Títulos de unidad

- `separarTituloDeUnidad` ([lib/nombre-de-unidad.ts](../../lib/nombre-de-unidad.ts)): "Unidad 2: Funciones. Dominio, imagen, ceros" → unidad "Unidad 2: Funciones" con los temas "Dominio", "Imagen", "Ceros" (adelante de los que tuviera); y "Unidad 2" pelado con un primer tema "Funciones. Dominio, imagen" → "Unidad 2: Funciones" (sólo si lo de antes del punto es corto). No se tocan un título solo, un guion largo, un decimal, "Nº." ni un tema con punto en una unidad con título. Aplicado en la normalización de `extract` y `guide`, y en la lectura heurística (donde la unidad quedaba sin temas y se descartaba).
- No encontré programas de la tanda I en `docs/` ni fixtures en el repo: el caso del pedido quedó como test (de la función y de la ruta `extract` con la IA simulada).

### O12 · Embudo del docente

- `/admin/embudo` (sólo `ADMIN_EMAILS`; link en el menú del admin): el embudo (cuántos docentes alcanzaron cada paso) y la lista por docente con su paso y hace cuántos días. **Los trabados más de 3 días en un paso que no es el último van arriba, con su email**, los de más días primero. Pasos: se registró → creó una materia → creó un grupo → mandó la primera tarea → el primer alumno la hizo → 5 alumnos activos (el quinto alumno distinto que hizo una tarea suya). Todo de las tablas que ya existen ([lib/embudo.ts](../../lib/embudo.ts), puro; [lib/embudo-server.ts](../../lib/embudo-server.ts)).
- No se saltean pasos: un docente con tarea pero sin grupo queda en "Creó una materia".

### O13 · Primer uso del docente

- Informe aparte con el camino paso por paso y las capturas: [o13-primer-uso-docente.md](o13-primer-uso-docente.md).
- **Arreglado:** (1) a 390, el botón **"Generar cuestionario" quedaba tapado por la barra inferior** de navegación: un docente nuevo en el celular no podía generar su primera tarea (y lo mismo la práctica del alumno, que usa el mismo componente); (2) la tarjeta de la materia en "Elegí una materia" no era un botón (teclado y lector de pantalla no podían elegirla).
- **Propuestas** (cambios de flujo, no tocados): elegir sola la única materia en "Armar la primera tarea"; no ofrecer "Quitar a los que nunca respondieron" con alumnos recién entrados; esconder "+ Alumno" hasta tener materia; cambiar el texto del aviso de la primera tarea cuando ya hay un intento.

### O14 · Calidad de la generación

- Script `scripts/qa/medir-calidad.ts --env=staging` (sólo staging; no escribe): genera con el núcleo de la app y mide con los validadores existentes. Grilla: Primario y Secundario de Matemática, y en Superior Matemática (Sistemas), Matemática y su Didáctica y Programación; teórico y práctico; 8 preguntas con los cuatro tipos. Salieron **22** cuestionarios (de 24 previstos: un par de unidades no tenía temas en staging).
- Resultado completo en [docs/calidad/2026-11-22.md](../calidad/2026-11-22.md): **0 %** en tipo (M2), dos resultados (K3), factorización (L3) y repetidas, y **0 de 22** GIFT con errores (M5).
- **"Fuera de tema" dio 8 %** (Secundario 25 %): eran preguntas del tema pedido con el nombre **acortado por el modelo** ("Cuerpos", "Semejanza", "Números Reales: Operaciones"). Se corrigió en la generación: `anclarTema` deja cada pregunta con el id y el nombre del tema pedido cuando se ubica con certeza. **Re-medido sólo ese caso: 0 %** ([re-medición](../calidad/2026-11-22-remedicion.md)). Efecto de paso: las respuestas nuevas quedan con el `topic_name` del programa, que es lo que necesita el puente de "A reforzar" (O2) y el reporte de temas.

### O15 · Tipos y esquema

- Los tipos `Db*` de `lib/db.ts` **ya no existen**: se borraron el 25/08 (estaban desalineados y no los usaba nadie); la convención es una interfaz por consulta. Lo que sí se puede verificar es que lo que nombran las consultas exista: `tests/esquema-real.test.ts` compara contra `information_schema` de staging (1) las tablas y columnas que declaran las migraciones y (2) una lista, a mantener con cada migración nueva, de las columnas que nombra el código (incluidas las de esta noche). En verde. No entra al CI: se corre con `$env:ESQUEMA_REAL="1"; npx vitest run tests/esquema-real.test.ts`.
- De paso, `check-schema-drift` mostró que la 031 y la 032 figuraban en staging "con el archivo cambiado" (retoqué comentarios después de correrlas): se volvieron a correr en staging (son idempotentes) y quedaron con el archivo final.

### O16 · Anchos chicos

- `xs:` ya no aparece en ninguna clase: la navbar que lo usaba (`components/navbar.tsx`) se borró con los cuatro contextos de navegación, y `/history` se arregló el 25/08. No hizo falta definir el breakpoint.
- Lo que sí había: **a 360 px la barra del docente se salía 21 px** (modo, campanita de O10, "+ Alumno" y el menú de la cuenta no entraban) y la página tenía scroll horizontal. Ahora la separación y el margen de la barra son más chicos sólo en el celular, y "+ Alumno" tiene menos relleno debajo de 640 px.
- Nuevo `e2e/anchos.spec.ts`: a 360, 390 y 768 px, en visitante (`/`), alumno (`/aulas`, `/practicar`, `/history`) y docente (las tres secciones del panel y la página del grupo), nada de la barra queda fuera de la pantalla y la página no tiene scroll horizontal. Ignora lo que está dentro de un carril con scroll propio (las pestañas del grupo, a propósito). Capturas en `docs/capturas/o16-anchos/`.
- De paso: quedaba un invitado "E2E" activo en el grupo de Irina de una corrida de las 02:57 cuya limpieza falló; lo pasé a `removed` (dato de prueba de esta ronda).

### O17 · Accesibilidad

- `@axe-core/playwright` 4.14.0 (devDependency, ~1 paquete más: `axe-core`, que ya es el estándar para esto; no entra al bundle). Nuevo `e2e/accesibilidad.spec.ts`: WCAG 2.1 A y AA en el panel docente (sus tres secciones), la página del grupo, una pregunta del cuestionario y la pantalla de resultados. **Falla con `serious` o `critical`**; lo `moderate`/`minor` queda anotado en el reporte de Playwright.
- Encontrado y corregido:
  1. *Mis alumnos*: la fila entera era un enlace con `aria-label="Ver la ficha de X"` que no incluía lo que se ve (nombre, contexto, fecha) — WCAG 2.5.3. Ahora el texto "Ver la ficha de" va oculto delante del contenido.
  2. *Grupo*: "Copiar link" tenía como nombre "Copiar **el** link del grupo X": ahora empieza por lo que dice el botón.
  3. *Grupo*: "Sin actividad" en gris suave sobre el fondo de "flojo": contraste insuficiente.
  4. *Pregunta*: el botón de salir (la X) **no tenía nombre** (critical) y la barra de avance tampoco.
  5. *Resultados*: la etiqueta "A seguir practicando" (rojizo sobre su tinte) y "20 % de aciertos" (gris sobre el fondo de "flojo"): contraste insuficiente.
- La prueba de la alumna hace la tarea "Lengua · 4to Año" (sin tope de intentos) con Sofía en staging: le suma intentos de prueba (ver datos de prueba).

## Pasos manuales de Mauro, en orden

1. Migración 030 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-030.ts
   ```
   Después, entrar a `/admin/reportes` → Resueltos: los 9 tienen que decir "Aviso pendiente" (el de Clarita) o "Sin aviso: lo reportó un admin" (los 8 tuyos).
2. Migración 031 en producción (después de la 030):
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-031.ts
   ```
3. Migración 032 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-032.ts
   ```
4. Migración 033 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-033.ts
   ```
5. Migración 034 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-034.ts
   ```
6. Corrección en lote de las 18 preguntas marcadas de producción. Primero sólo mirar (no escribe; la IA sí se llama, ~US$0,01):
   ```powershell
   npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20
   ```
   Si lo que propone está bien, aplicarlo (los cuestionarios con intentos, como el 41, se guardan como copia y sus asignaciones pasan a la copia; las respuestas ya hechas no cambian):
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20 --aplicar
   ```

## Decisiones que quedaron pendientes

(se completa al cierre)

## Datos de prueba que quedaron en staging

- Dos valoraciones de Irina en el cuestionario 39 (pregunta 1 arriba; pregunta 2 abajo, "Muy fácil"): entran al prompt de su Matemática 3.º Sec.
- Docente **"Docente Nueva O13"** (`o13-docente-mwrhwcrc`) con su materia Geografía, su grupo (código D8X5QT), una tarea y cuatro invitados "Alumno O13" (uno con la tarea hecha).
- Sofía también quedó en el grupo 4 "Prueba M3 · Matemática 1 Virtual" (traída desde Lengua en la prueba de O7).
- Racha de Sofía en `rachas_alumno` (0, migrada del navegador) y su intento en "Lengua · 4to Año · 11/7/2026" (2/10).
- Temas "a reforzar" marcados como superados a mano por Irina: #58 (Tomás Villa) y #57 (Sofía Ramírez), los dos de Lengua. Se devuelven con "Volver a reforzar" en la ficha.

- De O1, por cada corrida de `npm run e2e`: una materia "E2E · Geografía <fecha>", un grupo "E2E · Grupo <fecha>" y la tarea "E2E · Geografía <fecha> - Práctico - …" de Irina, con el intento del invitado "E2E · Invitado <fecha>" (que ya no está en el grupo). Además, de la exploración: la materia "E2E · Geografía" y su grupo "E2E · Geografía" (se armó solo al compartir una tarea que no llegó a guardarse).
- Cuestionario **39 "Prueba N2 · tipos mal armados"** de Irina (Matemática, 3.º Sec.), ya corregido desde la pantalla.
- Invitado **"Prueba N1 Invitada"** (`guest_746f3dcd015289be8016e284589db685`) en el grupo Lengua de Irina, y su reporte **#2** (resuelto, aviso visto).
