# Tipos como en Moodle con la IA real · 23/11/2026 (ronda U · U4)

Seis programas de prueba ([scripts/qa/fixtures/areas.ts](../../scripts/qa/fixtures/areas.ts), ninguno real): matematica-i, microeconomia, antropologia, contabilidad, enfermeria, matematica-didactica. Tres cuestionarios de 8 preguntas por programa con "Más tipos" (dos prácticos con cinco tipos y un mixto con los siete de Moodle). Generado con `generateQuiz` de `main` (con U1 y U3), modelo real, contra staging. Gasto de las corridas de este informe: **US$0.3412**; con la prueba inicial, la corrida intermedia y un diagnóstico de la calculada, **US$0,46 en total** (tope de la ronda U: US$5). Los datos crudos están en [docs/calidad/datos](datos) (`tipos-moodle-*.json`); para regenerar el informe: `npx tsx scripts/qa/medir-tipos-moodle.ts --env=staging --analizar=docs/calidad/datos/tipos-moodle-1-antes.json,…`.

Cómo se lee:

- **Devueltas:** las preguntas de ese tipo que devolvió el modelo, antes de filtrar.
- **Descartadas por el validador:** las que sacaron los validadores de forma (F2 a F7) o de calidad (U3). La meta es ≤ 5 %.
- **Otros descartes:** repetidas, del área (A5), de un tipo no pedido. No cuentan para la meta.
- **Finales:** las que quedaron en los cuestionarios.

## Lo que mostró la medición y qué se ajustó

La primera corrida encontró **tres bugs**, no problemas de prompt. Por eso se ajustó más de un caso.

1. **La mezcla de tipos perdía los tipos de Moodle.** Era la causa de fondo del caso G1. `restrictQuestionTypeMix` sólo recorría los cuatro tipos de siempre, así que con "Más tipos" la mezcla que veía el modelo quedaba, por ejemplo, en "100 % verdadero o falso". Con seleccionar, arrastrar, emparejamiento, calculada y verdadero o falso, el modelo devolvió 17 verdadero o falso de 20. Arreglado en [lib/question-mix.ts](../../lib/question-mix.ts): cada tipo pedido entra con el peso mínimo.
2. **La deduplicación comparaba sólo la consigna.** En los huecos (y a veces en el emparejamiento) la consigna es genérica ("Completá el texto con las palabras que faltan."), así que la segunda pregunta de huecos se descartaba como repetida. Por eso *arrastrar al texto* tenía **0 preguntas finales**. Ahora se compara el contenido: el texto, los pares, los pasos (`contenidoParaComparar`).
3. **La calculada llegaba sin `tolerance`** y el validador de F7 la descartaba: 72,7 %. Ahora va con el 1 % por defecto. El prompt pide además tolerancia siempre, al menos un comodín, nada de datos fijos ni LaTeX, y trae un ejemplo completo.

También se ajustaron los prompts de los huecos (3 a 5 huecos, `type` explícito en *seleccionar* y en *arrastrar*, que el modelo confundía).

**Lo que queda por encima del 5 %:**

- **Calculada: 22,2 % (2 de 9).** Son descartes correctos: el modelo escribe los datos fijos ("si a = 2, b = 5…") o usa en la fórmula un comodín que no está en el enunciado. Se hicieron los dos ajustes de prompt que pide el protocolo y no bajó más, pero la muestra es chica (9). El validador las saca y U1 pide otra, así que al docente no le llega ninguna mal armada. Si una no sale, recibe el aviso. *Recomendación:* medirla de nuevo con más casos (es barato) antes de seguir tocando el prompt.
- **Ordenamiento: 6,7 % (1 de 15).** Es un solo caso y el validador acertó: dos pasos de despejar una ecuación que se pueden hacer en cualquier orden.

"No salió" sigue apareciendo en el cuestionario 2: cinco tipos en 8 preguntas, en modo práctico, con una sola tanda extra (U1). Siempre viene con su aviso, y ninguno de los 18 cuestionarios quedó sin explicar lo que faltó.

## Antes y después de los ajustes

La primera corrida (`1-antes.json`) contra el resultado final, con los cuestionarios que se volvieron a medir después de los ajustes. Descartadas por el validador / devueltas.

| Tipo | Antes | Después |
|---|---|---|
| multiple_response | 0/23 (0.0 %) · 18 finales | 0/26 (0.0 %) · 19 finales |
| matching | 1/22 (4.5 %) · 17 finales | 1/24 (4.2 %) · 18 finales |
| ordering | 1/17 (5.9 %) · 13 finales | 1/15 (6.7 %) · 11 finales |
| gapselect | 2/23 (8.7 %) · 10 finales | 0/15 (0.0 %) · 11 finales |
| ddwtos | 0/8 (0.0 %) · 0 finales | 0/9 (0.0 %) · 9 finales |
| missing_word | 0/17 (0.0 %) · 12 finales | 0/15 (0.0 %) · 12 finales |
| calculated | 8/11 (72.7 %) · 2 finales | 2/9 (22.2 %) · 6 finales |

## Descartes por tipo (resultado final)

| Tipo | Devueltas | Descartadas por el validador | Motivos | Otros descartes | Finales |
|---|---|---|---|---|---|
| multiple_response | 26 | 0 (0.0 %) | — | 0 | 19 |
| matching | 24 | 1 (4.2 %) | calidad:emparejamiento-repetido (1) | 0 | 18 |
| ordering | 15 | 1 (6.7 %) | calidad:ordenamiento-intercambiable (1) | 0 | 11 |
| gapselect | 15 | 0 (0.0 %) | — | 0 | 11 |
| ddwtos | 9 | 0 (0.0 %) | — | 0 | 9 |
| missing_word | 15 | 0 (0.0 %) | — | 0 | 12 |
| calculated | 9 | 2 (22.2 %) | forma:calculada con comodines o fórmula que no cierran (2) | 0 | 6 |
| multiple_choice | 97 | 0 (0.0 %) | — | 1 | 24 |
| true_false | 110 | 0 (0.0 %) | — | 10 | 34 |

## Tipos pedidos contra obtenidos (U1)

**18 de 18** cuestionarios tienen todos los tipos pedidos, o un aviso que explica el que falta.

| Programa | Cuestionario | Resultado | Pedidos | Obtenidos | Faltan | Avisos |
|---|---|---|---|---|---|---|
| matematica-i | 1 (practico) | ok | 5 | 5 | — | — |
| matematica-i | 2 (practico) | ok | 5 | 3 | gapselect, matching | gapselect: no-salio, matching: no-salio |
| matematica-i | 3 (mixto) | ok | 7 | 6 | ordering | ordering: no-salio |
| microeconomia | 1 (practico) | ok | 5 | 5 | — | — |
| microeconomia | 2 (practico) | ok | 5 | 3 | ddwtos, matching | ddwtos: no-salio, matching: no-salio |
| microeconomia | 3 (mixto) | ok | 7 | 7 | — | — |
| antropologia | 1 (practico) | ok | 5 | 5 | — | — |
| antropologia | 2 (practico) | ok | 5 | 4 | calculated | calculated: sin-calculos |
| antropologia | 3 (mixto) | ok | 7 | 6 | calculated | calculated: sin-calculos |
| contabilidad | 1 (practico) | ok | 5 | 5 | — | — |
| contabilidad | 2 (practico) | ok | 5 | 4 | ddwtos | ddwtos: no-salio |
| contabilidad | 3 (mixto) | ok | 7 | 7 | — | — |
| enfermeria | 1 (practico) | ok | 5 | 5 | — | — |
| enfermeria | 2 (practico) | ok | 5 | 4 | calculated | calculated: sin-calculos |
| enfermeria | 3 (mixto) | ok | 7 | 6 | calculated | calculated: sin-calculos |
| matematica-didactica | 1 (practico) | ok | 5 | 5 | — | — |
| matematica-didactica | 2 (practico) | ok | 5 | 2 | ddwtos, matching, calculated | ddwtos: no-salio, matching: no-salio, calculated: no-salio |
| matematica-didactica | 3 (mixto) | ok | 7 | 6 | calculated | calculated: no-salio |

## Lo que descartaron los validadores (muestra)

- *matematica-i* · ordering · `calidad:ordenamiento-intercambiable` — Ordená los pasos lógicos para resolver la ecuación lineal $3(x - 2) = 5x + 4$ de manera algebraica.
- *microeconomia* · matching · `calidad:emparejamiento-repetido` — Relacioná el valor de la elasticidad precio de la demanda con su interpretación económica.
- *microeconomia* · calculated · `forma:calculada con comodines o fórmula que no cierran` — Un mercado de trigo en Argentina presenta una función de demanda $Q_d = 500 - 2P$ y una función de oferta $Q_s = 100 + 3P$. Si el gobierno establece un precio máximo de 60 pesos, ¿cuál es la cantidad 
- *matematica-didactica* · calculated · `forma:calculada con comodines o fórmula que no cierran` — Un alumno afirma que $\frac{3}{5}$ es equivalente a $\frac{6}{10}$ porque al realizar la división $3 \div 5$ y $6 \div 10$ obtiene el mismo cociente. ¿Qué procedimiento matemático subyace a esta valid

## Dos ejemplos por tipo

**multiple_response**

- *matematica-i* — Marcá todas las opciones que representan un resultado equivalente a la operación $\frac{3}{8} + \frac{5}{6} \cdot \frac{3}{4}$. [$\frac{15}{12}$, **$\frac{27}{24}$**, **$\frac{3}{8} + \frac{15}{24}$**, **$\frac{9}{8}$**, $\frac{1}{8} + \frac{5}{8}$]
- *microeconomia* — Marcá todas las opciones que describen correctamente las características de un mercado de competencia perfecta. [**No existen barreras significativas a la entrada o salida.**, **Existe información perfecta sobre los precios y productos.**, Las empresas tienen poder de mercado para fijar precios., El producto ofrecido por cada empresa es diferenciado., Cada empresa enfrenta una curva de demanda con pendiente negativa.]

**matching**

- *matematica-i* — Relacioná cada ecuación lineal con su respectiva solución $x$. — $5x - 7 = 3$ → 2 · $2(x + 4) = 10$ → 1 · $3x + 1 = x + 9$ → 4 · $x - 5 = 2x - 10$ → 5
- *microeconomia* — Uní cada concepto relacionado con el monopolio con su definición técnica correspondiente. — Barrera de entrada → Obstáculo que impide nuevos competidores · Ingreso marginal → Variación del ingreso por unidad adicional · Poder de mercado → Capacidad de fijar precios superiores · Monopolio natural → Costos medios decrecientes a gran escala

**ordering**

- *matematica-i* — Ordená los pasos necesarios para resolver la ecuación cuadrática $x^2 - 4x - 5 = 0$ mediante factorización. — 1. Identificar dos números que sumen -4 y multipliquen -5 · 2. Escribir la ecuación como $(x - 5)(x + 1) = 0$ · 3. Igualar cada factor a cero: $x - 5 = 0$ y $x + 1 = 0$ · 4. Determinar el conjunto solución: $\{5, -1\}$
- *microeconomia* — Ordená los siguientes pasos que sigue una empresa en competencia perfecta para determinar su nivel de producción óptimo a corto plazo. — 1. Observar el precio vigente en el mercado · 2. Igualar el precio al costo marginal · 3. Determinar la cantidad donde el costo marginal es creciente · 4. Comparar el precio con el costo variable medio

**gapselect**

- *matematica-i* — Completá el texto con las palabras que faltan sobre el comportamiento de la función lineal $f(x) = mx + b$. — En la función lineal $f(x) = mx + b$, si la pendiente es mayor a cero, la función es [[1]]. Si la pendiente es menor a cero, la función es [[2]]. Si la pendiente es igual a cero, la función es [[3]]. [creciente, decreciente, constante, parabólica, nula]
- *microeconomia* — Completá el texto sobre el equilibrio de mercado. — Cuando el precio de mercado se sitúa por encima del nivel de equilibrio, la cantidad ofrecida supera a la demandada, generando un [[1]]. Por el contrario, si el precio se encuentra por debajo del equilibrio, la cantidad demandada es mayor a la ofrecida, provocando una [[2]] que presiona el precio al [[3]]. [excedente, escasez, alza, baja, equilibrio]

**ddwtos**

- *matematica-i* — Completá el texto sobre las propiedades de la ecuación cuadrática $ax^2 + bx + c = 0$. — En una ecuación cuadrática, si el discriminante es [[1]], la parábola corta al eje de abscisas en dos puntos. Si el discriminante es [[2]], la parábola es tangente al eje de abscisas. Finalmente, si el discriminante es [[3]], la parábola no posee intersección con el eje de abscisas. [positivo, cero, negativo, infinito, uno]
- *microeconomia* — Completá el texto con las palabras que faltan. — En un mercado de [[1]], la empresa es la única oferente del bien. Debido a la existencia de [[2]] a la entrada, la firma puede fijar un precio que resulta [[3]] al costo marginal, generando una pérdida de eficiencia social en comparación con la competencia perfecta. [monopolio, barreras, superior, perfecto, incentivos, menor]

**missing_word**

- *matematica-i* — En la función lineal $f(x) = -3x + 7$, el valor $-3$ representa la [[1]] de la recta. [raíz, ordenada, abscisa, **pendiente**]
- *microeconomia* — Si ante una variación porcentual en el precio, la cantidad demandada varía en una proporción mayor, se dice que la demanda es [[1]]. [unitaria, inelástica, perfecta, **elástica**]

**calculated**

- *matematica-i* — Una empresa determina que sus costos mensuales siguen la función lineal $f(x) = {m}x + {b}$, donde $x$ representa las unidades producidas. Si la pendiente es {m} y la ordenada al origen es {b}, ¿cuál es el costo total para {u} unidades? — fórmula `{m} * {u} + {b}` (con {"m":32,"b":252,"u":19}: 860)
- *microeconomia* — Una empresa que opera como monopolio enfrenta una función de demanda dada por P = 100 - Q. Si la empresa decide producir {q} unidades, ¿cuál es el ingreso marginal correspondiente? — fórmula `100 - 2 * {q}` (con {"q":27}: 46)
