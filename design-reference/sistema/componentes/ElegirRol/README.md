La puerta de entrada de MaestrIA, y la pantalla que más trabajo de diseño merece de toda la app.

Los docentes que probaron la versión anterior reportaron lo mismo: que es fácil perderse, que unos entran con código y otros con Google, y que no se sabe si uno es docente o alumno. Esta pantalla existe para que eso no vuelva a pasar.

## Qué hace

Una sola decisión: **sos docente o sos alumno**. Abajo, separado por una línea, el campo de código para quien ya recibió una invitación.

El patrón sale de cómo lo resuelven Kahoot y Quizizz: el rol se elige al principio, y el alumno que llega con un código tiene su propia puerta.

## Lo que no se muestra acá

**El método de ingreso.** Google, email con código, lo que sea: eso viene después de elegir el rol, en la pantalla siguiente. Ofrecer rol y método a la vez es exactamente lo que confundía a los docentes.

## Si llegó por un link de grupo

No se muestra esta pantalla. Ya sabemos que es alumno. En su lugar aparece la pantalla del grupo, con el nombre del docente arriba: "Te invitó Mauro Lizárraga". Preguntarle el rol a alguien que llegó por una invitación es hacerle una pregunta cuya respuesta ya tenemos.

## El rol es reversible y hay que decirlo

La bajada dice "Elegí una vez. Después lo podés cambiar desde tu perfil." Esa línea está ahí porque la ansiedad de elegir mal es lo que traba a una persona frente a dos botones grandes.

## Medidas

Marco de celular con `radio-xl`. Botones grandes con `radio-lg` y dos líneas. El campo de código acepta minúsculas y las normaliza, y no exige guiones ni espacios.

## Accesibilidad

Los dos botones son `<button>` de verdad y se alcanzan con Tab en orden. El campo tiene `<label>` asociado por `for`; el `placeholder` del código es un ejemplo, no la etiqueta. El isotipo va `aria-hidden` porque el logotipo escrito está al lado.
