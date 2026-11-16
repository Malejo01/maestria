# MaestrIA — Roadmap

Documento vivo. Última actualización: **16 de noviembre de 2026**.

## Tesis de producto

Crecimiento **docente-first, bottom-up, freemium**. El docente crea el aula y paga; el alumno (incluso guest, sin cuenta) siempre es gratis.

**Destino inmediato:** que la próxima experiencia con alumnos reales sea la buena. Los 31 de Análisis de Sistemas ya saben que existe y quedaron esperando el aviso — esa es la segunda oportunidad y no hay una tercera.

---

## 🎯 EL SALTO PENDIENTE: de una app que usa una persona a un producto

**El flujo completo que Mauro está haciendo a mano tiene que ser nativo para cualquier docente.** Esto no es un item de backlog: es la diferencia entre una herramienta y un producto, y hoy la app está del lado equivocado.

El recorrido real, el que ya se recorrió entero con 31 alumnos:

```
diagnóstico  →  reporte  →  nivelar  →  asignar
```

Cada uno de esos cuatro pasos existe y funciona. Ninguno es una función del producto:

| Paso | Cómo se hizo | Qué lo ata a Mauro |
|---|---|---|
| Diagnóstico | cuestionario generado a mano y compartido por WhatsApp | nada lo declara "diagnóstico"; es un cuestionario más |
| Reporte | `lib/diagnostic-report.ts` + `/teacher/diagnostico` | la página existe, pero el mapeo de ejes a unidades está **escrito para este programa** |
| Nivelar | `scripts/fix-perfiles-diagnostico-2026-08-10.ts` | script one-off, con la fecha en el nombre |
| Asignar | `scripts/inscribir-diagnostico-2026-08-10.ts` | script one-off, `--docente=<email>`, `FECHA_DIAGNOSTICO` hardcodeada |

Los dos scripts están bien escritos —dry-run, backup, `--revert`— y eso es exactamente el problema: **son buenas herramientas de operador, y ninguna docente va a abrir una terminal.** Una profesora que se registra mañana puede generar cuestionarios y crear un aula, pero no puede hacer nada de lo que hizo que esto sirviera para los 31.

Lo que hay que convertir en producto, en orden de dependencia:

1. **El diagnóstico como tipo de asignación**, no como un cuestionario cualquiera. Ver la sección de evaluación vs. práctica: es el mismo modelo.
2. **El reporte, parametrizado por programa.** Hoy `programLinkFor` conoce las unidades de esta cátedra. Tiene que salir de `curriculum` / `teacher_programs`, como sale todo lo demás.
3. **Nivelar desde la UI**: "estos 31 alumnos están en el nivel equivocado, corregilos" tiene que ser un botón con confirmación, no un script.
4. **Inscribir desde la UI**: ya existe el código de aula, que cubre el caso normal. Falta el caso masivo — "traé a todos los que rindieron el diagnóstico".

**Criterio de terminado, y conviene que sea incómodo:** una docente que nunca habló con nosotros tiene que poder recorrer los cuatro pasos sola, sin que nadie corra un script, sin que su email aparezca en ningún archivo del repo.

---

## 🎨 Rediseño completo (desde el 15/11/2026)

El encargo, el sistema de diseño y las pantallas aprobadas viven en `design-reference/` (en la raíz; **versionado desde el 16/11/2026**, G7: antes existía sólo en el disco de Mauro). El encargo es `design-reference/PROMPT-FABLE.md`. Siete bloques, uno por rama y por PR, apilados:

```
1. Entrada y navegación   ← este
2. Onboarding docente
3. Panel: Mis alumnos
4. Wizard de temario
5. Compartir tarea
6. Lado del alumno
7. Onboarding alumno
```

**Compuertas acordadas con Mauro el 15/11, y no se negocian aunque el trabajo corra en loop:** ninguna migración contra producción sin su OK explícito (sólo contra la branch de staging de Neon), y ningún merge a `main`. La elección entre maquetas se frena sólo en el bloque 1; del 2 al 7 se elige y se documenta la alternativa en el PR. Si el bloque 1 vuelve con cambios grandes, se corta la pila y se rearma desde `main`.

**La app se trata como en uso.** El encargo dice que hoy no la usa ningún alumno; este documento dice que los 31 de Análisis de Sistemas están en el aula 2. Ante la duda, no se rompe `/aula/[codigo]` ni el motor de cuestionarios.

### Bloque 1 — Entrada y navegación (rama `rediseno/1-entrada-navegacion`)

Maquetas comparadas en [docs/maquetas/bloque-1.html](maquetas/bloque-1.html). Elegido por Mauro: entrada A (la tarjeta aprobada con una frase arriba), ingreso como paso 2 dentro de la misma tarjeta, barra inferior en celular.

- [x] **Tokens.** `app/tokens.css` es copia exacta de `design-reference/sistema/tokens.css`. `globals.css` ya no define ningún color: conecta los roles de shadcn (`--primary`, `--border`…) con los tokens, así los primitivos de `components/ui/` cambian de piel sin reescribirse. Modo en `data-theme="claro|oscuro"`; el variant `dark:` de Tailwind apunta ahí. Sombras anuladas a nivel de tema.
- [x] **Tipografías.** Plus Jakarta Sans e Inter self-hosteadas en `app/fonts/`; se fueron Manrope y Playfair. Esto cierra de paso el hallazgo del wordmark en la fuente equivocada (`--font-brand` ya no existe).
- [x] **Modo claro por defecto, siempre.** No sigue la preferencia del sistema operativo. Sin next-themes: React 19 marca su `<script>` como error; el script va en el `<head>` del layout de servidor (`lib/tema.ts`, `hooks/use-tema.ts`).
- [x] **Textos centralizados** en `lib/textos.ts`, con el vocabulario (temario, grupo, tarea…). Las pantallas todavía no rediseñadas conservan sus textos viejos.
- [x] **Cuatro contextos**, decididos por `lib/navegacion.ts` (función pura, con tests): visitante, invitado, alumno (Mis tareas / Practicar / Mi progreso), docente (Mis alumnos / Mis materias / Mis tareas). El caparazón nuevo está en `components/caparazon/`; `components/navbar.tsx` se borró.
- [x] **Entrada** (`app/(entrada)/`): la raíz es un server component que manda a cada quien a su inicio y sólo le muestra la entrada al visitante. El rol se elige ANTES del método; `/sign-in?rol=…` es el paso 2. El rol elegido sobrevive a la ida y vuelta a Google en localStorage (`lib/rol-elegido.ts`), y la bienvenida no lo vuelve a preguntar.
- [x] **Link de grupo** (`/aula/[codigo]`): "Te invitó…", sin pregunta de rol, un camino recomendado (el nombre) y Google como secundario. La lógica de ingreso no se tocó.
- [x] **El desplegable de rol salió de la barra.** Ahora vive en el menú de la cuenta, con confirmación y el texto que dice qué va a pasar.
- [x] **Vista de alumno para el docente, en otra pestaña y sin cambiar el rol** (pedido de Mauro al elegir maquetas). El docente abre las pantallas de alumno con un aviso arriba; su rol sigue siendo DOCENTE, así que el panel sigue andando en la pestaña original. Por eso el caparazón se decide por ruta + rol, no sólo por rol.
- [x] **Favicon definitivo**: la M sin nodos sobre `accion`. Cierra el pendiente "Falta el arte definitivo" del backlog. `public/icon.svg` es la fuente; `node scripts/generar-iconos.mjs` deriva el resto.
- [x] **`scripts/capturas.mjs`**: capturas a 1440 y 390, claro y oscuro, manejando el Chrome o Edge instalado por DevTools. Sin dependencias nuevas.
- [x] **`tests/sistema-de-diseno.test.ts`**: chequeo léxico sobre lo ya rediseñado — sin hexadecimales, sin sombras, sin degradés, sin rojo, sin animaciones CSS, sin emojis. Cada bloque suma sus carpetas a `ZONAS_REDISENADAS`.

Decisiones que conviene no redescubrir:

- **Las URLs no cambiaron.** "Mis tareas" es `/aulas`, "Mi progreso" es `/history` (+ `/tips` como sub-entrada hasta que el bloque 6 las funda), y las tres pestañas del docente son `/teacher?seccion=alumnos|materias|tareas`. Renombrar rutas rompía links ya compartidos por WhatsApp a cambio de nada.
- **Los colores de los chips salen de `tokens.json`, no del HTML de referencia.** El HTML usa `#0B6044` y `#9A3412`; los tokens dicen `#0e7c57` y `#c2410c`. Los tokens son la fuente de verdad declarada.
- **La segunda línea de "Soy docente" no va atenuada.** La referencia la pone al 75 % de opacidad, que a 12 px da 3,8:1 sobre `accion` y no pasa AA.
- **Las clases tipográficas de los tokens van en la capa `base`.** Importadas sin capa le ganaban a las utilidades de Tailwind (`cuerpo-s font-bold` daba 400).
- **Lo que viene pintado del servidor no se anima.** `Aparecer` sólo anima lo que se monta después de hidratar: con `opacity: 0` de entrada, la primera pantalla quedaba invisible hasta que corriera el JS.
- **`destructive` de shadcn apunta a `flojo` (naranja).** El sistema no tiene rojo, a propósito.
- **`viewport` ya no bloquea el zoom** (`maximumScale: 1` + `userScalable: false` afuera): impedía agrandar una fórmula, WCAG 1.4.4.

Pendiente del bloque 1, a propósito:

- [x] ~~**Verificación con sesión real.**~~ Hecha el 15/11 al arrancar el bloque 2, con el ingreso de desarrollo contra staging: las tres pestañas del docente, el redirect de la raíz a `/teacher` y la vista de alumno con su aviso funcionan con sesión. Sigue sin recorrerse el camino por Google (elegir rol → Google → volver sin que la bienvenida pregunte de nuevo): necesita un OAuth client de staging (`docs/staging.md` §2.3).
- [ ] **Ingreso por email con código**: fuera de este bloque por decisión de Mauro. Necesita proveedor de correo, una key y una migración de tokens de verificación. Va en su propio PR, apagado por variable de entorno.
- [ ] **El panel docente por dentro es el viejo.** Las tres pestañas muestran las secciones que ya existían (aulas, materias, cuestionarios + crear) con los tokens nuevos aplicados por arrastre. Los bloques 3 y 4 lo rehacen; "+ Alumno" de la referencia llega con el bloque 3.
- [ ] **El inicio viejo del alumno (`/`) desapareció**: racha, contador y adelanto de tips vivían ahí. Siguen accesibles en Mi progreso; el bloque 6 arma el inicio nuevo con accesos a todo lo que puede hacer (pedido de Mauro).
- [ ] **Gráficos por tema y planilla por alumno** (pedido de Mauro al elegir maquetas): van en la ficha de alumno, bloque 3.
- [ ] `components/math-background.tsx` sigue montado en el cuestionario, los resultados y `/practicar` (degradé + grilla de puntos). Se va con el bloque 6.

### Bloque 2 — Onboarding docente (rama `rediseno/2-onboarding-docente`)

Sin maquetas con pausa (acordado). La alternativa descartada está al final.

- [x] **Staging en uso.** La branch `staging` de Neon del 15/08 seguía viva y anonimizada (re-verificado el 15/11: `deployment_env = staging`, 0 emails reales, 0 tokens). No hizo falta clonar producción de nuevo. Se le corrieron las migraciones 023 y 024, que le faltaban. `.env.staging.local` se armó cambiando sólo el host sobre `.env.local`, con un `AUTH_SECRET` distinto.
- [x] **`npm run dev:staging`** ([scripts/dev-staging.mjs](../scripts/dev-staging.mjs)): levanta `next dev` contra staging. `npm run dev` a secas **sigue apuntando a producción**; para trabajar en el rediseño se usa el otro.
- [x] **Ingreso de desarrollo** ([lib/dev-login.ts](../lib/dev-login.ts), `/sign-in/dev`): entrar como un usuario de staging sin Google. Tres candados: `next dev`, `DEV_LOGIN=1` (sólo en `.env.staging.local`) y que la base diga ser staging. En un build de producción el proveedor no se registra.
- [x] **Cuatro hitos** — Tu materia, Tu temario, Tu primer alumno, Tu primera tarea — en una tarjeta arriba del panel que no se va hasta que hay un alumno con una tarea mandada. Dice un solo paso por vez, con un solo botón.
- [x] **El progreso se deduce, no se guarda** ([lib/onboarding-docente.ts](../lib/onboarding-docente.ts), con tests). El encargo pedía un campo de progreso; se descartó a propósito: es exactamente la columna de cierre que nadie escribe de las "Lecciones operativas". Deducido de materias, temas, miembros y tareas mandadas, no se puede desincronizar, retoma solo en cualquier dispositivo y **no necesita migración**.
- [x] **Grupo automático.** El docente pide el link para su primer alumno y el grupo de esa materia se crea detrás (`POST /api/teacher/onboarding/grupo`, idempotente). No ve un botón "crear aula" en el onboarding.
- [x] **Los caminos del temario ya no se abren solos.** `teacher-onboarding-modal.tsx` perdió la pantalla de bienvenida en prosa: ahora es el primer paso de la tarjeta de hitos y lo abre el docente. Vocabulario al día ("plan oficial de la provincia").
- [x] `scripts/capturas.mjs` acepta `ENTRAR_COMO="Nombre"` para capturar pantallas con sesión.

Decisiones:

- **El hito del alumno se cumple cuando alguien entra**, no cuando el docente copia el link: no hay forma de saber si lo mandó. Mientras tanto la tarjeta dice "Esperando a tu primer alumno" y deja ir armando la tarea.
- **El docente no cuenta como su propio alumno** (la cuenta de Mauro es miembro del aula 2).
- **El "¡Listo!" dura 48 horas** desde la primera tarea mandada y se puede cerrar. El cierre vive en localStorage: es un aviso, no un estado.
- Descartado: guardar el progreso en `users` (migración + una columna que puede mentir) y un asistente modal a pantalla completa (tapa el panel, que es justo lo que el docente tiene que aprender a usar).

Pendiente, a propósito:

- [ ] **El grupo que crea el onboarding no aparece en la lista vieja de "Mis aulas" hasta recargar.** Esa lista se va en el bloque 3.
- [ ] **Mandar la tarea sigue siendo el flujo viejo** ("Asignar a un aula" en las tareas guardadas). El bloque 5 lo rehace con la pantalla de compartir.
- [ ] **Nombre del alumno y "qué prepara"** al invitarlo: bloque 3, que sí necesita migración.
- [ ] No se probó un alumno entrando de verdad para ver el hito 3 completarse en pantalla: la regla está cubierta por tests, el recorrido no.

### Bloque 3 — Panel: Mis alumnos (rama `rediseno/3-mis-alumnos`)

> ⚠️ **Trae la migración 025 y está corrida SÓLO en staging.** Antes de mergear este bloque a `main` hay que correrla contra producción (`npx tsx scripts/run-migration-025.ts`), con el OK de Mauro. Sin ella, Mis alumnos responde 500 — es exactamente el incidente de la 023. El job `schema-gate` lo marca en rojo si se mergea sin correrla, pero Vercel despliega igual.

- [x] **Migración 025** ([scripts/025-alumnos-contexto-e-invitaciones.sql](../scripts/025-alumnos-contexto-e-invitaciones.sql)): `classroom_members.contexto` (qué prepara el alumno, texto libre del docente) y la tabla `classroom_invitations` (alumnos agregados por nombre que todavía no entraron). Aditiva: una columna que admite NULL y una tabla nueva. El archivo nombra quién escribe cada cosa.
- [x] **Mis alumnos** ([components/docente/mis-alumnos.tsx](../components/docente/mis-alumnos.tsx)): una fila por persona cruzando grupos — inicial, nombre, qué prepara, hasta dos chips (el mejor tema y el peor) y la última práctica. Cierra con **una** sugerencia que termina en un botón, y con dos números de la semana. Es la pantalla de inicio del docente.
- [x] **Vista de planilla** del mismo listado, con todos los números en columnas (pedido de Mauro).
- [x] **Ficha de alumno** (`/teacher/alumnos/[userId]`): qué prepara (editable en el lugar), aciertos por tema en barras con su estado escrito, errores que se le repiten, la planilla de sus últimas 50 prácticas y el botón "Asignarle una tarea" con la materia ya elegida.
- [x] **"+ Alumno"** en la barra del docente: nombre, qué prepara y materia. El grupo se crea detrás; no hay botón "crear aula".
- [x] **`ChipTema`** con sus tres estados: dominado, flojo (naranja) y sin datos.
- [x] **El panel se partió.** `app/(app)/teacher/page.tsx` pasó de 1.025 líneas a 115: el estado quedó en `components/docente/use-panel-docente.ts` y cada pestaña en su componente. La presentación de Mis materias y Mis tareas se movió **tal cual**, sin cambiar lógica; se rediseñan en los bloques 4 y 5.
- [x] `scripts/seed-staging-alumnos.ts`: tres alumnos de ejemplo con actividad, para mirar el panel con algo adentro. Se niega a correr fuera de staging.

Decisiones:

- **"Cómo le va en un tema" sale de `quiz_attempts.topics[]`**, no de `quiz_answers.topic_name` ni de `topic_mastery` (las dos que este documento ya midió como inservibles). El costo: la cuenta es por intento, así que un intento de tres temas le suma a los tres.
- **Umbrales, en `lib/alumnos-docente.ts`**: menos de 5 respuestas calificadas es "sin datos"; desde 70 % de aciertos es dominado y por debajo flojo. (Desde B1, 16/11: dominado pide además 8 respuestas.) **Es un criterio de producto y lo decide Mauro**; se cambia en dos constantes.
- **Privacidad:** todo se filtra por los grupos del docente. Lo que el alumno practicó por su cuenta o con otro docente no aparece.
- **Las invitaciones no tienen columna de "aceptada".** Cuando entra al grupo alguien con el mismo nombre, el listado los funde al leer y el alumno hereda el contexto. Marcarla obligaba a tocar el ingreso al grupo, que está en uso. Si el alumno entra con otro nombre ("Sofi"), el docente ve dos filas y quita la pendiente.
- **Sin sugerencia cuando no hace falta.** Si a todos les va bien y practicaron hace poco, la tarjeta no aparece.
- **Los nombres largos de tema se acortan** en chips y frases (lo que va antes de los dos puntos); la ficha muestra el nombre entero.
- Descartado: una tabla de dominio por tema precalculada (otra `topic_mastery`), y fotos de perfil.

Pendiente, a propósito:

- [ ] **"Mis grupos" sigue siendo la gestión vieja**, plegada debajo del listado: códigos, tareas mandadas y seguimiento por grupo. Se va cuando el bloque 5 rehaga el envío de tareas.
- [ ] **Cerrar el ciclo de "errores que se le repiten"**: la ficha muestra los `student_misconceptions` sin resolver, y sigue sin haber quién los resuelva (ítem 🔺 del backlog). La ficha del docente es el lugar natural para ese botón.
- [ ] La ficha no se probó con un alumno en dos materias del mismo docente; la regla está en los tests.

### Bloque 4 — Wizard de temario (rama `rediseno/4-wizard-temario`)

Sin migraciones.

- [x] **"Nivel y año" pasó al final** en las rutas de archivo y manual: Materia → Temario → Nivel y año → Cómo das la materia. Con el plan oficial el nivel sigue primero, porque hace falta para filtrar. Al editar se conserva el orden de siempre. La regla está en [lib/wizard-temario.ts](../lib/wizard-temario.ts), con tests; los pasos se identifican por su contenido y el orden es un dato.
- [x] **El nivel y el año se leen del archivo, y el docente confirma.** La extracción le pide a la IA el nivel y el año **sólo si el documento los dice de forma explícita**; el paso llega prellenado con un aviso ("Esto lo leímos de tu archivo. Confirmalo o cambialo."). Nunca pisa lo que el docente ya eligió.
- [x] **Se ve qué está pasando durante la lectura.** `/api/teacher/programs/extract` responde, si se le pide con `Accept: application/x-ndjson`, una línea JSON por etapa a medida que ocurren: leyendo, leído, separando unidades y temas, listo. Sin ese encabezado responde como siempre. El componente muestra los renglones uno debajo del otro, sin porcentaje.
- [x] **Mis materias con los tokens**: las tarjetas perdieron el círculo rojo de borrar, el chip de color por materia y las sombras. Salió de `TODAVIA_VIEJOS`.
- [x] Vocabulario: "plan oficial de la provincia" en lugar de "diseño curricular", "Cómo das la materia" en lugar de "Ajustes", y la jurisdicción ya no se nombra en el wizard.

Decisiones:

- **Nivel va antes de "Cómo das la materia" y no último de todo**, que es lo que decía el encargo al pie de la letra: ese paso pregunta la carrera sólo si el nivel es Superior.
- **Sin "encontré 6 unidades" a mitad de camino.** Se probó una pasada rápida sin IA para poder decirlo: daba 4 donde la IA después encontraba 3. Un número que se corrige solo a los cinco segundos enseña a no creerle al siguiente, así que la etapa intermedia no da conteo y el final sí, que es el verdadero.
- **Los errores de lectura quedan escritos junto al archivo**, no en un aviso que desaparece.
- **El plan oficial no se ofrece en el paso de temario hasta que haya nivel y año.** Subiendo un archivo, aparece solo en cuanto la IA los lee.
- Descartado: una barra de porcentaje (no hay forma honesta de calcularla) y convertir la ruta entera a streaming obligatorio (rompía a cualquier otro cliente).

Verificado en browser contra staging con un PDF de ejemplo y la IA real: orden de pasos, los cinco renglones de progreso, 3 unidades y 9 temas cargados, y "5to anio" del archivo llevado a la opción "5to Año".

Pendiente, a propósito:

- [ ] **El interior de los pasos del wizard sigue con la presentación vieja** (1.300 líneas): se cambió el marco, el indicador de pasos, los botones y el vocabulario. Rehacer cada paso por dentro es trabajo aparte.
- [ ] Las tarjetas de Mis materias siguen siendo un `Card` con `onClick` y doble click para el detalle: no se alcanzan con Tab. El lápiz y el tacho sí son botones.
- [ ] No hay capturas del wizard: el script de capturas no maneja diálogos.
- [ ] No se probó con un Word ni con una foto, sólo con PDF.

### Bloque 5 — Compartir tarea (rama `rediseno/5-compartir-tarea`)

Sin migraciones.

- [x] **Mandar y compartir, en dos pasos del mismo diálogo** ([components/share-quiz-dialog.tsx](../components/share-quiz-dialog.tsx)). Paso 1: un solo botón, "Mandar la tarea"; las fechas y el límite de intentos están plegados porque casi nunca hacen falta. Paso 2, la pantalla de compartir: el link del grupo, grande, con su botón de copiar; un mensaje ya escrito para WhatsApp, editable, con "Copiar el mensaje" y "Abrir WhatsApp"; y el recordatorio de que el alumno entra con su nombre, sin cuenta.
- [x] **El grupo aparece solo.** Si la materia todavía no tiene grupo, se crea al abrir el diálogo. Se fue el callejón sin salida "Todavía no tenés un aula… Ir a Aulas".
- [x] **El mensaje no inventa** ([lib/compartir-tarea.ts](../lib/compartir-tarea.ts), con tests): no dice "para esta semana" si no hay fecha, y sólo saluda por el nombre si en esa materia hay exactamente un alumno. Nombra el tema si la tarea tiene uno o dos; con más, la materia.
- [x] **Mis tareas con los tokens**: una acción principal por tarea ("Mandar a mi grupo") y el resto secundarias. Borrar pide confirmación en el lugar; antes borraba al primer click. Salió de `TODAVIA_VIEJOS`, que quedó vacío.
- [x] Vocabulario: tarea, grupo, Desde / Hasta.

Decisiones:

- **Las fechas van plegadas**, no afuera: la decisión de esta pantalla es mandar. El encargo pedía "una decisión por pantalla".
- **El mensaje es editable**: el docente conoce a su alumno mejor que una plantilla.
- **"Abrir WhatsApp" usa `wa.me/?text=`**, que deja elegir el destinatario. No se pide ni se guarda ningún teléfono.
- **El estado vacío de Mis tareas espera a que termine la primera lectura.** Mostraba "Todavía no armaste ninguna tarea" durante el instante de carga: un estado que todavía no se sabe, dibujado como un hecho. Apareció mirando una captura.
- Descartado: una página aparte para compartir (se pierde el contexto de la tarea) y mandar el mensaje desde la app (necesita teléfonos y un proveedor).

Verificado en browser contra staging: se mandó una tarea real al grupo de Lengua, la pantalla de compartir mostró el link y el mensaje, y la tarjeta de primeros pasos pasó a "¡Listo! Ya mandaste tu primera tarea." (4 de 4).

Pendiente, a propósito:

- [ ] **"Mis grupos"** (la gestión vieja por grupo, plegada en Mis alumnos) sigue existiendo: es donde se ve quién entregó cada tarea, se cierra un grupo o se regenera su código. Mandar tareas ya no pasa por ahí.
- [ ] El paso de compartir no se puede reabrir para una tarea ya mandada sin volver a mandarla (lo cual es inofensivo: la asignación se actualiza, no se duplica).
- [ ] Sin capturas del diálogo: el script no maneja diálogos. Hay capturas de Mis tareas.
- [ ] No se probó con fecha "Hasta" en pantalla; el texto con fecha está cubierto por tests.

### Bloque 6 — Lado del alumno (rama `rediseno/6-lado-alumno`)

Sin migraciones. **No se tocó la lógica** del motor de cuestionarios, de la corrección ni de los inputs de respuesta: los 753 tests siguen pasando sin haber cambiado uno.

- [x] **Pase de tokens a toda la app** ([scripts/codemod-tokens.py](../scripts/codemod-tokens.py)): la paleta de Tailwind pasó a los tokens en 31 archivos, cambiando sólo nombres de clase. Verdes → `logrado`, rojos y naranjas → `flojo` (naranja, nunca rojo), azules y violetas → `accion`, grises → `texto` / `borde` / `superficie`. Degradés → el color sólido de arranque; sombras y desenfoques, afuera. Es idempotente.
- [x] **El chequeo de diseño cubre toda la app.** `tests/sistema-de-diseno.test.ts` pasó de revisar las carpetas rediseñadas a revisar `app/` y `components/` enteros (menos `components/ui/`, vendored). `TODAVIA_VIEJOS` quedó vacío.
- [x] **Mis tareas del alumno** (`/aulas`): todas las tareas de todos sus grupos en una sola lista, lo que hay para hacer primero. Un solo botón azul: la primera tarea disponible. Debajo, los accesos a Practicar y Mi progreso (pedido de Mauro: que el alumno vea todo lo que puede hacer), sus grupos con "Te invitó…" y el campo para sumarse a otro.
- [x] **Mi progreso**: `/history` y `/tips` se fundieron. Tres pestañas: Lo que hice, A reforzar, Mis tips. `/tips` redirige. "Cofre de Tips" dejó de llamarse así.
- [x] **Cuestionario, resultados y Practicar con los tokens.** Verificado en pantalla respondiendo una pregunta: la opción correcta en verde `logrado`, la elegida mal en naranja `flojo`, y el mensaje en el mismo tono.
- [x] **Sin emojis en la interfaz**: salieron de resultados, explicación, revancha, tips y temas a reforzar.
- [x] **Un solo azul**: las materias dejaron de tener color propio (`lib/subject-appearance.ts`). `color_name` se sigue guardando; ya no cambia cómo se ve. El selector de color salió del wizard.
- [x] **Fondo plano**: `MathBackground` (degradé + grilla + manchas) quedó como un fondo liso. Se conserva el componente para no tocar los siete lugares que lo montan.
- [x] **Íconos de carga con Framer Motion**: los `Loader2 animate-spin` pasaron a `<Cargando />`, que respeta `prefers-reduced-motion`.
- [x] La tarjeta que se da vuelta (`flashcard-3d`) es un `<button>` de verdad en vez de un `div` con `role="button"`.

Decisiones:

- **El invitado ya no ve la práctica libre del grupo**, sólo sus tareas, con una línea que dice que con cuenta la tiene. Es la decisión que este documento ya tenía tomada ("La práctica exige cuenta") y la tabla del encargo. Cambia comportamiento: antes un invitado podía generar hasta 3 por día.
- **"analysis" era el verde de acierto** dentro del cuestionario y el color del modo práctico en el armado. En el cuestionario pasó a `logrado`; en el armado, al azul.
- **El papel picado de los resultados se queda**, con los colores de los tokens. Es la única animación que no es de Framer Motion (usa `canvas-confetti`). **Decisión de Mauro**: si la regla es estricta, se saca en una línea.
- **Los prompts de la IA siguen pidiendo emojis** en las explicaciones para Primario (`app/api/explain-error/route.ts`). No se tocó: es contenido pedagógico generado, no interfaz, y cambiarlo cambia cómo le habla la app a un nene de 8 años. **Decisión de Mauro.**
- **La pantalla de error global conserva colores escritos a mano**: se muestra justo cuando la hoja de estilos no cargó. Son el espejo de los tokens y está anotado en el test.

Lo que el pase rompió y cómo se atrapó (queda escrito porque el script se puede volver a usar):

- **Se llevó una comilla** en dos lugares: la clase `'hover:shadow-xl …'` al principio de una cadena perdía su comilla de apertura. Lo atrapó el compilador. Corregido en el script.
- **Dejó botones sin fondo**: los que sólo tenían color por su degradé (`from-[var(--algebra)]`) quedaban con texto blanco sobre nada. Lo atrapó una captura de la pantalla de carga. Corregido: el arranque del degradé pasa a ser el fondo.
- **Los íconos de nivel de Practicar quedaron invisibles**: sus clases venían de `lib/nivel-options.ts`, fuera del alcance del pase. Lo atrapó otra captura.

Pendiente, a propósito:

- [ ] **Sólo se miró en pantalla una parte**: el cuestionario (una pregunta de opción múltiple, bien y mal), Mis tareas, Mi progreso y el primer paso de Practicar. No se recorrieron la pantalla de resultados, la explicación del error, la revancha, ni los inputs numérico, verdadero/falso y respuesta corta. Cambiaron sólo clases, pero no se vieron.
- [ ] El interior de `/history` conserva su estructura vieja (tarjetas grandes, filtros), ahora con los tokens. No se rediseñó la disposición.
- [ ] La racha de la home vieja no volvió a ningún lado: vivía en localStorage y contaba otra cosa que lo que decía su etiqueta (ver "Tarjetas de resumen de /history").
- [ ] `tw-animate-css` sigue importado: lo usan los primitivos de `components/ui/`.

### Bloque 7 — Onboarding del alumno (rama `rediseno/7-onboarding-alumno`)

Sin migraciones.

- [x] **Tres pantallas y nada más** ([components/entrada/bienvenida.tsx](../components/entrada/bienvenida.tsx)): qué es esto, cómo se entra a un grupo (se puede escribir el código ahí mismo) y dónde se ve lo que le mandaron. Con contador "1 de 3" y botón de volver.
- [x] **Ya no pregunta nivel y año.** Eran dos pantallas de formulario antes de ver nada, tenían un "saltar por ahora", y Practicar ya los pregunta cuando hacen falta.
- [x] **Quien llegó por el link de su profe no ve el pedido de código**: la segunda pantalla detecta que ya está en un grupo y se lo dice.
- [x] **El rol se guarda al terminar la tercera pantalla**, no antes. Quien cierra a la mitad las vuelve a ver: no hay un "ya lo vio" que pueda quedar marcado sin que lo haya visto.

#### 🚨 El JWT nunca se refrescaba — defecto que ya estaba en producción

Se destapó al probar este bloque. Al terminar la bienvenida, el rol se guardaba en la base pero la persona quedaba para siempre en "Preparando tu cuenta…".

**La causa:** en Auth.js v5, `useSession().update()` **sin argumento no dispara nada**. Hace un GET común de la sesión y devuelve el token tal como estaba (`node_modules/next-auth/react.js`: `typeof data === "undefined" ? undefined : { body: … }`). Sólo con un argumento hace el POST que el servidor marca como `trigger: 'update'`, que es lo que `auth.ts` espera para re-leer la base.

El repo llamaba a `update()` pelado en tres lugares: al terminar el onboarding, al cambiar de rol, y en el refresco automático de nivel y año. **Ninguno de los tres funcionaba.** Esto corrige dos entradas de más abajo:

- "**Refresh del JWT sin cerrar sesión**" (16/08), dada por implementada y nunca verificada en browser: **no andaba**. Los alumnos con perfil corregido seguían con el token viejo hasta volver a loguearse.
- El `forceOnboarded` del gate de onboarding no era una optimización: era lo que tapaba el síntoma.

No se notaba porque la barra vieja leía el rol de `/api/user/profile` y no del token. Se notó cuando la raíz del sitio pasó a decidir por el rol del token.

**El arreglo tuvo dos intentos**, y el primero falló igual de callado que el original: un hook que llamaba a `update({})` pero guardaba la función del primer render, que nace con `loading: true` adentro y sale por su `if (loading) return` sin hacer nada. Lo mostró la pestaña de red: después de guardar el rol no salía ningún POST a `/api/auth/session`. El definitivo ([hooks/use-refrescar-sesion.ts](../hooks/use-refrescar-sesion.ts)) usa siempre la `update` del último render. Un test fija las dos cosas y prohíbe sacar `update` de `useSession` fuera del hook.

Es la cuarta vez del mismo patrón: algo que no funciona y se ve igual que si funcionara (`Boolean(undefined)`, el 500 pintado como lista vacía, el JSONB reordenado, y ahora esto).

**Verificado en browser contra staging**, con una cuenta nueva sin rol: las tres pantallas, el rol en `null` hasta el final, y al terminar la sesión con `role: ALUMNO`, `isOnboarded: true` y la persona en Mis tareas. También el cambio de rol desde el menú: termina en `/teacher` con sesión de docente y el primer hito del onboarding docente a la vista.

**Consecuencia para producción, a tener presente al mergear:** el proxy bloquea `/teacher` a quien tenga `role: 'ALUMNO'` en el token. Con el refresco roto, un token viejo podía decir otra cosa que la base. Ahora dicen lo mismo.

Pendiente, a propósito:

- [ ] Las tres pantallas no tienen capturas: son un flujo con estado y el script de capturas sólo saca pantallas por URL. Hay captura de la primera (la elección de rol para una cuenta nueva).
- [ ] No se probó la segunda pantalla con un código real (entrar al grupo desde ahí), ni el caso "ya estás en el grupo".
- [ ] El invitado no tiene onboarding: llega por el link de su profe y cae directo en su tarea.

---

## 🔁 Tanda post-rediseño (desde el 16/11/2026)

Los siete bloques están en `main` (`f0911c3`) y la 025 corrida en producción. Esta tanda es lo que apareció mirando la app en el navegador, más lo que el rediseño dejó abierto. **Una tarea, una rama desde `main`, un PR**: nada apilado (los PRs apilados del rediseño costaron un rescate a mano). Una línea por tarea cerrada: qué se hizo y qué quedó sin verificar.

- [x] **A1 · Las explicaciones de la IA se ven formateadas** (rama `fix/a1-markdown-explicacion`). Se imprimían con `whitespace-pre-wrap` y el alumno leía los `##` y los `**`. Parser propio en [lib/markdown-explicacion.ts](../lib/markdown-explicacion.ts) y componente [explicacion-markdown.tsx](../components/explicacion-markdown.tsx), usado en los **tres** lugares que mostraban esa salida: el modal, la pantalla de resultados y Mi progreso. **Sin dependencia nueva, a propósito**: en `$a_1 * b_2$` un parser de Markdown ve cursiva, y los plugins de matemática tratan todo `$…$` como fórmula, cuando `LaTeXRenderer` ya distingue el `$` que no lo es. Las fórmulas se apartan crudas y las sigue dibujando él. Un marcador sin cerrar nunca se imprime (el modal revela el texto de a poco). De paso, dos defectos del modal a 390 px que mostró la captura: `max-w-lg mx-4` lo corría 16 px fuera de la pantalla, y el botón de revancha no partía renglón y ensanchaba todo. `scripts/capturas.mjs` ahora acepta `ANTES=<archivo.js>` para hacer clicks antes de la foto: **cierra el "no maneja diálogos"** que los bloques 4, 5 y 7 dejaron anotado. Capturas en `docs/capturas/a1-markdown/`. Verificado además con una explicación real del modelo en staging (4 encabezados, negritas, lista).
  - Sin verificar: resultados y Mi progreso se cambiaron pero no se miraron en pantalla (mismo componente, tamaño `compacto` en Mi progreso). Tablas y links de Markdown no se soportan: el prompt no los pide.
  - Queda: `components/weak-points-section.tsx` tiene el mismo `max-w-xl mx-4` en su diálogo; se mira en A5.
- [x] **A2 · El registro de Primario ya no se filtra a cursos superiores** (rama `fix/a2-registro-por-nivel`). **La causa no era el nivel por defecto** —`getEducationContext` siempre cayó a Secundario—, eran dos cosas: el prompt de `explain-error` tenía **un solo formato para todos los niveles**, con los emojis escritos a mano en los cuatro títulos y "elementos visuales/emojis… a su edad" en el cuerpo; y una tarea de grupo **no mandaba nivel** (dependía de un regex sobre el contexto del programa que sólo aceptaba la palabra exacta: "Terciario" caía a Secundario). Ahora el prompt vive en [lib/education-context.ts](../lib/education-context.ts) (`buildExplainErrorPrompt`) con un formato por registro; `normalizarNivel` acepta "secundaria", "Terciario", "Nivel Primario"; `resolverNivelYGrado` fija el orden **grupo → programa → perfil → Secundario**; `/aulas` manda el nivel y el año del grupo; y `quitarEmojis` limpia la salida fuera de Primario aunque el modelo no obedezca (no toca ↔, →, ✓ ni fórmulas). Secundario y Superior llevan además la prohibición en su registro, así que vale también para las preguntas generadas. Verificado con el modelo real en staging: 4.º de secundaria y terciario, sin emojis y con otro tono.
  - Sin verificar: Primario con el modelo real después del cambio (su prompt no cambió de texto, sólo de lugar). La revancha y la corrección de respuesta corta reciben el nivel del grupo por la misma vía, pero no se miraron.
  - **Para Mauro:** el tono de Secundario · Lengua salió seco ("este error demuestra que aún no has automatizado…"): es la persona "estricto e inspirador" que ya estaba, ahora sin el formato infantil que la tapaba. Y las explicaciones salen en tuteo neutro, no en voseo. Ninguna de las dos se tocó.
- [x] **A3 · Los nombres largos de tema ya no le comen el ancho al resultado** (rama `fix/a3-tema-largo-resultados`). **El encargo decía "pantalla de resultados" y ahí no se pudo reproducir**: a 1280 px, con el temario más largo de staging (temas de 125 caracteres), la pantalla de resultados del alumno no desborda nada. Donde un tema largo sí pelea con una columna de resultado es en la **ficha del alumno** del docente, y se arregló ahí: en "Sus prácticas" la celda Temas escribía los siete temas enteros separados por coma (cinco renglones, "comunidad., Clases de palabras…") y ahora nombra los tres primeros con su nombre corto y cuenta el resto (`resumirTemas`, con tests; el detalle entero queda en `title` y para lector de pantalla); en "Cómo le va en cada tema" el resultado ya no se achica ni parte renglón, y el nombre cede a dos renglones como mucho. Capturas en `docs/capturas/a3-tema-largo/`.
  - Sin verificar: **si Mauro vio el desborde en otra pantalla, sigue ahí** — falta saber cuál. No se probó con un tema de más de dos renglones a 1280 (no hay ninguno en staging).
  - Queda para A5: el botón flotante de "Reportar un problema" tapa el borde derecho de la fila que le quede debajo.
  - `scripts/capturas/terminar-tarea.js` hace una tarea entera y llega a resultados (sólo staging: escribe un intento). Las capturas de A1 dejaron cuatro "errores que se repiten" llamados "Captura" en la alumna de ejemplo de staging; el script ya no escribe ese texto.
- [x] **A4 · El panel del docente ya no queda en blanco mientras carga** (rama `feat/a4-skeleton-panel-docente`). Tres causas juntas: `MisAlumnos` devolvía `null` hasta tener datos; la sección del store arranca en `'materias'`, así que entrar a Mis alumnos dibujaba un instante Mis materias; y **las materias y las tareas no se empezaban a pedir hasta que terminara `/api/user/profile`**, porque `isTeacher` salía sólo del perfil. Ahora el rol sale del perfil y, mientras no llegó, de la sesión (un viaje de red menos antes de pedir nada); y cada pestaña tiene su esqueleto con la forma real ([components/docente/esqueletos.tsx](../components/docente/esqueletos.tsx), sobre `Esqueleto` y `ZonaDeCarga` de `components/sistema/`): un solo latido de Framer Motion por zona, quieto con `prefers-reduced-motion`, anunciado con `role="status"`. La pestaña la dice la URL, así que el esqueleto ya es el de la pantalla que viene. Mis tareas dejó de decir "Guardadas (0)" mientras lee. Capturas en `docs/capturas/a4-esqueleto/`.
  - Sin verificar: **no se midió cuánto bajan los 5 segundos**; en local contra staging la carga es demasiado rápida para medirla, y el arranque en frío de Neon no se ejercitó. El esqueleto con `prefers-reduced-motion` activo no se miró en pantalla (lo cubre el mismo criterio que `Cargando`).
  - Queda: la tarjeta de primeros pasos sigue apareciendo de golpe arriba y empuja el listado. No tiene esqueleto a propósito: para quien ya terminó el onboarding no aparece nunca, y reservarle el lugar sería un salto al revés.
- [x] **A5 · Recorrido completo a 390×844, en los dos modos** (rama `chore/a5-recorrido-celular`). 18 pantallas × 2 modos en `docs/capturas/a5-celular/`: entrada, ingreso de alumno y de docente, link de grupo, Mis tareas, cuestionario, resultados (como llega y con las incorrectas abiertas), explicación, Practicar, Mi progreso; y del docente Mis alumnos, Mis materias, Mis tareas, la ficha de un alumno y el diálogo de agregar alumno. **Sin código de producto**: sólo capturas, y `scripts/capturas.mjs` ahora encadena varios pasos en `ANTES=a.js,b.js`. Lo que está mal quedó como tareas F1–F7, abajo.
  - Bien a 390: entrada, ingreso, link de grupo, Mis tareas del alumno, el cuestionario, la explicación, Practicar, Mis alumnos, la ficha y agregar alumno.
  - **Sin recorrer** (y por lo tanto sin verificar en celular): el ingreso por Google de punta a punta; entrar al grupo con nombre (crea un invitado); las preguntas numérica, verdadero/falso y de respuesta corta (la tarea de staging sólo tiene opción múltiple); la revancha; el wizard de temario; armar y mandar una tarea; la vista de planilla; "Mis grupos". El cartel "2 Issues" de la captura de la entrada es del servidor de desarrollo (`Error: aborted`, por el navegador de capturas que se cierra), no de la app.

- [x] **B1 · "Dominado" pide más respuestas que "flojo"** (rama `feat/b1-umbral-dominado`). Las dos cosas se decidían con las mismas 5 respuestas. Ahora son dos constantes con nombre en [lib/alumnos-docente.ts](../lib/alumnos-docente.ts): `RESPUESTAS_PARA_FLOJO = 5` (alcanza para sospechar: equivocarse cuesta una tarea de más) y `RESPUESTAS_PARA_DOMINADO = 8` (para afirmar hace falta más: equivocarse acá hace que el docente deje de mirar un tema). **Entre 5 y 7 respuestas, si le va bien, el tema sigue "sin datos"**; si le va mal ya es flojo. La ficha y el listado usan la misma `estadoDeTema`, y el texto de la ficha arma su frase con las constantes.
  - Sin verificar: no se miró en pantalla (en staging ningún tema cae entre 5 y 7 respuestas, así que nada cambia de color). Efecto esperable en producción: algunos chips verdes pasan a "sin datos".
  - **Para Mauro:** el estado intermedio se llama "Sin datos", que no es exactamente cierto (hay datos, no alcanzan). El sistema tiene tres estados de chip; un cuarto es decisión de diseño.

- [x] **B2 · La excepción de animación quedó escrita, y dejó de ser falsa** (rama `fix/b2-movimiento-reducido`). La sección nueva está en `design-reference/sistema/accesibilidad.md` ("La excepción declarada: qué se mueve y por qué"): las nueve cosas que se animan, el motivo de cada una y qué hacen con `prefers-reduced-motion`. **Al inventariar para escribirla salió que el documento ya decía algo que el código no cumplía**: el papel picado de resultados no consultaba la preferencia (no es de Framer Motion, así que no pasaba por `useReducedMotion()`), y tampoco las transiciones de CSS ni la animación de apertura de los primitivos de `components/ui/`. Ahora el papel picado lleva `disableForReducedMotion: true` y `app/globals.css` tiene la red para todo lo que se mueve por CSS. Dos tests léxicos lo sostienen.
  - Sin verificar: **no se probó en un navegador con la preferencia activada**; lo que hay son los tests sobre el código. `design-reference/` no está versionado, así que el documento cambió sólo en la máquina de Mauro: este PR lleva el código.
  - El papel picado sigue siendo decisión de Mauro (bloque 6): si la regla de sobriedad es estricta, se saca en una línea y se borra su fila de la tabla.

- [x] **B3 · La regla de emojis quedó escrita y con quién la sostenga** (rama `feat/b3-lint-emojis`). La regla: **en la interfaz, ninguno; en el contenido que escribe la IA, sólo para Primario.** Está en `design-reference/sistema/voz-y-textos.md` ("Emojis"), con la tabla por nivel y la línea que separa las dos cosas: quién escribió el texto. Tres cosas la sostienen sin depender de acordarse: el test de diseño (interfaz, ya existía), `permiteEmojis` + `quitarEmojis` (explicaciones, de A2) y, nuevo acá, el **lint de preguntas** ([lib/qa/lint-questions.ts](../lib/qa/lint-questions.ts)): una pregunta de Secundario o Superior con un emoji en el enunciado, una opción o la explicación es un hallazgo `major` de adecuación al nivel, y dice dónde está. Usa la misma `quitarEmojis`, así que una flecha o un ✓ no cuentan. Salió barato porque `scripts/qa/lint-sweep.ts` ya corre `lintQuestions`: no hubo que tocarlo.
  - Sin verificar: **no se corrió el barrido contra las 1.680 respuestas del 10/08**, así que no se sabe si el baseline de 88 hallazgos se mueve (esos alumnos son de Superior: cualquier pregunta con emoji sumaría). El documento cambió sólo en la máquina de Mauro (`design-reference/` no está versionado).
  - Queda: las preguntas generadas para Secundario y Superior no pasan por `quitarEmojis` al generarse, sólo se les pide por prompt (A2). El lint las detecta después; no las limpia.

- [ ] **C1 · Pasar de Gemini a la API de Claude — BLOQUEADA, sin código.** No hay `ANTHROPIC_API_KEY` en `.env.local` ni en `.env.staging.local` (contado el 16/11, sin leer valores), y toda la aceptación de la tarea son llamadas reales: que `generateObject` valide contra los mismos esquemas, que los cuatro tipos de pregunta salgan bien, y el costo medido con tres tandas. **No se escribió el cambio a ciegas a propósito**: mergeado sin la clave cargada en Vercel corta toda la IA de la app, que es el incidente del 30/09 hecho a mano. Lo que hace falta para desbloquearla, y lo que ya se sabe:
  - **De Mauro:** la clave en staging (workspace con tope mensual, como pide la sección "Evaluador con Claude") y **qué modelo**. Precios públicos al 16/11, por millón de tokens de entrada / salida: Claude Haiku 5.5 **USD 0,10 / 0,50** (prompts de hasta 100 mil tokens), Claude Sonnet 5.5 2 / 10, Claude Opus 5.5 4 / 20. Hoy `gemini-3.1-flash-lite` cuesta 0,25 / 1,50: **Haiku 5.5 sale más barato que lo actual**; Sonnet, unas 7 veces más caro. Con Haiku, los ~USD 0,0115 promedio por cuestionario bajarían a algo como 0,004, **si usa la misma cantidad de tokens, que es justo lo que hay que medir** (ver el punto del razonamiento, abajo).
  - **No es sólo cambiar el proveedor.** Son 9 llamadas con `google(AI_MODEL)`, y tres cosas de esas llamadas no pasan tal cual: (1) **`temperature`** está fijada en 9 lugares (0,2 a 0,5) y los modelos actuales de Claude rechazan con un 400 cualquier valor que no sea el de fábrica; (2) la corrección de respuesta corta manda `providerOptions.google.thinkingConfig.thinkingBudget: 0`, que es de Gemini; (3) **Haiku 5.5 razona por defecto y esos tokens salen del mismo `maxOutputTokens`**: es exactamente la falla del 10/08 (el JSON cortado antes del veredicto) esperando en otro proveedor. Hay que medir tokens de razonamiento por tipo de llamada y decidir el esfuerzo (`low` para corregir y para la revancha) antes de dar ningún número de costo.
  - Hay que sumar la fila del modelo a `MODEL_PRICING_USD_PER_MTOK` (lo exige un test) y revisar `FALLBACK_PRICING`, que hoy cae a una tarifa de Gemini.
  - Va sola en su PR, como dice el encargo, y el PR no se mergea hasta que la clave esté en Vercel.
- [ ] **D1 · Ingreso por email con código — BLOQUEADA, se saltó.** No hay `RESEND_API_KEY` ni `AUTH_RESEND_KEY` en ningún entorno. El encargo ya lo preveía ("si al llegar acá no está, se salta"). La migración de tokens de verificación sería la **026**. Nada escrito.
- [x] **E1 · El cambio de rol se refleja sin cerrar sesión — ya estaba arreglado; ahora está verificado y con tests que lo ejecutan** (rama `test/e1-refresco-de-sesion`). El defecto (`update()` sin argumento no refresca nada) lo corrigió el bloque 7 con `useRefrescarSesion`; el encargo lo traía como abierto. **Verificado el 16/11 en el navegador contra staging, en las dos direcciones**: una cuenta de alumno pasa a docente desde el menú, sale el `POST /api/auth/session`, la sesión dice `DOCENTE` y cae en el panel con sus tres pestañas; y de vuelta a alumno igual. Sin cerrar sesión en ningún momento. Los tests que había eran léxicos (leían el código); se sumaron seis que lo ejecutan: el hook llama a `update` con argumento y usa la del último render, y el menú de la cuenta guarda el rol, **después** refresca la sesión, no refresca nada si el guardado falla, y no hace nada sin confirmación.
  - Sin verificar: el camino con una cuenta de Google real (staging entra por el ingreso de desarrollo). El test del menú no afirma sobre la navegación final (`window.location.assign` no se puede espiar en jsdom); eso lo cubre la verificación en el navegador.

- [ ] **E2 · Qué reemplaza a la práctica de invitado — propuesta hecha, ESPERA RESPUESTA de Mauro** ([issue #22](https://github.com/Malejo01/maestria/issues/22)). Sin código, como pedía el encargo. La propuesta separa dos personas: el **invitado** de un grupo recupera la práctica del temario de su grupo con tope de **3 por día** (que ya es el límite vigente en `lib/ai-rate-limit.ts`: no se abre ninguna puerta nueva), y el **visitante** sin grupo ve un **cuestionario de muestra fijo, sin IA**. El tope vive en un `lib/planes.ts` (todos en "gratis" hasta la FASE 1: sin migración) y el docente lo ve pero no lo edita. **Revierte "la práctica exige cuenta"** de la sección *Evaluación vs. práctica*, que este documento daba por cerrada: si Mauro lo aprueba, esa sección se corrige. Tres preguntas abiertas en el issue: el número, si va la muestra, y si el docente lo puede apagar por grupo (eso sí es migración).
- [x] **E3 · Las decisiones abiertas, en un solo lugar** ([issue #23](https://github.com/Malejo01/maestria/issues/23)). **El informe del rediseño no está en el repo**, así que las "tres decisiones" se dedujeron de lo que este documento y los PRs #6 a #12 marcan como "decide Mauro": los umbrales de dominado y flojo, el papel picado, y los emojis para Primario. Las tres quedaron contestadas por B1, B2 y B3 de esta misma tanda; el issue las lista con lo que se hizo y una recomendación. Suma además las seis que abrió esta tanda y que sí esperan respuesta: el modelo de Claude para C1, el tono de Secundario · Lengua, el tuteo de las explicaciones, el nombre del estado intermedio de un tema, el vocabulario viejo (F7) y en qué pantalla estaba el desborde de A3.
  - Sin verificar: que esas tres sean las del informe.

### Cola nueva, salida de A5 (se hace después de E3)

- [x] **F1 · La nota no entra en su recuadro en resultados.** A 390, "4.00" a 48 px se sale del cuadro de 144 px y pisa el "/10" (`components/results-screen.tsx`). Captura: `a5-celular/resultados-390-claro.png`. **Hecho:** el recuadro crece con la nota (ancho mínimo, no fijo), y la insignia de tendencia se ancla a su esquina. Capturas en `docs/capturas/f1-f2-f5-resultados/`.
- [x] **F2 · La barra de acciones de resultados, a 390.** "Tomar revancha de todo el cuestionario" queda cortado, y el botón flotante de "Reportar un problema" se le monta encima (en el cuestionario se acomoda solo; en resultados no). El mismo botón tapa el borde derecho de la fila que le quede debajo en la ficha del alumno. **Hecho:** el botón de revancha parte renglón, y la barra de resultados lleva el mismo enganche que la del cuestionario, así que el botón flotante se pone arriba y no encima. **Queda** el caso de la ficha del alumno, donde el botón flotante sigue tapando el borde de la fila que tenga debajo.
- [x] **F3 · Mis materias: el lápiz y la X quedan fuera de la tarjeta.** Están posicionados sobre las esquinas y pisan el título de la sección y la tarjeta de arriba. Captura: `a5-celular/teacher-seccion-materias-390-claro.png`. Mirarlo también a 1280. **Hecho:** el lápiz y la X van adentro de la tarjeta, en sus esquinas, y siguen midiendo 44 px. Captura en `docs/capturas/f3-f4-panel-docente/`.
- [x] **F4 · Mis tareas del docente: los temas enteros separados por coma.** Una tarea de seis temas son nueve renglones a 390 antes de llegar al botón de mandarla. Es el mismo problema de A3 en otra pantalla: usar `resumirTemas`. **Hecho:** usa `resumirTemas`: los tres primeros con su nombre corto y el resto contado; el detalle entero queda en `title` y para lector de pantalla.
- [x] **F5 · Resultados no tiene ancho máximo en escritorio.** A 1280 las tarjetas miden el ancho entero de la ventana (se vio en A3). La barra de acciones sí está acotada. **Hecho:** ancho máximo de 672 px en la pantalla de resultados.
- [x] **F6 · `components/weak-points-section.tsx` tiene el mismo `max-w-xl mx-4`** que sacaba de la pantalla al modal de explicación (A1). No se miró en pantalla. **Hecho:** sin `mx-4` y con el ancho del primitivo. **Sin mirar en pantalla**: el diálogo se llena con datos guardados en el navegador del alumno y no se pudo abrir en una sesión de captura.
- [ ] **F7 · Restos del registro viejo en pantallas del alumno.** Resultados: "Tu Racha", "Aprueba 2 seguidos para activar" (tuteo, y la racha vive en localStorage); "Explicar Error". Mi progreso: "Evaluaciones" para lo que son prácticas, y el filtro "Todos los modos" parte en dos renglones. Es vocabulario, va contra `lib/textos.ts`; **decide Mauro** cuánto de esto se reescribe.

## 💸 Tanda G — lo que hace falta para cobrar (desde el 16/11/2026)

Objetivo: cobrarle a un docente esta semana sin facturación automática. Orden: G7 → G0 → G1 → G2 → G3 → G5 → G6 → G4 → G8 → G10. **G9 (migración a Claude) queda fuera a propósito**: se hace con Mauro presente, en su propio PR. Válvula de seguridad de toda la tanda: **si `users.plan_nivel` no existe, viene nulo o la consulta falla, el docente es `exento`**; correr la 026 en producción es lo que enciende el cobro, y eso lo hace Mauro a mano.

- [x] **G7 · `design-reference/` versionado** (rama `chore/g7-versionar-design-reference`). La carpeta entera tal como estaba en el disco: 32 archivos, 1,5 MB, incluidas las ediciones de B2 (`accesibilidad.md`) y B3 (`voz-y-textos.md`) y los PNG de `pantallas/` (1,4 MB, el más pesado por debajo de 1 MB). Desde acá, lo que se escribe ahí queda en el repo.
- [x] **G0 · Recorrido de lo que la tanda anterior no miró** (rama `chore/g0-recorrido-produccion`). Capturas a 390×844 y 1280×800, claro y oscuro: `docs/capturas/g0-produccion/` (producción, sin sesión) y `docs/capturas/g0-staging/` (con sesión). **Producción con sesión no se pudo recorrer**: el ingreso es sólo con Google y la extensión de Chrome no estaba conectada, así que las pantallas con cuenta se recorrieron contra staging con el mismo código de `main`. `scripts/capturas.mjs` suma `MOVIMIENTO=reducido` y `PUERTO=`.
  - **Anda:** entrada, ingreso de docente y de alumno y código de grupo inexistente, en producción (**corregido en G5:** la captura de términos era en realidad la pantalla de ingreso — `/terminos` y `/privacidad` mandaban al ingreso a quien no tenía cuenta); el botón de Google llega a la pantalla de Google con `redirect_uri` a `/api/auth/callback/google`. En staging: una práctica con **los cuatro tipos** (opción múltiple, verdadero/falso, numérica y respuesta corta, ésta corregida por la IA), cada una antes y después de verificar; resultados; **la revancha** de todo el cuestionario (genera y arranca); el **wizard de temario** en sus cuatro pasos; **mandar una tarea** al grupo (quedó la asignación en staging); el diálogo de **temas a reforzar** (F6) a 390, dentro de la pantalla. **B2 en producción:** con `prefers-reduced-motion: reduce` emulado no queda ningún elemento con transición ni animación (sin la preferencia, dos); en el servidor de desarrollo la red de CSS no aparece, así que esa verificación vale sólo contra el build.
  - **Arreglado acá:** el wizard se salía por la derecha a 390 en el paso Temario (el `max-w-5xl` pisaba el ancho móvil del diálogo y los botones sin corte de línea estiraban la grilla); "Teorico", "Practico", "Basico" sin tilde en la configuración de la práctica, en el modo del cuestionario y en el título de los guardados; "Realizar Cuestionario" pasa a "Empezar la práctica"; el placeholder de la numérica se cortaba a 390; "1 unidades" y "1 fallas" (nuevo `contar()` en `lib/textos.ts`); los "¡Listo!" del panel docente, "¡Tu cuestionario ya fue creado!" y "¡Entendido, a enseñar!" (la voz no lleva signos de admiración); "ningún aula" pasa a "ningún grupo".
  - **No anda / queda:** (1) el registro viejo del lado del alumno sigue — "¡Sigue practicando!", "Tu Racha", "Aprueba 2 seguidos", "Respuesta Incorrecta", "Ver Resultados", y el modal de explicación ("¡Tomarme la Revancha!", "¡Espectacular!") — es F7 y lo decide Mauro; (2) el aviso de tope de práctica de Primario lleva un emoji (🌱) en `lib/ai-rate-limit.ts`, y un test lo exige: choca con la regla de B3 ("en la interfaz, ninguno"), decide Mauro; (3) las materias de Primario dicen "2do Año" donde va "grado"; (4) el botón flotante de "Reportar un problema" se apoya sobre el borde derecho de "Verificar" a 390; (5) el servidor de desarrollo registra *"The final argument passed to useEffect changed size between renders"* en el panel docente: sin rastrear; (6) en temas a reforzar, la etiqueta del tipo de error a veces sale cruda ("conceptual").
  - Sin verificar: **la vuelta de Google con una cuenta real** (hace falta Mauro) y todo lo de producción con sesión. Los datos de prueba que dejó este recorrido en staging (tres prácticas de Sofía Ramírez, una revancha y una tarea mandada por Irina Álvarez) entran en la limpieza de G8.
- [x] **G1 · Capa de planes y bloques** (rama `feat/g1-planes-y-bloques`). Migración **026** (`scripts/026-planes-docente.sql`, runner `run-migration-026.ts`): `plan_nivel`, `plan_vence_el`, `prueba_iniciada_el`, `plan_notas` sobre `users`. **Corrida sólo en staging; en producción la corre Mauro, y correrla es lo que enciende el cobro.** [lib/planes.ts](../lib/planes.ts) es puro (cupos, precios por variable de entorno, `estadoDelPlan`, `puedeGenerar`, `puedeSumarAlumno`, `diasRestantes`, el cuerpo del 402); [lib/planes-server.ts](../lib/planes-server.ts) lee y escribe. **Qué ocupa un lugar:** los alumnos distintos de los grupos abiertos del docente, invitados sin cuenta incluidos, más las invitaciones pendientes que todavía no se fundieron con un miembro — la misma regla con la que se arma Mis alumnos (`contarLugares`, junto a `armarFilas`). Dónde se aplica: generar (`/api/generate-quiz` sólo para docentes, regenerar pregunta), crear materia (`programs`, `extract`, `guide`), crear grupo (`classrooms`, `onboarding/grupo`), sumar alumno (`/api/teacher/alumnos`, copiar de otro grupo) y **el ingreso por código**, que frena sólo a quien ocuparía un lugar nuevo: el que ya está en otro grupo del docente o viene a ocupar su invitación entra igual, y con el plan vencido los alumnos actuales siguen respondiendo. Siempre 402 con un cuerpo que la UI lee (`leerBloqueo`), nunca 500. `GET /api/teacher/plan` para las pantallas. `lib/ai-rate-limit.ts` no se tocó: primero el plan, después el límite.
  - Verificado en staging, con la 026 corrida: vencido → 402 en generar, sumar alumno y crear grupo; nivel 1 con 3 alumnos → entra el 4.º y el 5.º, el 6.º recibe 402 `sin_cupo` y se le ofrece el nivel 2; con el grupo lleno, un invitado nuevo recibe 402 y quien viene a ocupar su invitación entra. Tests: los estados, el borde del cupo (5 y 6), el vencimiento (día antes, día de, a la hora exacta, día después), la exención y la válvula (columna inexistente, base caída, nivel nulo → `exento`, y el 42703 no se reporta como incidente).
  - **Para Mauro, antes de correr la 026 en producción:** (1) que `ADMIN_EMAILS` en Vercel incluya su cuenta — en `.env.local` está, en la copia vieja `.env.vercel.local` no; si falta, su cuenta entra en prueba como cualquiera; (2) cargar las cuatro variables `MAESTRIA_PRECIO_*` (están en `.env.local.example`); (3) el gate de esquema de CI va a marcar la 026 como faltante en `main` hasta que corra: es esperable.
  - Sin verificar: la ruta de copiar alumnos de otro grupo sólo mira el vencimiento, no el cupo (copia gente que ya ocupa lugar, salvo que venga de un grupo cerrado).
- [x] **G2 · Prueba de 30 días con aviso al volver** (rama `feat/g2-aviso-de-prueba`). [components/docente/aviso-de-prueba.tsx](../components/docente/aviso-de-prueba.tsx): un diálogo arriba del panel con "Rediseñamos MaestrIA. Desde hoy tenés 30 días para probarla completa.", qué incluye la prueba (10 alumnos, sin tarjeta) y tres novedades del rediseño. Lo dispara `avisoDePruebaPendiente` de `GET /api/teacher/plan` (nivel 0, sin `prueba_iniciada_el` ni `plan_vence_el`), así que vale igual para los 8 docentes que ya existen —arranca cuando vuelven a entrar, no con el deploy— y para el que se registra hoy, en su primer panel (que es donde vive su onboarding). **Cerrarlo de cualquier forma es aceptarlo**: `POST /api/teacher/plan` escribe `prueba_iniciada_el = now()` y `plan_vence_el = now() + 30 días` con una guarda en el `UPDATE` (sólo si nunca arrancó), y desde ahí no se dibuja más. La cuenta exenta y una base sin la 026 nunca lo ven. Textos en `PLAN` de `lib/textos.ts`. Capturas en `docs/capturas/g2-aviso-de-prueba/`.
  - Verificado en staging: el aviso aparece, al aceptarlo quedan las dos fechas a 30 días, y la visita siguiente ya no lo muestra. Tests: aparece una vez y no dos (también si el plan llega viejo), la X también acepta, la exenta no lo ve ni llama a nada, y sin la 026 no aparece.
  - Para Mauro: a un docente nuevo el título le dice "Rediseñamos", como pidió el encargo ("con el mismo texto"); si prefiere otro título para los nuevos, es una línea en `PLAN`.
- [x] **G3 · Pantalla de límite y pantalla de vencimiento** (rama `feat/g3-limite-y-vencimiento`). **Al excederse:** cuando el alta de un alumno vuelve 402, el diálogo de agregar alumno cambia el formulario por [la pantalla de límite](../components/docente/pantalla-de-limite.tsx): "Tenés 5 de 5 alumnos", a qué nivel pasar y la frase que ordena todo, y las [opciones de pago](../components/docente/opciones-de-pago.tsx) —por mes y el pase de 90 días, con lo que se ahorra el pase frente a tres meses— cada una con su botón directo al link de MercadoPago. Una opción sin link no se ofrece; sin ninguna, lo dice. Nada de "contactá al administrador". **Al vencer:** [estado-del-plan.tsx](../components/docente/estado-del-plan.tsx) pone arriba del panel un banner con los días que faltan cuando quedan 7 o menos ("Tu prueba termina en 3 días", con "Ver planes"), y cuando ya venció, una pantalla de solo lectura —qué puede seguir haciendo y qué no, y cómo renovar— que no tapa el panel: el docente sigue viendo todo lo suyo. Tokens del sistema, íconos de `lucide` con su trazo, cero hexadecimales. Capturas a 390 y 1280, claro y oscuro, en `docs/capturas/g3-limite-y-vencimiento/` (con precios y links **de ejemplo** de un `.env.development.local` que sólo existe en la máquina de Mauro).
  - Sin verificar: los avisos de error de los otros caminos que vuelven 402 con el plan vencido (generar desde una materia, el wizard, regenerar una pregunta) muestran el mensaje del servidor como texto, sin la pantalla con los botones de pago; la pantalla de solo lectura de arriba del panel ya los tiene.
- [x] **G5 · Página pública de precios** (rama `feat/g5-precios`). [`/precios`](../app/(entrada)/precios/page.tsx), sin cuenta, en el marco de las pantallas de entrada: "Pagás una clase por cada cinco alumnos que seguís.", la prueba de 30 días con su botón, los seis niveles con los dos montos y cuatro notas (30 y 90 días desde la acreditación, quién cuenta como alumno, qué pasa al vencer, pesos argentinos). **En celular, una tarjeta por nivel; desde 640 px, la tabla.** Los montos salen de las mismas variables que el resto del cobro; si falta una, ese monto dice "—". El título y la descripción de la página llevan la frase, que es lo que muestra la vista previa de WhatsApp. Capturas en `docs/capturas/g5-precios/` (precios de ejemplo, de `.env.development.local`).
  - **De paso, un defecto de producción que G0 dio por bueno:** `/terminos` y `/privacidad` no estaban en la lista de rutas públicas del middleware, así que los links legales de la pantalla de ingreso —"Al ingresar aceptás los Términos…"— llevaban de vuelta al ingreso, y la política de privacidad que pide Google no se podía leer sin cuenta. La lista pasó a [lib/rutas-publicas.ts](../lib/rutas-publicas.ts), con test, y suma `/precios`, `/terminos` y `/privacidad`.
- [x] **G6 · Contador de alumnos y plan en el panel** (rama `feat/g6-contador-del-plan`). [contador-del-plan.tsx](../components/docente/contador-del-plan.tsx): arriba del panel, en letra chica, "12 de 15 alumnos · tu plan vence el 15/12" (o "tu prueba termina el…", o "venció el…"); con el cupo lleno pasa al color de alerta. Cuenta igual que el cupo: invitados sin cuenta e invitaciones pendientes incluidos. Con la cuenta exenta, o sin la 026, no se dibuja nada. Capturas en `docs/capturas/g6-contador/`.
  - Verificado en staging: Irina con 3 alumnos ve "3 de 10"; un invitado que entra por el código la lleva a "4 de 10"; una docente en la lista de admin (sólo en el `.env.development.local` de esta máquina) no ve nada.
- [x] **G4 · Cobro con links de MercadoPago y acreditación a mano** (rama `feat/g4-acreditacion-manual`). Sin webhook. Los diez links van en `MAESTRIA_LINK_MENSUAL_1..5` y `MAESTRIA_LINK_PASE_1..5` y las pantallas de G3 los ofrecen; si uno falta, esa opción no aparece (`linkDePago` exige `https://`). [`/admin/planes`](../app/admin/planes/page.tsx), sólo para `ADMIN_EMAILS` (al resto, 404, como `/admin/ai-usage`): cada docente con sus alumnos contra el cupo, nivel, estado (y si la prueba no arrancó), vencimiento y notas, y un formulario por fila —nivel, 30 días, 90 días o una fecha, y con qué pagó—. `POST /api/admin/planes` escribe nivel y vencimiento y **agrega** una línea a `plan_notas` ("16/11/2026 · quién acreditó nivel 2 hasta el 14/2/2027 · MercadoPago, pase…"): el historial no se pisa, y nada se edita a mano en la base. Sin la 026, la página lo dice en vez de romper. Capturas en `docs/capturas/g4-acreditacion/`.
  - **Aceptación, en staging:** Irina vencida → `generate-quiz` 402 → acreditada desde `/admin/planes` (nivel 2, 90 días) → activa → `generate-quiz` 200 con 5 preguntas. La "admin" fue otra docente de staging, puesta en `ADMIN_EMAILS` sólo en el `.env.development.local` de esta máquina.
  - Para Mauro: no hay link a `/admin/planes` desde ningún lado (tampoco lo hay a `/admin/ai-usage`); se entra por la dirección. Falta generar los diez links en MercadoPago y cargarlos en Vercel.
- [x] **G8 · Datos de prueba de staging, limpios.** Sofía Ramírez vuelve a lo que dejó la siembra del 16/11 (01:54 UTC): se borraron los **18 intentos** y los **21 "errores que se repiten"** posteriores —los "Captura" de A1, dos explicaciones enteras guardadas como tipo de error por las verificaciones de A2, y las prácticas y la revancha de G0—, con sus respuestas en cascada. También la tarea que mandó Irina en G0 y las invitaciones y el invitado de las pruebas de G1 y G6. Los docentes de staging vuelven al plan de fábrica (nivel 0, prueba sin arrancar), así el aviso de G2 se puede mostrar en una demo. Sin código.
  - Queda: `topic_mastery` de Sofía conserva lo que esas prácticas sumaron (no se puede deshacer sin saber el valor anterior). Si molesta, la salida limpia es volver a correr la siembra.
- [ ] **G9 · Migración a Claude (C1) — fuera de esta tanda, a propósito.** `ANTHROPIC_API_KEY` ya está en Vercel, pero se hace con Mauro presente y en su propio PR: lo que hace falta saber está en C1, más arriba.
- [ ] **G10 · Ingreso por email (D1) — sigue bloqueada.** No hay variable de Resend en ningún archivo local ni en el proyecto de Vercel (mirado el 16/11, sólo nombres).

## 🆓 Tanda H — plan gratis, textos y ajustes antes de cobrar (16/11/2026)

La última antes de encender el cobro: cuando esté en `main`, Mauro corre la 026 en producción. Orden: H7 → H3 → H5 → H1 → H2 → H6 → H4. Sin migración nueva. **La válvula de G1 sigue intacta**: sin la columna del plan (o nula, o con la consulta caída) el docente es `exento`, también para el plan gratis.

- [x] **H7 · Plan gratis para siempre, hasta 2 alumnos** (rama `feat/h7-plan-gratis`). No es un nivel guardado sino un **estado derivado** en [lib/planes.ts](../lib/planes.ts): `estadoDelPlan` evalúa exento → plan pago vigente → prueba vigente → con `cupoGratis()` alumnos o menos `gratis`, si no `vencido`; recibe `alumnosActuales`, que el servidor cuenta **sólo cuando el período ya terminó** (generar con un plan vigente sigue siendo una consulta). Topes del gratis por variable: `MAESTRIA_CUPO_GRATIS` (2) y `MAESTRIA_GRATIS_CUESTIONARIOS_MES` (20), con 2 y 20 si faltan o traen basura; documentadas en `.env.local.example`. El tope de cuestionarios cuenta filas de `ai_usage_log` con `endpoint = 'quiz_generation'` en los últimos 30 días corridos, y **sólo** lo consumen generar un cuestionario y regenerar una pregunta (las dos escriben en ese bucket); crear una materia o un grupo, no. Quitar alumnos nunca pasó por el plan y sigue así en solo lectura (`puedeQuitarAlumno` lo deja escrito): bajar a 2 devuelve al gratis solo. Un 402 nuevo, `tope_cuestionarios`, y **generar desde una materia y regenerar una pregunta ahora abren la pantalla de límite** (`DialogoDeLimite`) en vez de un aviso de texto — eso cierra lo que G3 dejó sin verificar. Textos: banner de 7 días según alumnos ("Te quedan 4 días de prueba. Después seguís gratis con hasta 2 alumnos." / "…con 12 alumnos, necesitás un plan. Mirá los precios." con link a `/precios`), contador ("2 de 2 alumnos · plan gratis", "6 de 10 alumnos · prueba, quedan 18 días"; en solo lectura sin el cupo que ya no rige: "3 alumnos · tu prueba terminó el 1/11"), y la pantalla de solo lectura dice cómo volver al gratis. De paso: "pasá a 1 bloques" → "1 bloque". Capturas en `docs/capturas/h7-plan-gratis/`.
  - **Verificado en staging:** Irina (3 alumnos) con la prueba vencida a mano desde `/api/admin/planes` → `vencido`, `generate-quiz` 402 `vencido`; quita a un alumno → `gratis`, "2 de 2 alumnos · plan gratis", `generate-quiz` 200 con 5 preguntas. Después se le devolvió el alumno y el plan de fábrica. Tests de cada borde en `lib/planes.test.ts` y `lib/planes-server.test.ts`.
  - Decisiones que no estaban en el encargo: (1) las filas de `ai_usage_log` en `'error'` **no** cuentan para el tope (una falla del modelo no le come cuestionarios al docente); (2) el modo **mixto** hace dos pedidos y cuenta 2, igual que cada pregunta regenerada cuenta 1 — "20 cuestionarios" son 20 pedidos a la IA, no 20 guardados; (3) si contar los cuestionarios falla, cuenta cero.
  - Sin verificar: el tope de cuestionarios con 20 filas reales en staging (está cubierto por tests contra la consulta, no generando 20 veces).
- [x] **H3 · Dos textos en el aviso de bienvenida** (rama `feat/h3-aviso-dos-textos`). El docente que ya existía lee "Rediseñamos MaestrIA. Desde hoy tenés 30 días para probarla completa, con hasta 10 alumnos. Después podés seguir gratis con hasta 2." con la lista "Qué hay de nuevo"; el nuevo, "Tenés 30 días para probar MaestrIA completa, con hasta 10 alumnos. Sin tarjeta. Después podés seguir gratis con hasta 2." y la misma lista bajo "Lo que vas a encontrar" — ninguno de los dos le habla de un rediseño a quien no vio lo anterior. Decide `users.created_at` contra `CORTE_DOCENTES_PREVIOS` en [lib/planes.ts](../lib/planes.ts): **16/11/2026 06:13:07 UTC**, el merge del PR #29 (G2) a `main`, que es lo que despliega Vercel. Sin fecha legible, nuevo. Los números salen de `DIAS_PRUEBA`, `cupoDeNivel(0)` y `cupoGratis()`; el botón también ("Empezar los 30 días"). Capturas de las dos variantes en `docs/capturas/h3-aviso-de-bienvenida/` (la del docente nuevo con la fecha de alta de Joaquín corrida a hoy un rato y devuelta). Tests: cada texto, que el nuevo no diga "rediseñ", que el cupo gratis venga del plan, y que la exenta no vea ninguno.
  - Nota: Diego y Elena Álvarez (staging) caen en "¿Cómo entrás?" al entrar por `/sign-in/dev`, no en el panel; no se miró por qué, porque no es de esta tarea.
- [x] **H5 · La tabla de `/precios`** (rama `feat/h5-tabla-de-precios`). **Gratis** ("Hasta 2 alumnos, para siempre.", con el tope de 20 cuestionarios cada 30 días en letra chica) y **Prueba** ("30 días con hasta 10 alumnos, todo incluido. Sin tarjeta.") salen de la tabla y van arriba, como dos tarjetas propias; antes la prueba era una fila más y "Gratis, 30 días" caía en la columna del pase. La tabla —y en celular, las tarjetas— quedan con los niveles pagos, de 1 bloque al tope, bajo un título "Planes". Bajada nueva: "Empezás con 30 días gratis, con hasta 10 alumnos. Después seguís gratis con hasta 2, o elegís un plan." (también en la descripción que muestra la vista previa de WhatsApp). Letra chica: "Los 2 alumnos gratis no se suman a un plan: 1 bloque son 5 alumnos en total.", y la de qué pasa al vencer suma que con 2 o menos se sigue gratis. **Donde hay link de pago, el monto es un botón al link** (hoy, sólo el pase de 1 bloque); sin link, texto. Todos los números salen de `lib/planes.ts` y de las variables. Tests nuevos de la página (`app/(entrada)/precios/page.test.tsx`). `scripts/capturas.mjs` suma `COMPLETA=1` para sacar la página entera. Capturas en `docs/capturas/h5-precios/`, página entera, 390 y 1280, claro y oscuro.
  - Las capturas usan los precios de Vercel y un link **marcador** para el pase de 1 bloque, sólo en el `.env.development.local` de esta máquina (borrado al terminar la tanda): el link real está en Vercel y no se copió. Lo que se ve es el botón; a dónde lleva, no.
- [x] **H1 · Vocabulario viejo del lado del alumno** (era F7; rama `fix/h1-voseo-lado-alumno`). "¡Sigue practicando!" → "Seguí practicando", "Tu Racha" → "Tu racha", y el barrido entero: **61 textos en 20 archivos**, sin un solo `¡` ni tuteo en la interfaz. Del lado del alumno: los encabezados de resultados (los nueve, Primario incluido; "¡Sos un/a genio/a!" se fue), la racha ("Aprobá 2 seguidos para activarla"), el modal de explicación y revancha ("Tomarme la revancha", "Entendido, seguir", "Lo superaste", "Volver al cuestionario"), "Correcto" / "Respuesta incorrecta" / "Ver resultados" en el motor, "Escribí tu respuesta…", "Tocá para ver el tip", el toast "Listo" al entrar a un grupo, el de historial sin sesión y "Gracias. Quedó registrado." **El mismo barrido encontró tuteo del lado del docente y se corrigió en el mismo PR**: "Elegí una materia" en Mis materias, el import del temario, los placeholders de editar pregunta, y los errores del servidor que la UI muestra tal cual ("Debes indicar un titulo" → "Falta el título", "Intenta con otro documento" → "Probá con otro documento"). De paso, tildes en esas mismas frases. **No se tocó** lo que genera o pide la IA (prompts de `education-context.ts`, `quiz-generation.ts`, `guide`/`extract`), ni `/terminos` (registro formal a propósito, ver Voseo app-wide más abajo). Los tests que fijaban los textos viejos se actualizaron.
  - Queda para H2: el "¡Uf, cuánta práctica! 🌱" del tope de Primario, en `lib/ai-rate-limit.ts`.
  - Sin captura: son cambios de texto, cubiertos por los tests de los componentes.
- [x] **H2 · El emoji del aviso de tope en Primario** (rama `fix/h2-sin-emoji-en-el-tope`). "¡Uf, cuánta práctica! 🌱 Por hoy…" pasa a "Uf, cuánta práctica. Por hoy llegaste al máximo de N. Descansá un poquito y volvé…": lo cálido queda en las palabras. **El test que exigía el 🌱 se corrigió**: protegía el comportamiento viejo, no una decisión; ahora exige lo contrario para todos los niveles y actores (sin emoji ni `¡!`). **El lint de B3 no cubría este caso** —miraba `app/` y `components/`, y el texto vive en `lib/ai-rate-limit.ts`—: se extendió a `lib/` y `hooks/`, salvo los prompts (`education-context.ts`, `quiz-generation.ts`) y `lib/qa/`, y dejando pasar los símbolos que son contenido (↔ © ™). Comprobado que los dos tests nuevos fallan con el texto viejo. La regla escrita en `design-reference/sistema/voz-y-textos.md` dice el alcance nuevo.

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

## 🏫 Aula de Matemática y su Didáctica — Profesorado de Educación Primaria (30/09/2026)

Programa y aula para 1º año del Profesorado de Educación Primaria (Instituto Jean Piaget Nº 8048, anual 2026), para que los alumnos entren con el código y practiquen todo el programa. Se hizo por script porque el autocompletar del wizard (`/api/teacher/programs/extract`) fallaba por falta de crédito en Gemini (ver riesgo de abajo), no por código.

- [x] **Contenido** en [scripts/data/programa-matematica-didactica-profesorado-primaria.ts](../scripts/data/programa-matematica-didactica-profesorado-primaria.ts): 5 unidades, 53 temas, numeración del documento de contenidos (no la del cronograma). Corregido del Word: MCD/MCM (decía "MCM" y "DCM"), tildes y typos.
- [x] **Script** [scripts/crear-aula-matematica-didactica.ts](../scripts/crear-aula-matematica-didactica.ts), sobre [scripts/lib/aula-programa.ts](../scripts/lib/aula-programa.ts): dry-run por defecto, backup JSON después de cada paso, `--revert` que **se niega si el aula ya tiene uso** (todas las FK de `classrooms`/`teacher_programs` son `ON DELETE CASCADE`; `--forzar` para pasar igual), idempotente por (docente, materia, nivel, grado) y (docente, nombre del aula). Un test lee el texto de las rutas y falla si las columnas de los INSERT se desvían. Dry-run verificado contra producción el 30/09: crearía 1 programa, 1 materia, 1 aula.
- [x] **`--apply` corrido el 30/09/2026** con autorización de Mauro: **programa id 15** (`teacher-15-matematica-y-su-didactica`), **aula id 3**, código **`2UQT7J`** → `https://maestria-edu.vercel.app/aula/2UQT7J`. Verificado contra producción: 5 unidades, 53 temas, `degree` = Profesorado de Educación Primaria, aula `open`; `GET /api/classrooms/join?code=2UQT7J` devuelve el aula. El backup para `--revert` quedó en `scripts/backups/` (no versionado), en la máquina de Mauro.
  - La `--metodologia` cargada es un **borrador de Claude aprobado por Mauro**, no texto propio del docente. Se edita desde el wizard (editar materia) si hace falta ajustarla.

Dos cosas que quedan escritas para no redescubrirlas:

- **Probabilidad:** la Unidad V se llama "Estadística y probabilidad" pero el programa no lista ningún tema de probabilidad. No se inventaron.
- **El enfoque didáctico entra sólo por `methodology`.** Ver el ítem 🔺 del backlog sobre la práctica de aula: `contexto_profesional` y `tipos_pregunta_sugeridos` no se aplican ahí, así que cargar filas en `curriculum` para esta carrera hoy no cambiaría nada dentro del aula. Por eso la lectura didáctica ("un niño de 4º grado resolvió así, ¿qué error cometió?") va en la metodología del programa, que sí llega al prompt como "PREFERENCIAS PEDAGÓGICAS DEL DOCENTE". Es por programa, no por unidad, y no controla la mezcla de tipos.

### Primer uso real del aula (30/09/2026): temas fuera de lo elegido y `numeric` conceptuales

Mauro armó un cuestionario de 20 preguntas, mixto, con los 4 tipos y **un solo tema** (Divisibilidad, Unidad I). Salieron preguntas de MCD, primos, racionales, geometría, proporcionalidad y TSD, y dos veces una pregunta de "explicá el MCD" con input numérico y respuesta 0/1. Dos causas, las dos del prompt y no del modelo:

- [x] **Alcance.** El aula manda el programa entero como `subjectUnits` (5 unidades, 53 temas) y el prompt lo presentaba como `CURRICULUM` sin decir que el alcance eran los `TEMAS`; la metodología ("TSD, el error…") se leía como temas extra. `/practicar` nunca lo tuvo porque ya manda sólo los temas elegidos. Fix en [lib/quiz-scope.ts](../lib/quiz-scope.ts): `scopeUnitsToTopics` recorta el programa a los temas elegidos (con fallback al programa entero si nada coincide, que es lo que pasa en la regeneración de una pregunta), y el prompt ahora tiene una REGLA DE ALCANCE explícita y dice que la metodología indica *cómo* preguntar, no *qué*. Efecto colateral bueno: los `ejes` que lee `loadCurriculumPedagogy` también salen recortados, como en `/practicar`.
- [x] **`numeric` en la tanda teórica.** El mixto se genera como dos tandas, y la teórica dice "sin cálculos" pero igual pedía repartir parejo entre los 4 tipos. `questionTypesForMode` saca `numeric` de la tanda teórica (salvo que sea el único tipo pedido); el bloque del tipo `numeric` en el prompt dice cuándo NO usarlo; y `isConceptualNumericQuestion` descarta como red de seguridad una `numeric` cuyo enunciado pide palabras, y el bucle pide otra.
- Verificado contra Gemini (`gemini-3.1-flash-lite`) con el temario del repo, el mismo tema y una metodología didáctica equivalente (no la real del programa 15: no se leyó producción): 20 de 20 preguntas sobre divisibilidad, cero `numeric` en la tanda teórica, las dos `numeric` de la práctica son cálculos. Queda un roce: una pregunta pidió el "menor múltiplo común" (MCM, tema hermano) — el límite entre "múltiplos" y "MCM" es borroso y no se forzó más.
- **Los cuestionarios ya guardados no cambian**; hay que regenerarlos o quitar las preguntas fuera de tema desde la vista de revisión.

### ⚠️ Riesgo operativo: Gemini sin crédito prepago

El 30/09/2026 el autocompletar del wizard fallaba con `AI_APICallError: Your prepayment credits are depleted` (Sentry **MAESTRIA-18**). La key de la API de Gemini es **prepaga**: cuando el crédito se agota no hay degradación, **se corta toda la IA de la app** — generación de cuestionarios, corrección de `short_answer` que el corrector determinista no resuelve, revancha y extracción de programas — para todos los usuarios a la vez.

- Resuelto ese día cambiando la key (`GOOGLE_GENERATIVE_AI_API_KEY` en `.env.local` y en Vercel, con redeploy). **Ojo con el nombre: la app lee `GOOGLE_GENERATIVE_AI_API_KEY`, no `GEMINI_API_KEY`.**
- **La key nueva destapó un segundo corte:** es de un proyecto de Google nuevo, y Google ya no habilita `gemini-2.5-flash` ni `-lite` a proyectos nuevos (404 "no longer available to new users", que la app mostraba como 502 genérico). Se migró toda la app a **`gemini-3.1-flash-lite`**, el mismo que Mauro ya usa en otros proyectos. El id vive ahora en un solo lugar, [lib/ai-model.ts](../lib/ai-model.ts) —antes estaba escrito a mano en 10 llamadas—, con su tarifa en `MODEL_PRICING_USD_PER_MTOK` (USD 0,25 / 1,50 por millón) y un test que exige que el modelo activo tenga precio cargado. Verificado contra la API: no gasta tokens pensando por defecto, acepta `thinkingBudget: 0` y devuelve JSON con esquema. `generateQuiz` real con el temario del profesorado: 5 preguntas en 8 s, 0 tokens de razonamiento, ~USD 0,0015. Descartados `gemini-3.5-flash` y `3.8-flash`: responden, pero con 20 tokens de techo los gastaron enteros pensando — la misma falla del 10/08.
  - **Pendiente de mirar con uso real:** calidad de las preguntas del modelo nuevo en el aula de Sistemas (el prompt se afinó con 2.5), y la tasa de `AI_NoObjectGeneratedError` en Sentry durante los primeros días.
- Lo que falta para que no vuelva a pasar por sorpresa: una alerta de saldo bajo en la consola de facturación de Google, o una alerta de Sentry sobre ese mensaje de error. Hoy nos enteramos cuando un docente ve fallar el wizard.
- Mismo aviso que ya estaba arriba: la suscripción de consumidor de Gemini **no** cubre la API.

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

## 🚨 Incidente del 15-24/08 y lo que dejó (24/08/2026)

**`/practicar` estuvo nueve días caído en producción, para todos los niveles.** La causa: la migración **023** (`curriculum.tipos_pregunta_sugeridos`) se mergeó y desplegó el 15/08 pero **nunca se corrió contra producción**. `/api/curriculum/topics` fallaba al parsear la consulta (`42703`), devolvía 500, y el cliente lo pintaba como el estado vacío: *"No hay temas cargados para esta materia todavía"*.

Nadie se enteró porque el fallo se disfrazó dos veces: el `catch` de la ruta no reportaba a Sentry, y `fetchTopics` no miraba `res.ok`. **Cero eventos en nueve días.**

Ya es la tercera vez que un fallo se disfraza de resultado válido: el `Boolean(undefined)` del 10/08, el `create-staging-branch.ts` que este documento describía sin que existiera, y ahora esto. El inventario completo del patrón —15 `fetch` sin `res.ok` en 10 archivos, 20 rutas con `catch` en silencio total— quedó medido en [deuda-tecnica.md](deuda-tecnica.md), sección 6.

Todo cerrado el 24/08:

- [x] **023 corrida** — `/practicar` funciona otra vez en todos los niveles. No necesitó deploy: era la base, no el código.
- [x] **Seeder re-corrido** — las 7 mezclas de tipos de pregunta cargadas. **Toda la tanda pedagógica del 16/08 estuvo inerte en producción hasta hoy**: `loadCurriculumPedagogy` atrapaba el mismo error en su `try/catch` y devolvía `{}`, así que la generación perdía en silencio el contexto profesional *y* la mezcla.
- [x] **Los dos silenciadores** — `captureRouteFailure` en las cuatro rutas de `curriculum/*`, y el helper `pedirJson` + el componente `CargaFallida` en el selector, que distinguen un 500 de una lista vacía en los cuatro pasos de la cascada.
- [x] **Detector de drift** — `npm run check:schema`, documentado en [gate-de-esquema.md](gate-de-esquema.md). Probado contra una base del 15/08 simulada: habría atrapado la 023 **y** la 019.
- [x] **`schema_migrations`** (migración 024) — 23 migraciones registradas. El detector deduce mirando el catálogo; el registro no deduce nada.
- [x] **Job `schema-gate` en CI** — corre en push a `main` y falla si la base no está al día.

### Lo que queda de esto, y es de Mauro

1. **Rol de sólo lectura en Neon + `DATABASE_URL_READONLY` en GitHub Secrets.** Sin eso el gate avisa y pasa, o sea que no gatea. El SQL exacto está en [gate-de-esquema.md](gate-de-esquema.md); el rol necesita **un solo `GRANT SELECT`**, sobre `deployment_env`, porque el chequeo lee `pg_catalog` y no `information_schema`.

2. **DECISIÓN PENDIENTE — apagar el auto-deploy de Vercel.** Hoy el gate marca en rojo en Actions pero **Vercel despliega igual**: el push a `main` dispara el build sin mirar el workflow. Cerrar el círculo significa apagar el auto-deploy a producción (conservando los previews de PR) y desplegar desde el workflow después del gate, lo que necesita `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`.

   Es una decisión de fricción, no técnica: **¿puede salir un deploy con el esquema desalineado, o queda bloqueado hasta correr la migración?**

   > Lectura de Mauro el 24/08: *"con dos incidentes en dos semanas, yo cerraría el círculo. Pero implica un cambio de flujo de deploy, así que no lo haría hoy."* Queda anotado a propósito para decidirlo con la cabeza fresca, y no el mismo día del incidente.

   El "Ignored Build Step" de Vercel **no** es la alternativa barata: su semántica hace que un drift detectado se vea como un deploy *"Skipped"* — un fallo que se presenta como "no pasó nada", que es exactamente la enfermedad de este incidente.

3. **Verificar `/practicar` con sesión real.** Todo lo verificable sin login está verificado: el handler de `/api/curriculum/topics`, invocado con la base de producción, devuelve **HTTP 200**, las 7 unidades, la Unidad 5 con sus 10 temas y las 7 mezclas. Lo que falta es la pantalla.

---

## 🛠 Tanda del 24-25/08 — revisión de cuestionarios y limpieza de silenciadores

### Vista de revisión de cuestionarios (24/08, mergeado)

- **Editar y regenerar pregunta por pregunta** (`components/teacher-quiz-review.tsx` + `/api/teacher/quizzes/[id]` PATCH + `/regenerate-question`). Regenerar **no guarda**: la ruta devuelve la pregunta nueva sin escribir, el docente compara lado a lado y decide; el único camino de escritura es el PATCH. El id de la pregunta vieja se conserva a propósito para no renumerar.
- **Editar sin pisar lo que ya se rindió** — `getQuizImpact` (`lib/teacher-quizzes-server.ts`): el alumno no recibe copia de las preguntas (JOIN en vivo contra `teacher_quizzes.questions`), así que editar un cuestionario con intentos abre un diálogo de decisión (editar en el lugar vs. copia). Asignado sin intentos NO pide confirmación: obligar a confirmar ahí enseña a confirmar sin leer.
- **Diálogo alto scrolleable** (`components/ui/dialog.tsx`) — un diálogo más alto que la pantalla scrollea en vez de salirse.

### El bug de JSONB y su lección (24/08)

Postgres reordena las claves de `jsonb` (por longitud y después byte a byte). Mordió **dos veces el mismo día en lugares que no se conocen entre sí**: el dry-run del seeder reportó "CAMBIA" en las 7 unidades sin cambio real, y el cartel "Cambios sin guardar" de la vista de revisión no se apagaba nunca después de guardar — comparaba con `JSON.stringify` lo local contra lo que devolvía el `RETURNING`. Un aviso que miente una vez deja de leerse.

La salida es `lib/stable-json.ts` (`stableStringify` / `sameJsonValue`), módulo con nombre propio porque va a volver a aparecer. **La lección de test:** el test viejo pasaba porque su mock devolvía las claves en el mismo orden que mandó el cliente — exactamente lo que el código esperaba, no lo que devuelve el sistema real. El fixture de regresión (`comoLoDevuelvePostgres`) devuelve las claves desordenadas a propósito.

### Tanda autónoma del 25/08 (esta rama, sin tocar producción)

- [x] **Lint de calidad re-verificado**: las 1.680 respuestas del 10/08 dan **88 hallazgos, idénticos al baseline** — reglas estables, precisión intacta. El cuestionario nuevo (Matemática · Práctico · 24/8) quedó **pendiente**: el clasificador de permisos bloqueó la lectura de producción en esta sesión (por los dos caminos: script y MCP). El barrido quedó commiteado en [scripts/qa/lint-sweep.ts](../scripts/qa/lint-sweep.ts); correrlo desde la raíz del repo es: `npx tsx scripts/qa/lint-sweep.ts --env-file=.env.local --listar-quizzes` y después `--quiz=<id>`.
- [x] **Silenciadores de deuda-tecnica.md §6 cerrados** — las **20 rutas en silencio total** reportan con `captureRouteFailure` (alumno primero, con tests que afirman sobre la llamada), y los `fetch` sin `res.ok` del camino de alumno usan el helper compartido nuevo `lib/pedir-json.ts` + `components/carga-fallida.tsx` (extraídos del selector). Quedan 3 call sites de docente, anotados en §6a.
- [x] **`\uXXXX` crudos: reproducido y arreglado** — ver el ítem del backlog, que queda cerrado.
- [x] **Tipos `Db*` de `lib/db.ts` borrados** (los seis, nadie los importaba, varios mentían contra el schema) y **4 `any` del motor de quiz** cerrados fuera de los 17 intencionales del módulo extraído.
- [x] **Barrido de tests con mocks que mienten** — inventario en deuda-tecnica.md §8; los tres más peligrosos, cerrados.

### Tarjetas de resumen de `/history` (25/08/2026)

Dos cosas, una de layout y una de producto.

**Layout:** las tres tarjetas ocupaban una fila completa cada una —tres pantallas de scroll antes del historial— porque `xs:` **no es un breakpoint de Tailwind 4** y este proyecto no lo define, así que `xs:grid-cols-3` no emitía ninguna regla. Medido: la fila pasa de 338px a 105px, en desktop y en mobile. El mismo par de clases roto estaba en la home y se arregló igual; el tercer uso, en la navbar, quedó anotado en el backlog porque ahí la variante muerta esconde UI en vez de descolocarla.

**Producto:** el "Promedio 6.7" global se sacó. Mezclaba Ciencias Sociales, Álgebra y dos Matemáticas distintas, se calculaba sobre las últimas 20 filas sin decirlo, promediaba promedios de denominador distinto (migración 021) e ignoraba el filtro de materia que la propia pantalla ofrece. Ahora: los agregados vienen del servidor sobre todo el historial, siguen los filtros, el promedio es `SUM(correctas)/SUM(calificadas)` y **sólo aparece con una materia elegida**, rotulado "Promedio de práctica" con la materia al lado. El tercer lugar dejó de ser "Aprobadas" y pasó a "A reforzar", contado desde `student_misconceptions` y no desde el `weakPoints` del store, que vive en localStorage.

> **Dos hallazgos que no se tocaron y conviene tener presentes.** `quiz_attempts` **no guarda nivel, grado ni carrera**, y `subject` es un string libre: *Matemática de secundaria* y *Matemática de la tecnicatura* caen las dos en `subject = 'Matemática'` y se fusionan en cualquier agrupación por materia. Y la **racha** de la home (`lib/store.ts`) no está en la base: vive en localStorage y cuenta cuestionarios aprobados consecutivos, aunque el label diga "Racha días".

---

## 👉 PENDIENTE DE MAURO — leer esto primero (16/08/2026)

Todo lo de la tanda está mergeado a `main` y desplegado. Queda esto, que sólo podés hacer vos:

### 1. ~~Correr la inscripción~~ — HECHO (24/08/2026)

Medido contra producción el 24/08/2026: el script ya se corrió. Existe el programa **id 14** (Matemática · Superior · 1er Año · `created_from: 'curriculum'`, 7 unidades, creado el 24/08 a las 14:26), su fila en `subjects` (`teacher-14-matematica`) y el **aula id 2** ("Matemática — 1er Año Análisis de Sistemas", código `CRB6S9`), con **32 membresías activas**.

Dos cosas que conviene mirar, no bloqueantes:

- **32 y no 31.** El miembro 32 es la cuenta del propio docente (`lizarragamauroalejandro@gmail.com`), que no tiene intentos del 10/08 y por lo tanto no la inscribió el script — entró por el código. Cuenta como alumno en el roster y en `member_count`. Si molesta, se saca desde la pantalla del aula.
- **El aula todavía no tiene ninguna asignación ni ningún intento** (`classroom_assignments` 0, `quiz_attempts.classroom_id = 2` 0). Los 31 están adentro pero todavía no hicieron nada ahí.

El texto original de esta sección queda abajo como referencia del comando.

```bash
npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=TU_EMAIL
```

Eso es el dry-run y no toca nada. Verificado el 16/08: 31 alumnos, 0 ya miembros, 31 filas a insertar, 7 unidades con 36 temas. Para aplicarlo:

```bash
npx tsx scripts/inscribir-diagnostico-2026-08-10.ts --docente=TU_EMAIL --apply --metodologia="..."
```

`--metodologia` es **obligatorio** y no tiene default a propósito: ese texto entra derecho al prompt de generación, y el wizard blanquea las metodologías autocompletadas justamente para que lo escriba una persona. Escribí cómo das la materia, en una o dos oraciones.

El script crea el programa (Superior / 1er Año / Matemática, con las 7 unidades copiadas de `curriculum`), el aula, y las 31 membresías. Escribe un backup en `scripts/backups/` **después de cada paso**, así que una caída a la mitad sigue siendo reversible con `--revert=<archivo.json>`.

### 1b. ~~Decidir cómo se arreglan las fuentes~~ — RESUELTO (16/08/2026)

`app/layout.tsx` importa Manrope y Playfair Display con `next/font/google`, que **descarga en tiempo de build**. Si esa descarga falla, no falla la tipografía: falla el módulo, y la home tira 500. Es lo que viene limitando la verificación en browser hace tres tandas.

Medido el 16/08/2026: `fonts.googleapis.com` responde 200, pero las URLs de **fuente variable** que pide Next dan **404**, mientras que los archivos estáticos del mismo tipo descargan bien. No es lentitud de red — son URLs que no existen más.

**Resuelto con self-hosting**: los dos subsets `latin` viven en `app/fonts/` (63 kB entre ambos, fuentes variables, un archivo por familia) y se cargan con `next/font/local`. El build no toca la red nunca más.

Dos descartes que conviene no volver a proponer: `display: swap` **no arregla nada** (actúa al renderizar, y acá se rompe antes, en el build), y sacar Playfair tampoco alcanzaba porque Manrope venía por el mismo camino.

**Verificado en browser**, que era el punto: el dev server levanta, la home responde **200 donde antes daba 500** y renderiza completa, cero errores de consola, los dos `woff2` se sirven desde `/_next/static/media/` y no hay una sola petición a `fonts.gstatic.com`.

> **Hallazgo preexistente, no corregido:** el wordmark "MaestrIA" de la navbar se dibuja en **Manrope, no en Playfair**. `--font-brand` se declara dentro de un bloque `@theme inline` de `globals.css`, y el modificador `inline` hace que Tailwind sustituya el valor en sus propias utilidades en vez de emitir una custom property usable — así que `[font-family:var(--font-brand)]` resuelve a vacío. `--font-playfair` sí resuelve. Arreglarlo cambia cómo se ve la marca, así que es una decisión tipográfica y queda para vos.

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
- [x] **Aula de Análisis de Sistemas + inscripción de los 31** — `scripts/inscribir-diagnostico-2026-08-10.ts`, corrido con `--apply` el **24/08/2026**. Programa 14, aula 2 (código `CRB6S9`), 32 membresías activas (los 31 del diagnóstico + la cuenta del docente, que entró por código). Verificado contra producción el 24/08. Esta entrada decía "falta correrlo".

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

## 📐 Evaluación vs. práctica — diseñado, NO implementado (24/08/2026)

Hoy el aula trata igual dos cosas con propósito distinto. **Evaluación**: el docente arma un cuestionario, lo revisa y lo asigna; 1 o 2 intentos, porque el número mide y repetir lo distorsiona. **Práctica**: el docente elige temas y el alumno entra las veces que quiera, generando un cuestionario nuevo cada vez; el propósito es aprender, no medir.

El diseño completo está discutido (modelo, UX de alumno y docente, reporte, costo). Falta implementarlo. **Dos decisiones ya tomadas, que no hay que volver a discutir:**

### 1. La práctica exige cuenta — los invitados quedan afuera

Un invitado no está autenticado, así que su límite de `quiz_generation` es **3/día** justamente para que no se pueda quemar cuota sin identidad. Subírselo para habilitarles la práctica abre abuso sin autenticación, que es lo que ese límite existe para evitar.

> **Esto es BLOQUEANTE para abrir la app a otros docentes.** Un aula que se llene de invitados va a ver la práctica cortarse al tercer intento, y el docente no va a entender por qué. Antes de invitar a un docente que no seamos nosotros hay que resolver una de estas dos: o la práctica exige cuenta y la UI lo dice desde el principio, o se define un límite de invitado que aguante una clase sin abrir la puerta.

- [x] **La home lo dice antes del click (30/09/2026).** Sin sesión, el CTA dice "Ingresar con Google y empezar" y avisa que el código de aula es la vía sin cuenta. Y `/sign-in` ahora respeta `callbackUrl` (antes mandaba siempre a `/`, así que el que se logueaba desde el CTA volvía a la home). Esto cubre la práctica libre de `/practicar`; la práctica **dentro del aula**, cuando se implemente, tiene que avisarlo en su propia pantalla.
- [x] **El agujero de fondo no era el 3/día sino fabricar invitados (30/09/2026).** Crear uno costaba un código de aula y un nombre, y cada invitado nuevo traía su cupo limpio: un `curl` en bucle agotaba el presupuesto global en ~30 minutos, y el global corta también a los alumnos con cuenta. Dos barreras, sin migración:
  - **Sub-tope de gasto de invitados** (`AI_GUEST_DAILY_BUDGET_USD`, default $3) *dentro* del global: su gasto suma al total, pero se cortan antes. Un abuso anónimo, en el peor caso, deja sin IA a los demás invitados — nunca a los logueados. `lib/ai-guard.test.ts` lo fija simulando invitados fabricados en serie.
  - **Tope de invitados nuevos por aula** (`CLASSROOM_DAILY_NEW_GUEST_LIMIT`, default **60 en 24 h deslizantes**): el que queda afuera ve por qué y que con Google entra igual; el docente ve el aviso en el panel desde el 75%; a nosotros nos llega a Sentry. Regenerar el código corta una filtración pero **no** libera el cupo del día: el conteo es por aula, no por código.
    - **Criterio del número: una comisión por aula.** 60 = la clase más grande esperada (40 alumnos entrando juntos, todos sin cuenta) × 1,5 de margen para los que re-entran desde otro dispositivo o en incógnito, que sin la cookie cuentan como invitado nuevo. Dos comisiones de 35 compartiendo la misma aula el mismo día **sí** lo superan, y está bien que así sea: la recomendación al docente es un aula por comisión, no subir el tope. Si un caso real lo pide, se sube por env antes de tocar el criterio.
    - Lo que puede gastar un código filtrado con 60: 60 × 3 generaciones × ~$0,011 ≈ $2 por día, y el sub-tope de invitados corta antes de que eso se multiplique entre aulas.
  - Medido antes de hacerlo: en producción había **0 invitados**, 0 filas de `ai_usage_log` con `is_guest` y los 31 del 10/08 tienen cuenta de Google. Ningún usuario real pasó por estos caminos.
  - **Descartado: límite por IP en `/api/classrooms/join`.** Tres motivos:
    1. **Una IP escolar para 40 alumnos.** La escuela sale a internet por una sola IP pública, así que el límite tendría que ser más laxo que el tope por aula — no protege nada que el tope por aula no proteja ya.
    2. **Exige migración.** Un contador en memoria vive por instancia de lambda y no sirve; hace falta una tabla.
    3. **Guardar IPs de menores.** Es dato personal bajo la Ley 25.326, con política de retención incluida, para una protección marginal.

    **Si aparece abuso, la primera respuesta es una regla de rate limit en el Firewall de Vercel** sobre `POST /api/classrooms/join`: es configuración, no código, no guarda nada en nuestra base y se saca igual de rápido.

### 0. La distinción es `assignment_id`, **no** `mode` — leer antes de implementar

`quiz_attempts.mode` (`teorico` / `practico` / `mixto`) **no tiene nada que ver** con evaluación vs. práctica: describe qué tipo de preguntas trae el cuestionario, no si la nota cuenta. Confundirlos es fácil —el valor se llama literalmente `practico`— y se paga caro si se descubre a mitad de la implementación.

Lo que separa las dos cosas es **`assignment_id`**, que ya existe en `quiz_attempts` desde la migración 015, junto con `classroom_id` y `attempt_number`:

| | Evaluación | Práctica |
|---|---|---|
| Señal | `assignment_id IS NOT NULL` | `assignment_id IS NULL` |
| De dónde sale | el alumno entró por una asignación del aula | práctica libre, con o sin aula |
| Cupo de intentos | `classroom_assignments.max_attempts` | sin tope |

**Medido el 25/08/2026: hoy no hay un solo intento con `assignment_id`.** El aula 2 no tiene ninguna asignación, así que el 100% de lo que existe —el diagnóstico del 10/08 incluido— es práctica libre. Consecuencia inmediata, ya aplicada en `/history`: mientras eso siga así, cualquier promedio que se le muestre al alumno se rotula **"Promedio de práctica"**, porque un "Promedio 6.7" pelado lo lee como la nota de la materia y no lo es.

Cuando esto se implemente, el reporte del alumno tiene que separar por `assignment_id` y no volver a mezclar las dos poblaciones en un solo número.

### 2. `topic_mastery` no se toca en este trabajo

La tabla **no sirve** para el reporte de práctica, y no por falta de columnas: sólo escribe cuando el alumno aprueba, `attempts_count` cuenta intentos aprobados, `highest_score` guarda el máximo (o sea que no hay trayectoria) y `mastered_at` no lo escribe ningún camino de código — 0 de 77 filas en producción.

El reporte de práctica se construye sobre **`quiz_attempts`**, que ya guarda cada intento con `topics[]`, `score` y `completed_at`. No hace falta tabla nueva ni extender la vieja.

El diagnóstico completo de `topic_mastery` y sus dos salidas posibles (arreglarla o borrarla) quedó en [deuda-tecnica.md](deuda-tecnica.md), sección 7.

### Costo, medido antes de habilitarlo

Sobre 128 generaciones reales de `ai_usage_log`: **$0,0115 USD promedio** por cuestionario (mín. $0,0021, máx. $0,0208).

| Escenario | Generaciones | Costo |
|---|---|---|
| 31 alumnos × 5 prácticas | 155 | **$1,79** |
| Peor caso (todas al máximo) | 155 | $3,22 |

Los límites actuales lo permiten con margen: por alumno, `quiz_generation` en rol ALUMNO es **30/día y 10/hora**; el tope global `AI_DAILY_BUDGET_USD` no está seteado, así que rige el default de **$15/día**, o sea ~1.300 generaciones. Harían falta ~42 prácticas por alumno el mismo día para cortarlo. **No va a cortar una clase.** Lo que sí conviene mirar es el total diario, porque ese presupuesto es compartido con corrección, revancha y extracción de programas.

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

- [ ] 🔺 **La práctica de aula no usa el programa de cátedra: ni contexto profesional ni mezcla de tipos.** Medido leyendo el código el 30/09/2026. `SubjectContent` ([subject-content.tsx:180](../components/subject-content.tsx#L180)), que es lo que corre en `/aulas` y en el panel docente, llama a `/api/generate-quiz` **sin `carrera`** —así que `loadCurriculumPedagogy` devuelve `{}`— y **siempre con `questionTypes`** explícito (el default del selector es `['multiple_choice']`), que gana sobre lo sugerido. Consecuencia: **el aula 2 de Análisis de Sistemas genera sin contexto profesional y 100% opción múltiple** salvo que el alumno cambie los tipos a mano. El A/B de la Unidad 5 y la mezcla de la 023 valen para `/practicar` y para la regeneración de una pregunta, no para el aula. Tres cosas más en el mismo camino:
  - `nivel`/`grado` salen primero del **perfil del alumno** y recién después del programa del aula: un alumno del profesorado registrado como Secundario recibe el prompt de Secundario.
  - `buildProfessionalContextSection` ([education-context.ts](../lib/education-context.ts)) trae ejemplos y vocabulario **de Sistemas escritos a mano** (algoritmos, usuarios de una app, bases de datos). Antes de cargar `contexto_profesional` para otra carrera (el profesorado) hay que parametrizarlos, o se filtran.
  - La persona de Superior + Matemática es "implacable en lógica y rigor… demostración", con rúbrica de `short_answer` que pone 0-40% al resultado sin desarrollo: no calza con una unidad de didáctica.

  Arreglo probable: mandar `carrera` desde `pedagogyProfile.degree` y no mandar `questionTypes` mientras el alumno no toque el selector. Cambia comportamiento en un aula con alumnos reales, así que va con decisión explícita.
- [ ] 🔺 **Cerrar el ciclo de "A reforzar": nadie marca un tema como superado.** Lo primero de esta lista, y tiene fecha por sí solo: los 31 están usando la app, `student_misconceptions.resolved` no lo pone en `TRUE` **ningún** camino de código, y la tarjeta "A reforzar" de `/history` sólo puede crecer. En dos semanas es una lista tan larga que no se mira, y mientras tanto castiga justo al alumno que mejoró: sigue viendo ahí el tema que ya domina. Las consultas ya filtran `resolved = FALSE`, así que el día que algo lo marque funcionan solas.

  **La decisión de qué cuenta como "superado" es de Mauro.** Lo que sigue es lo que el modelo soporta hoy, para que la conversación arranque sobre datos y no sobre impresiones:

  - **La hipótesis "N aciertos seguidos sobre ese tema" necesita antes una clave de tema estable, y hoy no la hay.** `student_misconceptions.topic_id` se escribe desde [quiz-engine.tsx:435](../components/quiz-engine.tsx#L435) con `currentQuestion.topic`, que **lo escribe la IA por pregunta** (está en el schema Zod de `lib/quiz-generation.ts`, opcional y con fallback a `'unknown'`). Es la misma familia de campo que este documento ya midió como inservible para agrupar: `quiz_answers.topic_name` tiene **358 valores distintos en 1.680 respuestas** y coincide con el tema que el alumno eligió sólo 22 veces. Sobre esa clave, "acertó 3 veces seguidas *ese* tema" no significa lo que parece.
  - **Lo que sí es estable** es `quiz_attempts.topics[]`, que son los temas que el alumno eligió, del currículum — la clave que ya usa el reporte del diagnóstico, anclada contra `curriculum.temas`. Es por intento y no por pregunta, así que da una granularidad más gruesa ("le fue bien en los intentos que cubrían este tema") pero con identidad real.
  - **La corrección por respuesta existe**: `quiz_answers.is_correct` más su `quiz_attempt_id` dan acierto y fecha. Lo que falta es el puente respuesta → tema del currículum.
  - **La salida manual del docente es la más barata y ya tiene media pieza puesta**: [students/[userId]](../app/api/teacher/classrooms/[id]/students/[userId]/route.ts) ya lee las misconceptions con su `resolved` y las muestra. Falta el PATCH y el control en la UI.
  - Hay una tercera forma que no requiere decidir nada de lo anterior: **caducidad por tiempo** ("esto lo trabajaste hace dos meses") en vez de un booleano de superado.

- [ ] **Source maps con Turbopack** — suben bien pero Sentry no los aplica (bug upstream `sentry-javascript#18248`, State: Blocked). Workaround: `next build --webpack`.
- [x] **Voseo app-wide** — 18 formas en 10 archivos: `quieres`→`querés` (6), `Selecciona`→`Seleccioná` (3), `intenta`→`intentá` (3), `Elige`→`Elegí` (2), `necesitas`→`necesitás` (2), más `completa`, `revisa`, `indica`, `Genera`, `vuelve` y `sigue así`. Vivían sobre todo en toasts de error y en las descripciones de los modos de cuestionario. De paso se corrigieron tildes y signos de apertura **en esas mismas frases** (`¿Qué querés hacer?`, `teórico`, `Perderás`), no más allá. **`/terminos` y `/privacidad` quedan como están**: su registro formal («Usted acepta», «su actividad previa») no es peninsular, es el que corresponde a un texto de cumplimiento de la Ley 25.326. El barrido inicial daba ~50 coincidencias y la mayoría eran comentarios del código en tercera persona, que no son copy.
- [x] Navegación de vuelta desde `/admin/ai-usage` — un `<Link>` a `/`, no la navbar: montarla arrastraría el layout de `(app)` con sus guards de onboarding, que es justamente lo que la página evita viviendo fuera del grupo. Un `<Link>` además la deja seguir siendo server component.
- [x] `updated_at` de `deployment_env` no se refresca — el `DEFAULT NOW()` de la columna sólo corre en el INSERT. `markEnvironment()` ya lo ponía a mano; los runners **017** y **018**, que también reescriben la fila, no. **Se descartó el trigger**, que sería el arreglo que no depende de que cada autor se acuerde: es una migración nueva y hay que correrla contra producción para arreglar algo que hoy no rompe nada. En su lugar quedó `tests/deployment-env-updated-at.test.ts` — chequeo léxico sobre el repo, mismo enfoque que `tests/migrations.test.ts`, que exige `updated_at` en todo `UPDATE` y todo `ON CONFLICT … DO UPDATE` sobre la tabla. Los INSERT pelados no se exigen: ahí el DEFAULT sí corre.
- [ ] Tipos `Db*` en `lib/db.ts` desalineados con el schema
- [x] ~~Warnings de `any` nuevos de la extracción~~ — los tres de la superficie pública tipados el 16/08/2026 (`subjectUnits`, `body`, `questions`); `GeneratedQuestion` se deriva de `quizSchema` con `z.infer` para que no se desincronice. **Quedan 17 en el módulo y quedan a propósito**: vinieron con el código movido y el header del archivo declara que la extracción no cambia comportamiento.
  - Tipar el `body` destapó que `subject`, `topics` y `mode` pueden venir `undefined` y el código los usa sin chequear. **No se agregó validación**: cambia comportamiento y hay 29 tests de caracterización que fijan el actual. La suposición quedó declarada y comentada en vez de silenciosa. Validarla es trabajo aparte.
- [x] favicon 404 — `public/favicon.ico`, un contenedor `.ico` de verdad con dos PNG embebidos (16 y 32, sacados de `icon-light-32x32.png`), no un PNG renombrado. Va en `public/` y **no** en `app/favicon.ico`: la convención de archivo de Next haría que el framework emita su propio `<link rel="icon">` compitiendo con el bloque `metadata.icons` de `layout.tsx`. Verificado contra el dev server, 404 sin el archivo y 200 con él.
- [x] Limpieza de ramas — de **16** locales a 9, y de 4 worktrees a 2. Borradas las 5 `worktree-agent-*` y las 3 `v0/*`, las ocho verificadas como ancestros de `main` antes de tocar nada. `fix/flujo-diagnostico-primero` se conserva: es la única sin mergear. (El conteo viejo decía ~14; eran 16.)
- [x] **Sacar el logo de v0** — los cinco íconos y `metadata.generator: 'v0.app'` afuera. En su lugar hay un arte **provisorio**: una M de trazo sobre cuadrado redondeado en el verde de marca `#43613C`, con el mismo esquema claro/oscuro que tenía el set anterior. `generator` se elimina del objeto en vez de reescribirse — es opcional y no hay nada que declarar.
  - [x] ~~**Falta el arte definitivo.**~~ Resuelto el 15/11/2026 con el isotipo del sistema de diseño (ver el bloque 1 del rediseño). Lo provisorio servía para no seguir mostrando la marca de otro producto, no para ser la identidad. Ver la nota de abajo sobre qué hace falta.
- [x] ~~**10 preguntas del 10/08 llegaron a un alumno con el texto corrupto.**~~ **Reproducido y arreglado el 25/08/2026.** Los ids 1430–1448 tenían escapes `\uXXXX` sin decodificar: el alumno leyó `La circunferencia…` en enunciado, opciones y explicación.
  - **La reproducción exoneró a la sospechosa.** Este ítem culpaba a la regex de `repairQuizJson` que duplica backslashes — y esa regex **nunca toca `\u`**: está en su lookahead de exclusión. El disparador real es el modelo emitiendo `par\\u00e1bola` con doble backslash (el mismo hábito con el que escribe `\\frac` para que el JSON signifique `\frac`, aplicado donde no corresponde). Eso es **JSON válido** cuyo valor es el texto literal: ni la reparación ni el parser ven nada raro, así que sólo se puede arreglar después de parsear.
  - El fix: `decodeStrandedUnicodeEscapes` en la normalización post-parse (las tres salidas del módulo, `acceptedAnswers` incluido), acotado a la mitad alta de Latin-1 con el mismo recorte que la regla del lint y por la misma razón. Tres tests de regresión verificados en rojo sin el fix; los 29 de caracterización, intactos.
  - La regex delicada quedó sin tocar, que era la restricción.
- [x] ~~**El tooling entra en los worktrees anidados de `.claude/`.**~~ Resuelto el 16/08/2026 con `exclude: ['**/.claude/**']` en vitest y el patrón equivalente en ESLint. Medido antes y después: vitest pasó de **67 archivos vistos (32 del worktree) a 35, cero del worktree**; ESLint, de decenas de miles de warnings sobre chunks compilados a **75 warnings, 0 errores**, que es el número real del repo. En vitest hay que listar `node_modules`, `dist` y `.next` explícitamente porque declarar `exclude` **reemplaza** los defaults en vez de sumarse. Historia original: Ni `vitest.config.ts` ni la config de ESLint excluyen `.claude/`, así que con un worktree vivo en `.claude/worktrees/` las dos herramientas lo escanean. Medido el 16/08/2026:
  - `npm test` levanta también los tests del worktree anidado. **Re-medido el 16/08 más tarde: 67 archivos vistos desde la raíz, 32 de ellos del worktree** — o sea que hoy se corre casi todo dos veces. La entrada decía "6 archivos en rojo"; el número creció con cada test que se sumó al worktree.
  - `npm run lint` entra al `.next/` del worktree anidado y reporta **34.641 warnings** sobre chunks compilados. El número real del repo es **71 (0 errores)**.
  - Los dos hacen creer que un cambio rompió algo cuando no. CI no se ve afectado: hace checkout limpio.
  - Arreglo: `exclude: ['**/.claude/**']` en vitest y el patrón equivalente en ESLint. Dos renglones. Hoy hace ruido cada vez que hay un agente en paralelo, que es justamente el modo de trabajo que recomienda la lección operativa de arriba.
- [x] ~~`public/placeholder-logo.svg` y `.png`~~ — borrados el 16/08/2026, verificado que no los referenciaba nadie.
- [ ] Quedan **tres archivos más de la misma tanda de v0**, igual de huérfanos y también sin una sola referencia en el repo: `public/placeholder.svg`, `public/placeholder.jpg` y `public/placeholder-user.jpg`. No se borraron con los otros dos porque no estaban en el pedido.
- [ ] Borrar el proyecto Neon de `quiosco-next` (no urgente: una branch no consume slot)
- [ ] **`xs:` en la navbar deja dos elementos ocultos para siempre.** `xs:` no es un breakpoint de Tailwind 4 y este proyecto no lo define en el `@theme` de `globals.css`, así que la variante no emite ninguna regla. En las filas de tarjetas de `/history` y de la home eso las apilaba a lo ancho (arreglado el 25/08). En [navbar.tsx:233 y :237](../components/navbar.tsx#L233) el patrón es `hidden xs:block`, o sea que el `hidden` gana en **todos** los tamaños: esos dos elementos no los vio nunca nadie. **No se tocó a propósito** — hacerlos aparecer es una decisión de producto (nadie sabe qué debería mostrar esa UI), no un arreglo de layout. Mirarlo cuando se toque la navbar; ahí decidir entre definir `--breakpoint-xs` o borrar los elementos.

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
- **El esquema modela el ciclo completo; el código implementa sólo la mitad que crea datos.** Tres casos, y a esta altura no es casualidad:

  | Columna | Qué promete | Qué pasa |
  |---|---|---|
  | `topic_mastery.mastered_at` | cuándo dominó el tema | **ningún** código la escribe — 0 de 77 filas en producción |
  | `topic_mastery.attempts_count` | cuántas veces lo intentó | sólo se incrementa en el camino de aprobado, así que cuenta intentos **aprobados** |
  | `student_misconceptions.resolved` | si ya superó la confusión | **ningún** código la pone en `TRUE` |

  El patrón: al diseñar la tabla se piensa el ciclo entero —empieza, progresa, se cierra— y se escriben las columnas de los tres momentos. Después se implementa la mitad que *produce* filas, porque es la que hace falta para que la feature se vea andando, y la que las *cierra* queda para "cuando haya tiempo". Nunca lo hay. El resultado no es una columna vacía y a la vista: es una tabla que **responde con seguridad una pregunta que no sabe contestar**, y encima aguas abajo alguien construye una pantalla sobre ella (la tarjeta "A reforzar" que sólo crece).

  Es primo del patrón de deuda-tecnica.md §6 —la falla disfrazada de estado normal— pero entra por otra puerta: ahí el error se disfraza de dato válido, acá lo hace la ausencia de escritura.

  **Cómo detectarlo en treinta segundos, y conviene hacerlo al agregar una columna de cierre:** buscar la columna en el repo y mirar si aparece en algún `UPDATE`/`INSERT` fuera del `.sql` que la creó. Si las únicas referencias son el DDL y `SELECT`s, la columna es letra muerta desde el día uno. La regla al escribir una migración nueva: **si una columna describe un final, el commit que la agrega tiene que incluir quién la escribe, o declarar explícitamente que todavía no existe y que las lecturas lo contemplan.**

- **Los tests de caracterización van antes del refactor, no después.**
- **PITR de Neon: 6 horas** (plan Free). El dump diario es la única red más allá del mismo día.

---

## Herramientas

- **Claude Code** — código real. Opus para ambigüedad arquitectónica, Sonnet para implementación con plan confirmado.
- **Este chat / Projects** — arquitectura y decisiones de producto. Mantener este doc como fuente canónica en Project Knowledge.
- **Cowork / Gemini** — documentos autocontenidos que no compiten por el repo vivo.
