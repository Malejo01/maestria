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
  - ⚠️ **`scripts/create-staging-branch.ts` y `branch-guard.ts` no existen.** Un agente los describió en detalle (try/finally, timeout, verificación independiente) y nunca los escribió. Ver "Lecciones operativas". Si se quiere el flujo automatizado, hay que escribirlo desde cero; el runbook manual está en `docs/staging.md`.

### Pendiente de staging (no urgente)

- [ ] §2.3-§2.5 de `docs/staging.md`: OAuth client propio, `AUTH_SECRET` distinto, key de Gemini aparte, y proyecto Vercel de staging. **El `AUTH_SECRET` es el importante:** compartirlo con producción hace que una sesión de staging valga en producción. Hace falta recién para la capa de agentes de UI.

---

## ✅ Post-incidente del 10/08 (COMPLETO)

Examen real con 31 alumnos que destapó cuatro fallas. Todo resuelto:

- [x] **Corrección de respuestas cortas** — `maxOutputTokens: 500` cortaba el JSON de Gemini antes del veredicto; el cliente hacía `Boolean(undefined) = false` y guardaba como incorrecta en silencio. 225 de 238 mal calificadas. Fix: 2000 tokens + `thinkingBudget: 0` + reintento con contabilidad de usage.
- [x] **Corrector determinista previo a la IA** (`lib/short-answer-grading.ts` + `lib/numeric-answer.ts` compuestos en `short-answer-autograde.ts`). Validado contra datos reales: 15 de 238 recuperables, cero falsos positivos. Corre antes de `guardAiCall`, así que ahorra la fila de uso y el rate limit.
- [x] **Fail-open** — migración 021: `is_correct` nullable (NULL = sin calificar), `quiz_attempts.ungraded_answers`, índice parcial. La nota sale sobre `tally.graded`: 8 correctas + 2 sin calificar es un 10, no un 8. Panel ámbar visible para el alumno.
- [x] **Input numérico** — `type="text"` + `inputMode="decimal"`, interpretado con `parseNumericAnswer`. Acepta `3,5`, `7/2`, `\frac{7}{2}`, `50%`.
- [x] **Botón de feedback en mobile** — medía la barra con `ResizeObserver` en vez de offset fijo (la barra tiene alturas distintas según contexto).
- [x] **Login (305 `MissingCSRF`)** — dos instancias de Auth.js por request emitían cookies CSRF distintas. Fix: sacar `/api/auth/*` del matcher del middleware. Investigación completa en `docs/investigacion-login-10-08.md`. Nadie quedó afuera (31 crearon cuenta, 31 rindieron), pero se perdió tiempo: mediana 5,6 min, peor caso 37 min.

### Causa raíz del contenido fuera de programa

Los 31 alumnos estaban registrados como **Secundario / 4to Año**. El sistema sirvió impecablemente el currículum de Secundario 4to. 872 de 1.792 respuestas midieron cónicas, sucesiones, combinatoria y probabilidad — nada de eso está en el programa de la carrera.

> Los números de arriba se midieron contra **producción**. La branch de staging tiene 1.680 respuestas en 84 intentos para esa fecha, de las cuales 856 caen en esos temas. La diferencia es esperable en un clon, pero tenerla presente: el fixture de calibración de FASE 0.5 sale de staging, así que está construido sobre ese subconjunto.

- [x] Perfiles migrados a Superior / 1er Año (31 filas, con backup y `--revert`)
- [x] Currículum de la carrera cargado (migración 022): `curriculum.carrera` + `curriculum.contexto_profesional`, 7 unidades del programa 2026
- [x] **Contexto profesional en el prompt** — A/B verificado en Unidad 5: sin contexto 0/6 ejercicios situados, con contexto 4/6 (crecimiento de usuarios de una app, costo de licencias, tiempo de ejecución de un algoritmo)
- [ ] **Sesgo de tipos de pregunta — NO implementado.** La idea: `tipos_pregunta_sugeridos` con pesos, no set; sugerido y no impuesto, la elección explícita del usuario gana. La última migración del repo es la **022**; no existe una 023 ni esa columna. Queda como pendiente, no como hecho.

**Pendiente de comunicación:** los alumnos tienen que cerrar sesión y volver a entrar para que el JWT refresque nivel/grado. Sin eso siguen viendo Secundario 4to.

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
- [ ] `scripts/qa/run-agents.ts` — ya tiene todas las piezas

**Reglas de lint evaluadas y descartadas** (medidas contra los datos del 10/08, 15/08/2026):

| Regla | Veredicto |
|---|---|
| Enunciado demasiado largo para el nivel | **No.** `education-context.ts` no expone ningún límite estructurado de enunciado — sólo `maxOpcionesPalabras`, ya usado para opciones. Los topes por oración viven como prosa dentro del prompt y sólo para Primario. Y no hay un solo dato de Primario en el 10/08 (los usuarios son Superior 1er y Secundario 5to), así que no se puede validar. Requiere primero agregar `maxPalabrasPorOracion` a `EducationContext`; en pausa hasta que haya datos de Primario. |
| `acceptedAnswers` sin variante sin tildes | **No, la regla no tiene sentido.** `normalizeAnswerText` ya saca las tildes al comparar ([short-answer-grading.ts:108](../lib/short-answer-grading.ts#L108)); el alumno que escribe "parabola" ya da correcto. Dispararía en 23 casos y los 23 serían falsos positivos. |
| Opciones con longitudes dispares | **Se deja como está, con la premisa medida.** Sobre 862 preguntas de 4 opciones: la más larga es la correcta el 28,0% de las veces contra un azar de 25% — efecto real pero de ~2 errores estándar. Lo que sí aparece fuerte es lo inverso: la correcta es la más corta sólo el 8,7%. Queda en `minor`, umbral ≥25 chars y ≥2× el promedio (dispara en 4,1%). No hay umbral que aísle una señal fuerte porque no la hay; el número está escrito en el comentario del código para que nadie lo lea como más de lo que es. |
| `numeric` sin tolerancia | **Ya estaba afinada.** Exige `!Number.isInteger(correctAnswer)`: dispara en 9 de 19 no enteras, y no dispara en las 230 enteras con tolerancia nula. Sin el chequeo de entero dispararía en 239 en vez de 9. |

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

- [ ] Upgrade de `next` a 16.2.12 + resto de `npm audit`

### Próximo sprint

- [ ] **Source maps con Turbopack** — suben bien pero Sentry no los aplica (bug upstream `sentry-javascript#18248`, State: Blocked). Workaround: `next build --webpack`.
- [ ] **Voseo app-wide** — el onboarding se corrigió, pero quedan ~22 formas peninsulares
- [x] Navegación de vuelta desde `/admin/ai-usage` — un `<Link>` a `/`, no la navbar: montarla arrastraría el layout de `(app)` con sus guards de onboarding, que es justamente lo que la página evita viviendo fuera del grupo. Un `<Link>` además la deja seguir siendo server component.
- [x] `updated_at` de `deployment_env` no se refresca — el `DEFAULT NOW()` de la columna sólo corre en el INSERT. `markEnvironment()` ya lo ponía a mano; los runners **017** y **018**, que también reescriben la fila, no. **Se descartó el trigger**, que sería el arreglo que no depende de que cada autor se acuerde: es una migración nueva y hay que correrla contra producción para arreglar algo que hoy no rompe nada. En su lugar quedó `tests/deployment-env-updated-at.test.ts` — chequeo léxico sobre el repo, mismo enfoque que `tests/migrations.test.ts`, que exige `updated_at` en todo `UPDATE` y todo `ON CONFLICT … DO UPDATE` sobre la tabla. Los INSERT pelados no se exigen: ahí el DEFAULT sí corre.
- [ ] Tipos `Db*` en `lib/db.ts` desalineados con el schema
- [ ] 4 warnings de `any` nuevos de la extracción (ahora hay 29 tests como red)
- [x] favicon 404 — `public/favicon.ico`, un contenedor `.ico` de verdad con dos PNG embebidos (16 y 32, sacados de `icon-light-32x32.png`), no un PNG renombrado. Va en `public/` y **no** en `app/favicon.ico`: la convención de archivo de Next haría que el framework emita su propio `<link rel="icon">` compitiendo con el bloque `metadata.icons` de `layout.tsx`. Verificado contra el dev server, 404 sin el archivo y 200 con él.
- [x] Limpieza de ramas — de **16** locales a 9, y de 4 worktrees a 2. Borradas las 5 `worktree-agent-*` y las 3 `v0/*`, las ocho verificadas como ancestros de `main` antes de tocar nada. `fix/flujo-diagnostico-primero` se conserva: es la única sin mergear. (El conteo viejo decía ~14; eran 16.)
- [ ] **Los íconos siguen siendo el logo de v0**, no la marca de MaestrIA — `public/icon.svg` y los dos PNG de 32×32 son el logotipo de v0.app, y `metadata.generator` sigue diciendo `'v0.app'`. El favicon nuevo hereda ese arte, así que cambiarlo es un solo lugar más. Detectado al arreglar el 404.
- [ ] Borrar el proyecto Neon de `quiosco-next` (no urgente: una branch no consume slot)

### Vivir con esto

Sin ORM · Cold starts de Neon · Corepack (inerte hoy)

---

## Lecciones operativas

- **Agentes en paralelo solo con worktrees separados.** Ya se pagó dos veces: migración 016 duplicada, y `run-migration-016.ts` modificado en paralelo.
- **`.env.local` con claves duplicadas** causó un run de backup fallido. Verificar con `(Select-String -Path .env.local -Pattern "^CLAVE=").Count`.
- **No pegar salidas con connection strings en el chat.** Para chequeos, usar el conteo sin exponer el valor.
- **Un agente puede describir en detalle algo que nunca escribió.** `create-staging-branch.ts` fue descrito con try/finally, timeout y verificación independiente — y no existía en ninguna rama. Verificar antes de asumir.
- **Los tests de caracterización van antes del refactor, no después.**
- **PITR de Neon: 6 horas** (plan Free). El dump diario es la única red más allá del mismo día.

---

## Herramientas

- **Claude Code** — código real. Opus para ambigüedad arquitectónica, Sonnet para implementación con plan confirmado.
- **Este chat / Projects** — arquitectura y decisiones de producto. Mantener este doc como fuente canónica en Project Knowledge.
- **Cowork / Gemini** — documentos autocontenidos que no compiten por el repo vivo.
