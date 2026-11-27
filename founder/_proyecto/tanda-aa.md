# MaestrIA — Tanda AA: gratis sólo con 2 alumnos, canal de Meta y registro probado de punta a punta

Encargo del 26/11/2026. **Va antes de lanzar la campaña de Meta de MaestrIA**, que lleva al docente a registrarse solo. Corre encadenada con la Tanda AB (ver el orden en `tanda-ab-2026-11-27.md`); las reglas de AB aplican también acá.

**Decisión de Mauro (26/11):** se acaba la prueba de 30 días con hasta 10 alumnos. El plan gratis queda en **2 alumnos particulares (y 1 curso) para siempre**. Para tener más alumnos hay que pagar un plan.

---

## AA1 · Sin prueba de 30 días

**Hoy:**
- La prueba arranca cuando el docente acepta el aviso: `iniciarPrueba` en `lib/planes-server.ts` (G2), con `DIAS_PRUEBA = 30` en `lib/planes.ts` y el cupo de `cupoDeNivel(0)`.
- La página `/precios` ofrece «Probar 30 días gratis» (`T.empezar`, `T.bajada`, `T.pruebaDetalle` en `lib/textos.ts`).

**Qué hacer:**
1. **La prueba se apaga con una variable.** Crear `MAESTRIA_PRUEBA_DIAS`, que por defecto vale **0**.
   - Con 0, `iniciarPrueba` no hace nada y devuelve `false`.
   - El aviso que ofrece la prueba no se muestra.
   - Un docente nuevo arranca directo en el estado `gratis`.
2. **Los que ya están en prueba la terminan como estaba prevista.** No se les acorta ni se les quita nada, y al vencer pasan a gratis como hasta hoy. Listar en el informe cuántos hay en producción, con un script de **sólo lectura**.
3. **`/precios` y los textos:**
   - Arriba: «Gratis con 2 alumnos particulares y 1 curso, para siempre. ¿Más alumnos? Elegí un plan.»
   - El botón: **«Empezar gratis»** → `/sign-in?rol=docente`.
   - Sacar toda mención a los 30 días de prueba, en `/precios` y en cualquier otro texto (buscar «30 días» y `DIAS_PRUEBA` en `app/`, `lib/` y `components/`; los «30 días» de `/admin/ai-usage` y de `acreditar-plan` no son la prueba y quedan).
4. **El cupo gratis** sigue saliendo de `cupoGratis()` (hoy 2). Al llegar al alumno 3, el docente ve el aviso de plan (que AB6 rediseña).

**Aceptación:**
- Tests de `iniciarPrueba` con la variable en 0 y con la variable en 30.
- Un docente en prueba de hoy no cambia.
- El test de `/precios` ya no encuentra «30 días».

---

## AA2 · El canal «Meta» en el origen del registro

Hoy `lib/origen.ts` conoce `ig`, `wa`, `fb`, `tt`, `li`, `yt` y `otro`.
1. **Sumar `meta`** (nombre: «Anuncio de Meta») a `CANALES` y a `NOMBRE_DEL_CANAL`.
2. **El link del anuncio** va a ser `https://maestria-edu.vercel.app/profes?origen=meta&ref=AD-<nombre>`. Que `ref` acepte esos valores sin confundirlos con el código de referido de un docente: si empieza con `AD-`, se guarda como campaña y no como referido.
3. **En `/admin/embudo`**, una fila para el canal Meta con: visitas, registros, docentes con al menos 1 alumno y docentes que pagan. Sumar también las filas del criterio de verificación del análisis Founder: **profes activados** (programa + 2 alumnos que practicaron en sus primeros 7 días), **con 3.er alumno** y **pagando**.

**Aceptación:** tests de `lib/origen.ts` con `origen=meta` y con `ref=AD-...`; test de la función que cuenta «activado».

---

## AA3 · `/profes`: la página a la que llega el anuncio

Una página corta, en modo claro, con la estética de MaestrIA, para el docente que viene de Instagram o Facebook. Tiene que leerse en un celular sin hacer scroll de más. **Los textos son los de AB2**, no los originales.

1. Título, bajada y tres puntos: ver AB2.
2. **El video:** embebido y sin autoplay con sonido. Archivo `public/profes/reel.mp4`: lo pasa Mauro. Si no está, se muestra una captura.
3. **El botón «Empezar gratis con 2 alumnos»** → `/sign-in?rol=docente&callbackUrl=/teacher`, conservando `origen` y `ref`.
4. **Abajo:** «Prefiero que me lo cargues vos» (WhatsApp, `MAESTRIA_WHATSAPP_CONTACTO`) y el link a `/precios`.

**Aceptación:**
- Test de que el botón conserva `origen` y `ref`.
- Lighthouse en celular con rendimiento de 85 o más.

---

## AA4 · El registro de un docente nuevo, probado de punta a punta en staging

**Va al final de la noche**, sobre la rama de integración de AB. Con `npm run dev:staging` y `/sign-in/dev` (un usuario de staging **nuevo**, creado por el script de datos de prueba; nunca uno real), recorrer y grabar con Playwright:

1. Entrar a `/profes?origen=meta&ref=AD-prueba`.
2. Tocar «Empezar gratis».
3. Elegir el rol docente y entrar.
4. Pasar por la bienvenida y el arranque guiado (AB4).
5. Crear la primera materia importando un PDF (fixture de la tanda I).
6. Generar un cuestionario de 5 preguntas, revisarlo y aprobarlo (AB7).
7. Copiar el mensaje para WhatsApp e invitar a 2 alumnos de prueba.
8. Que los alumnos practiquen.
9. Que el docente vea «Esta semana» (AB5) y la ficha.
10. Invitar a un 3.er alumno y ver el muro con evidencia (AB6).

**El informe dice:** en qué paso se traba, si se traba; cuántos clics lleva cada paso; qué textos confunden; y si `users.origen` quedó en `meta`. Lo que se pueda arreglar en el momento va en su propia PR. Lo que no: `[BLOQUEADO]` con captura.

**Nota:** hoy el único ingreso es con Google. Anotar cuántos pasos requiere y si un docente sin cuenta de Google queda afuera. **No implementar email todavía:** es una decisión de Mauro.

---

## Cierre
Va en el informe de AB (`docs/informes/tanda-ab-2026-11-27.md`): PRs, variables para Vercel (`MAESTRIA_PRUEBA_DIAS=0`), cuántos docentes siguen en prueba, el resultado de AA4 paso por paso y el link final del anuncio.
