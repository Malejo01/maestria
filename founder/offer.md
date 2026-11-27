# La oferta · MaestrIA

## Problemas del profe (en sus palabras, del panel)
1. «No sé si mis alumnos van a practicar en casa.» (hábito)
2. «¿La IA corrige bien matemática y respeta cómo explico yo?» (confianza)
3. «En diciembre no tengo tiempo de aprender otra plataforma.» (tiempo)
4. «Esto lo hago gratis con ChatGPT y un PDF.» (sustituto)
5. «En marzo se me van los alumnos.» (estacionalidad)
6. «$20.000 es una clase.» (precio, minoritario)

## El stack (qué recibe y qué resuelve)
| Pieza | Problema | Estado en la app |
|---|---|---|
| Gratis con 2 alumnos, sin vencimiento | 1, 4 | existe (`MAESTRIA_PRUEBA_DIAS`), falta sacar «30 días» del copy |
| Arranque por videollamada de 15 min (te cargo el programa) | 3 | proceso manual de Mauro |
| Revisás y editás cada pregunta antes de mandarla | 2 | existe (`teacher-quiz-review.tsx`, edición inline solo múltiple opción) — **no se comunica** |
| Link de WhatsApp para el alumno, sin cuenta | 1 | existe (invitado) y el mensaje prearmado para WhatsApp también (`lib/compartir-tarea.ts`) — falta mostrarlo en el arranque |
| Pistas que nunca dan la respuesta | 2, 4 | existe (`hint`) |
| Resumen semanal «quién practicó y qué le falta» | 1, 4 | parcial (`leerFichaAlumno`); falta vista/aviso semanal al profe |
| Pausa en marzo sin perder fichas | 5 | falta copy + estado de pausa |
| Garantía 14 días: si nadie practicó, te devuelvo | 1, 6 | falta copy y proceso de reintegro |

## Ecuación de valor (1–10)
| | v1 (pago mensual) | v2 (Pase Mesas) | v3 propuesta (gratis→pago) |
|---|---|---|---|
| Resultado soñado («llegar a clase sabiendo qué reforzar») | 6 | 7 | 7 |
| Probabilidad percibida | 4 | 4 | **7** (lo ve con sus 2 alumnos antes de pagar) |
| Demora | 6 | 6 | 7 |
| Esfuerzo | 5 | **3** («revisás cada pregunta» se leyó como trabajo) | 6 (videollamada + «nada sale sin tu OK, en 1 clic») |

## Re-prueba (honesta)
- v1 (mensual $20.000 + pase 90 días $50.000): **3 de 40 compran (8 %)**. En las mismas 20 personas: 3 de 20.
- v2 (Pase Mesas $35.000 / fundador $25.000, garantía, pausa): **0 de 20**.
- Por qué empeoró: pago **por adelantado**, ancla «$9.000/mes» que abarató la referencia, y «revisás cada pregunta» sonó a esfuerzo. Casi todos dijeron: **«primero pruebo gratis con 2 alumnos y si practican pago»**.
- Por lo tanto la v3 no es una oferta para comprar en frío: es **una oferta para empezar gratis**, y la venta ocurre adentro de la app cuando el profe ve evidencia.

## Oferta v3 (la que va a la landing /profes y al anuncio)
> **Empezá gratis con 2 alumnos.** Subís el programa (o te lo cargo yo en 15 minutos por videollamada), MaestrIA arma la práctica y **nada le llega al alumno sin tu OK**. Tus alumnos practican desde un link de WhatsApp, sin crear cuenta, con pistas que nunca les dan la respuesta. Cada lunes ves quién practicó y qué tema le falta.
> Cuando quieras sumar al 3.er alumno: **$15.000 por mes por 5 alumnos** (menos que una clase). Primeros 20 profes: código fundador, $10.000 los primeros 3 meses. En marzo pausás sin perder nada.

**Nombre de la oferta:** «Gratis con 2 alumnos». Ocultar Aula, Institución y Autodidacta de la venta principal.
