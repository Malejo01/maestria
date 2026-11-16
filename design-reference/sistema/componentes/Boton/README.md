Los cuatro botones del sistema. No hay un quinto.

| Variante | Cuándo | Fondo |
|---|---|---|
| Principal | La acción que la pantalla quiere que pase. Una sola por pantalla. | `accion` |
| Secundario | Una alternativa legítima a la principal. | `superficie-tarjeta` con borde |
| Solo ícono | Acciones de barra sin texto: cambiar de modo, cerrar. | `superficie-tarjeta` |
| Grande de celular | Las dos opciones de la pantalla de entrada. Dos líneas: qué sos y qué hacés. | `accion` o hueco |

## Texto

Un verbo y un objeto: "Armar tarea", "Agregar alumno". Nunca "Aceptar", nunca "Enviar" solo. Si el botón dice "Guardar", tiene que quedar claro qué se guarda.

## Medidas

Radio `radio-md` en los chicos, `radio-lg` en el grande de celular. Padding de 10/15 px en los chicos. El botón solo ícono mide 44 × 44 aunque el ícono sea de 18: el área táctil no se negocia.

## Estados

`hover` pasa a `accion-hover` en el principal y oscurece el borde en el secundario. El foco de teclado es un anillo de 2 px en `foco` con 2 px de separación, y nunca se saca.

## Reglas

- **Una acción principal por pantalla.** Si hay dos botones azules compitiendo, uno de los dos es secundario.
- Un botón que dispara algo irreversible no es principal por defecto: pedí confirmación.
- Nunca un `div` con `onClick`. Siempre `<button type="button">` o `<a href>`, incluso en una maqueta.
- El botón solo ícono lleva `aria-label` y su SVG `aria-hidden="true"`.
