# Re-medición después de anclar los temas · 22/11/2026 (O14)

Sólo los casos donde "fuera de tema" pasaba el 5 % (Primario, Secundario y Superior · Matemática), con `anclarTema` en la generación.

Staging, IA real (`gemini-3.1-flash-lite`), con el mismo núcleo de la app (`generateQuiz` y su filtro). 14 cuestionarios de 8 preguntas pedidas, con los cuatro tipos permitidos; teórico y práctico. Gasto estimado: US$0.0379 (38514 tokens de entrada, 18876 de salida).

Qué mide cada columna (sobre lo que devuelve la generación, después de su filtro): **Tipo** = `problemaDeTipo` (M2); **Dos resultados** = `pideMasDeUnValor` (K3); **Factorización** = numérica que pide factorizar sin `forma: factorizacion` (L3); **Repetidas** = misma consigna o misma cuenta dentro del cuestionario; **Fuera de tema** = el tema de la pregunta no se ubica entre los pedidos; **GIFT** = cuestionarios cuya exportación a Moodle tiene errores de `validarGift` (M5, incluye llaves de conjunto).

## Por nivel y materia

| Nivel | Preguntas | Tipo (M2) | Dos resultados (K3) | Factorización (L3) | Repetidas | Fuera de tema | GIFT con errores (M5) |
|---|---|---|---|---|---|---|---|
| Primario | 32 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 de 4 |
| Secundario | 32 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 de 4 |
| Superior · Matemática | 48 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 de 6 |

## Por tipo de pregunta

| Tipo | Preguntas | Tipo (M2) | Dos resultados (K3) | Factorización (L3) | Repetidas | Fuera de tema | GIFT con errores (M5) |
|---|---|---|---|---|---|---|---|
| true_false | 41 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | — |
| short_answer | 28 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | — |
| multiple_choice | 32 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | — |
| numeric | 11 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | — |

## Total

|  | Preguntas | Tipo (M2) | Dos resultados (K3) | Factorización (L3) | Repetidas | Fuera de tema | GIFT con errores (M5) |
|---|---|---|---|---|---|---|---|
| Total | 112 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 de 14 |


## Ejemplos de lo marcado

Nada marcado.
