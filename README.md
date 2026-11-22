# MaestrIA

MaestrIA es una plataforma web de generación y gestión de cuestionarios educativos asistidos por IA, para **cualquier materia** (no solo matemática) y **cualquier nivel** (Primario, Secundario, Superior). Tiene dos roles con experiencias completamente distintas: **ALUMNO** (practica de forma autónoma o dentro de un aula) y **DOCENTE** (crea programas de materia, genera cuestionarios y gestiona aulas con seguimiento de sus alumnos).

> Nació como una app de práctica de matemática ("Malejo Math") y en agosto de 2026 se generalizó a cualquier disciplina, rebrandeada como MaestrIA.

## Stack técnico

- **Framework**: Next.js 16 (App Router, React 19), TypeScript.
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix UI primitives), framer-motion, KaTeX para renderizado de fórmulas LaTeX.
- **Estado cliente**: Zustand (`lib/store.ts`).
- **Auth**: NextAuth v5 (Auth.js) con proveedor Google OAuth, estrategia JWT. Sesiones de invitado (guest) vía cookie firmada propia para alumnos que entran a un aula sin cuenta.
- **Base de datos**: PostgreSQL serverless (Neon) accedida con `@neondatabase/serverless`, sin ORM — SQL crudo con tagged templates, migraciones numeradas a mano en `scripts/*.sql` + runners en `scripts/run-migration-*.ts`.
- **IA generativa**: Google Gemini vía Vercel AI SDK (`ai` + `@ai-sdk/google`), usando `generateObject` con esquemas Zod para forzar salida estructurada.
- **Parsing de archivos** (para que el docente suba su programa de materia): `mammoth` (.docx), `pdf-parse` (.pdf), `tesseract.js` (OCR de imágenes/escaneos), `word-extractor` (.doc legacy).
- **Testing**: Vitest (unit tests en `lib/*.test.ts` y `tests/`).
- **Deploy**: Vercel (proyecto vinculado a v0.app, cada merge a `main` despliega automáticamente).

## Roles y flujos principales

### ALUMNO
1. **Onboarding**: elige nivel/grado (persistido en `users.nivel/grado` y cacheado en el JWT) — no se le vuelve a preguntar en sesiones futuras.
2. **Practicar** (`/practicar`): elige materia/tema y genera un cuestionario on-demand vía IA, adaptado a su nivel y dificultad.
3. **Aulas** (`/aulas`, `/aula/[codigo]`): se une a un aula de un docente con un código, ve cuestionarios asignados con ventana de disponibilidad (`opensAt`/`dueAt`) y límite de intentos, y puede entrar **como invitado** (sin cuenta Google) tipeando solo un nombre.
4. **Historial** (`/history`): ve intentos pasados, dominio de temas (`topic_mastery`), racha de días (`streak`) y "puntos débiles" (`weak_points`) detectados automáticamente.
5. **Tips** (`/tips`): consejos personalizados generados por IA a partir de errores recurrentes (misconceptions) detectados en sus intentos.

### DOCENTE
1. **Programas de materia** (`teacher-subject-wizard.tsx`): crea la estructura de su materia de 3 formas — subir un archivo (programa en PDF/Word/imagen, extraído y estructurado por IA), elegir del currículum oficial precargado, o armarlo manualmente. Cada programa tiene unidades → temas, un perfil pedagógico (nivel, complejidad, metodología) e ícono/color propios.
2. **Generación de cuestionarios**: a partir de un programa, genera preguntas con tipos configurables (opción múltiple, verdadero/falso, numérica, respuesta corta), las guarda o las comparte.
3. **Aulas** (`/teacher` → gestor de aulas): crea un aula ligada a un programa, obtiene un código de unión, ve la lista de miembros (verificados vs. invitados) y les asigna cuestionarios con fecha de apertura/vencimiento y cantidad máxima de intentos.
4. **Reportes**: por aula, ve desempeño agregado y por alumno (`/api/teacher/classrooms/[id]/report`).
5. **Exportación Moodle GIFT**: cualquier cuestionario se puede exportar al formato GIFT de Moodle, con soporte por tipo de pregunta y renderizado LaTeX (`lib/moodle-export.ts`).

## Motor de preguntas — tipos extensibles

El sistema de preguntas es una unión discriminada por `type` (`lib/types.ts`): `multiple_choice`, `short_answer`, `true_false`, `numeric`. Cada tipo define su propio Zod schema (generación), su componente de respuesta (`components/quiz-answer-inputs/*`), su lógica de corrección y su exportador GIFT. `short_answer` se corrige con IA (no hay matching exacto posible) vía `/api/quiz/grade-short-answer`.

## Personalización pedagógica por IA (`lib/education-context.ts`)

El corazón "inteligente" de la generación de contenido: dado nivel + grado + materia, construye un system prompt que ajusta automáticamente:
- Rango etario y etapa de desarrollo cognitivo.
- Registro lingüístico (vocabulario, longitud de oraciones, uso de emojis en primaria).
- Estrategia disciplinar (distractores diagnósticos típicos según sea Matemática, Ciencias Naturales, Sociales o Lengua).
- Tono de la retroalimentación/explicación (empático en primaria, riguroso en superior).
- Reglas anti-alucinación (no salirse del programa oficial del grado) y reglas de formato LaTeX/moneda.

## Deduplicación y normalización de preguntas (`lib/question-dedup.ts`, `lib/normalize-questions.ts`)

Evita que un alumno reciba el mismo ejercicio disfrazado de otro tipo o redacción (firma léxica + firma numérica), y normaliza preguntas "legacy" guardadas antes de que existieran los tipos extendidos, para que sigan siendo compatibles con el motor actual.

## Modelo de datos (resumen)

Migraciones SQL numeradas en `scripts/`, aplicadas manualmente vía runners TS. Tablas principales:
- `users`, `accounts` — identidad (NextAuth + rol ALUMNO/DOCENTE + nivel/grado persistido).
- `quiz_attempts`, `quiz_answers` — historial de intentos y respuestas (con `question_type` + `answer_payload` polimórfico desde la migración 013).
- `topic_mastery`, `student_misconceptions`, `student_tips` — seguimiento de progreso y tips generados.
- `curriculum` — currículum oficial precargado (actualmente jurisdicción Salta, desacoplado vía `DEFAULT_JURISDICTION`).
- `subjects` — registro de metadata (ícono/color) tanto para materias curriculares como creadas libremente por docentes.
- `teacher_programs` — programas de materia de cada docente (unidades/temas, perfil pedagógico, nivel/grado/jurisdicción).
- `teacher_quizzes` — cuestionarios guardados/compartidos por un docente.
- `classrooms`, `classroom_members`, `classroom_assignments` — aulas, membresía (incluye invitados no verificados) y asignaciones con ventana de tiempo/intentos.

## Autenticación y autorización

- Auth.js v5 con Google OAuth únicamente, estrategia JWT (sin hit a DB en cada request; el rol se cachea en el token y se refresca con `update()` tras onboarding).
- `proxy.ts` (middleware) protege rutas: redirige no-autenticados a `/sign-in`, bloquea a ALUMNO el acceso a `/teacher` y `/api/teacher/*`.
- Sesiones de invitado independientes (`lib/guest-session.ts`) para que un alumno entre a un aula solo con su nombre, sin cuenta — se resuelven en cada endpoint vía `getViewer()` (`lib/auth-session.ts`), que unifica sesión NextAuth + sesión guest.

## Scripts útiles

```bash
npm run dev          # servidor de desarrollo
npm run build         # build de producción
npm run test           # tests con Vitest
npm run lint            # ESLint
npm run e2e             # pruebas de punta a punta (Playwright) contra staging
```

### Pruebas de punta a punta (`npm run e2e`)

Seis recorridos con Playwright, en `e2e/`, contra el servidor de desarrollo de **staging** (`npm run dev:staging`; si no está corriendo, Playwright lo levanta). Entran por `/sign-in/dev`, así que **no corren contra producción** ni en el CI (no hay base de staging en GitHub Actions): se corren a mano antes de un PR que toque estos recorridos.

1. El docente crea una materia (del plan oficial), un grupo y una tarea, y la manda.
2. Un invitado entra por el código del grupo y hace la tarea.
3. Un alumno corta la conexión a mitad de una tarea, recarga y sigue donde estaba.
4. El docente abre la página del grupo y ordena la planilla.
5. El docente arma un diagnóstico para un grupo eligiendo temas.
6. Un alumno no puede entrar a `/teacher`.

La IA siempre está simulada (`simularGeneracion` en `e2e/ayudas.ts`; el diagnóstico simula sus dos rutas): correrlas no gasta. Usan a Irina (docente) y a Sofía (alumna) de staging. Los recorridos 1 y 2 dejan en staging una materia, un grupo y una tarea con el prefijo "E2E ·"; el invitado se quita del grupo al final para no llenar el tope del plan de Irina. El navegador es el Chromium que trae `@playwright/test` 1.63.0 ya instalado en la máquina; en otra máquina, `npx playwright install chromium` una vez. Para un solo archivo: `npx playwright test e2e/planilla.spec.ts`.

El login real con Google no está cubierto (no se puede automatizar sin una cuenta de prueba): sigue siendo manual.

Las migraciones se corren individualmente, ej: `npx tsx scripts/run-migration-015.ts`.

## Variables de entorno

Ver `.env.local.example`: conexión a Postgres (Neon), credenciales de Auth.js/Google OAuth, y la API key de Google Generative AI (Gemini).

## Novedades y Actualizaciones Recientes

- **Documentación Legal (Argentina)**: Se agregaron las páginas de Términos y Condiciones (`/terminos`) y Políticas de Privacidad (`/privacidad`), adaptadas a la Ley 25.326 de Argentina. Cubren los **tres** tipos de usuario que existen en el modelo de datos: docente registrado, alumno con cuenta propia de Google y alumno invitado sin cuenta — la distinción que importa no es el rol sino si hay o no una cuenta, porque sólo la cuenta implica entregar un correo electrónico. El contacto de ejercicio de derechos ARCO vive en [lib/legal-config.ts](lib/legal-config.ts), en un solo lugar para los dos documentos.
- **Tour de bienvenida del docente**: El panel muestra una presentación de dos pantallas con las tres formas de armar el temario (subir un archivo, partir del diseño curricular, escribirlo a mano). La marca de "ya lo vio" es `users.teacher_tour_seen_at` (migración 020) y la escribe el servidor recién al cerrarlo: antes vivía en `localStorage` y se marcaba al abrirlo, así que una recarga a destiempo se lo comía para siempre y volvía a aparecer en cada navegador nuevo.
- **Sistema de Feedback**: Nuevo botón para reportar problemas (`feat(feedback)`) que captura automáticamente el contexto de la aplicación.
- **Mantenimiento y Deuda Técnica**: Actualización a ESLint 9 (Next 16 + TS) e inventario de deuda técnica.
- **Mejoras de Infraestructura**:
  - Corrección de rutas de Sentry (sourcemaps con Turbopack) e instrumentación de fallos (`captureRouteFailure`).
  - Normalización del host de Neon DB para prevenir saltos del guardrail de base de datos no unpooled, y mejor reporte de variables de entorno faltantes.
  - Fix en el runner de cuestionarios por pregunta.
- **Footer y avisos legales**: El `<Footer />` global vive en `app/(app)/layout.tsx`. Como ni la pantalla de ingreso (`/sign-in`) ni la de entrar a un aula por código (`/aula/[codigo]`) están bajo ese layout — son pantallas sueltas a propósito —, ambas llevan además un [`<LegalNotice />`](components/legal-notice.tsx) al pie del formulario: son los dos puntos donde efectivamente se recolecta el dato, y un alumno que entra como invitado no pasa por ningún otro lado.
