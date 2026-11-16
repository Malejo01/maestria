El isotipo de MaestrIA, que es la M de Malejo con otra tinta.

En código va **inline**, con `stroke="currentColor"` y `style="color: var(--accion)"`. Así es un solo SVG para los dos modos y no hace falta un archivo por tema. Los archivos descargables están en el grupo de assets Logo, para usos fuera de la app.

## Medidas

| Tamaño | `stroke-width` | Nodos |
|---|---|---|
| 27 px o más | 4,8 | Sí |
| 22 a 26 px | 8,5 | Sí |
| Favicon | 9,5 | No |

Abajo de 27 px el trazo original se afina tanto que los nodos se cierran contra las capsulas y la M se ensucia. En el favicon directamente se quitan los cinco nodos y queda la M sola sobre un cuadrado de `accion` con `radio-sm`.

## Con el logotipo

La M va a la izquierda, separada por `espacio-3`. El texto en `display` 800 con `letter-spacing: -0.025em`; las letras **IA** en `accion` y el resto en `texto`.

## Lo que no se hace

No se rota, no se deforma, no se le cambia el grosor de trazo fuera de la tabla, no se le pone fondo propio ni sombra, y no se usa el isotipo en un color que no sea `accion` o `texto-sobre-accion`.

Aire mínimo alrededor: `espacio-3` por lado.

## Accesibilidad

Siempre `role="img"` y `aria-label="MaestrIA"`. Si va acompañado del logotipo escrito al lado, el SVG pasa a `aria-hidden="true"` para que el lector de pantalla no lo lea dos veces.
