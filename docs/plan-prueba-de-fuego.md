# Plan post prueba de fuego — 30 alumnos, diagnóstico de matemática

Relevado el **2026-08-12** sobre lo que dejó la corrida del **2026-08-10 (22:05 – 23:42 UTC)**
con 30 alumnos de Análisis de Sistemas. Las causas de abajo no son hipótesis: cada una está
confirmada contra Sentry (`personal-667/maestria`, release `a3bb055`) y contra la base de
producción (`noisy-smoke-23995229`, marcada `production` en `deployment_env`).

---

## Resumen de lo medido

| # | Síntoma reportado | Causa raíz confirmada | Evidencia |
|---|---|---|---|
| 1 | "Reportar problema" no envía | La tabla `feedback_reports` **no existe en producción**: la migración 019 nunca se corrió | `NeonDbError: relation "feedback_reports" does not exist` (MAESTRIA-Z) + `information_schema` de producción |
| 2 | El botón flota encima de "Siguiente" | `FeedbackButton` es `fixed bottom-4 right-4 z-[45]`; la barra de acción del quiz es `fixed bottom-0 … z-20`. Se superponen y el botón gana el click | [components/feedback-button.tsx:149](../components/feedback-button.tsx#L149) vs [components/quiz-engine.tsx:579](../components/quiz-engine.tsx#L579) |
| 3 | Respuestas correctas marcadas como incorrectas | El corrector de IA falló ~224 veces y el cliente **falla cerrado**: cualquier error se persiste como respuesta incorrecta | 225 de 238 `short_answer` incorrectas en la base (94,5%) + 224 `AI_NoObjectGeneratedError` en Sentry |
| 4 | Números y fracciones no se toman | Dos caminos distintos: en `short_answer` es el mismo fallo de (3) más la falta de normalización; en `numeric` es el `<input type="number">` y la tolerancia ausente | `acceptedAnswers` como `["7/2","3.5"]`, `["1/3"]`, `["7/4","\\frac{7}{4}","1.75"]` |

**Hallazgo no reportado por los alumnos, y es el de mayor volumen:** 305 eventos de
`MissingCSRF: CSRF token was missing during an action signin` en `POST /api/auth/signin/google`
(MAESTRIA-9), primero a las 22:05 y último a las 23:42 del 10/08 — exactamente la ventana del
examen. Más 10 `InvalidCheck: pkceCodeVerifier` y 4 `CallbackRouteError` en el callback.
Está en estado *escalating*. No sabemos todavía cuántos alumnos no pudieron entrar por esto.

---

## 1 — El botón de reportes (roto de deploy, no de código)

El endpoint y el componente están bien. Lo que falta es que la migración corra:
`scripts/019-feedback-reports.sql` tiene runner (`scripts/run-migration-019.ts`) y nunca se
aplicó. La 020 **sí** está aplicada (`users.teacher_tour_seen_at` existe), así que es un hueco
puntual, no un atraso general.

Consecuencias que arrastra:

- Cada reporte que escribieron los alumnos durante la prueba **se perdió**. No hay cola ni
  reintento: el `INSERT` explota, el handler devuelve 500 y el texto muere en el navegador.
- `docs/deuda-tecnica.md` (sección "Riesgos latentes") anota que `scripts/anonymize-staging.ts`
  todavía no borra `feedback_reports`. Hoy eso es inocuo porque la tabla no existe. **En cuanto
  se corra la 019 deja de serlo**: el próximo clon de producción a staging se lleva texto libre
  escrito por alumnos reales. Las dos cosas van juntas o no van.

Lo que hay que agregar para que no se repita: nada de esto se detecta hoy. `tests/migrations.test.ts`
valida la **numeración** de los `.sql`, no que estén **aplicados**. Falta un chequeo de "las tablas
que declara el último `.sql` existen en el target".

---

## 2 — El botón tapa "Siguiente" en el celular

La geometría, en números:

- Barra de acción del quiz: `fixed bottom-0 left-0 right-0 p-4` con botones `h-14` → ocupa de
  0 a ~88 px desde el borde inferior, todo el ancho.
- Botón de reporte: `fixed bottom-4 right-4` (`sm:bottom-6`), `h-12` → ocupa de 16 a 64 px.
  **Está íntegramente dentro de la banda de la barra**, sobre la mitad derecha.
- `z-[45]` contra `z-20`: el botón flotante se queda con el click.

En horizontal es peor y por una razón concreta: el label está oculto con `sm:hidden`, y `sm:`
es un breakpoint de **ancho**. Al girar el teléfono el ancho pasa de 640 px, aparece
"Reportar problema", y el botón crece de ~56 px a ~200 px — tapa la mayor parte de "Siguiente".
Y el panel abierto es `w-[calc(100vw-2rem)]` sin `max-height`: en horizontal cubre la pantalla
entera sin scroll.

Arreglo propuesto:

1. Durante el quiz (`activeView === 'quiz'`) el botón **no flota**: vive en el header sticky del
   quiz, que ya es `z-20` y tiene lugar. Fuera del quiz sigue flotando como hoy.
2. Si se prefiere mantenerlo flotando, el offset tiene que ser dinámico y contemplar
   `env(safe-area-inset-bottom)`, no un `bottom-4` fijo.
3. El label deja de depender sólo del ancho: `sm:` reemplazado por una condición que también
   mire la altura, para que girar el teléfono no haga aparecer texto.
4. El panel gana `max-h-[80dvh] overflow-y-auto`.

---

## 3 — Respuesta corta: el 94,5% de las respuestas está mal calificado

Los números de producción, sobre `quiz_answers`:

| Tipo | Correctas | Incorrectas | % correcto |
|---|---|---|---|
| `multiple_choice` | 366 | 602 | 38% |
| `true_false` | 202 | 128 | 61% |
| `numeric` | 63 | 193 | 25% |
| **`short_answer`** | **13** | **225** | **5%** |

Un 5% no es una señal pedagógica, es un sistema roto. Y calza casi exacto con los 224
`AI_NoObjectGeneratedError` de `/api/quiz/grade-short-answer` en la misma ventana.

**La cadena completa, con el eslabón exacto de cada paso:**

1. `generateObject` pide un objeto a `gemini-2.5-flash` con `maxOutputTokens: 500`
   ([route.ts:47](../app/api/quiz/grade-short-answer/route.ts#L47)). Es el valor más bajo de todo
   el repo — el resto de las rutas usa entre 2000 y 8000.
2. El modelo gasta ese presupuesto en *thinking tokens* y la respuesta sale cortada. El evento de
   Sentry lo muestra literal: `JSON parsing failed: Text: { "isCorrect` — 14 caracteres.
3. La ruta responde 500.
4. El cliente hace `const data = await response.json()` **sin mirar `response.ok`**, y después
   `Boolean(data.isCorrect)` ([quiz-engine.tsx:237](../components/quiz-engine.tsx#L237)). Un 500
   trae `{ error: … }`, así que `data.isCorrect` es `undefined` → `false`.
5. Ese `false` se persiste en `quiz_answers` y cuenta en el score. **El `catch` ni siquiera se
   ejecuta** — no hubo excepción — así que el alumno tampoco ve el mensaje "no se pudo corregir".

Hay evidencia directa de falsos negativos en los datos:

| Respuesta del alumno | Aceptadas | Resultado |
|---|---|---|
| `9` | `["9"]` | ❌ marcada incorrecta |
| `parabola\n` | `["Parábola", "Parabola"]` | ❌ marcada incorrecta |

Normalizando mayúsculas, tildes y espacios, **11 respuestas coinciden literalmente con una
aceptada y están marcadas como incorrectas**. Ese es el piso, no el total: las que son correctas
por significado y no por letra no se pueden contar con una query.

**Arreglo en tres capas, en este orden:**

1. **Corrector determinista antes de la IA.** Normalizar (trim, minúsculas, sin tildes, espacios
   colapsados, puntuación final y delimitadores LaTeX fuera) y comparar contra `acceptedAnswers`.
   Si coincide → correcto, sin llamar al modelo. Esto mata de raíz el caso de la tilde y el de la
   mayúscula, baja la latencia y la factura, y hace que el 100% del tráfico de IA sea sólo para
   los casos que de verdad necesitan criterio.
2. **Arreglar la llamada:** subir `maxOutputTokens` a ~2000 y acotar el thinking
   (`providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } }` — soportado en
   `@ai-sdk/google@3`), más un reintento.
3. **Fallar abierto, no cerrado.** Si el corrector no puede corregir, la respuesta queda
   **sin calificar**, no incorrecta: `isCorrect: null`, fuera del score, con un aviso al alumno y
   una marca visible para vos en el informe del aula. Requiere tocar el tipo `Answer` y
   `save-result`. Esto es lo que evita que un problema de infraestructura se convierta en una
   nota injusta.

**Aparte, un problema de contenido:** varias `acceptedAnswers` vienen en LaTeX crudo
(`$x > 0$`, `\\frac{7}{4}`, `$P(A \\cap B) = P(A)P(B)$`). Ningún alumno va a tipear eso, y además
se le muestra así en "respuesta esperada". La generación tiene que exigir siempre una variante en
texto plano, y la comparación tiene que despojar los delimitadores.

---

## 4 — Números y fracciones

Se parte en dos, porque son dos motores distintos:

**En `short_answer`** — mismo fallo que (3), más la falta de equivalencia numérica. Las
`acceptedAnswers` reales de la prueba incluyen `["7/2","3.5"]`, `["1/10","0.1"]`,
`["7/4","\\frac{7}{4}","1.75"]`, `["1/3"]`. Un alumno que escribe `3,5` o `1/3` o `0.33` tiene que
dar correcto. Hace falta un evaluador: si la respuesta y alguna aceptada parsean como número
(fracción `a/b`, coma decimal, porcentaje, `\frac{}{}`), se comparan con tolerancia relativa.

**En `numeric`** — el input es `<input type="number">` y `Number(raw)`
([numeric-input.tsx:19](../components/quiz-answer-inputs/numeric-input.tsx#L19)). Dos problemas:

- En un teclado en español la coma es el separador decimal natural. Chrome devuelve `""` para
  `1,5` en un `type="number"` → `onChange(null)` → **el botón "Verificar" queda deshabilitado sin
  explicar por qué**. El alumno ve que escribió algo y que el botón no responde.
- Una fracción es imposible de escribir.
- `tolerance` es opcional en el schema y la IA casi nunca la manda: de todas las respuestas
  numéricas de la prueba, sólo una tiene tolerancia. El resto compara flotantes por igualdad
  exacta, así que cualquier resultado no entero es inganable.

Arreglo: input de texto con parser tolerante (coma, fracción, `%`, signo, espacios), tolerancia
relativa por defecto cuando la esperada no es entera, y eco de lo interpretado ("leímos: 3,5")
para que el alumno vea qué entendió el sistema antes de confirmar.

Advertencia honesta: revisé las respuestas `numeric` incorrectas y **la mayoría son errores
genuinos** (respondieron 2 donde iba 8). El arreglo acá saca fricción y desbloquea decimales; no
va a mover el 25% a un 80%.

---

## Fases

### Fase 0 — Desbloqueo inmediato *(sin código, ~15 min)*

1. Correr `scripts/run-migration-019.ts` contra producción (pide tipear el project id, es a
   propósito).
2. En el mismo movimiento, agregar `DELETE FROM feedback_reports` a `scripts/anonymize-staging.ts`.

Con esto el botón de reportes funciona hoy, antes de tocar una línea de la app.

### Fase 1 — Corregir, en paralelo *(4 agentes simultáneos)*

Cuatro tareas con conjuntos de archivos disjuntos, cada una con sus propios tests:

| Agente | Alcance | Archivos (dueño exclusivo) |
|---|---|---|
| **A** | Corrector determinista de texto: normalización + equivalencia | `lib/short-answer-grading.ts` *(nuevo)* + su test |
| **B** | Parser numérico: coma, fracción, %, LaTeX, tolerancia relativa | `lib/numeric-answer.ts` *(nuevo)* + su test |
| **C** | Layout móvil: botón de reporte, landscape, safe-area, panel con scroll | `components/feedback-button.tsx`, `components/quiz-engine.tsx` |
| **D** | Robustez de la ruta de corrección: tokens, thinking, reintento | `app/api/quiz/grade-short-answer/route.ts` |

A y B son módulos puros sin dependencias: son los que mejor se prueban solos y los que después
usan todos los demás.

### Fase 2 — Integrar *(1 agente, secuencial)*

Depende de que A, B y D estén mergeados. Acá se cablea:

- A y B dentro de la ruta de corrección (determinista primero, IA sólo si no hay coincidencia).
- B dentro de `isCorrectNumeric` y del input numérico.
- **Fail-open en el cliente**: chequear `response.ok`, estado "sin calificar" en lugar de
  incorrecta, tipo `Answer` extendido y `save-result` al día.
- **Las dos formas de un porcentaje en `acceptedAnswers`.** `parseNumericAnswer` lee `33%` como
  0,33 — el símbolo se interpreta como "dividido cien", que es lo que hace que `50%` y `1/2` sean
  la misma respuesta. El costo conocido: si la consigna pregunta "¿qué porcentaje…?" y la
  respuesta esperada está cargada sólo como `33`, el alumno que escribe `33%` da distinto. El
  arreglo no va en el parser — adivinar la unidad desde el enunciado es exactamente lo que no
  queremos — sino en la generación: `PROMPT_FIELD_BLOCKS.short_answer` de
  [app/api/generate-quiz/route.ts](../app/api/generate-quiz/route.ts) tiene que exigir que una
  respuesta porcentual venga siempre en las dos formas (`["33%", "0.33"]`), igual que ya conviene
  que exija una variante en texto plano al lado de cada expresión en LaTeX.

No se paraleliza: es el punto donde todo converge en `quiz-engine.tsx` y en `lib/types.ts`.

### Fase 3 — Verificar y blindar *(3 agentes simultáneos)*

| Agente | Alcance |
|---|---|
| **E** | Verificación en preview: mobile 375×812 y landscape, screenshots del antes/después, quiz completo de punta a punta |
| **F** | Guardia de migraciones: chequeo de que las tablas del último `.sql` existen en el target, para que un 019 sin correr no vuelva a pasar inadvertido |
| **G** | Los dos issues abiertos que nadie reportó: los 305 `MissingCSRF` del login y el `ReferenceError: DialogDescription is not defined` de `/teacher` (MAESTRIA-4, Seer lo marca *high*) |

### Fase 4 — Devolverle la nota justa a los 30 *(1 agente, con tu OK explícito)*

Script de re-corrección offline sobre los `quiz_answers` de tipo `short_answer` de la prueba, con
el corrector nuevo, recalculando `quiz_attempts.score`. Dry-run primero, con el diff a la vista,
y recién después la escritura. Es opcional y es reversible sólo si se guarda el estado previo —
por eso va último y separado.

---

## Cuándo se puede paralelizar (y cuándo no)

La regla que usé para partir las fases, en orden de importancia:

1. **Un archivo, un agente.** Dos agentes editando `quiz-engine.tsx` a la vez es un conflicto
   garantizado. Por eso C es dueño exclusivo de ese archivo en la Fase 1 y nadie más lo toca hasta
   la Fase 2.
2. **Sin dependencia de datos.** Si la tarea Y necesita leer el código que escribe X, no van
   juntas. A y B son módulos nuevos que no importan nada del repo: por eso pueden arrancar a la
   vez que C y D.
3. **Verificable sola.** Cada tarea paralela tiene que poder correr `npm test` y decir "verde" sin
   esperar a las otras. A, B y D cumplen; la integración de la Fase 2 no, por definición.

Traducido a este plan:

- **Fase 1 → 4 agentes en paralelo.** Es el mejor punto de todo el plan: cuatro archivos
  distintos, cuatro suites de tests distintas.
- **Fase 3 → 3 agentes en paralelo.** E, F y G no comparten un solo archivo.
- **Fases 0, 2 y 4 → un solo agente.** La 0 escribe en producción, la 2 es el punto de
  convergencia, la 4 reescribe notas de alumnos reales. Ninguna de las tres gana nada
  paralelizando y las tres pierden si algo sale a medias.

Si en algún momento hace falta paralelizar tocando el mismo archivo, la salida es dar a cada
agente su propio worktree y pagar el merge después — pero para este plan no hace falta.
