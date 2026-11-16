# Accesibilidad

El objetivo es WCAG 2.1 AA, en los dos modos. No es un repaso al final: si un token no pasa contraste, el token está mal elegido.

## Contraste

Todos los pares de la paleta están medidos sobre el fondo que les toca, en claro y en oscuro.

| Par | Claro | Oscuro |
|---|---|---|
| `texto-suave` sobre `superficie-base` | 4.60:1 | 7.4:1 |
| `texto-suave` sobre `superficie-tarjeta` | 4.9:1 | 6.8:1 |
| `accion` sobre `superficie-tarjeta` | 5.2:1 | 5.4:1 |
| `texto-sobre-accion` sobre `accion` | 5.2:1 | 5.6:1 |
| `logrado` sobre `logrado-fondo` | 4.6:1 | 5.9:1 |
| `flojo` sobre `flojo-fondo` | 4.6:1 | 6.3:1 |

`texto-suave` se eligió en `#667085` y no en un gris más claro justamente por el primer par: sobre `superficie-base` un tono más claro no llegaba a 4.5:1.

Si agregás un token de color, medilo contra su fondo antes de usarlo y dejá el resultado escrito en su `usage`.

## Color que no es el único canal

Logrado y flojo se distinguen por luminosidad además de por tono, así que sobreviven a una daltonopía. Aun así el chip siempre lleva el nombre del tema escrito: el color acompaña, no informa solo.

Se eligió **naranja y verde** en vez de rojo y verde por lo mismo, y además porque el naranja comunica "reforzá esto" y el rojo comunica "fracasaste".

## Teclado

Todo lo que se puede tocar se puede alcanzar con Tab, en el orden en que se lee. El foco se ve siempre: anillo de 2 px en `foco`, con 2 px de separación del elemento. Nunca `outline: none` sin reemplazo.

Nada de `role="button"` ni `onClick` sobre un `div` o un `span`: Tab no los alcanza. Si algo se clickea, es un `<button>` o un `<a href>` de verdad, incluso en una maqueta.

## Área táctil

Mínimo 44 × 44 px en celular, que es donde está el alumno. Si un ícono se ve de 17 px, su botón igual mide 44.

## Formularios

Todo campo tiene su `<label>` asociado por `for`. El `placeholder` no reemplaza a la etiqueta: cuando el campo se llena, el placeholder desaparece y la persona pierde la referencia.

El campo de código de grupo acepta minúsculas y las normaliza, y no obliga a respetar guiones ni espacios.

## Movimiento

Las animaciones son de entrada y de cambio de estado, cortas. Toda animación respeta `prefers-reduced-motion`: con la preferencia activa, el elemento aparece sin desplazarse.

### La excepción declarada: qué se mueve y por qué

El sistema es sobrio a propósito: sin sombras, sin degradés, un solo azul. **El movimiento es la única excepción a esa sobriedad, y está acotada a esta lista.** Lo que no figura acá no se anima; si hace falta animar algo nuevo, primero se agrega acá con su motivo.

| Qué se mueve | Dónde | Por qué | Con `prefers-reduced-motion` |
|---|---|---|---|
| **Entrada de un bloque** (sube unos píxeles y aparece) | `Aparecer`: sugerencias, tarjetas que llegan después de la primera pantalla | Avisa que apareció algo que antes no estaba. Sin eso, un bloque que llega por la red parece un salto de la página. | Aparece en su lugar, sin desplazarse. |
| **Ícono de trabajo** (gira) | `Cargando`: botones y esperas de la IA | Distingue "está trabajando" de "se colgó" en esperas de varios segundos. | Queda quieto. El texto de al lado ya dice qué está pasando. |
| **Latido del esqueleto** | `ZonaDeCarga`: el panel del docente mientras lee sus datos | Distingue "está cargando" de "está vacío". Un solo latido por zona, no uno por bloque. | Queda quieto: los bloques grises siguen diciendo que ahí va a haber algo. |
| **Renglones de progreso** | La lectura de un temario subido: "leyendo… separando unidades y temas…" | Cada etapa aparece cuando ocurre: se ve que avanza. | Aparecen sin desplazarse. |
| **Barras que crecen** | La ficha del alumno ("Cómo le va en cada tema") y los primeros pasos del docente | La barra llega a su valor en vez de aparecer puesta: se lee como una medición. | Aparecen en su valor final. |
| **Marca de la pestaña activa** (se desliza) | La barra de navegación | Muestra de dónde venís y a dónde fuiste. | Salta a su lugar. |
| **Tarjeta que se da vuelta** | Mis tips | Es la metáfora del contenido: pregunta de un lado, respuesta del otro. | Cambia de cara sin girar. |
| **Panel de "Reportar un problema"** (se abre desde su botón) | El botón flotante | Deja claro de dónde salió el panel y a dónde vuelve. | Aparece casi instantáneo, sin escala. |
| **Papel picado** | La pantalla de resultados, sólo al aprobar | Es la única celebración de la app y la única animación decorativa. Está para el alumno, que es quien necesita que aprobar se sienta distinto de no aprobar. | **No se dispara.** |

Tres reglas que hacen que la excepción no se desborde:

1. **Toda animación es de Framer Motion y consulta `useReducedMotion()`.** Ni `animate-*` de Tailwind ni `@keyframes` propios: no respetan la preferencia solos, y el test del sistema (`tests/sistema-de-diseno.test.ts`) los rechaza. El papel picado es la única que no es de Framer Motion (usa `canvas-confetti`): se dispara siempre con `disableForReducedMotion: true`.
2. **Lo que viene pintado desde el servidor no se anima.** Si la primera pantalla entrara con opacidad 0, quedaría invisible hasta que baje y corra el JavaScript, que en un celular lento son segundos. Sólo se anima lo que se monta después.
3. **El movimiento nunca es el único canal.** Un estado que se comunica moviéndose también está escrito: el esqueleto se anuncia con `role="status"`, el ícono de trabajo va al lado de un texto, la barra lleva su porcentaje.

Nada parpadea, nada se mueve en bucle salvo las dos esperas (el ícono y el latido), y ninguna animación dura más de medio segundo salvo esas dos, que duran lo que dure la espera, y el papel picado, que dura tres segundos.

### Lo que no es de Framer Motion

Dos cosas se mueven sin pasar por Framer Motion, y por eso no pueden consultar `useReducedMotion()`:

- **Las transiciones de estado de CSS**: el color de un botón al pasar el mouse, el botón que se hunde un poco al tocarlo. No desplazan contenido y duran menos de 200 ms.
- **Los primitivos de `components/ui/`** (diálogos, menús, pestañas), que son código de terceros y traen su propia animación de apertura.

Para las dos hay una red en `app/globals.css`: con `prefers-reduced-motion: reduce`, toda transición y toda animación de CSS de la app dura cero. Es lo que hace que "toda animación respeta la preferencia" sea cierto también para el código que no escribimos nosotros.

## Imágenes e íconos

Un ícono decorativo al lado de su etiqueta lleva `aria-hidden="true"`. Un ícono solo lleva `role="img"` y `aria-label`. El isotipo lleva `aria-label="MaestrIA"`.

## Matemática

Las fórmulas se renderizan con KaTeX, que emite MathML para lectores de pantalla. Nunca se pone una fórmula como imagen sin alternativa en texto.
