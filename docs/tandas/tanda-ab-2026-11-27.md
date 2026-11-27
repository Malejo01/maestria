# MaestrIA — Tanda AB: de «comprá el plan» a «empezá gratis con 2 alumnos»

Encargo del 27/11/2026. Sale del análisis Founder (`docs/founder/`, leer primero `summary.md`, `offer.md` y `pricing.md`).

**La idea en una línea:** el profe no compra en frío. Quiere ver a sus 2 alumnos practicar gratis antes de pagar. La app tiene que **llevarlo a esa evidencia en la primera semana** y **mostrársela** en el momento de pedir el pago.

**Va encadenada con la Tanda AA** (`docs/tandas/tanda-aa-2026-11-26.md`). Orden de la noche:
AA1 → AA2 → AB1 → AB2 (incluye AA3) → AB3 → AB4 → AB5 → AB6 → AB7 → AB8 → AB9 → AA4 (al final, para probar todo junto).

## Reglas
- Una rama por ítem desde `main` (`tanda-ab/ab1-...`), PR y CI en verde (`npm test` + `npm run build`). **Ningún merge**: los mergea Mauro a la mañana.
- `[BLOQUEADO]` a las 2 fallas o a las 2 horas, y seguir con el siguiente.
- **Nada contra producción.** Siempre `npm run dev:staging`. Scripts con `--env=staging`. Lecturas de prod solo si el ítem lo dice y con script de solo lectura.
- Migraciones desde la siguiente libre, corridas **solo en staging**. Mauro corre las de producción.
- **No cambiar precios ni planes por defecto en el código** (`DIAS_PASE`, cupos, niveles). Los montos salen de env vars (`MAESTRIA_PRECIO_MENSUAL_BLOQUE`, `MAESTRIA_PRECIO_PASE_BLOQUE`); Mauro las carga en Vercel.
- Gemini en staging: **tope de USD 0,20 en toda la noche** (≈ 40 llamadas). Preferir fixtures y mocks; cada llamada real se anota en el informe.
- Datos de prueba ficticios. Nunca un alumno o docente real.
- Diseño: tokens de `app/tokens.css`, textos en `lib/textos.ts`, animaciones con Framer Motion + `useReducedMotion()`.
- Informe en `docs/informes/tanda-ab-2026-11-27.md`. Actualizar `docs/roadmap.md` al cerrar.

---

## AB1 · Copiar el análisis al repo
1. Commitear `docs/founder/` y `docs/tandas/tanda-ab-2026-11-27.md` (los dejó Claude sin commitear en el árbol de trabajo) en la rama `tanda-ab/ab1-founder`.
2. Nada más: es la base que leen los demás ítems.

## AB2 · `/profes` v3 (reemplaza los textos de AA3)
Hacer AA3 tal cual con estos cambios:
- **Título:** «Empezá gratis con 2 alumnos.»
- **Bajada:** «Nada le llega a tu alumno sin tu OK.»
- **Tres puntos:**
  1. Subís el programa (o te lo cargo yo en una videollamada de 15 minutos) y MaestrIA arma la práctica por tema.
  2. Revisás cada pregunta y la aprobás en un clic. Si se traba, el alumno recibe una pista, nunca la respuesta.
  3. Cada lunes ves quién practicó y qué tema le falta a cada uno.
- **Ancla de precio, chica, abajo:** «¿Más de 2 alumnos? Menos que una clase por mes, para 5.» El monto sale de `precioMensual(1)`; si no hay env, no se muestra el número.
- **Botón secundario:** «Prefiero que me lo cargues vos» → WhatsApp con la variable existente y el texto «Hola Mauro, quiero que me ayudes a cargar mi programa en MaestrIA».
- **Prohibido en el copy:** «ahorrá horas revisando», «IA que corrige todo», cualquier «30 días».

**Aceptación:** los tests de AA3 + un test de que el texto no contiene «30 días» ni «revisando».

## AB3 · `/precios`: una sola oferta adelante
1. Arriba solo el **plan Particular**: «Gratis con 2 alumnos, para siempre» y «Bloque de 5 alumnos: $X por mes» (`precioMensual`), con el pase de 90 días como segunda opción (`precioPase`), **más chico**. No cambiar los 90 días.
2. **Aula, Institución y Autodidacta** salen de la vista principal: quedan detrás de un link «¿Sos escuela, instituto o estudiás por tu cuenta?» que despliega lo de hoy. No se borra nada.
3. Debajo del precio, dos renglones:
   - **Garantía:** «Si en 14 días ninguno de tus alumnos practicó, te devuelvo el pago.»
   - **Marzo:** «No hay débito automático: si no renovás, tus fichas quedan guardadas y volvés cuando quieras.» (verificarlo en AB8 antes de dejarlo).
4. Actualizar `app/(entrada)/precios/page.test.tsx`.

**Aceptación:** test de que Aula/Institución/Autodidacta no están en el primer render y aparecen al desplegar; test de los dos renglones.

## AB4 · El arranque guiado del docente nuevo
En el inicio de `/teacher`, para el docente con menos de 2 alumnos que practicaron, una lista de 3 pasos que se tilda sola:
1. **Subí tu programa** (o «Pedime que te lo cargue»: WhatsApp).
2. **Revisá y aprobá tu primer cuestionario.**
3. **Mandáselo a 2 alumnos** → abre el mensaje de `lib/compartir-tarea.ts` con botón «Copiar para WhatsApp» y «Abrir WhatsApp».
- Al completarse: «Listo. El lunes te mostramos quién practicó.» y la lista desaparece.
- El estado se calcula de datos que ya existen (programas, cuestionarios asignados, intentos de alumnos). **Sin migración** si se puede.

**Aceptación:** tests de la función pura que decide en qué paso está el docente (0, 1, 2, 3 y completo).

## AB5 · «Esta semana»: quién practicó y qué le falta
Una tarjeta en `/teacher` (y su versión para copiar al WhatsApp del profe):
- Por alumno, **últimos 7 días**: practicó sí/no, cuántos ejercicios, % de aciertos y **el tema más flojo** (de `leerFichaAlumno`).
- Arriba, una frase: «3 de tus 4 alumnos practicaron esta semana. A Juan le falta logaritmos.»
- Si nadie practicó: «Nadie practicó todavía. ¿Les reenviás el link?» con el mismo botón de AB4.
- Botón «Copiar resumen» con texto plano para WhatsApp (mismas reglas que `compartir-tarea.ts`: no inventar).
- No hay email todavía: es in-app. Se puede dejar anotado en el informe cómo sería un aviso semanal, sin hacerlo.

**Aceptación:** tests de la función que arma la frase y el texto copiable, con 0, 1 y varios alumnos y con alumnos sin intentos.

## AB6 · El muro del 3.er alumno, con evidencia
Hoy, al pasar el cupo gratis, el docente ve el aviso de plan de siempre. Cambiarlo por:
- **La evidencia primero:** «Tus 2 alumnos hicieron 46 ejercicios en 9 días. El tema más flojo: funciones.» (datos de AB5; si no hay práctica, un texto honesto: «Todavía no practicaron: probá primero con tus 2 alumnos.»).
- **La oferta:** «Sumá hasta 5 alumnos por $X al mes» (`precioMensual(1)`), garantía de 14 días, «sin débito automático».
- El precio fundador va por el sistema de códigos que ya existe (`lib/codigos-descuento.ts`, `/admin/codigos`): en el muro, un campo «¿Tenés un código?» visible. El código lo crea Mauro (propuesta: `FUNDADOR`, 33 %, 3 meses, 20 usos).
- Botón al checkout que ya existe (`/api/pagos/checkout`).

**Aceptación:** test del componente con evidencia, sin evidencia y sin env de precio.

## AB7 · «Nada sale sin tu OK», visible
En `teacher-quiz-review.tsx`:
1. El paso de revisión se nombra **«Revisá y aprobá»**, con un contador «7 de 10 revisadas» y un botón **«Aprobar todas y mandar»**.
2. Extender la edición inline a **verdadero/falso y respuesta corta** si la estructura lo permite sin tocar el motor de tipos. Si requiere tocar las 4 piezas del tipo de pregunta, `[BLOQUEADO]` con la explicación y no hacerlo.

**Aceptación:** tests del contador y del flujo «aprobar todas».

## AB8 · Verificar qué pasa cuando el plan vence (para el copy de marzo)
1. Con un docente de prueba en staging con plan Particular vencido: ¿se conservan alumnos, fichas e historial? ¿Qué ve el alumno 3, 4 y 5? ¿Qué ve el docente?
2. Escribir el resultado en el informe. Si **algo se pierde**, el renglón de marzo de AB3 cambia a lo que sea cierto y se marca para Mauro.
3. Agregar en `/admin` una lista **de solo lectura**: «Pagaron hace 14 días o menos y ningún alumno practicó» (candidatos a la garantía), para que Mauro devuelva a mano desde Mercado Pago.
4. Probar el webhook de Mercado Pago (`app/api/pagos/mercadopago`) de punta a punta **en staging** con el modo de prueba de Mercado Pago si está configurado; si no, con el test existente y anotar qué falta para probarlo real.

## AB9 · Extracción de programas con PDFs reales
1. Script `scripts/probar-extraccion.ts --env=staging --carpeta <ruta>` que pasa cada PDF por la extracción de programas y escribe una tabla: archivo, páginas, temas extraídos, unidades, errores, tiempo, costo estimado.
2. Correrlo sobre **`C:\Programacion\Math Malejo\pruebas-programas`** (9 PDFs, ≈ USD 0,03 en Gemini).
3. En el informe: cuáles salen bien, cuáles mal y por qué (escaneado, tablas, índice raro). Lo que se pueda arreglar en el prompt o el parser, en su propia PR.

## AA4 al final
Correr AA4 **con todo lo de AB puesto** (sobre una rama de integración local `tanda-ab/integracion` que junte las PR, sin mergear a `main`): la grabación tiene que pasar por `/profes` v3, el arranque guiado, el resumen semanal y el muro del 3.er alumno.

## Cierre
El informe dice:
- cada PR con su estado (verde / bloqueado);
- **las variables para Vercel** que Mauro decide cargar: `MAESTRIA_PRUEBA_DIAS=0`, `MAESTRIA_PRECIO_MENSUAL_BLOQUE=15000` (recomendado por el análisis; hoy $20.000) y `MAESTRIA_PRECIO_PASE_BLOQUE` (propuesta $35.000 por 90 días); el código fundador se crea en `/admin/codigos`;
- el resultado de AB8 (qué se conserva al vencer) y de AB9 (tabla de PDFs);
- el costo real de Gemini de la noche;
- el link final del anuncio para Meta (de AA2), **que no se usa hasta el OK de Mauro**.
