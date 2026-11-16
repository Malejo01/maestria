# MaestrIA

Sistema de diseño de MaestrIA, plataforma donde un docente arma el temario de su materia y le manda trabajos prácticos a sus alumnos, y la IA diagnostica en qué se equivocan antes de darles la respuesta.

Lo usan dos personas muy distintas: una docente de 25 a 60 años que no necesariamente se lleva bien con la tecnología, en celular y en escritorio; y un alumno de secundario o terciario, casi siempre en celular, casi siempre apurado.

## Los cinco principios

**Primero la persona, después la materia.** El panel se organiza por alumnos, no por materias. Un profesor particular tiene ocho alumnos y cada uno prepara algo distinto; la unidad mental es la persona.

**Una decisión por pantalla.** Nadie elige entre cinco cosas a la vez. La entrada pregunta una sola cosa: si sos docente o alumno. El resto viene después.

**Cada pantalla dice qué hacer ahora.** Un panel que solo informa se abre una vez. Un panel que propone la acción siguiente se abre todos los días. Por eso la tarjeta de sugerencia termina siempre en un botón.

**La matemática se tiene que leer.** El contenido lleva fórmulas en KaTeX sobre pantallas chicas. El sistema nunca compite con eso: fondos planos, un solo color de acción, nada de degradés ni sombras detrás del texto.

**Bordes, no sombras.** Las superficies se separan con el token `borde`. No hay sombras en este sistema y no se agregan.

## Modos

La app abre en **modo claro**. El oscuro existe y es completo, pero queda detrás de un botón en la barra: una docente que entra por primera vez no debería encontrarse con una pantalla negra.

No son una paleta y su inversa. Son dos juegos de valores para los mismos roles, y varios cambian de tono porque el contraste lo exige: `accion` pasa de `#2d5bff` a `#5b82ff`, y `texto-sobre-accion` pasa de blanco a tinta. Usá siempre el nombre del token, nunca el hexadecimal.

## Color

| Rol | Token | Cuándo |
|---|---|---|
| Acción | `accion` | Un solo azul. Botón principal, enlaces, pestaña activa, isotipo. Si hay dos azules en una pantalla, uno está de más. |
| Dominado | `logrado` sobre `logrado-fondo` | El alumno responde bien ese tema. |
| Flojo | `flojo` sobre `flojo-fondo` | El alumno falla ahí. **Naranja, no rojo**: marca dónde reforzar, no un error grave. Un alumno que ve rojo en su pantalla deja de entrar. |
| Secundario | `texto-suave` | Fechas, subtítulos, metadatos. |

Logrado y flojo también se distinguen por luminosidad, no solo por tono, así que funcionan para alguien que no diferencia verde de naranja. Aun así, **nunca dejes el color solo**: el chip lleva el nombre del tema escrito.

## Tipografía

Dos familias y nada más.

**Plus Jakarta Sans 800** para títulos, con `letter-spacing` negativo. Le da carácter sin dejar de ser una grotesca legible.

**Inter** para todo el resto: cuerpo, metadatos, etiquetas y números. Inter tiene cifras tabulares y buen comportamiento a 12 px en pantalla chica, que es donde vive el alumno.

Nunca una tercera familia. Nunca Plus Jakarta Sans para texto corrido.

## Espaciado y radios

La escala de espaciado es de 4 px, con `espacio-4` (16 px) como paso base. Los radios suben con la superficie: 8 px en un chip, 11 px en un botón, 14 px en una tarjeta, 24 px en el marco del celular.

## El isotipo

La M de MaestrIA **es** la M de Malejo, el estudio de Mauro Lizárraga: mismo trazado, mismos cinco nodos, mismo grosor relativo. Lo único que cambia es la tinta, que acá es `accion`.

El archivo usa `currentColor`, así que es **un solo SVG sin fondo** que toma el color de la variable CSS del modo activo. No hay una versión por modo.

Reglas:

- Hasta 26 px va el trazo original de 4,8. Por debajo sube a 8,5, porque si no los nodos se cierran y la M se ensucia.
- En el favicon se quitan los cinco nodos y queda la M sola, en `texto-sobre-accion` sobre un cuadrado de `accion` con `radio-sm`.
- El isotipo no se rota, no se deforma, no se le cambia el grosor de trazo fuera de las dos medidas de arriba, y no se le pone fondo propio.
- Aire mínimo alrededor: `espacio-3` por lado.

Los archivos están en el grupo de assets **Logo**.

## Iconografía

Íconos de trazo, 1.9 px de grosor, extremos y uniones redondeados, caja de 24 px. Se pintan con `currentColor` y heredan el color del texto que acompañan.

Un ícono solo, sin texto visible, siempre lleva `aria-label`. Un ícono decorativo al lado de su etiqueta lleva `aria-hidden="true"`.

Nunca emojis en la interfaz.

## Accesibilidad, en corto

Todo el texto pasa 4.5:1 sobre el fondo que le toca, en los dos modos, incluidas las etiquetas de 11 px. El área táctil mínima es de 44 px. El foco de teclado se ve siempre, con el token `foco`. Los detalles están en la sección de accesibilidad.

## Cómo se usa

Leé primero este archivo y después `tokens.json`. En la app los tokens llegan como variables CSS (`var(--accion)`), y el modo se cambia con `data-theme="claro"` o `data-theme="oscuro"` en el elemento raíz.

Las dos familias se cargan desde Google Fonts: Plus Jakarta Sans en 500, 700 y 800, e Inter en 400, 500, 600 y 700.
