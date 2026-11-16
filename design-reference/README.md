# design-reference — MaestrIA

Todo lo que necesita un agente para rediseñar MaestrIA sin inventar nada. **Las imágenes de `pantallas/` son el diseño aprobado: se copian, no se interpretan.**

## Por dónde empezar

1. `PROMPT-FABLE.md` — el encargo completo. Es lo primero que lee el agente.
2. `sistema/brand-book.md` — principios, color, tipografía, logo, iconografía.
3. `sistema/tokens.json` — la fuente de verdad de todos los valores.
4. `pantallas/*.png` — cómo se ve el diseño aprobado.

## Qué hay en cada carpeta

### `sistema/`

| Archivo | Qué es |
|---|---|
| `brand-book.md` | El manual de marca. Principios, color, tipografía, reglas del isotipo. |
| `tokens.json` | 17 colores con valor en claro y oscuro, 7 pasos de espaciado, 5 radios, 2 grupos tipográficos. Cada token dice para qué sirve. |
| `tokens.css` | **Generado desde `tokens.json`.** Listo para copiar al proyecto. No se edita a mano: si cambia un valor, se cambia en el JSON y se regenera. |
| `voz-y-textos.md` | Cómo habla la app, y la tabla de vocabulario (temario, grupo, tarea…). |
| `accesibilidad.md` | Contrastes medidos par por par, teclado, área táctil, formularios. |
| `componentes/<Nombre>/README.md` | Cuándo usar el componente, sus medidas y sus reglas. |
| `componentes/<Nombre>/preview.html` | El componente andando. Se abre en el navegador sin servidor. |

### `pantallas/`

Los tres tableros de diseño aprobados, en PNG y en HTML.

| Archivo | Qué muestra |
|---|---|
| `marca.png` | Logotipo en los dos modos, tamaños del isotipo, paletas y escala tipográfica. |
| `modo-claro.png` | **Pantalla de entrada en celular + panel del docente en escritorio.** El diseño de referencia. |
| `modo-oscuro.png` | Las mismas dos pantallas en modo oscuro. |
| `componente-*.png` | Cada componente aislado. |

Los `.html` al lado de cada PNG son la misma pantalla en vivo: ábrelos para inspeccionar medidas y colores exactos con las herramientas del navegador, en lugar de estimar desde la imagen.

### `logo/`

El isotipo en las dos tintas, sin fondo. **En la app no se usan estos archivos**: ahí el SVG va inline con `stroke="currentColor"`. Estos existen para presentaciones, perfiles y documentos.

## Las tres reglas que más se incumplen

1. **Ningún hexadecimal suelto en el código.** Todo es `var(--token)`.
2. **Modo claro por defecto.** El oscuro va detrás de un botón, y no es la paleta invertida: varios tokens cambian de tono porque el contraste lo exige.
3. **Naranja para "flojo", nunca rojo.** Es una decisión de producto, explicada en el brand book.

## Si cambia un token

Editá `sistema/tokens.json`, regenerá `sistema/tokens.css` y actualizá la versión publicada del sistema de diseño. Nunca al revés.
