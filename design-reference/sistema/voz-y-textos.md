# Voz y textos

El texto de la interfaz es parte del diseño. En MaestrIA es lo que decide si una docente que no se lleva bien con la tecnología sigue o abandona.

## Cómo hablamos

**Castellano rioplatense con voseo.** "Elegí", "armá", "entrás". Nunca "elige", nunca "usted".

**Como un colega, no como un sistema.** "Julieta no practica hace 6 días" dice lo mismo que "Última actividad registrada: hace 6 días" y se entiende sin traducir.

**Decí qué pasó, no qué falló.** "No pudimos leer el PDF, probá con otro archivo" en vez de "Error 422 al procesar el documento".

**Sin relleno.** Si una frase se puede borrar sin perder información, se borra. Nada de "¡Bienvenido a la plataforma educativa del futuro!".

## Palabras que usamos y las que no

| Decimos | No decimos | Por qué |
|---|---|---|
| Temario | Programa de materia | Es como lo llama un profesor particular. |
| Grupo | Aula | "Aula" suena institucional y además se crea solo. |
| Tarea | Asignación | Nadie le manda una "asignación" a un alumno. |
| Desde / Hasta | Ventana de disponibilidad | |
| Plan oficial de la provincia | Diseño curricular | |
| Cómo das la materia | Perfil pedagógico | |
| — | Jurisdicción | No se muestra nunca; se infiere. |

Estas equivalencias viven en un módulo de textos, no repartidas por los componentes. Más adelante pueden cambiar según el tipo de cuenta sin tocar una sola pantalla.

## Reglas por tipo de texto

**Botones:** un verbo y un objeto. "Armar tarea", "Agregar alumno". Nunca "Aceptar", nunca "Enviar" solo.

**Estados vacíos:** son la primera pantalla real de un docente nuevo. Llevan qué es esto, por qué está vacío y un botón. "Todavía no agregaste alumnos. Cuando sumes al primero, acá vas a ver cómo le va."

**Esperas:** si la IA está trabajando, decí qué está haciendo. "Leyendo el PDF… encontré 6 unidades… extrayendo temas." Un spinner mudo es donde más gente abandona.

**Diagnósticos:** hablan del razonamiento, no de la nota. "Confunde la regla del producto con la de la cadena", no "60% de aciertos en derivadas".

**Nada de mayúsculas de énfasis** en el medio de una frase, y nada de signos de exclamación salvo en la confirmación de que algo salió bien.

## Emojis

**En la interfaz, ninguno.** Ni en botones, ni en títulos, ni en avisos, ni en estados vacíos, ni en mensajes de error o de festejo. Un ícono del sistema (`lucide`, trazo de 1,75) hace ese trabajo y se ve igual en todos los dispositivos; un emoji cambia de dibujo según el teléfono y le baja el registro a todo lo que tiene alrededor.

**En el contenido que escribe la IA, sólo para Primario.** Una pregunta o una explicación para un nene de 7 años puede llevar un 🐥 al lado de "pollitos": ahí es apoyo de lectura, no decoración, y lo pide el prompt de ese nivel. Para Secundario y Superior, ninguno: ni en preguntas, ni en opciones, ni en explicaciones.

| Dónde | Primario | Secundario | Superior |
|---|---|---|---|
| Interfaz (lo que escribimos nosotros) | No | No | No |
| Preguntas y opciones generadas | Sí, pocos | No | No |
| Explicación de un error | Sí, pocos | No | No |

La línea entre las dos cosas es **quién escribió el texto**: si está en `lib/textos.ts` o en un componente, es interfaz; si lo devolvió el modelo para un alumno, es contenido. Un título de pantalla es interfaz aunque esté arriba de una explicación generada.

Cómo se sostiene, para que no dependa de acordarse:

- **Interfaz:** `tests/sistema-de-diseno.test.ts` falla si aparece un emoji en `app/` o en `components/`.
- **Contenido:** el nivel decide (`permiteEmojis` en `lib/education-context.ts`). Fuera de Primario el prompt los prohíbe, la explicación pasa además por `quitarEmojis` antes de llegar al alumno, y el lint de preguntas (`lib/qa/lint-questions.ts`) marca cualquier pregunta de Secundario o Superior que traiga uno.

Lo que **no** es un emoji para esta regla: los símbolos que son contenido (→, ↔, ✓, ©, ½) y todo lo que va dentro de una fórmula.

## Nombres propios

Se escribe **MaestrIA**, con las dos últimas letras en mayúscula, siempre. No "Maestria", no "MAESTRIA", no "Maestr-IA". En el logotipo las letras "IA" van en `accion` y el resto en `texto`.
