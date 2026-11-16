# Rediseño completo de MaestrIA

> Pegá todo lo que sigue como primer mensaje de la sesión, con el repositorio `MalejoMath` conectado y la carpeta `design-reference/` ya en la raíz.

---

## Rol y misión

Sos el diseñador y desarrollador principal del rediseño de **MaestrIA**, una plataforma donde un docente arma el temario de su materia y le manda trabajos prácticos a sus alumnos, y la IA diagnostica en qué se equivocan antes de darles la respuesta.

El repositorio es `MalejoMath` (el nombre viejo del producto). Está en producción, funciona, y hoy **no lo usa ningún alumno**: podés tocar las dos puntas sin romperle el día a nadie.

Tu misión tiene una sola frase: **que una docente de 50 años que no se lleva bien con la tecnología entre, entienda dónde está parada, cargue su temario y le mande la primera tarea a un alumno real, sola, sin que nadie le explique nada por teléfono.**

## El diseño ya está hecho. No lo inventes.

En la raíz del repo está la carpeta **`design-reference/`** con el sistema de diseño completo y las pantallas aprobadas.

**Las imágenes de `design-reference/pantallas/` son el diseño aprobado. Tu trabajo es reproducirlas con exactitud y convertirlas en pantallas reales, responsive y animadas.** No son inspiración ni un punto de partida: son la referencia.

### Lo que tenés que leer, en orden

1. `design-reference/README.md` — el índice de todo.
2. `design-reference/sistema/brand-book.md` — principios, color, tipografía, logo, iconografía.
3. `design-reference/sistema/tokens.json` — **la fuente de verdad de todos los valores.**
4. `design-reference/sistema/tokens.css` — los mismos tokens ya compilados, listos para copiar al proyecto.
5. `design-reference/sistema/voz-y-textos.md` — cómo habla la app y la tabla de vocabulario.
6. `design-reference/sistema/accesibilidad.md` — contrastes medidos, teclado, área táctil.
7. **Abrí las imágenes** `design-reference/pantallas/modo-claro.png`, `modo-oscuro.png` y `marca.png`.
8. `design-reference/sistema/componentes/<Nombre>/README.md` y su `preview.html`, los cinco.

### Cómo trabajar con las referencias

Al lado de cada PNG hay un `.html` con la misma pantalla en vivo. **Abrilo en el navegador e inspeccionalo** para sacar medidas, colores y espaciados exactos en vez de estimarlos desde la imagen. Cada valor que saques tiene que terminar en un token, nunca en un literal.

Diferencias permitidas respecto de la referencia: menú hamburguesa en celular, estados hover/foco/activo, animaciones, y secciones que la referencia no muestra (diseñalas en el mismo lenguaje, con los mismos tokens).

Después de leer todo, proponé en no más de 30 líneas tu plan para el bloque 1. **Esperá mi OK antes de implementar.**

## El problema que estás resolviendo

Esto no es un capricho estético. Los docentes que probaron la versión actual reportaron, con estas palabras:

> "Uno entra, pero es muy fácil perderse. Algunos usan código, algunos usan Google, no saben si son profes, si son alumnos. Toda esa parte es muy complicada para alguien nuevo."

Hay tres causas concretas en el código:

1. **Tres puertas de entrada que no saben de dónde venís.** `/sign-in` es solo Google y su subtítulo dice "Plataforma de Infraestructura Curricular". `/aula/[codigo]` ofrece dos caminos simultáneos (nombre de invitado o Google) sin decir cuál conviene. Quien llega a la raíz cae directo en una pantalla de rol.
2. **El rol se elige antes de ver nada, es binario y excluyente**, y abajo dice que se puede cambiar después — una frase que llega tarde, cuando la ansiedad de elegir mal ya ocurrió.
3. **Los dos roles comparten el mismo caparazón.** `components/navbar.tsx` muestra los mismos links base (Inicio, Cofre de Tips, Historial) para todos, agrega uno según el rol, y tiene **un desplegable que cambia tu rol en caliente**. Una persona puede cambiar de rol sin querer y ver otra aplicación.

## Inventario actual

### Rutas

| Ruta | Quién | Qué hace hoy |
|---|---|---|
| `/sign-in` | Cualquiera | Solo Google |
| `/sign-up` | Cualquiera | Alta |
| `/` | Logueado | Pantalla de rol si no completó onboarding |
| `/practicar` | Alumno | Práctica libre, layout propio sin navbar |
| `/aulas` | Alumno | Sus grupos |
| `/aula/[codigo]` | Alumno | Entrar por código: invitado o Google |
| `/history` | Alumno | Intentos, dominio de temas, racha |
| `/tips` | Alumno | "Cofre de Tips" |
| `/teacher` | Docente | Panel: materias, generación, cuestionarios |
| `/teacher/diagnostico` | Docente | Reporte de diagnóstico |
| `/admin/ai-usage` | Mauro | Consumo de IA |
| `/terminos`, `/privacidad` | Cualquiera | Legales |

### Componentes que vas a tocar

`navbar.tsx` · `onboarding-gate.tsx` · `onboarding-screen.tsx` · `app-guards.tsx` · `teacher-onboarding-modal.tsx` · `teacher-subject-wizard.tsx` (1322 líneas) · `teacher-classrooms.tsx` (864) · `app/(app)/teacher/page.tsx` (994) · `app/aula/[codigo]/page.tsx` · `app/sign-in/[[...sign-in]]/page.tsx` · `join-classroom-field.tsx` · `loading-screen.tsx` · `footer.tsx` · `legal-notice.tsx`

Los tres archivos de más de 800 líneas mezclan orquestación con presentación. El rediseño es la oportunidad de partirlos; no la desaproveches.

## La arquitectura nueva: cuatro contextos

Hoy hay un caparazón para todos. A partir de ahora hay **cuatro contextos con navegación propia**, y una persona está siempre en uno solo.

### 1. Visitante (sin cuenta)

Llega a `/`. Ve una landing corta que explica qué es MaestrIA, y **una sola decisión**:

- Botón grande: **Soy docente**
- Botón grande: **Soy alumno**
- Separado por una línea: **campo de código** ("Tu profe te pasó un código")

Sin navbar. Sin links a nada más que legales en el pie.

**El método de ingreso no aparece acá.** Google o email con código vienen en la pantalla siguiente, después de elegir el rol. Ofrecer rol y método a la vez es exactamente lo que confunde hoy.

El diseño está en `design-reference/pantallas/modo-claro.png` (columna izquierda) y en el componente `ElegirRol`.

### 2. Invitado (alumno con código, sin cuenta)

Entra por `/aula/[codigo]` o por el campo de código. Ve **solo el grupo al que entró y sus tareas**. Nada más: ni práctica libre, ni historial, ni tips.

Arriba, el nombre de quien lo invitó: **"Te invitó Mauro Lizárraga"**. Si llegó por un link de grupo, **no se le pregunta el rol**: ya sabemos que es alumno.

Banner persistente, discreto, no modal: *"Estás entrando como invitado. Creá tu cuenta para no perder tu progreso."* con un botón que crea la cuenta y conserva lo hecho.

### 3. Alumno (con cuenta)

| Entrada | Qué hay |
|---|---|
| **Mis tareas** | Lo que le asignaron sus profes, con fecha. Es la pantalla de inicio. |
| **Practicar** | Práctica libre, con el límite de su plan visible. |
| **Mi progreso** | Historial, dominio por tema, racha y tips, **todo junto**. |

Hoy "Historial" y "Cofre de Tips" son dos entradas separadas: se funden en **Mi progreso**. Y "Cofre de Tips" deja de llamarse así; el vocabulario del sistema no usa nombres de juego.

Lo asignado es lo principal; la práctica libre existe pero es secundaria y tiene tope.

### 4. Docente (con cuenta)

| Entrada | Qué hay |
|---|---|
| **Mis alumnos** | Listado de personas con avance, última práctica y temas flojos. **Es la pantalla de inicio.** |
| **Mis materias** | Lo que hoy es la barra lateral del panel. |
| **Mis tareas** | Guardados y Realizados, como hoy. |

El docente **no ve** la navegación del alumno.

El diseño está en `design-reference/pantallas/modo-claro.png` (panel derecho).

#### Por qué alumnos primero

Un docente de instituto tiene una materia y treinta alumnos. Un profesor particular —que es el cliente de esta etapa— tiene ocho alumnos y cada uno prepara algo distinto: uno rinde Análisis I en diciembre, otra el ingreso a Medicina, un tercero trigonometría de quinto.

La unidad mental es la persona, no la materia. Hoy el panel está al revés.

**No hace falta cambiar el modelo de datos.** `classroom_members`, `quiz_attempts`, `topic_mastery` y `student_misconceptions` ya tienen todo. Falta una **vista** que lea cruzando grupos y lo presente por persona.

### El desplegable de rol se va del navbar

Hoy `navbar.tsx` tiene un `<Select>` que cambia el rol en caliente. **Sacalo de ahí.** Pasa al menú de usuario, con confirmación explícita y un texto que diga qué va a pasar: *"Vas a cambiar a la vista de alumno. Tus materias y alumnos siguen donde están."*

El rol se elige al entrar y rara vez se cambia. Que esté a un clic del logo es lo que hace que la gente se pierda.

## Qué ve cada uno

| Funcionalidad | Visitante | Invitado | Alumno | Docente |
|---|---|---|---|---|
| Landing y elegir rol | Sí | — | — | — |
| Entrar por código | Sí | — | Sí | — |
| Tareas asignadas | — | Sí (su grupo) | Sí | — |
| Práctica libre | — | No | Sí, con tope | Sí (para probar) |
| Progreso, dominio, tips | — | Solo del grupo | Sí | — |
| Crear temario | — | — | — | Sí |
| Generar y revisar cuestionarios | — | — | — | Sí |
| Grupos y asignaciones | — | — | Unirse | Crear y gestionar |
| Ficha de alumno | — | — | — | Sí |
| Consumo de IA | — | — | — | **No** (solo admin) |

## Pantalla por pantalla

### Entrada (`/`, `/sign-in`, `/aula/[codigo]`)

Rehacé las tres. El componente de referencia es `ElegirRol`.

- Fuera el subtítulo "Plataforma de Infraestructura Curricular". Poné una frase que un humano entienda.
- Sumá **email con código** como alternativa a Google. Hay docentes sin Gmail o que no quieren usar el personal.
- En `/aula/[codigo]`, el nombre del docente arriba y sin pregunta de rol.

### Onboarding del docente

Hoy `teacher-onboarding-modal.tsx` cierra cuando el docente eligió cómo armar el temario, y lo deja frente a un panel vacío.

**El onboarding no termina hasta que hay un alumno con una tarea asignada.** Cuatro hitos con barra de progreso que persiste entre sesiones:

```
[✓] Tu materia   [✓] Tu temario   [ ] Tu primer alumno   [ ] Tu primera tarea
```

Si abandona a mitad y vuelve mañana, retoma donde estaba. Hoy `users.teacher_tour_seen_at` es un booleano de "ya lo vio"; hace falta un campo de progreso.

### Onboarding del alumno

Distinto del docente, más corto. Qué es esto, cómo se entra a un grupo, dónde ve lo que le mandaron. Tres pantallas como mucho.

### Wizard de temario (`teacher-subject-wizard.tsx`)

Hoy los pasos son: Nivel y año → Materia → Temario → Ajustes.

**Pasá "Nivel y año" al final** en las rutas de archivo y manual: si subió un PDF, la IA puede inferirlo del contenido y el docente solo confirma. La ruta curricular mantiene nivel primero porque lo necesita para filtrar.

Durante la extracción, **mostrá qué está pasando**: "Leyendo el PDF… encontré 6 unidades… extrayendo temas." El spinner mudo es donde más gente abandona.

### Panel del docente (`app/(app)/teacher/page.tsx`)

Reordenalo en las tres entradas de arriba y partí el archivo: `teacher-students.tsx`, `teacher-subjects.tsx`, `teacher-quizzes.tsx`, y la página como contenedor. Objetivo: **bajo 300 líneas**.

La **ficha de alumno** es nueva y es el corazón: nombre, qué prepara, última actividad, dominio por tema con los chips del sistema, errores recurrentes detectados, y un botón "Asignarle una tarea" que abre la generación con la materia ya elegida.

El listado cierra con la **tarjeta de sugerencia** (componente `TarjetaAlumno`): una sola, que nombra a la persona, dice el hecho concreto y termina en un botón.

### Grupo automático

El docente **nunca ve un botón "crear aula"**. Escribe el nombre del primer alumno y el grupo aparece detrás.

### Pantalla de compartir

Es la que más rinde por línea escrita. Cuando la tarea está lista:

- El link del grupo, grande, con botón de copiar.
- Un texto prearmado para WhatsApp: *"Hola Sofía, te dejo la práctica de límites para esta semana: [link]. Entrás con tu nombre, no necesitás cuenta."*
- Un recordatorio de que el alumno puede entrar como invitado.

### Lado del alumno

`/practicar`, el motor de cuestionarios y los inputs de respuesta **funcionan y están probados con 31 personas reales**. Rediseñalos visualmente con los tokens, pero **no toques su lógica**. Fusioná `/history` y `/tips` en "Mi progreso".

## Vocabulario

La tabla completa está en `design-reference/sistema/voz-y-textos.md`. Lo esencial: temario (no programa de materia), grupo (no aula), tarea (no asignación), desde/hasta (no ventana de disponibilidad), plan oficial de la provincia (no diseño curricular), jurisdicción no se muestra nunca.

**Centralizalo en un módulo de textos**, no repartido por componentes.

## Reglas de diseño

Todo sale de `design-reference/`. Lo que más se incumple:

- **Ningún hexadecimal suelto.** Todo es `var(--token)`. Copiá `tokens.css` al proyecto y usalo.
- **Modo claro por defecto**, oscuro detrás del botón de la barra. Los dos modos son completos; no son una paleta y su inversa.
- **Bordes, no sombras.** Este sistema no tiene sombras.
- **Un solo azul por pantalla.** Si hay dos botones de acción compitiendo, uno es secundario.
- **Naranja para "flojo", nunca rojo.** Está explicado en el brand book y es una decisión de producto.
- **Nunca emojis** en la interfaz.
- Dos familias y ninguna más: Plus Jakarta Sans 800 para títulos, Inter para todo lo demás.
- El isotipo va inline con `stroke="currentColor"`. Hasta 26 px, trazo 4,8; por debajo, 8,5.

## Reglas de datos

- **No inventes datos de MaestrIA**: ni precios, ni cifras, ni nombres de instituciones, ni testimonios.
- Los alumnos de ejemplo en maquetas se llaman como en la referencia y se ven como ejemplo.
- Las cuotas y métricas que ya muestra la app salen de la base, nunca de un literal.

## Stack y restricciones

- **Next.js 16 App Router, React 19, TypeScript estricto.** Tailwind CSS 4 con variables CSS.
- **Framer Motion para toda animación.** Nada de animaciones CSS sueltas ni otra librería. Toda animación respeta `prefers-reduced-motion`.
- **shadcn/ui** estilo "new-york": los primitivos de `components/ui/` son vendored. Componé sobre ellos, no los reescribas.
- **Sin ORM.** SQL crudo con `@neondatabase/serverless`. Migraciones numeradas a mano en `scripts/*.sql` con su runner.
- **KaTeX** para fórmulas. Cualquier cambio de tipografía o de fondo se prueba con una fórmula larga en pantalla de 390 px.
- **Auth.js v5.** Nunca llames a `auth()` directo en un route handler: usá `getViewer()` de `lib/auth-session.ts`, que unifica sesión real y sesión de invitado.

Antes de tocar nada, leé `CLAUDE.md` y `docs/roadmap.md` del repo: tienen el guardarraíl de entornos, el modelo de datos y las lecciones ya pagadas.

## Fuera de alcance

- **La migración del modelo de IA.** La app usa `gemini-3.1-flash-lite` y va a migrar a la API de Claude, pero eso va en su propio PR y no se mezcla con un rediseño.
- **La lógica del motor de preguntas**, la deduplicación y la normalización de preguntas legacy.
- **El flujo institucional**: diagnóstico masivo, nivelación y los dos scripts one-off.
- **Facturación.** No existe tabla de suscripciones y está bien que no exista todavía. Si una pantalla necesita mostrar un límite de plan, usá una constante y dejala marcada.

## Forma de trabajo

### Primero maquetas, después código

**No implementes nada hasta que yo elija.** Para cada bloque, mostrame primero **dos o tres maquetas navegables** para comparar. Recién con mi elección pasás a código.

### Orden de los bloques

```
1. Entrada y navegación   ← el bloqueante, va primero
2. Onboarding docente     ← cuatro hitos
3. Panel: Mis alumnos     ← ficha de alumno y sugerencia
4. Wizard de temario      ← reordenar pasos y progreso visible
5. Compartir tarea        ← link y texto de WhatsApp
6. Lado del alumno        ← Mis tareas y Mi progreso
7. Onboarding alumno
```

Dentro de cada bloque podés trabajar en paralelo. Entre bloques no: el 1 condiciona a todos los demás.

### Ramas y PRs

Un bloque = una rama = un PR con preview de Vercel. Commits chicos en español. **Nunca hagas merge a `main` ni cambies variables de producción sin mi OK explícito.**

### Reportes

Al cerrar cada bloque: qué hiciste, link del preview, capturas a 1440 y 390, decisiones que tomaste y qué quedó pendiente. Si algo te bloquea, documentalo en el PR, proponé una alternativa y seguí con el bloque siguiente que no dependa de él.

## Calidad mínima para cerrar un bloque

- Pasan `npm run lint`, `npm run build` y `npm test`.
- Capturas a 1440 y 390 de todo lo que tocaste, adjuntas al PR.
- **WCAG AA**: contraste 4.5:1 en texto en **los dos modos**, foco visible, recorrido con Tab, `alt` y `label`, `useReducedMotion()`. Nada de `role="button"` sobre un `div`.
- Área táctil mínima de 44 px en celular.
- Ningún valor visual suelto fuera de los tokens.
- Una fórmula KaTeX larga se lee bien a 390 px, en claro y en oscuro.

Empezá leyendo `design-reference/README.md`, abriendo las imágenes de `design-reference/pantallas/`, y proponé el plan del bloque 1.
