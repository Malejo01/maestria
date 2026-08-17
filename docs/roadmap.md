# MaestrIA — Roadmap

Documento vivo. Última actualización: **16 de agosto de 2026**.

## Tesis de producto

Crecimiento **docente-first, bottom-up, freemium**. El docente crea el aula y paga; el alumno (incluso guest, sin cuenta) siempre es gratis.

**Destino inmediato:** que la próxima experiencia con alumnos reales sea la buena. Los 31 de Análisis de Sistemas ya saben que existe y quedaron esperando el aviso — esa es la segunda oportunidad y no hay una tercera.

---

## ⏸️ PENDIENTE ESPERANDO PRESUPUESTO

### Evaluador con Claude para los agentes de QA

**Estado:** código escrito, testeado, con assert que falla claro si falta la clave. Solo falta cargar crédito en la API de Anthropic.

**Qué falta:** `ANTHROPIC_API_KEY` en `.env.staging.local`, generada dentro de un workspace dedicado con tope mensual.

**Costo:** ~$0,52 USD por barrido completo de las 5 personas. Diez iteraciones de rúbrica con caché: ~$3. Con $20 de crédito hay para meses.

**Ojo:** la suscripción de $100 (plan Max) **no cubre la API** — es billing separado. Lo mismo con Gemini: la suscripción de consumidor no cubre la API que ya usa MaestrIA.

**Por qué Claude y no Gemini:** Gemini genera; si Gemini también evalúa, es el mismo modelo juzgando su trabajo con sus mismos puntos ciegos. La combinación es el diseño, no una concesión.

**Primer comando cuando haya crédito:**

```bash
npx tsx scripts/qa/calibrate.ts --max-usd=2
```

**Qué verificar en esa primera corrida:** recall 1.0 sobre known-bad reales, precisión ≥0,9 sobre known-good, y sobre todo el **control cruzado** — las mismas preguntas de cónicas marcadas `critical` bajo Superior y aprobadas bajo Secundario 4to. Si marca `critical` en ambas, la rúbrica reacciona a "parece difícil" y hay que ajustarla.

**Disparador:** cuando salga el proyecto de la muni, o cuando haya USD disponibles.

---

## ✅ FASE 0 — Pre-lanzamiento (COMPLETA)

- [x] Rate limiting por usuario + kill switch `AI_DAILY_BUDGET_USD`
- [x] Cierre de 3 endpoints de IA sin auth
- [x] Sentry con scrubbing de PII verificado en producción
- [x] Dashboard de costo de IA (`/admin/ai-usage`, gate en tres capas)
- [x] Guardrail de entorno (`db-target.ts`, migraciones 017/018), probado en ambas direcciones (pooled y unpooled)
- [x] Backups diarios cifrados a Vercel Blob (105 kB verificados)
- [x] ToS + política de privacidad (Ley 25.326, foco en menores vía guest session)
- [x] Botón de reportar problema (migración 019)
- [x] Onboarding docente (migración 020, `teacher_tour_seen_at`)
- [x] Typecheck real — `ignoreBuildErrors` eliminado, de 31 errores a 0
- [x] ESLint instalado y configurado
- [x] Staging — branch de Neon anonimizada y verificada. Armada **a mano** (consola de Neon + `scripts/anonymize-staging.ts`), no por script. Verificado el 15/08/2026 contra `ep-blue-snow-amd743o6`: marcador `deployment_env` = `staging` con `origin_host` coincidente, 40 usuarios y los 40 con email `@staging.invalid`, cero tokens de Google vivos en `accounts`, `teacher_program_uploads` vacía.
  - ✅ **El flujo automatizado ya existe**, desde `e683395` (15/08/2026): `scripts/create-staging-branch.ts` encadena §2.1-§2.2 de `docs/staging.md` en un solo comando, apoyado en `scripts/lib/branch-guard.ts`, `staging-branch.ts` y `neon-api.ts`, con tests propios. La branch sobrevive si y sólo si los seis pasos salen bien; cualquier otro final la borra. El runbook manual sigue sirviendo como referencia.
    - Esta entrada decía, hasta el 16/08/2026, que esos archivos **no existían**. Era cierto cuando se escribió y dejó de serlo con ese commit. Se corrige, pero la lección operativa de abajo queda: lo que la volvió falsa fue que alguien los escribiera, no que estuviera mal razonada.

### Pendiente de staging (no urgente)

- [ ] §2.3-§2.5 de `docs/staging.md`: OAuth client propio, `AUTH_SECRET` distinto, key de Gemini aparte, y proyecto Vercel de staging. **El `AUTH_SECRET` es el importante:** compartirlo con producción hace que una sesión de staging valga en producción. Hace falta recién para la capa de agentes de UI.

---

## ✅ Post-incidente del 10/08 (COMPLETO)

Examen real con 31 alumnos que destapó cuatro fallas. Todo resuelto:

- [x] **Corrección de respuestas cortas** — `maxOutputTokens: 500` cortaba el JSON de Gemini antes del veredicto; el cliente hacía `Boolean(undefined) = false` y guardaba como incorrecta en silencio. Fix: 2000 tokens + `thinkingBudget: 0` + reintento con contabilidad de usage.
  - **Los números medidos contra producción el 16/08/2026 son 224 de 235**, no 225 de 238. Ver la corrección de conteos más abajo.
- [x] **Corrector determinista previo a la IA** (`lib/short-answer-grading.ts` + `lib/numeric-answer.ts` compuestos en `short-answer-autograde.ts`). Validado contra datos reales: 15 de 238 recuperables, cero falsos positivos. Corre antes de `guardAiCall`, así que ahorra la fila de uso y el rate limit.
- [x] **Fail-open** — migración 021: `is_correct` nullable (NULL = sin calificar), `quiz_attempts.ungraded_answers`, índice parcial. La nota sale sobre `tally.graded`: 8 correctas + 2 sin calificar es un 10, no un 8. Panel ámbar visible para el alumno.
- [x] **Input numérico** — `type="text"` + `inputMode="decimal"`, interpretado con `parseNumericAnswer`. Acepta `3,5`, `7/2`, `\frac{7}{2}`, `50%`.
- [x] **Botón de feedback en mobile** — medía la barra con `ResizeObserver` en vez de offset fijo (la barra tiene alturas distintas según contexto).
- [x] **Login (305 `MissingCSRF`)** — dos instancias de Auth.js por request emitían cookies CSRF distintas. Fix: sacar `/api/auth/*` del matcher del middleware. Investigación completa en `docs/investigacion-login-10-08.md`. Nadie quedó afuera (31 crearon cuenta, 31 rindieron), pero se perdió tiempo: mediana 5,6 min, peor caso 37 min.

### Causa raíz del contenido fuera de programa

Los 31 alumnos estaban registrados como **Secundario / 4to Año**. El sistema sirvió impecablemente el currículum de Secundario 4to. Buena parte del diagnóstico midió cónicas, sucesiones, combinatoria y probabilidad — nada de eso está en el programa de la carrera.

> **Corrección de conteos (16/08/2026).** Este bloque decía "872 de 1.792 respuestas" en producción contra "1.680 en staging", y presentaba la diferencia como el desfasaje esperable de un clon. Medido de nuevo contra producción, **producción tiene 1.680 respuestas en 84 intentos** — el mismo número que staging, así que no hay tal diferencia y el 1.792 nunca existió. El dato es consistente por dos caminos: `SUM(quiz_attempts.total_questions)` y el conteo de filas de `quiz_answers` dan los dos 1.680. Por tipo: 862 `multiple_choice`, 328 `true_false`, 255 `numeric`, 235 `short_answer`.
>
> Del mismo modo, **los 31 alumnos están hoy en `Superior / 1er Año` en producción, los 31**. La nota de más abajo que dice "30 y 1 sigue en Secundario / 5to Año" describe la branch de staging, no producción.
>
> Lección: los números que este documento presenta como "producción" conviene re-medirlos antes de apoyarse en ellos, sobre todo si vienen acompañados de una comparación contra staging.

- [x] Perfiles migrados a Superior / 1er Año (31 filas, con backup y `--revert`)
- [x] Currículum de la carrera cargado (migración 022): `curriculum.carrera` + `curriculum.contexto_profesional`, 7 unidades del programa 2026
- [x] **Contexto profesional en el prompt** — A/B verificado en Unidad 5: sin contexto 0/6 ejercicios situados, con contexto 4/6 (crecimiento de usuarios de una app, costo de licencias, tiempo de ejecución de un algoritmo)
- [x] **Sesgo de tipos de pregunta** — implementado en `e053fc2`. Migración **023** (`023-curriculum-tipos-pregunta.sql` + su runner) agrega `curriculum.tipos_pregunta_sugeridos` como JSONB de **pesos relativos, no porcentajes**; `NULL` conserva el reparto parejo previo. La lógica vive en `lib/question-mix.ts`, que separa PRODUCCIÓN (`numeric`, `short_answer`, sin piso por azar) de RECONOCIMIENTO (`multiple_choice`, `true_false`) y sesga hacia la primera, con los números del 10/08 escritos en el módulo. `restrictQuestionTypeMix()` es lo que hace que sea sugerido y no impuesto: la elección explícita del usuario recorta la mezcla.
  - Esta entrada decía "NO implementado, la última migración del repo es la 022 y no existe una 023". Quedó vieja al mergearse el PR #5 y avanzar `main`.

**~~Pendiente de comunicación:~~ RESUELTO.** Decía que los alumnos tenían que cerrar sesión y volver a entrar para que el JWT refrescara nivel/grado. **Ya no hace falta avisarles nada.**

> [auth.ts:145](../auth.ts#L145) ya re-leía la base cuando `trigger === 'update'`; faltaba sólo disparar `useSession().update()` desde el cliente. Implementado en la navbar, que ya traía `/api/user/profile` en cada carga con sesión. El alumno abre la app y el token se pone al día solo. La regla de comparación vive en `lib/session-profile-sync.ts` con 7 tests, y los que importan son los que **no** tienen que disparar: `null` vs `undefined` cuenta como igual, porque si no todo usuario sin nivel cargado pegaría a `/api/auth` en cada carga.

---

## 👉 PENDIENTE DE MAURO — leer esto primero (16/08/2026)

Todo lo de la tanda está mergeado a `main` y desplegado. Queda esto, que sólo podés hacer vos:

### 1. Correr la inscripción (bloquea a los 31 alumnos)

Es lo único de la tanda que no está en producción. Sin esto, los 31 **no están en ningún aula**.

```bash
npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=TU_EMAIL
```

Eso es el dry-run y no toca nada. Verificado el 16/08: 31 alumnos, 0 ya miembros, 31 filas a insertar, 7 unidades con 36 temas. Para aplicarlo:

```bash
npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=TU_EMAIL --apply --metodologia="..."
```

`--metodologia` es **obligatorio** y no tiene default a propósito: ese texto entra derecho al prompt de generación, y el wizard blanquea las metodologías autocompletadas justamente para que lo escriba una persona. Escribí cómo das la materia, en una o dos oraciones.

El script crea el programa (Superior / 1er Año / Matemática, con las 7 unidades copiadas de `curriculum`), el aula, y las 31 membresías. Escribe un backup en `scripts/backups/` **después de cada paso**, así que una caída a la mitad sigue siendo reversible con `--revert=<archivo.json>`.

### 1b. Decidir cómo se arreglan las fuentes (bloquea toda verificación en browser)

`app/layout.tsx` importa Manrope y Playfair Display con `next/font/google`, que **descarga en tiempo de build**. Si esa descarga falla, no falla la tipografía: falla el módulo, y la home tira 500. Es lo que viene limitando la verificación en browser hace tres tandas.

Medido el 16/08/2026: `fonts.googleapis.com` responde 200, pero las URLs de **fuente variable** que pide Next dan **404**, mientras que los archivos estáticos del mismo tipo descargan bien. No es lentitud de red — son URLs que no existen más.

Está esperando tu decisión entre self-hosting (preserva la tipografía exacta) y sacar Playfair (cambia el wordmark). Detalle en la respuesta del chat.

### 2. Verificaciones manuales (no las pude hacer yo)

No puedo autenticarme como alumno ni como docente, y el dev server del sandbox no levanta por el fetch de Google Fonts. Lo que falta mirar con tus ojos:

- **Refresh del JWT.** El que más importa. Entrá con una cuenta de alumno cuyo perfil hayas cambiado en la base y confirmá que `/practicar` muestra el nivel nuevo **sin cerrar sesión**. Si no anda, el síntoma es que sigue mostrando el viejo; si anda mal, el síntoma sería un pedido a `/api/auth` en bucle (mirá la pestaña Network).
- **Reporte del alumno** en `/history`, logueado como uno de los 31. Verificá que el aviso de respuestas escritas aparece y que el bloque arranca abierto.
- **Reporte docente** en `/teacher/diagnostico`. Los números están verificados contra producción; lo que no vi renderizado con sesión real es la página entera.
- **Campo de código de aula** en el inicio: ese sí lo probé end-to-end contra el aula real, hasta la pantalla de "Entrar" (no apreté el botón para no escribir en producción).

---

## 🚀 Tanda de lanzamiento (16/08/2026)

- [x] **Entrada de código de aula en el inicio** — el alumno que recibía un código por WhatsApp no tenía dónde ponerlo. Campo fijo en la rama de ALUMNO que navega a `/aula/<code>`, la pantalla que ya resuelve Google/invitado/invitado-nuevo. No se duplicó el flujo de join.
- [x] **Reporte del diagnóstico para el alumno** — bloque colapsable en `/history`, por unidad, sin `short_answer` y diciendo por qué, con el piso de azar al lado de cada conteo y separando lo que entra en el programa de lo que no.
- [x] **Reporte del diagnóstico para el docente** — `/teacher/diagnostico`. Aparte del reporte por aula, que filtra por `classroom_id` y no encuentra nada: los 84 intentos lo tienen en NULL.
- [x] **Refresh del JWT sin cerrar sesión** — ver arriba.
- [x] **FASE 0.5 commiteada** — el lint determinista, el fixture de calibración y la extracción de `lib/quiz-generation.ts` estaban **sin commitear en el worktree** mientras este documento ya los describía como hechos. Ahora están en el repo.
- [ ] **Aula de Análisis de Sistemas + inscripción de los 31** — `scripts/inscribir-diagnostico-2026-08-10.ts`, dry-run verificado (31 filas, 0 duplicados). **Falta correrlo con `--apply --metodologia="..."`.** Único item de la tanda que no está en producción.

### Deuda que dejó el merge

- **`route.ts` conflictuó y no era textual.** `main` había metido el question-mix dentro de las ~690 líneas que esta rama movió a `lib/quiz-generation.ts`. Se resolvió portando el cableado al módulo extraído, sin tocar un solo test: los 29 de caracterización y los 6 de `generate-quiz-question-mix` pasan juntos. `QuizRequestParams.questionTypes` pasó a `explicitQuestionTypes` porque el default ya no se puede aplicar al parsear el body: la precedencia necesita lo que declara `curriculum`.
- **Después de mergear hay que correr `npm install`.** El build falló una vez por esto: `node_modules` tenía `next 16.2.4` y el `package.json` mergeado pide `16.2.12`.
- **`lib/qa/lint-questions.ts` era binario para git.** Tenía un byte NUL literal como centinela; git lo clasificaba como binario y no mostraba diffs — un archivo de reglas que nadie podía revisar en un PR. Pasó a escape de 6 caracteres.
- **El dev server no levanta en el sandbox de Claude Code.** `app/layout.tsx` pide Playfair Display y `fonts.gstatic.com` devuelve 404 desde esa red, así que la home tira 500. El build de producción pasa. Consecuencia práctica: las pantallas nuevas se verificaron con datos reales en páginas temporales, y el refresh del JWT **no** se pudo ejercitar en browser.

### Lo que destapó

- **No existía ningún programa ni aula de Análisis de Sistemas.** Los tres programas del docente eran Lengua/Primario, Ciencias Naturales/Primario y Matemática/Secundario 3er Año, y su única aula colgaba del último. El script crea el programa (7 unidades copiadas de `curriculum`) y el aula, además de inscribir.
- **La carrera no necesita columna en `teacher_programs`.** Va en `pedagogy_profile.degree`, que es lo que `pedagogyProfileToContext` emite como `Carrera: ...`.
- **`quiz_answers.topic_name` no sirve para agrupar.** Lo escribe la IA por pregunta: 358 valores distintos en 1.680 respuestas, y coincide con el tema que el alumno eligió sólo 22 veces. La clave real es `quiz_attempts.topics` contra `curriculum.temas`, anclado a Secundario 4to porque 5 de los 46 temas están duplicados entre 4to y 5to y sin el ancla todos los totales salen dobles. Cubre 77 de 84 intentos.
- **Los distractores recurrentes no dan señal.** Sobre 559 respuestas de múltiple choice incorrectas hay 505 textos distintos; el máximo se repite 5 veces en 5 preguntas por 5 alumnos, y es la palabra "Parábola", que en otras preguntas es la correcta. Se descartó la sección en vez de mostrar ruido.
- **`lib/db.ts` mentía en el tipo.** El export `sql` era una función pelada casteada a `NeonQueryFunction`: `sql.query` tipaba bien y en runtime era `undefined`. Corregido.

**Verificado en staging el 15/08/2026:** de los 31 alumnos con intento del 10/08, **30 están en `Superior / 1er Año` y 1 sigue en `Secundario / 5to Año`**. Dos cosas a mirar: el rezagado no se migró, y su grado original era 5to, no 4to — así que "los 31 estaban en Secundario / 4to Año" no es exacto. No puedo ver producción desde acá; esto es lo que dice la branch de staging.

---

## 🔨 FASE 0.5 — Agentes de QA (EN CURSO)

### ✅ Construido y funcionando sin costo

**Lint determinista** (`lib/qa/lint-questions.ts`) — corre sin tocar ningún modelo. Verificado sobre las 1.680 preguntas del 10/08 en staging: 61 hallazgos, precisión 100%, cero falsos positivos. Detecta: `\neg` corrompido a `eg`, `$` como símbolo de moneda, `acceptedAnswers` enteramente en LaTeX (14 de 235 `short_answer`), `tolerance: null` en numéricas no enteras (9 de 19), y **distractores numéricamente equivalentes** (2 de 862 `multiple_choice`: `3/4` y `0.75` juntas en la misma pregunta de "cuál es irracional", ids 771 y 1351).

```bash
npx tsx scripts/qa/calibrate.ts --lint-only
```

**Fixture de calibración** — 10 casos reales de `quiz_answers` de staging, con su id para trazabilidad. Commiteado a propósito: es el contrato de la rúbrica.

**Extracción de `lib/quiz-generation.ts`** — `route.ts` de 954 a 88 líneas, con 29 tests de caracterización escritos **antes** del refactor y verificación byte a byte contra `git show HEAD`.

**Doble freno de gasto** — tope mensual del workspace (te para la factura) + `--max-usd` en `scripts/qa/lib/budget.ts` (te para el loop en el momento).

### ⏸️ Esperando presupuesto

Evaluador con Claude (ver sección de arriba).

### Diseño de la calibración (ya implementado)

Dos caras, no solo recall:

1. **Recall sobre known-bad reales** — ¿detecta lo que sabemos que está mal?
2. **Precisión sobre known-good** — ¿se queda callado donde debe? Sin esto, una rúbrica que marca `critical` en todo pasa con 100%.
3. **Control cruzado por persona** — las mismas preguntas de cónicas evaluadas bajo Secundario 4to tienen que pasar, porque ahí sí están en el programa. Misma pregunta, veredicto opuesto según la persona.
4. **Exigencia de silencio por dimensión**, no en bloque.

### Las 5 personas

| # | Nivel | Grado | Materia | Dim. 5 |
|---|---|---|---|---|
| 1 | Primario | 1er/2do Año | Matemática | no |
| 2 | Primario | 4to Año | rota 2 de 6 por corrida | no |
| 3 | Secundario | 4to Año | Historia | no |
| 4 | Superior | 1er Año | Matemática (Tecnicatura Análisis de Sistemas) | sí |
| 5 | Secundario | 4to Año | Lengua y Literatura | no |

Solo la persona 4 tiene casos reales del 10/08. Las otras cuatro calibran con casos sintéticos, marcados `synthetic: true` y visibles en el reporte de salida, no solo en el fixture.

### Siguiente sin costo

- [x] ~~Distractores numéricamente equivalentes~~ — implementado. Dos ramas: `critical` si el par duplicado incluye la opción correcta (hay dos respuestas correctas), `major` si son sólo distractores (la pregunta ofrece menos opciones reales de las que aparenta). Los dos casos reales caen en la segunda rama; la primera está cubierta sólo por test sintético.
- [x] ~~Tres reglas más~~ (16/08/2026) — **el lint pasa de 61 a 88 hallazgos, precisión sigue en 100%**:

  | Regla | Sev. | Casos | Nota |
  |---|---|---|---|
  | Escapes `\uXXXX` crudos | `critical` | **10 preguntas** (ids 1430–1448) | El alumno lee `parábola`. Un solo intento con todo su contenido corrupto. |
  | Manda a mirar un visual inexistente | `critical` | **1** (id 750) | No hay imágenes en ningún cuestionario: irrespondible. El alumno adivinó y erró. |
  | `true_false` que adelanta su respuesta | `major` | **2** (693, 1432) | Abre con "Es verdadero que…"; los dos tienen `correctAnswer: true`. |

  Dos decisiones de alcance que valen más que las reglas:
  - El escape se acota a la **mitad alta** de Latin-1 (``–`ÿ`). El primer test falló y tenía razón: el patrón ancho también atrapaba `A`, que es una `A` en ASCII y puede ser el tema legítimo de una pregunta de sistemas sobre codificación.
  - La del visual es estrecha (imperativo + deíctico + sustantivo). La versión amplia da un **falso positivo** medido: el id 1071 dice "cuya gráfica se muestra" pero después describe el comportamiento en palabras y se responde sin ver nada.

- [ ] `scripts/qa/run-agents.ts` — ya tiene todas las piezas

**Reglas de lint evaluadas y descartadas** (medidas contra los datos del 10/08; las cuatro primeras el 15/08/2026, las seis siguientes el 16/08):

| Regla | Veredicto |
|---|---|
| Enunciado demasiado largo para el nivel | **No.** `education-context.ts` no expone ningún límite estructurado de enunciado — sólo `maxOpcionesPalabras`, ya usado para opciones. Los topes por oración viven como prosa dentro del prompt y sólo para Primario. Y no hay un solo dato de Primario en el 10/08 (los usuarios son Superior 1er y Secundario 5to), así que no se puede validar. Requiere primero agregar `maxPalabrasPorOracion` a `EducationContext`; en pausa hasta que haya datos de Primario. |
| `acceptedAnswers` sin variante sin tildes | **No, la regla no tiene sentido.** `normalizeAnswerText` ya saca las tildes al comparar ([short-answer-grading.ts:108](../lib/short-answer-grading.ts#L108)); el alumno que escribe "parabola" ya da correcto. Dispararía en 23 casos y los 23 serían falsos positivos. |
| Opciones con longitudes dispares | **Se deja como está, con la premisa medida.** Sobre 862 preguntas de 4 opciones: la más larga es la correcta el 28,0% de las veces contra un azar de 25% — efecto real pero de ~2 errores estándar. Lo que sí aparece fuerte es lo inverso: la correcta es la más corta sólo el 8,7%. Queda en `minor`, umbral ≥25 chars y ≥2× el promedio (dispara en 4,1%). No hay umbral que aísle una señal fuerte porque no la hay; el número está escrito en el comentario del código para que nadie lo lea como más de lo que es. |
| `numeric` sin tolerancia | **Ya estaba afinada.** Exige `!Number.isInteger(correctAnswer)`: dispara en 9 de 19 no enteras, y no dispara en las 230 enteras con tolerancia nula. Sin el chequeo de entero dispararía en 239 en vez de 9. |
| `true_false` cuyo enunciado termina en `?` | **No.** Dispara en 42 de 328 (12,8%) y ninguno es un defecto: "¿Es cierto que el foco está en $(0,4)$?" se responde perfectamente con Verdadero/Falso. Es una forma de redacción, no un error. |
| Opción correcta repetida literal en el enunciado | **No.** 1 caso de 862 y es falso positivo: el enunciado **cita la relación** ("la cantidad de agua que gastas al ducharte depende del tiempo") y pregunta cuál es la variable dependiente. Que la frase aparezca no regala nada. |
| Respuesta numérica visible en el enunciado | **No.** 3 de 255 y los tres son ejercicios legítimos de lectura: sacar $r^2$ de $(x-3)^2+(y+2)^2=25$ **es** el ejercicio. La regla confunde "el dato está a la vista" con "la respuesta está regalada". |
| Una opción es prefijo de otra | **No.** 5 de 862, **los cinco falsos positivos**: `"1"` y `"12"` son números distintos; `"Todos los reales"` y `"Todos los reales excepto $x=2$"` son un par de distractores perfectamente válido. |
| Opciones con y sin LaTeX mezcladas | **No.** 90 de 862 (10,4%) y es lo correcto: en `["$x > -2$", "Todos los números reales", …]` la opción sin `$` no tiene matemática que envolver. Envolverla sería el error. |
| `acceptedAnswers` redundantes tras normalizar | **No.** 15 de 235 (`["focos","Focos"]`, `["Hipérbola","Hiperbola"]`). `normalizeAnswerText` ya baja a minúsculas y saca tildes, así que las variantes no agregan nada — pero **tampoco rompen nada**. Marcar una pregunta que funciona es un falso positivo. Es la imagen espejo de la regla de tildes ya descartada arriba. |
| Opciones que difieren sólo en puntuación | **No — el bug era de la regla.** Parecía disparar en 112 de 862 hasta que se miró la muestra: la canonicalización borraba `+` y `−`, así que daba por iguales `$a^2=b^2+c^2$` y `$a^2=b^2-c^2$`, que difieren justo en lo que importa. Anotada por la lección, no por la regla. |

> Nota de método: el filtro que descartó seis de estas ocho fue **mirar la muestra a mano**, no el conteo. Tres de ellas disparaban con volumen respetable (12,8%, 10,4%, 13%) y las tres eran ruido. Una tasa de disparo alta es motivo para sospechar de la regla, no para celebrarla.

---

## FASE 1 — Monetización

- [ ] Tabla `subscriptions`/`plans`, contadores de uso, gating de features premium
- [ ] Cobro — evaluar MercadoPago
- [ ] Validar precio con 5-10 docentes reales antes de lanzar el tier pago

Precio de referencia: Docente Pro ~$4.000-7.000 ARS/mes. Costos medidos: IA ~$0,001-0,01 USD por cuestionario. Infra ~$0-50 USD/mes.

## FASE 2 — Activación del docente

- [ ] Analytics de producto, funnel signup → primera aula → primer cuestionario

## FASE 3 — Loop de calidad de generación IA

- [ ] Feedback del docente (thumbs up/down) alimentando `education-context.ts`

## FASE 4 — Reportes exportables · FASE 5 — Referidos · FASE 6 — Orquestador de backlog

---

## Backlog técnico

### Antes de invitar usuarios

- [x] **Upgrade de `next` a 16.2.12** — cierra las 22 advisories propias de Next que traía 16.2.4; siete son bypass de middleware/proxy, y eso pesa más que el promedio acá porque `proxy.ts` es el único lugar donde se bloquea a un ALUMNO de `/teacher`. El techo más alto del lote era `<16.2.11`. `eslint-config-next` se fija también en 16.2.12 para no quedar una minor por delante.
- [x] **Parte segura de `npm audit`** — `postcss` 8.5.14 → 8.5.26, `nanoid` → 3.3.18, `vite` → 8.2.1 vía `vitest` 4.1.10. Las tres caían dentro de los rangos ya declarados, así que sólo se movió el lockfile. De 7 hallazgos a 5.
- [x] **Las 2 CRITICAL de Auth.js** — `next-auth` beta.31 → **beta.32**, que arrastra `@auth/core` 0.41.3. La que importaba: «Configuration errors can cause existence-based auth checks to **fail open**», que pega justo en el patrón de `getViewer()` y de `proxy.ts` (`!!session`). **El audit queda en 0 críticas**, de 7 hallazgos a 3.
  - [ ] **Smoke test manual pendiente** — ningún test automático cubre el runtime de Auth.js (los de `middleware-matcher` son léxicos). Hay que probar a mano: login con Google, invitado por código de aula, bloqueo de `/teacher` para ALUMNO, y switch de rol ALUMNO↔DOCENTE. Ojo con la interpretación: el arreglo hace que una config rota **deje de pasar inadvertida**, así que si aparece un problema de login la primera hipótesis no es «lo rompió el bump». Detalle en [deuda-tecnica.md](deuda-tecnica.md).
- [ ] `postcss` (4 high) y `sharp` (1 high) — cuelgan de `next`, y no del `postcss` de arriba: el que queda es el que Next trae empaquetado (`node_modules/next/node_modules/postcss@8.4.31`). npm sólo los da por resueltos con **`next@16.3.1`**, que sale de la línea 16.2.x. **Decidido el 16/08/2026: quedarse en 16.2.x** — ninguna es alcanzable (build-time sobre CSS propio) y no se salta de línea menor justo antes de invitar usuarios. Cuando toque subir, `16.3.1` las cierra las tres de un saque. Las de `sharp` siguen en camino muerto por `images.unoptimized: true`, **pero se reactivan solas si alguien da vuelta esa flag**.

### Próximo sprint

- [ ] **Source maps con Turbopack** — suben bien pero Sentry no los aplica (bug upstream `sentry-javascript#18248`, State: Blocked). Workaround: `next build --webpack`.
- [x] **Voseo app-wide** — 18 formas en 10 archivos: `quieres`→`querés` (6), `Selecciona`→`Seleccioná` (3), `intenta`→`intentá` (3), `Elige`→`Elegí` (2), `necesitas`→`necesitás` (2), más `completa`, `revisa`, `indica`, `Genera`, `vuelve` y `sigue así`. Vivían sobre todo en toasts de error y en las descripciones de los modos de cuestionario. De paso se corrigieron tildes y signos de apertura **en esas mismas frases** (`¿Qué querés hacer?`, `teórico`, `Perderás`), no más allá. **`/terminos` y `/privacidad` quedan como están**: su registro formal («Usted acepta», «su actividad previa») no es peninsular, es el que corresponde a un texto de cumplimiento de la Ley 25.326. El barrido inicial daba ~50 coincidencias y la mayoría eran comentarios del código en tercera persona, que no son copy.
- [x] Navegación de vuelta desde `/admin/ai-usage` — un `<Link>` a `/`, no la navbar: montarla arrastraría el layout de `(app)` con sus guards de onboarding, que es justamente lo que la página evita viviendo fuera del grupo. Un `<Link>` además la deja seguir siendo server component.
- [x] `updated_at` de `deployment_env` no se refresca — el `DEFAULT NOW()` de la columna sólo corre en el INSERT. `markEnvironment()` ya lo ponía a mano; los runners **017** y **018**, que también reescriben la fila, no. **Se descartó el trigger**, que sería el arreglo que no depende de que cada autor se acuerde: es una migración nueva y hay que correrla contra producción para arreglar algo que hoy no rompe nada. En su lugar quedó `tests/deployment-env-updated-at.test.ts` — chequeo léxico sobre el repo, mismo enfoque que `tests/migrations.test.ts`, que exige `updated_at` en todo `UPDATE` y todo `ON CONFLICT … DO UPDATE` sobre la tabla. Los INSERT pelados no se exigen: ahí el DEFAULT sí corre.
- [ ] Tipos `Db*` en `lib/db.ts` desalineados con el schema
- [ ] 4 warnings de `any` nuevos de la extracción (ahora hay 29 tests como red)
- [x] favicon 404 — `public/favicon.ico`, un contenedor `.ico` de verdad con dos PNG embebidos (16 y 32, sacados de `icon-light-32x32.png`), no un PNG renombrado. Va en `public/` y **no** en `app/favicon.ico`: la convención de archivo de Next haría que el framework emita su propio `<link rel="icon">` compitiendo con el bloque `metadata.icons` de `layout.tsx`. Verificado contra el dev server, 404 sin el archivo y 200 con él.
- [x] Limpieza de ramas — de **16** locales a 9, y de 4 worktrees a 2. Borradas las 5 `worktree-agent-*` y las 3 `v0/*`, las ocho verificadas como ancestros de `main` antes de tocar nada. `fix/flujo-diagnostico-primero` se conserva: es la única sin mergear. (El conteo viejo decía ~14; eran 16.)
- [x] **Sacar el logo de v0** — los cinco íconos y `metadata.generator: 'v0.app'` afuera. En su lugar hay un arte **provisorio**: una M de trazo sobre cuadrado redondeado en el verde de marca `#43613C`, con el mismo esquema claro/oscuro que tenía el set anterior. `generator` se elimina del objeto en vez de reescribirse — es opcional y no hay nada que declarar.
  - [ ] **Falta el arte definitivo.** Lo provisorio sirve para no seguir mostrando la marca de otro producto, no para ser la identidad. Ver la nota de abajo sobre qué hace falta.
- [ ] **10 preguntas del 10/08 llegaron a un alumno con el texto corrupto.** Detectado el 16/08/2026 al medir reglas de lint nuevas. Los ids 1430–1448 (un solo intento, todas sus respuestas) tienen el contenido con escapes `\uXXXX` sin decodificar: el alumno leyó `La circunferencia se define como el lugar geométrico…`, enunciado, opciones y explicación por igual.
  - El lint **ya lo detecta** (regla nueva, `critical`), pero eso es el detector, no el arreglo. La causa está en la cadena de reparación de JSON de `lib/quiz-generation.ts`: `repairQuizJson` duplica backslashes con `candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')` para arreglar escapes rotos, y en algún camino los `\u` legítimos terminan igual doblados.
  - **No está reproducido todavía.** Hay que encontrar qué entrada lo dispara antes de tocar la regex — es la función más delicada del módulo y tiene 29 tests de caracterización encima que hay que respetar.
  - Prioridad: es un defecto que **ya le llegó a un alumno real**, no una hipótesis.
- [ ] **El tooling entra en los worktrees anidados de `.claude/`.** Ni `vitest.config.ts` ni la config de ESLint excluyen `.claude/`, así que con un worktree vivo en `.claude/worktrees/` las dos herramientas lo escanean. Medido el 16/08/2026:
  - `npm test` levanta también los tests del worktree anidado. **Re-medido el 16/08 más tarde: 67 archivos vistos desde la raíz, 32 de ellos del worktree** — o sea que hoy se corre casi todo dos veces. La entrada decía "6 archivos en rojo"; el número creció con cada test que se sumó al worktree.
  - `npm run lint` entra al `.next/` del worktree anidado y reporta **34.641 warnings** sobre chunks compilados. El número real del repo es **71 (0 errores)**.
  - Los dos hacen creer que un cambio rompió algo cuando no. CI no se ve afectado: hace checkout limpio.
  - Arreglo: `exclude: ['**/.claude/**']` en vitest y el patrón equivalente en ESLint. Dos renglones. Hoy hace ruido cada vez que hay un agente en paralelo, que es justamente el modo de trabajo que recomienda la lección operativa de arriba.
- [ ] `public/placeholder-logo.svg` y `placeholder-logo.png` también son de v0 y no los referencia nadie. Borrarlos.
- [ ] Borrar el proyecto Neon de `quiosco-next` (no urgente: una branch no consume slot)

### Qué hace falta para el ícono definitivo

Lo provisorio se generó por script desde un SVG; reemplazarlo es cambiar cinco archivos en `public/` y nada más — `layout.tsx` ya apunta a los nombres correctos y no hay que tocarlo.

Con **un solo SVG cuadrado** alcanza para derivar todo lo demás. Requisitos, que salen de las limitaciones de los formatos y no de una preferencia:

| Necesito | Por qué |
|---|---|
| **SVG cuadrado**, lienzo 1:1, con el margen ya incluido | Los PNG se derivan de acá. Si el margen no viene en el arte, cada tamaño hay que recortarlo a ojo. |
| Que se lea **a 16 px** | Es el tamaño real de la pestaña. Un logotipo con palabra o con trazos finos se convierte en una mancha; a ese tamaño sólo sobrevive la silueta. Si la marca completa no aguanta, hace falta una versión reducida (isotipo). |
| **Dos variantes, clara y oscura** | El set actual sirve un ícono distinto según `prefers-color-scheme`. Con una sola variante, o desaparece sobre chrome negro o sobre blanco. |
| Colores **planos**, sin degradés ni sombras | A 16 y 32 px un degradé se vuelve barro. Además el `.ico` se arma con paleta reducida. |
| Confirmar si `#43613C` es el color de marca | Vino del pedido, no de un manual. Si hay otro verde oficial, ese. |

Sin el SVG también se puede avanzar con un PNG de 512×512 o más, pero el resultado va a ser peor en los tamaños chicos: escalar hacia abajo desde un bitmap pierde definición justo donde más se nota.

### Vivir con esto

Sin ORM · Cold starts de Neon · Corepack (inerte hoy)

---

## Lecciones operativas

- **Agentes en paralelo solo con worktrees separados.** Ya se pagó dos veces: migración 016 duplicada, y `run-migration-016.ts` modificado en paralelo.
- **`.env.local` con claves duplicadas** causó un run de backup fallido. Verificar con `(Select-String -Path .env.local -Pattern "^CLAVE=").Count`.
- **No pegar salidas con connection strings en el chat.** Para chequeos, usar el conteo sin exponer el valor.
- **Un agente puede describir en detalle algo que nunca escribió.** `create-staging-branch.ts` fue descrito con try/finally, timeout y verificación independiente — y no existía en ninguna rama. Verificar antes de asumir. (Ese caso puntual se cerró el 15/08/2026 con `e683395`, que efectivamente los escribió. Lo que se cerró es el caso, no la lección.)
- **Este documento se lee desde la rama en la que estás parado.** El 16/08/2026 dos entradas estaban lisa y llanamente al revés de la realidad —`create-staging-branch.ts` y el sesgo de tipos de pregunta, las dos marcadas como inexistentes cuando ya estaban en `main`— y ninguna de las dos por mal razonamiento: el worktree estaba dos commits atrás y su remoto ya borrado tras mergear el PR. Si CLAUDE.md manda leer el roadmap al empezar la sesión, el paso previo es mirar contra qué base se lo está leyendo (`git log --oneline HEAD..main`).
- **Los tests de caracterización van antes del refactor, no después.**
- **PITR de Neon: 6 horas** (plan Free). El dump diario es la única red más allá del mismo día.

---

## Herramientas

- **Claude Code** — código real. Opus para ambigüedad arquitectónica, Sonnet para implementación con plan confirmado.
- **Este chat / Projects** — arquitectura y decisiones de producto. Mantener este doc como fuente canónica en Project Knowledge.
- **Cowork / Gemini** — documentos autocontenidos que no compiten por el repo vivo.
