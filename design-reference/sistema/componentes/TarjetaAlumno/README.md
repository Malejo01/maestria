La fila de una persona en el listado del panel, y la tarjeta de sugerencia que la acompaña.

Es el componente central de MaestrIA, porque es el que materializa el principio de que el panel se organiza por alumnos y no por materias.

## La fila

Cinco zonas, siempre en este orden: inicial, quién es, cómo le va, cuándo fue la última vez.

| Zona | Contenido | Estilo |
|---|---|---|
| Inicial | Primera letra del nombre | `superficie-suave` con tinta `accion`, 42 px |
| Nombre | Nombre y apellido | `cuerpo` |
| Contexto | Qué prepara y para cuándo | `nota` en `texto-suave` |
| Temas | Hasta dos chips: el mejor y el peor | `ChipTema` |
| Última vez | "hace 2 d", "ayer" | `nota` en `texto-suave`, ancho fijo de 72 px alineado a la derecha |

El ancho fijo de la última columna es a propósito: las fechas quedan alineadas y el ojo las recorre de un saque.

El contexto ("Análisis I · rinde el 12/12") lo escribe el docente cuando agrega al alumno. Es texto libre y es lo que convierte un listado de nombres en algo útil.

## La tarjeta de sugerencia

Cierra el listado y **siempre termina en un botón**. Un panel que solo informa se abre una vez; uno que propone la acción siguiente se abre todos los días.

El texto nombra a la persona y dice el hecho concreto ("Julieta no practica hace 6 días"), después el diagnóstico, después la pregunta. Nunca una métrica suelta.

Va en `accion-tenue` con borde `accion-tenue-borde`. Una sola por listado: si todo sugiere, nada sugiere.

## Reglas

- Hasta dos chips por fila. El resto vive en la ficha del alumno.
- La inicial es decorativa: `aria-hidden="true"`. El nombre ya está escrito al lado.
- La fila entera es clickeable hacia la ficha, y entonces es un `<a href>`, no un `div`.
- Sin foto de perfil. Nadie va a subir una, y el hueco vacío se ve peor que la inicial.

## Estado vacío

Cuando el docente todavía no agregó a nadie, en lugar del listado va un bloque con qué es esto, por qué está vacío y el botón de agregar. Es la primera pantalla real de un docente nuevo y merece el mismo cuidado que el resto.
