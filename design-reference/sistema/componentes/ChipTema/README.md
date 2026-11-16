Muestra cómo le va a un alumno en un tema del temario. Es la pieza de información más repetida del panel.

| Estado | Tokens | Significa |
|---|---|---|
| Dominado | `logrado` sobre `logrado-fondo` | Responde bien de forma sostenida |
| Flojo | `flojo` sobre `flojo-fondo` | Falla ahí |
| Sin datos | `texto-suave` sobre `superficie-tarjeta`, con borde | Todavía no practicó lo suficiente |

## Por qué naranja y no rojo

Un alumno que abre su pantalla y ve rojo deja de entrar. El naranja dice "reforzá esto"; el rojo dice "fracasaste". Es una decisión del producto, no una preferencia estética, y no se cambia sin discutirla.

Además naranja y verde se diferencian por luminosidad y no solo por tono, así que funcionan para alguien que no distingue rojo de verde.

## El color nunca va solo

El chip siempre lleva el nombre del tema escrito. El color acompaña la lectura, no la reemplaza. Si en algún lado hace falta mostrar estado sin espacio para texto, usá un listado con etiquetas, no una grilla de puntos de color.

## Medidas

`radio-sm`, padding de 5/9 px, texto de 11 px en peso 600. Entre chips, `espacio-2`.

## Cuántos mostrar

En una fila de listado, hasta dos chips: el mejor y el peor. El resto aparece en la ficha del alumno. Una fila con cinco chips no se lee.

## El tercer estado importa

"Sin datos" no es lo mismo que "flojo". Un tema que el alumno nunca practicó no se pinta de naranja: eso le haría creer al docente que hay un problema donde solo hay silencio.
