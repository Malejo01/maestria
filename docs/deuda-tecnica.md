# Deuda técnica

Relevado el **2026-08-03** sobre `feat/ai-usage-and-db-guardrails`, actualizado el mismo
día a medida que se fue cerrando. Ampliado el **2026-08-04** sobre
`feature/feedback-y-limpieza` con el relevamiento de ESLint (sección 4) y el diagnóstico de
los source maps de Sentry con Turbopack (sección 5).
Medido con `npx tsc --noEmit`, `npm audit`, `npm run lint` y `CI=1 npm run build`.

Versiones al momento de medir: `next@16.2.4`, `next-auth@5.0.0-beta.31`,
`postcss@8.5.14`, `typescript@5.7.3`, `eslint@9`, `eslint-config-next@16.2.4`.

**Estado: TypeScript en 0 errores y `ignoreBuildErrors` fuera. ESLint instalado y en
verde, con 70 warnings inventariados — arrancó en 93, y lo que falta es casi todo
`no-explicit-any` sobre filas de Neon. Source maps de Sentry diagnosticados y sin arreglar,
por pedido. Quedan las 6 vulnerabilidades de `npm audit`, ninguna resuelta.**

---

## Ya resuelto

| Commit | Qué |
|---|---|
| `b4917c8` | `tsconfig.tsbuildinfo` fuera del control de versiones (ignorado por glob `*.tsbuildinfo`) |
| `a285bea` | Tests del fail-closed de `resolveDbTarget` |
| `cff5453` | `pnpm-lock.yaml` y `test-export.ts` borrados; `packageManager: npm@10.9.8` declarado |
| `dcaece1` | `lib/moodle-export-no-imports.ts` borrado + tipos de Sentry alineados — **31 → 5 errores** |
| *(este)* | 4 filas de Neon tipadas + `@types/canvas-confetti` + `ignoreBuildErrors` fuera — **5 → 0** |

---

## 3a. Errores de TypeScript — **resuelto**

`typescript.ignoreBuildErrors` ya no está en [next.config.mjs](../next.config.mjs), así que
**`npm run build` typechequea de verdad**: un error de tipos ahora rompe el build y, por
lo tanto, CI. Verificado inyectando un error deliberado — el build sale con código 1 y
`Type error:` en la salida, no en verde.

Cómo se cerraron los 31:

| Origen | Errores | Cómo se resolvió |
|---|---|---|
| `lib/moodle-export-no-imports.ts` | 14 | Archivo muerto, borrado (`dcaece1`) |
| Borde Sentry ↔ `scrubEvent` | 12 | `ScrubbableEvent` alineado con el SDK (`dcaece1`) |
| Filas de Neon con `any` implícito | 4 | Tipadas con el shape real de cada query |
| `canvas-confetti` sin tipos | 1 | `npm i -D @types/canvas-confetti` |

### Las 4 filas de Neon

El problema de fondo era que el driver devuelve las filas sin forma, no hay ORM (decisión
explícita, ver CLAUDE.md), y entonces **el único lugar donde vivía el contrato de shape era
el string de SQL**. Ninguno de los cuatro rompía: los cuatro degradaban en silencio a "no
hay datos", indistinguible de un caso vacío legítimo.

Cada query declara ahora una interfaz con las columnas que realmente selecciona, y con un
comentario que apunta al `.sql` donde está el DDL. No se usó un tipo laxo genérico: donde
el schema no garantiza una forma, el tipo lo dice.

Tres decisiones que vale la pena recordar, porque no son obvias:

- **`curriculum.temas` es JSONB → `unknown`, no `string[]`.** Postgres garantiza JSON
  válido, no un arreglo de strings. El `as string[]` que había (comentado como *"cast for
  TS safety"*) no daba seguridad: la suprimía. Ahora la columna se estrecha con un guard
  (`toTopicList`) que descarta lo que no sea `string[]` en el servidor, donde se puede ver,
  en vez de dejarlo llegar al browser a romper el `.map`/`.join`.
  **Es el único cambio de comportamiento de la tanda**: datos malformados ahora devuelven
  lista vacía en lugar de romper del lado del cliente.
- **`quiz_attempts.score` es DECIMAL(4,2) → `string`.** El driver devuelve los `numeric`
  como string para no perder precisión. No es una elección de estilo: es la razón por la
  que todos los consumidores ya lo envolvían en `Number(...)`.
- **`completed_at` / `created_at` son `Date | null`.** En el schema sólo tienen
  `DEFAULT NOW()`, sin `NOT NULL`. Los call sites usan `?? 0`, que conserva exactamente el
  comportamiento previo (`new Date(null)` ya era la época).

### Pendiente menor relacionado

`lib/db.ts` declara `DbQuizAttempt`, `DbTeacherQuiz` y `DbTopicMastery`, y **no los importa
nadie**. Además no coinciden con el schema: `DbQuizAttempt.id` dice `string` cuando la
columna es `SERIAL`, le faltan `incorrect_answers` y `passed`, y tipa `score` como `number`.
Por eso no se reutilizaron acá — habría sido adoptar tipos ya equivocados. Conviene
borrarlos o corregirlos, pero al no estar en uso no rompen nada hoy.

---

## 3b. `npm audit` — de 7 hallazgos a 3 (3 high, **0 critical**)

**Actualizado el 16/08/2026.** Las dos críticas están cerradas. Quedan tres high, las tres del mismo racimo y ninguna alcanzable por un cambio de rango.

| # | Paquete | Estado |
|---|---|---|
| 1 | `next` | ✅ 16.2.4 → **16.2.12**, cierra sus 22 advisories propias |
| 2 | `next-auth` | ✅ beta.31 → **beta.32** |
| 3 | `@auth/core` | ✅ 0.41.2 → **0.41.3**, vía `next-auth` |
| 4 | `postcss` | ⚠️ el directo se subió a 8.5.26; **queda el que `next` trae empaquetado** |
| 5 | `sharp` | ⚠️ abierta, no explotable hoy (ver abajo) |
| 6 | `vite` | ✅ 8.0.12 → **8.2.1**, vía `vitest` 4.1.10 |
| — | `nanoid` | ✅ → 3.3.18, entraba de arrastre por `postcss` |

### Las 3 que quedan se cierran juntas con `next@16.3.1`

`next` ya no aporta advisories propias: figura en el reporte sólo **via `postcss`, `sharp`**. Y esas dos no se arreglan subiendo el `postcss` de arriba —eso ya se hizo— porque el vulnerable es el que Next trae adentro, en `node_modules/next/node_modules/postcss@8.4.31`. npm lo dice explícito: `fixAvailable: {"name":"next","version":"16.3.1","isSemVerMajor":false}`.

**Decisión del 16/08/2026: quedarse en la línea 16.2.x.** No se salta de minor justo antes de invitar usuarios para ganar un reporte limpio, cuando ninguna de las tres es alcanzable: las de `postcss` son lectura de `.map` vía `sourceMappingURL` en build-time, y no hay CSS de un atacante en el build.

**Cuando toque subir de línea menor, `next@16.3.1` cierra las tres de un saque.** Es el momento de hacerlo: no requiere trabajo aparte, sólo que la subida esté decidida por otro motivo.

### 1. `next` — **directa**, high

`16.2.4`; el fix es `16.2.12`, **bump de patch, no cambia de major**.
Arrastra ~22 advisories. Los que importan acá:

- **Bypass de middleware / proxy** (varios high: `GHSA-267c-6grr-h53f`,
  `GHSA-492v-c6pp-mqqv`, `GHSA-26hh-7cqf-hhc6`). Es *el* que hay que mirar en este
  proyecto, porque [proxy.ts](../proxy.ts) es donde vive la protección de rutas.
  **Pero hay defensa en profundidad y aguanta**: verifiqué las 15 rutas de
  `app/api/teacher/` y las 15 revalidan el rol contra la base — 8 vía `getTeacherViewer()`
  y 7 con un `requireTeacher()` local que consulta `role` en Postgres. Un bypass del
  middleware **no** le da a un alumno acceso a los endpoints de docente.
  Lo que sí queda expuesto son las **páginas** `/teacher/*`, que dependen sólo del
  middleware. Ese es el hueco real.
- **DoS** (Server Components, Cache Components, Server Actions). Reales pero de bajo valor
  para este target.
- **DoS de Image Optimization** (2 advisories) — **no aplica**: `next.config.mjs` tiene
  `images.unoptimized: true`, el pipeline no corre.

*Veredicto: **hecho el 16/08/2026** (`16.2.12`). Cerró el hueco de las páginas `/teacher/*`, que era el único que no tenía defensa en profundidad detrás.*

### 2. `next-auth` — **directa**, critical

`5.0.0-beta.31`. Rango afectado `4.24.8 - 5.0.0-beta.31`.

- **`GHSA-8fpg-xm3f-6cx3` (critical)** — un error de configuración puede dejar el objeto
  `auth` poblado con un error, y ahí **los chequeos de autenticación basados en existencia
  fallan abiertos**. Es directamente relevante: `getViewer()` hace
  `if (session?.user?.id)` ([lib/auth-session.ts:52](../lib/auth-session.ts#L52)) y las 7
  rutas con auth inline hacen `const session = await auth(); if (!userId) return 401`.
  Todos son chequeos por existencia, que es justo el patrón que el advisory describe.
  Mitiga en parte que las rutas de docente después van a la base a buscar el rol: una
  sesión fail-open sin user id válido no resuelve a `DOCENTE`. Las rutas de alumno
  dependen de `getViewer()` sola.
- **`GHSA-7rqj-j65f-68wh` (critical, homoglifos en el normalizador de email)** —
  **no aplica**: sólo afecta al provider Email. [auth.ts](../auth.ts) configura únicamente
  Google + la cookie de invitado.
- **`GHSA-xmf8-cvqr-rfgj` (high)** — `getToken()` tira excepción no capturada ante un
  header `Bearer` malformado. Vector de DoS barato si algo llama a `getToken()`.

*Veredicto: **hecho el 16/08/2026** (beta.31 → beta.32), con el smoke test manual pendiente
de la lista de acá abajo.*

> **El arreglo de `GHSA-8fpg-xm3f-6cx3` puede DESTAPAR un problema, no sólo prevenirlo.**
> Lo que hacía era dejar pasar los chequeos por existencia ante un error de configuración.
> Corregido, esa misma configuración rota deja de pasar inadvertida y se manifiesta como
> login que falla. Si aparece un problema de login después de este bump, la primera
> hipótesis no es "lo rompió el bump" sino "había un error de config que hasta ahora venía
> fallando abierto".
>
> Smoke test manual, que no lo cubre ningún test automático — los de
> `tests/middleware-matcher.test.ts` son léxicos, verifican el patrón declarado en
> `proxy.ts` y no el runtime de Auth.js:
>
> 1. Login con Google.
> 2. Sesión de invitado entrando por código de aula.
> 3. Que el middleware siga bloqueando `/teacher` para un ALUMNO.
> 4. El switch de rol ALUMNO↔DOCENTE, que `getTeacherViewer()` lee de la base y no del JWT.

### 3. `@auth/core` — **transitiva** (vía `next-auth`), critical

Mismos advisories que arriba. Se resolvió con el mismo bump (0.41.2 → 0.41.3); no se tocó por separado.

### 4. `postcss` — **directa** (devDep `^8.5`) **y** transitiva vía `next`, high

`8.5.14`. Las tres advisories son lectura arbitraria de archivos y path traversal vía
`sourceMappingURL` en comentarios CSS, más un XSS por `</style>` sin escapar en el output.

**No explotable acá**: son rutas de *build*, y requieren CSS controlado por un atacante.
Todo el CSS del proyecto es propio (Tailwind + `globals.css`); no se procesa CSS subido
por nadie. El XSS de stringify requiere que se sirva el output de PostCSS sobre input
hostil, cosa que no pasa.

*Veredicto: **parcialmente hecho el 16/08/2026.** El `postcss` directo subió a 8.5.26 (y con
él `nanoid` a 3.3.18). El que sigue abierto es el que `next` trae empaquetado — ver arriba:
sólo lo cierra `next@16.3.1`. La premisa de "no explotable" no cambia: sigue siendo build-time
sobre CSS propio.*

### 5. `sharp` — **transitiva** (vía `next`), high

`<0.35.0`, CVEs heredadas de libvips (`CVE-2026-33327/33328/35590/35591`).

**No explotable en este proyecto**: `sharp` sólo lo invoca el pipeline de Image
Optimization de Next, y `next.config.mjs` lo tiene apagado con `images.unoptimized: true`.
Es código muerto en este deploy. La condición quedó anotada en un comentario **junto a la
flag misma**, que es donde alguien la va a leer antes de cambiarla.

> ⚠️ **Esto se enciende solo.** No hace falta tocar `sharp` ni actualizar nada: alcanza con
> que alguien ponga `images.unoptimized: false` —o borre la línea, porque el default de Next
> es optimizar— para que las cuatro CVEs de libvips pasen de código muerto a camino vivo, en
> el mismo commit y sin que ningún `npm audit` cambie de número. La mitigación no vive en el
> lockfile: vive en esa flag. Si se reactiva la optimización de imágenes, subir `next` a
> **16.3.1** (que trae `sharp` ≥ 0.35.0) deja de ser opcional y pasa a ser parte del mismo
> cambio.

*Veredicto: vivir con esto, con esa condición — y con el aviso de arriba.*

### 6. `vite` — **transitiva** (vía `vitest`, devDependency), high

`8.0.0 - 8.0.15`. Bypass de `server.fs.deny` en rutas alternativas de Windows, más una
fuga de hash NTLMv2 en `launch-editor` vía rutas UNC.

**Sin exposición en producción**: `vite` sólo existe dentro del test runner. Nunca se
bundlea ni se despliega — el dev server de este proyecto es el de Next, no el de Vite.
El bypass de `fs.deny` necesita un dev server de Vite corriendo y alcanzable por el
atacante; la fuga NTLM necesita que alguien haga click en el overlay de error de Vite
desde una página hostil.

*Veredicto: **hecho el 16/08/2026.** Se levantó de paso, como decía acá: `vitest` 4.1.6 →
4.1.10 lo lleva a `vite` 8.2.1. No hizo falta tocar `package.json` — caía dentro de `^4.1.6`.*

---

## 4. ESLint — instalado el 2026-08-04, **70 warnings** (arrancó en 93)

`npm run lint` venía fallando desde antes porque **ESLint no estaba instalado**: el script
decía `eslint .` y no había binario. No era una regla rota, era la herramienta ausente.

Se instaló `eslint@9` + `eslint-config-next@16.2.4`, pineado a la misma versión que `next`.
Desde la 16 ese paquete exporta configs planas directas, así que
[eslint.config.mjs](../eslint.config.mjs) no necesita `FlatCompat` ni `@eslint/eslintrc`; los
presets `core-web-vitals` y `typescript` ya traen typescript-eslint, react, react-hooks 7,
jsx-a11y e import. `next lint` está deprecado desde la 15 y no se usa.

La primera corrida dio **79 errores y 16 warnings**. Ninguno se arregló: se relevaron, se
clasificaron acá, y las cuatro reglas que producían errores se bajaron a `warn`.

**Por qué `warn` y no `off`.** `off` borra el hallazgo del reporte, y entonces nada distingue
"no lo arreglamos todavía" de "no existe". `warn` deja el lint en verde — ESLint sólo falla
por errores — y a la vez mantiene el inventario a la vista. Cada regla vuelve a `error` en
cuanto su bloque llegue a cero; el comentario que dice eso está al lado de cada una en la
config, no sólo acá.

**Esto no pone en verde nada que estuviera en rojo en CI**: [ci.yml](../.github/workflows/ci.yml)
corre `npm test` y `npm run build`, **no** el lint. La consecuencia de bajar a `warn` es
enteramente local. Que el lint no esté en CI es, por otro lado, su propia deuda — no tiene
sentido meterlo mientras queden decenas de warnings, porque el paso pasaría siempre.

### Estado al 2026-08-06

**93 → 70.** Se cerraron los pasos 1 a 4 del orden sugerido de más abajo, en dos tandas, con
`npm test` en verde después de cada una:

| Regla | Inicial | Ahora | Qué se hizo |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 52 | **50** | Sólo los 2 de `lib/db.ts`, importando el tipo del driver |
| `react-hooks/set-state-in-effect` | 22 | **16** | Los 5 de "estado derivado" + el `localStorage` del tour docente |
| `@typescript-eslint/no-unused-vars` | 14 | **2** | Borrado mecánico; quedan los `actionTypes` de `use-toast` (vendorizado) |
| `prefer-const` | 2 | **0** | `eslint --fix` |
| `@next/next/no-assign-module-variable` | 2 | **0** | Renombradas las dos variables `module` |
| `@next/next/no-img-element` | 1 | 1 | No aplica — ver 4c |
| `react-hooks/purity` | 1 | 1 | Código vendorizado — ver 4c |

Lo cerrado en `set-state-in-effect` es el grupo que la sección 4b marcaba como el que da bugs
de verdad:

- **`teacher-subject-wizard.tsx` (5 → 1).** Los tres lookups de currícula (años, materias,
  ejes) empezaban con un `setState([])` sincrónico para vaciar la lista. Ahora pasan por
  `useCurriculumLookup`, que guarda la respuesta junto a la URL que la produjo y deriva la
  lista de si esa URL sigue vigente. De paso arregla un bug real: al cambiar de nivel, los
  años del nivel anterior seguían en pantalla hasta que llegaba el fetch, y en esa ventana se
  podía elegir un año inexistente para el nivel recién elegido. El quinto era la
  autoselección de materia, que ahora es un `useMemo` sobre `browseMateriaChoice`, donde
  `null` ("todavía no eligió") dejó de ser lo mismo que `''` ("eligió ninguna").
- **`explanation-modal.tsx` (2 → 1).** El efecto máquina-de-escribir guardaba el texto ya
  revelado; ahora guarda `{ source, length }` y el texto se calcula, así que un enunciado
  nuevo reinicia la animación sin escribir estado desde el efecto.

**Los 2 que quedan en esos archivos no son estado derivado**: son "disparar una acción cuando
el diálogo se abre o se monta", que es la categoría *bootstrap* del final de esta sección. El
arreglo correcto es remontar el diálogo con `key` en vez de resetear a mano, y eso es un
cambio de cómo el padre renderiza un componente de 1200 líneas — no un lint fix.

### Clasificación

Los números de esta tabla son los del relevamiento inicial; la tabla de arriba tiene los
actuales.

| Regla | Cant. | Qué es | Riesgo real | Costo |
|---|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 52 | Tipos escapados a `any` | **Medio** | Alto |
| `react-hooks/set-state-in-effect` | 22 | `setState` dentro de `useEffect` | **Bajo-medio** | Medio |
| `@typescript-eslint/no-unused-vars` | 14 | Imports y bindings muertos | Ninguno | Trivial |
| `prefer-const` | 2 | `let` que nunca se reasigna | Ninguno | Trivial (autofix) |
| `@next/next/no-assign-module-variable` | 2 | Variable local llamada `module` | Bajo | Trivial |
| `@next/next/no-img-element` | 1 | `<img>` en vez de `next/image` | Ninguno acá | Ninguno |
| `react-hooks/purity` | 1 | `Math.random()` en render | Ninguno | No se toca |

### 4a. `no-explicit-any` — 52, el bloque grande

Concentración real, no disperso:

| Archivo | Cant. |
|---|---|
| `app/api/generate-quiz/route.ts` | 18 |
| `app/api/teacher/classrooms/[id]/report/route.ts` | 8 |
| `lib/ai-usage.ts` | 5 |
| `app/api/teacher/classrooms/[id]/students/[userId]/route.ts` | 4 |
| `app/(app)/teacher/page.tsx`, `app/api/student/classrooms/route.ts`, `lib/classrooms-server.ts`, `lib/db.ts` | 2 c/u |
| 9 archivos más | 1 c/u |

**Es la contracara de no tener ORM**, que es una decisión explícita (ver CLAUDE.md): el
driver de Neon devuelve las filas sin forma y `any` es el atajo. O sea que es exactamente el
mismo problema que ya se cerró a mano para cuatro queries en la sección 3a — y ahí quedó
documentado por qué importa: los cuatro **degradaban en silencio a "no hay datos"**,
indistinguible de un caso vacío legítimo.

Por eso el riesgo es medio y no cosmético: cada `any` sobre una fila de Postgres es un
contrato de shape que vive únicamente en el string de SQL. Pero el costo también es alto —
el arreglo correcto es declarar una interfaz por query, no un `Record<string, unknown>`
genérico, que suprimiría el problema igual que el `any`.

Dos de los 52 son distintos y hay que mirarlos aparte: los de `lib/db.ts` están en el
`sql` lazy (`let lazySql: any`), donde el `any` es el tipo del cliente de Neon y no de una
fila. Ese se arregla importando el tipo del driver, no escribiendo una interfaz.

### 4b. `react-hooks/set-state-in-effect` — 22, regla nueva

`eslint-plugin-react-hooks@7` la agregó; **no existía cuando se escribió este código**, así
que no es que alguien la ignoró.

| Archivo | Cant. |
|---|---|
| `components/teacher-subject-wizard.tsx` | 5 |
| `components/explanation-modal.tsx`, `components/teacher-classrooms.tsx` | 2 c/u |
| 13 archivos más (páginas de aulas/teacher, navbar, quiz-overlay, curriculum-selector, `use-mobile`…) | 1 c/u |

Se parten en dos grupos que no cuestan lo mismo:

- **Bootstrap de datos** (`navbar.tsx`, `aulas/page.tsx`, `teacher/page.tsx`): un `fetch` en
  un efecto que guarda la respuesta en estado. Es el patrón que la regla marca por defecto y
  el que menos vale la pena reescribir: la salida real es mover la carga al servidor, que es
  un cambio de arquitectura, no un lint fix.
- **Sincronización de estado derivado** (`teacher-subject-wizard.tsx`, `explanation-modal.tsx`):
  estado que se recalcula a partir de props o de otro estado. Estos **sí** conviene cerrarlos:
  son los que producen renders de más y estados imposibles, y el arreglo es derivar en vez de
  sincronizar. `quiz-overlay.tsx` es de este grupo y ya tiene un `eslint-disable` de
  `exhaustive-deps` puesto a mano, señal de que el efecto viene siendo incómodo hace rato.

### 4c. El resto — ruido, salvo dos

- **`no-unused-vars` (14)**: `app/(app)/teacher/page.tsx` (5) y `components/weak-points-section.tsx`
  (4) concentran la mayoría. Cero riesgo, borrado mecánico. Ya venía como warning en el
  preset, así que no bloqueaba nada.
- **`prefer-const` (2)**: `teoricoCollected` y `practicoCollected` en
  `app/api/generate-quiz/route.ts:712-713`. `eslint --fix` los cierra solos. Quedaron para no
  mezclar un cambio de código con el commit que instala la herramienta.
- **`no-assign-module-variable` (2)**: `const module = await import('word-extractor')` en
  `app/api/teacher/programs/extract/route.ts:238` y `.../guide/route.ts:165`. No reasigna
  nada — declara una variable llamada igual que el `module` de CommonJS, que el bundler puede
  terminar sombreando. Se arregla renombrando la variable. **Nota aparte: las dos rutas tienen
  el mismo helper de extracción duplicado**; el lint lo hizo visible de casualidad.
- **`no-img-element` (1)**: el avatar de Google en `components/navbar.tsx:283`. **No aplica**:
  `next.config.mjs` tiene `images.unoptimized: true`, así que `next/image` no optimizaría nada
  y sólo agregaría peso. Se deja como está, por la misma razón que el punto 5 de `npm audit`.
- **`react-hooks/purity` (1)**: `Math.random()` dentro de un `useMemo` en
  `components/ui/sidebar.tsx:611`, para el ancho del skeleton. Es código **vendorizado** de
  shadcn/ui, que CLAUDE.md dice componer y no reescribir. Arreglarlo se perdería en el
  próximo `npx shadcn add`. La regla queda en `warn` sólo para `components/ui/**`, con eso
  escrito en la config.

### Orden sugerido para cerrarlo

Por relación costo/beneficio, no por cantidad:

1. ~~**`prefer-const` + `no-unused-vars` (16)**~~ — **hecho**. Quedan 2 `no-unused-vars` en
   `use-toast`, que es vendorizado.
2. ~~**`no-assign-module-variable` (2)**~~ — **hecho**. Falta todavía decidir qué hacer con el
   helper de extracción duplicado que el lint dejó a la vista.
3. ~~**`no-explicit-any` en `lib/db.ts` (2)**~~ — **hecho**.
4. ~~**`set-state-in-effect`, grupo "estado derivado"**~~ — **hecho** (5 cerrados). Ver el
   detalle en "Estado al 2026-08-06".
5. **`no-explicit-any` sobre filas de Neon (50)** — *pendiente, y es lo que queda grande*.
   Archivo por archivo, empezando por `generate-quiz` que tiene 18. Mismo método que la
   sección 3a: una interfaz por query, con un comentario que apunte al `.sql` del DDL.
6. **`set-state-in-effect`, grupo "bootstrap" (16)** — último, porque el arreglo real es mover
   la carga al servidor, o remontar los diálogos con `key`, y eso no es un lint fix.

Recién con (5) hecho tiene sentido subir las reglas a `error` y meter `npm run lint` en CI.

### Nota: `run.log` estuvo trackeado

El commit `13a1867` incluyó `run.log` — 70 KB, UTF-16, 35.418 líneas, un volcado de
`gh run view --log`. Se sacó del índice con `git rm --cached` y se agregó a `.gitignore`
junto con `*.run.log`. Se le pasó un scan de secretos (tokens de Sentry, npm, claves de
Google, URLs de Postgres) y salió limpio, así que **no hizo falta reescribir la historia**:
el archivo sigue existiendo en los commits viejos y ahí puede quedarse.

---

## 5. Source maps de Sentry con Turbopack — **diagnóstico, sin arreglo**

**Síntoma reportado:** los mapas suben bien durante el build, pero Sentry no los aplica —
el stack llega minificado y el panel ofrece *"Unminify Code"*. En el log de subida varios
`.js.map` aparecen sin debug ID.

Relevado el 2026-08-04 con tres builds locales (`next@16.2.4`, `@sentry/nextjs@10.69.0`),
uno de ellos con `CI=1` para que el plugin dejara de estar en `silent` y escupiera el
*Source Map Upload Report* completo.

### Qué está pasando realmente

**Turbopack es el bundler.** El build imprime `▲ Next.js 16.2.4 (Turbopack)` y deja
`.next/turbopack/`. En Next 16 Turbopack es el default de `next build`, no hace falta ningún
flag — el proyecto migró de bundler sin que nadie lo pidiera explícitamente.

**Por eso Sentry ya no corre como plugin del bundler.** El log muestra:

```
Running next.config.js provided runAfterProductionCompile ...
[@sentry/nextjs - After Production Compile] Info: ...
```

Con webpack, Sentry inyecta los debug IDs *durante* la compilación, desde un plugin. Con
Turbopack no hay dónde engancharse, así que el SDK usa el hook `runAfterProductionCompile`
de Next y **post-procesa el `.next` ya escrito**, inyectando los debug IDs con `sentry-cli`.
Es un camino distinto, más nuevo, y es el que hay que mirar.

### Los `.js.map` sin debug ID: reales, y en su mayoría inofensivos

Los conté. **No son un único problema, son dos, y ninguno de los dos es el que rompe.**

**56 de 240 mapas del servidor no tienen debug ID.** Son exactamente los
`.next/server/app/**/page.js.map` y `**/route.js.map`. Ahora, esos `.js` **no tienen código
de la aplicación**: son stubs de carga de 371 a 966 bytes. `app/api/feedback/route.js`
entero es esto:

```js
var R=require("../../../chunks/[turbopack]_runtime.js")("server/app/api/feedback/route.js")
R.c("server/chunks/_next-internal_server_app_api_feedback_route_actions_0bigvl-.js")
module.exports=R.m(957982).exports
```

El código real vive en `server/chunks/*.js`, **y esos sí tienen debug ID** (184 de 240). Un
stack de servidor apunta a los chunks, no a los stubs. Que aparezcan sin ID en el log es
ruido del reporte, no una pérdida de simbolicación.

**1 de 31 chunks de cliente no tiene debug ID:** `03~yq9q893hmn.js`, 112 KB, el chunk de
polyfills (contiene el shim de `Object.assign`). Ese sí es una pérdida real, pero acotada, y
tiene causa conocida: `widenClientFileUpload` está en su default `false`, que según la
documentación de Sentry excluye *"Next.js-internal code and code from dependencies"*.

Los otros 30 chunks de cliente están **bien**: verifiqué que cada uno arranca con el snippet
de runtime que registra el ID contra el stack…

```js
;!function(){try{var e=...globalThis...,n=(new e.Error).stack;
n&&((e._debugIds||(e._debugIds={}))[n]="0a3168e3-1ce2-400d-aa14-223e15399943")}catch(e){}}();
```

…y termina con `//# debugId=0a3168e3-…`. Los dos extremos del mecanismo están puestos: el
que el navegador lee en runtime y el que `sentry-cli` usa para aparear artefacto y mapa.

**Conclusión incómoda pero importante: la línea del log que llamó la atención no es la causa
del stack minificado.** Los archivos sin debug ID son stubs sin código y un chunk de
polyfills. Arreglarlos no va a desminificar nada de la aplicación.

### Entonces, ¿por qué llega minificado?

Tres hipótesis que sí lo explicarían, ordenadas por probabilidad. **No se puede decidir entre
ellas desde el repo** — hace falta mirar un evento real y el deploy que lo produjo.

#### A. El bug upstream de Next 16 + Turbopack — *la más probable*

[getsentry/sentry-javascript#18248](https://github.com/getsentry/sentry-javascript/issues/18248),
*"Function names remain mangled in Sentry stack traces after upgrading to Next.js 16 +
Turbopack"*. Abierto, etiquetado **State: Blocked** (espera a Turbopack, no a Sentry).
Coincide en versión y en bundler con este proyecto.

**Cómo confirmarlo en 30 segundos:** mirar un stack en el panel. Si el **archivo y la línea
son correctos** pero los **nombres de función siguen ofuscados**, es este. Si no se ve nada
del código fuente, no es este.

#### B. El build que sube no es el que se sirve

Los debug IDs se inyectan **después** de compilar, mutando `.next` (la doc de
`useRunAfterProductionCompileHook` lo advierte: *"Enabling this option will mutate your
Next.js build output"*). Cualquier cosa que reemplace un chunk después de esa inyección —
caché de build reutilizando artefactos de un deploy anterior, un rebuild — deja el navegador
sirviendo un `.js` cuyo ID no está en ningún bundle subido.

**Cómo confirmarlo:** tomar la URL exacta de un frame minificado del issue, bajar ese chunk
de producción, y buscarle el `//# debugId=` del final. Si no lo tiene, o si ese UUID no
aparece en el *Source Map Upload Report* del deploy que lo sirvió, es esto.

#### C. `widenClientFileUpload: false`

Sólo explica frames dentro de código de Next o de dependencias (el chunk de polyfills, o un
frame `[native code]`). **No explica** un stack minificado en código propio. Es un agujero
real pero chico.

### Opciones

| # | Opción | Costo | Qué resuelve |
|---|---|---|---|
| 1 | **Diagnosticar antes de tocar**: mirar un evento real y decidir entre A, B y C | 15 min | Nada por sí solo, pero evita cambiar el build a ciegas |
| 2 | **Volver a webpack**: `next build --webpack` | 1 palabra en `package.json` + build más lento | A y B de una. Es el camino que Sentry soporta hace años |
| 3 | **`widenClientFileUpload: true`** | Build más lento | Sólo C |
| 4 | **Esperar el fix upstream** | Cero | A, cuando llegue. Está *Blocked*, sin fecha |
| 5 | **`next build --no-mangling`** | Bundle más pesado en producción | Enmascara A a costa del usuario final |

El flag `--webpack` **existe en `next@16.2.4`** — lo verifiqué con `npx next build --help`,
está junto a `--turbopack`. No es un downgrade ni un experimento: es la opción de salida que
Next mantiene explícitamente.

### Recomendación

**Hacer (1) y después (2), en ese orden.**

Primero (1) porque el reporte del log llevaba a un callejón: los `.js.map` sin debug ID son
stubs vacíos, y sin mirar un evento real se corre el riesgo de "arreglar" eso y no cambiar
nada. Son quince minutos y descartan o confirman B, que es la única hipótesis que un cambio
de bundler **no** arreglaría si el problema fuera de caché de deploy.

Después (2) `next build --webpack`, salvo que el diagnóstico apunte claro a B. Razones:

- Es el único camino que Sentry soporta plenamente. La subida con Turbopack existe desde
  `@sentry/nextjs@10.13.0`, es reciente, y tiene bugs abiertos y bloqueados justo en esta
  combinación de versiones.
- Es reversible con una palabra, y no toca ni una línea de código de la aplicación.
- El costo es tiempo de build. En un proyecto de este tamaño eso es barato; un stack
  minificado en el único canal de observabilidad que hay, no.

**(3) va de arriba igual**, con cualquiera de las dos decisiones: cuesta un flag y cierra el
chunk de polyfills. **(5) no**: `--no-mangling` le hace pagar al alumno, con bytes, la
comodidad de leer un stack.

Lo que **no** conviene es tocar `deleteSourcemapsAfterUpload`. Está bien como está: borra
sólo los mapas de cliente (`.next/static/`), que son los únicos públicos, y deja los de
servidor, que Sentry necesita en runtime y que nadie puede descargar. Verificado en el build:
0 mapas en `.next/static/`, 240 en `.next/server/`.

### Nota sobre los builds de este diagnóstico

`SENTRY_AUTH_TOKEN` está en `.env.local`, así que **los tres builds subieron bundles de
artefactos al proyecto real** (`personal-667/maestria`), con el `release` tomado del SHA del
commit local de esta rama. Los dos últimos reportaron *"Nothing to upload, all files are on
the server"* — se deduplicaron por hash. No se borró ni se pisó nada, pero quedan un par de
releases con nombre de commit de rama en el panel.

---

## 6. `numeric-answer` sin validación contra datos reales

Al enchufar la corrección determinista de respuestas cortas (2026-08-14) se validaron los dos
módulos contra las 238 respuestas `short_answer` de producción, con
[scripts/report-short-answer-regrade.ts](../scripts/report-short-answer-regrade.ts). El
resultado fue bueno para uno solo de los dos:

| | validación contra producción |
|---|---|
| `lib/short-answer-grading.ts` | **15 recuperadas, 0 falsos positivos** sobre 225 incorrectas |
| `lib/numeric-answer.ts` | **ningún caso**. El camino numérico no se ejecutó ni una vez |

Sigue respaldado sólo por sus 22 tests unitarios. No es bloqueante —su riesgo de falso
positivo es bajo: tolerancia 0 para enteros y `PLAIN_NUMBER` valida la cadena entera, así que
`"3n+2"` no se lee como 3— pero conviene no decir que está probado contra producción, porque
no lo está.

**Por qué no hubo casos.** No es que la coma estuviera bloqueada: `short-answer-input.tsx` es
un `<textarea>` y el examen tiene respuestas con coma (`"8,4"`, `"-4,0"`, `"3,14 < 22/7"`).
La razón es más simple: en ese examen las respuestas numéricas o coincidían literalmente
—el `1/3` de una alumna entró por texto, no por el parser— o estaban derecho mal (`4` contra
`0`, `12` contra `13`). No apareció ni una donde la equivalencia numérica fuera lo que
decidía.

### `type="number"` en `numeric-input.tsx` — **resuelto el 2026-08-14**

Era un bug con consecuencia directa: `numeric-input.tsx` usaba `type="number"`, que en la
mayoría de los navegadores **descarta la coma decimal**. Un alumno en es-AR que escribía
`3,5` obtenía un valor vacío, y el botón "Verificar" quedaba deshabilitado sin decir por qué.
Afectaba al tipo de pregunta `numeric`, no a `short_answer` (ese input siempre fue un
`<textarea>`).

Ahora es `type="text"` con `inputMode="decimal"`, interpretado con `parseNumericAnswer`
—coma, punto, fracción, LaTeX, porcentaje—, y con las dos mitades que hacían falta para que
aceptar más formas sirva de algo: le devuelve al alumno qué entendió ("Leímos: 3,5", con
`formatNumericAnswer`) y le avisa **antes** de enviar cuando no puede interpretar.

`isCorrectNumeric` pasó a delegar en `isNumericallyEquivalent`. El fallback era `?? 0`, o sea
igualdad exacta en punto flotante; ahora sin `tolerance` explícita aplica
`defaultToleranceFor`. **Ninguna pregunta de resultado entero cambia de veredicto** —para
enteros esa función también devuelve 0—; lo que cambia es el caso no entero, donde `0,33`
contra `1/3` ahora acierta y un `7/4` calculado por división ya no puede fallar contra `1.75`
por un error de representación de 1e-17.

**Queda pendiente volver a correr el reporte** cuando haya un examen nuevo: recién con datos
posteriores a este arreglo `numeric-answer` va a recibir las formas equivalentes que el input
viejo no dejaba escribir, y va a haber con qué validarlo contra producción.

---

## Riesgos latentes

Cosas que hoy no molestan y que van a morder si cambia una condición. No son tareas: son
avisos para el momento en que alguien toque justo eso.

### Corepack y el pin de `packageManager`

`package.json` declara `"packageManager": "npm@10.9.8"`, que es el npm que trae Node 22 —
la versión que fija CI ([ci.yml](../.github/workflows/ci.yml#L21)). El entorno de
desarrollo actual corre **Node 24 / npm 11**.

Hoy no pasa nada: Corepack está instalado (0.34.6) pero **no está interceptando `npm`**;
el binario que se ejecuta es el que viene con Node, así que el campo es metadata inerte y
sirve nada más para declarar que el gestor es npm y no pnpm.

Se enciende en dos escenarios:

1. **Alguien corre `corepack enable`.** Ahí Corepack empieza a hacer valer el pin, y la
   diferencia entre el npm declarado (10.9.8) y el local (11.x) pasa de ser cosmética a
   ser un error duro en cada comando.
2. **CI se actualiza dentro de Node 22.** El workflow fija `node-version: '22'`, no una
   versión exacta, así que cuando salga un Node 22 con otro npm, el número pineado deja de
   describir lo que CI realmente usa — que era justamente para lo que se puso.

Si alguna vez molesta, la salida es fijar la versión exacta de Node en el workflow y que
el pin de npm la siga. Se dejó como está a propósito: el valor del campo hoy es declarar
**qué gestor** se usa, no clavar una versión.

### `images.unoptimized: true` y `sharp`

Ver el punto 5 de `npm audit`. Está comentado en `next.config.mjs`.

### `feedback_reports` y el refresco de staging

La migración 019 agrega [`feedback_reports`](../scripts/019-feedback-reports.sql), que guarda
**texto libre escrito por personas reales**. No tiene columna de email, pero es dato personal
de hecho: un alumno que reporta un problema escribe lo que se le ocurre, incluido su nombre
o el de su docente.

[`scripts/anonymize-staging.ts`](../scripts/anonymize-staging.ts) ya borra las dos tablas
equivalentes (`verification_tokens` y `teacher_program_uploads`) y **todavía no borra esta**.
Hoy no molesta porque la tabla no existe en ninguna base; muerde el día que alguien clone
producción a staging después de correr la 019.

El arreglo es una línea (`DELETE FROM feedback_reports`) junto a las otras dos. Quedó sin
hacer a propósito: tocar el script de anonimización es tocar el procedimiento de refresco de
branch, y eso no entraba en el alcance del commit que agregó el botón.

> **Cerrado el 2026-08-12.** La migración 019 se corrió contra producción (era la causa de
> `NeonDbError: relation "feedback_reports" does not exist`, MAESTRIA-Z: el botón de reportes
> devolvía 500 y se perdía todo lo que escribían los alumnos). Con la tabla ya existiendo, el
> riesgo dejó de ser latente, así que el `DELETE FROM feedback_reports` se agregó en el mismo
> movimiento. Contexto completo en [plan-prueba-de-fuego.md](plan-prueba-de-fuego.md).

### Los worktrees de agentes se crean desde el commit base de la sesión, no desde HEAD

Relevado el **2026-08-12** trabajando el plan de la prueba de fuego. No es deuda del proyecto
sino del harness, pero muerde acá y conviene tenerlo escrito antes de la próxima tanda.

Cuando se lanza un agente con aislamiento por worktree, el worktree nuevo **no parte del HEAD
actual de la rama de trabajo**: parte del commit en el que estaba la sesión cuando arrancó.
Verificado sobre cinco worktrees de agentes: los cinco tenían como padre `a3bb055`, el commit
base de la sesión, aunque la rama ya estaba en `d8df17b`.

Es inofensivo mientras cada agente escriba archivos nuevos — cuatro de los cinco lo eran y las
cuatro ramas mergearon limpio. Se vuelve peligroso en el único caso que importa: un agente que
tiene que **modificar** un archivo que cambió después del inicio de la sesión. Ahí trabaja sobre
la versión vieja y, al integrar, o hay conflicto textual o —peor— revierte en silencio el trabajo
intermedio.

Pasó exactamente eso con el agente de layout móvil, y **no rompió nada porque el brief le pedía
verificar una precondición**: "confirmá que este marcador está en el archivo; si no está, PARÁ y
reportá". Paró sin escribir una línea. La lección no es sobre este bug puntual sino sobre la
forma del brief: a un agente que va a modificar código existente hay que darle **cómo verificar
que partió de la base correcta**, no sólo qué cambiar.

La remediación es una línea al principio del brief (`git merge --ff-only <sha>` dentro del
worktree, más la verificación), y así se lanzó el reintento. Mientras el harness siga
comportándose así, cualquier agente que modifique archivos existentes necesita ese paso cero.

---

## Prioridades abiertas

### Arreglar antes de invitar usuarios

1. ~~**`next` → 16.2.12.**~~ — **hecho el 16/08/2026.** Cerró la familia de bypass de
   middleware, y con ella la exposición de las páginas `/teacher/*`, que era lo único sin
   defensa en profundidad detrás.
2. ~~**`next-auth` → último 5.0.0-beta.**~~ — **hecho el 16/08/2026** (beta.32). **Queda
   pendiente el smoke test manual**: login con Google, invitado por código de aula, bloqueo
   de `/teacher` para ALUMNO y switch de rol. Sin eso el ítem no está cerrado del todo —
   ningún test automático cubre el runtime de Auth.js.
3. **Partir el deploy de la migración 016 en dos pasos.** Ya está documentado en
   [staging.md](staging.md#L170) pero no resuelto: las migraciones corren *después* del
   deploy, y la 016 **renombra** `ai_generation_log` → `ai_usage_log`. Deployada de una,
   hay una ventana en la que el código nuevo consulta una tabla que todavía no existe.
   Un `ADD COLUMN` tolera ese desfasaje; un rename no.

### Próximo sprint

4. **Borrar o corregir las interfaces `Db*` sin uso de `lib/db.ts`** (ver 3a). No rompen
   nada, pero son tipos equivocados esperando que alguien los adopte de buena fe.
5. ~~**Primeros dos pasos del orden sugerido de ESLint**~~ — **hecho**, junto con los pasos 3
   y 4 (93 → 70). Lo que sigue es el paso 5: los 50 `no-explicit-any` sobre filas de Neon,
   empezando por los 18 de `generate-quiz`.
6. **Decidir el bundler de producción** (ver 5): mirar un stack real para separar el bug
   upstream de Turbopack de un desfasaje de deploy, y a partir de eso decidir si `next build`
   vuelve a webpack. Mientras tanto, los stacks del panel no son confiables.

### Vivir con esto

5. **`postcss`** — sólo build, y todo el CSS es propio. **Corrección:** *no* se arregla con el
   bump a 16.2.12, como decía este renglón. El directo subió a 8.5.26, pero el vulnerable que
   queda es el que `next` trae empaquetado, y ése sólo lo cierra `next@16.3.1`.
6. **`sharp`** — camino de código muerto por `images.unoptimized: true`, **y sólo mientras esa
   flag siga en `true`**: se reactiva sola si alguien la da vuelta, sin que el audit cambie.
   Ahí `next@16.3.1` deja de ser opcional.
7. ~~**`vite`**~~ — **hecho el 16/08/2026**, vía `vitest` 4.1.10.

---

## 6. Fallas disfrazadas de estado normal — inventario del 24/08/2026

Relevado después del incidente de la migración 023, que dejó `/practicar` caído
**nueve días para todos los niveles** mostrando *"No hay temas cargados para esta
materia todavía"*. La causa era un 500; la pantalla decía "no hay datos".

Es la tercera vez que un fallo se disfraza de resultado válido en este proyecto:

1. **10/08** — `Boolean(undefined) = false` guardaba respuestas cortas como
   incorrectas en silencio.
2. **15/08** — el roadmap describía `scripts/create-staging-branch.ts` como
   existente cuando no existía; nadie lo notó porque el documento se leía bien.
3. **24/08** — este.

El patrón no es un bug: es una **forma**. Dos variantes, medidas sobre 158
archivos de `app/`, `components/` y `hooks/`, y las 40 rutas de `app/api/`.

### 6a. `fetch` de cliente que consumen el body sin mirar `res.ok`

**15 llamadas en 10 archivos** (eran 18 en 11 antes de cerrar las cuatro del
selector de currículum). Todas hacen `.then(res => res.json())` o equivalente: un
500 queda indistinguible de una lista vacía.

| Archivo | # |
|---|---|
| `app/(app)/history/page.tsx` | 4 |
| `app/(app)/aulas/page.tsx` | 2 |
| `app/(app)/page.tsx` | 2 |
| `app/(app)/tips/page.tsx` | 1 |
| `components/diagnostic-report-card.tsx` | 1 |
| `components/navbar.tsx` | 1 |
| `components/onboarding-screen.tsx` | 1 |
| `components/share-quiz-dialog.tsx` | 1 |
| `components/teacher-classrooms.tsx` | 1 |
| `components/teacher-subject-wizard.tsx` | 1 |

**Ya cerrado:** las cuatro de `components/curriculum-selector.tsx`
(`fetchCareers`, `fetchGrades`, `fetchSubjects`, `fetchTopics`), vía el helper
`pedirJson` y el componente `CargaFallida`. Ese es el patrón a copiar.

**El más caro de los que quedan** es `components/onboarding-screen.tsx:56`:
consulta `/api/curriculum/grades` y es lo primero que ve un alumno nuevo. Si
falla, el onboarding se ve como "no hay años para tu nivel".

### 6b. Route handlers cuyo `catch` no reporta

**38 de 40 rutas tienen `catch`.** Separadas por cuánta señal dan, que es la
distinción que importa:

| | # | Qué pasa cuando falla |
|---|---|---|
| Llaman a un `captureXxx` de `lib/observability.ts` | **10** | evento con tags propios, filtrable |
| Sólo `console.error` | **8** | llega a Sentry por la integración de consola, sin tags |
| **Silencio total** | **20** | no llega nada |

Que la diferencia importa está medido: `relation "feedback_reports" does not
exist` (`MAESTRIA-Z`) llegó a Sentry porque `/api/feedback` hace
`console.error`. La de `/api/curriculum/topics` no hacía ni eso, y por eso duró
nueve días.

**Ya cerradas:** las cuatro de `app/api/curriculum/*` (`topics`, `careers`,
`grades`, `subjects`), con test en [tests/curriculum.test.ts](../tests/curriculum.test.ts)
que afirma sobre la **llamada** a `captureRouteFailure` y no sobre el status — el
500 ya se devolvía y no alcanzó.

Las 20 en silencio total:

```
app/api/classrooms/join/route.ts
app/api/student/assignments/[id]/route.ts
app/api/student/classrooms/route.ts
app/api/student/diagnostic-report/route.ts
app/api/student/guest/claim/route.ts
app/api/subjects/meta/route.ts
app/api/teacher/classrooms/route.ts
app/api/teacher/classrooms/[id]/route.ts
app/api/teacher/classrooms/[id]/assignments/route.ts
app/api/teacher/classrooms/[id]/assignments/[assignmentId]/route.ts
app/api/teacher/classrooms/[id]/members/route.ts
app/api/teacher/classrooms/[id]/members/[memberId]/route.ts
app/api/teacher/classrooms/[id]/report/route.ts
app/api/teacher/classrooms/[id]/students/[userId]/route.ts
app/api/teacher/diagnostic-report/route.ts
app/api/teacher/programs/cleanup-temp/route.ts
app/api/teacher/quizzes/route.ts
app/api/teacher/quizzes/[id]/route.ts
app/api/teacher/tour/route.ts
app/api/user/profile/route.ts
```

**Prioridad sugerida cuando se ataque:** las de `student/*` y `classrooms/join`
primero. Son las que toca un alumno —que no va a reportar nada, sólo se va— y
las únicas del grupo que un invitado sin cuenta puede ejercitar.

### 6c. Lo que haría falta para que no vuelva a crecer

Una regla de ESLint que exija mirar `res.ok` antes de consumir el body no existe
lista; habría que escribirla. Más barato y probablemente suficiente: que
`lib/observability.ts` exporte un `fetchJson` cliente, y revisar en code review
que ningún `fetch` nuevo lo esquive.

No se ataca ahora **por decisión explícita** (24/08/2026): se cerró la pantalla
que ya había fallado y se dejó el resto medido, para que la próxima vez se
discuta sobre números y no sobre impresiones.
