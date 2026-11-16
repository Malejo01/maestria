# Logo

El isotipo de MaestrIA: la M de Malejo, trazo por trazo, con la tinta cambiada.

Son cuatro trazos capsulares que arman la M más cinco nodos circulares en los vértices. Todo en contorno, sin relleno, `stroke-width` 4,8 sobre un viewBox de 144,4.

## Los archivos

| Archivo | Tinta | Para |
|---|---|---|
| `maestria-isotipo-claro.svg` | `#2d5bff` (`accion` en claro) | Fondos claros |
| `maestria-isotipo-oscuro.svg` | `#5b82ff` (`accion` en oscuro) | Fondos oscuros |

Los dos vienen **sin fondo**: el SVG es transparente y el color está escrito en el trazo.

**En la app no uses estos archivos.** En código el isotipo va inline con `stroke="currentColor"`, y toma el color de la variable del modo activo. Estos dos archivos existen para lo que pasa fuera de la app: una presentación, un perfil de red, un documento, un proveedor que te pide el logo.

## Reglas

- Hasta 26 px va el trazo de 4,8. Por debajo subilo a 8,5 o los nodos se cierran.
- Para favicon, sacá los cinco nodos y dejá la M sola sobre un cuadrado de `accion` con `radio-sm`.
- Aire mínimo: `espacio-3` por lado.
- No se rota, no se deforma, no se le agrega fondo propio ni sombra.
- Con el logotipo al lado, la M va a la izquierda, separada por `espacio-3`, y las letras "IA" del texto van en `accion`.
