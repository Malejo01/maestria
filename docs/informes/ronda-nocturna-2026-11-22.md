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

**Gasto de IA acumulado de la noche:** US$0,029 (medido en `ai_usage_log` de staging: 18 llamadas, US$0,0285; más ~US$0,0005 del dry-run de N2, que no pasa por el registro) (tope: US$10; a los US$8 se pasa a modelos simulados).

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
4. Corrección en lote de las 18 preguntas marcadas de producción. Primero sólo mirar (no escribe; la IA sí se llama, ~US$0,01):
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

- Racha de Sofía en `rachas_alumno` (0, migrada del navegador) y su intento en "Lengua · 4to Año · 11/7/2026" (2/10).
- Temas "a reforzar" marcados como superados a mano por Irina: #58 (Tomás Villa) y #57 (Sofía Ramírez), los dos de Lengua. Se devuelven con "Volver a reforzar" en la ficha.

- De O1, por cada corrida de `npm run e2e`: una materia "E2E · Geografía <fecha>", un grupo "E2E · Grupo <fecha>" y la tarea "E2E · Geografía <fecha> - Práctico - …" de Irina, con el intento del invitado "E2E · Invitado <fecha>" (que ya no está en el grupo). Además, de la exploración: la materia "E2E · Geografía" y su grupo "E2E · Geografía" (se armó solo al compartir una tarea que no llegó a guardarse).
- Cuestionario **39 "Prueba N2 · tipos mal armados"** de Irina (Matemática, 3.º Sec.), ya corregido desde la pantalla.
- Invitado **"Prueba N1 Invitada"** (`guest_746f3dcd015289be8016e284589db685`) en el grupo Lengua de Irina, y su reporte **#2** (resuelto, aviso visto).
