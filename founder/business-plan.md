# MaestrIA · Business plan

**Verdict: Not yet**

- ✓ Each bloque-mes (5 alumnos, 1 mes) earns $12640.00 before fixed costs (84% contribution).
- ✓ Year 1 operating profit: $790,699.
- ✓ Break-even is 1 bloque-mes (5 alumnos, 1 mes)s a day against a capacity of 3.
- ✗ 3 of 40 simulated buyers buy (8%, the bar is 25%).

| key number | |
| --- | ---: |
| Price | $15000.00 a bloque-mes (5 alumnos, 1 mes) |
| Profit margin at plan | 63% per bloque-mes (5 alumnos, 1 mes) |
| Break-even | 1 bloque-mes (5 alumnos, 1 mes)s a day |
| Year 1 operating profit | $790,699 |
| Startup spend | $28,000 |
| Cash needed before it pays for itself | $98,267 |
| Startup money earned back | month 3 |
| Buyer panel | 3 buy · 37 pass |

## The idea

- What it is: a web app in Spanish where a private tutor uploads the official syllabus of a subject (a PDF), and the app builds topic-by-topic practice quizzes; the student practises from a WhatsApp link without creating an account, gets a hint (never the answer) when stuck and an explanation of what they confused when wrong, and the tutor sees a per-student sheet of which topics to reinforce in the next class.
- Who it is for: independent private tutors (profes particulares) of maths (and other subjects) for secondary school, tertiary/teacher-training institutes and university entrance in Argentina, who have 3 to 20 students and charge ARS 15,000–20,000 per class; peak season is the make-up exams ("mesas") in December and February and the entrance courses. Secondary targets: tutoring centres / academies (4–8 tutors), school teachers with courses of ~35 (the "Aula" mode), and adult self-learners (hypothesis).
- What it sells, at what price (ARS, Nov 2026; USD 1 ≈ ARS 1,950 card rate): Free forever with 2 private students + 1 course of 35, 10 quizzes per 30 days. Particular: ARS 20,000 per month per block of 5 students (up to 20 students; cap tier up to 150), or a 90-day pass at ARS 50,000. Aula: ARS 15,000 per month per course, ARS 10,000 each extra course. Institution: custom, ARS 99,000 cap as reference. "Fundadora" early tutor: 1 block at ARS 10,000. Self-learner pass (hypothesis): ARS 6,000 per subject. Payment via Mercado Pago links (monthly or pass), manual activation until 5 paying.
- Where and how: online, all of Argentina (starting from Salta, where the founder has the full provincial curriculum loaded; elsewhere tutors upload their own syllabus). Acquisition: Meta ads to teachers (prepared, ARS 2,000/day, not launched), organic Instagram @maestria.edu.app, the founder's own network of tutors, and the founder's own private classes as a showcase (his students use it).
- Budget and constraints: solo founder (maths teacher at tertiary level + AI engineer), about 2 hours per day for sales and support. Fixed costs: Vercel ~USD 20/month (shared with other projects), Neon Postgres free tier. AI cost measured in production (Gemini 3.1 flash-lite): ≈ USD 0.0049 per generated quiz, 0.0008 per feedback, 0.0004 per grading, 0.0002 per hint, 0.002–0.003 per syllabus upload. Goal: about 20 paying tutors by February 2027; personal income goal ≈ ARS 500,000/month from January across all activities. Login is Google-only today. Exports to Moodle.

## Summary

**Veredicto: Todavía no.** El negocio cierra en los números (84 % de contribución por bloque, IA casi gratis) pero **la venta en frío no está probada**: el panel simulado compra 8 % (3 de 40) con la oferta mensual y 0 de 20 con el pase de un pago. El motivo no es el precio, es **confianza y hábito**: el profe quiere ver practicar a sus 2 alumnos gratis antes de pagar.

**Qué cambia:** de «comprá el plan» a **«Empezá gratis con 2 alumnos»**, con la venta adentro de la app cuando el profe ve evidencia (resumen semanal, muro del 3.er alumno). Precio recomendado: **$15.000/mes por bloque de 5** (hoy $20.000, fuera de la curva v2).

**Lo único de esta semana:** que la tanda AB deje en staging la landing /profes v3, el resumen semanal y el muro con evidencia; y conseguir 10 colegas que activen gratis con 2 alumnos.

**Pauta de MaestrIA:** pausada en $0 hasta cumplir el criterio de verificación (≥ 15 profes activados y ≥ 5 pagando, 3 fuera de la red de Mauro, al 31/1). Solo corre la campaña de clases particulares.

**Advertencia de método:** los compradores son personas simuladas por IA, no profes reales. Sirven para encontrar objeciones, no para predecir ventas. La prueba real es el 31/1.

## What the board said

**Voto: 3 «financiar si» · 0 pasar · promedio 5/10.** Producto 6, Ofertas 5, Monopolio 4.

Los tres financian con condiciones. Ninguno financia tal como está.

### Riesgos que repiten dos o más evaluadores (van primero)
1. **No hay prueba de que paguen ni de que funcione.** Hay 0 clientes pagos, 7 usuarios activos y ningún caso medido. Lo marcan los tres.
2. **La distribución no está probada.** El costo por profe conseguido y la retención después de la temporada son desconocidos (Ofertas y Monopolio).
3. **Estacionalidad:** la demanda tiene picos en diciembre y febrero/marzo, y nadie sabe qué retiene al profe en abril (Ofertas y Monopolio).
4. **Falta de foco:** Particular, Aula, Institución, Moodle y autodidacta, todo junto, con 2 horas por día (Producto y Ofertas).

### Riesgos que marca un solo evaluador
- **Monopolio:** no hay una ventaja 10 veces mejor. «ChatGPT con el PDF» se acerca bastante y un competidor podría copiar en seis meses.
- **Producto:** los primeros 5 minutos de un profe nuevo no están probados, en especial la extracción del programa con PDFs desprolijos. Además, la activación manual después del pago es una costura rota.
- **Ofertas:** se vende una herramienta, no un resultado. No hay garantía, ni urgencia real, ni nombre de oferta, y la escalera de precios confunde.

### Desacuerdos
- **Ofertas** cree que el ancla «un bloque cuesta lo mismo que una clase» es buena y que hasta podría duplicarse en el segmento de ingreso universitario.
- **Monopolio** ve un techo bajo de ingresos por profe (≈ USD 10 por mes) y duda de la durabilidad.
- **Producto** pone el problema en la experiencia; los otros dos, en la demanda.

### Condiciones (checklist para el resto del pack)
- [ ] Pagos reales de profes antes de invertir en anuncios, no solo uso. *(launch)*
- [ ] Algunos profes pagando por fuera de la red personal antes de febrero. *(launch / marketing)*
- [ ] Un caso medido con alumnos propios en las mesas de diciembre: si practicaron y si la ficha cambió la clase. *(launch / offer)*
- [ ] Una sola oferta de entrada con nombre, resultado prometido, garantía y cupo real. Ocultar Aula, Institución y autodidacta hasta que haya demanda. *(offer / pricing)*
- [ ] Congelar Aula y Moodle en la venta y elegir un nicho primero. *(marca / producto)*
- [ ] Observar a 5 profes ajenos usando la app sin ayuda y medir cuántos llegan a mandar un quiz. *(launch)*
- [ ] Medir la extracción de programas con al menos 10 PDFs reales distintos. *(ops / tanda)*
- [ ] Automatizar la activación después del pago, o prometer un plazo y cumplirlo. *(ops / tanda)*
- [ ] Medir la retención en febrero y marzo antes de escalar Meta. *(cfo / launch)*
- [ ] Investigar los precios de los sustitutos. *(competitors)*
- [ ] Definir qué dato acumulado hace caro irse: el historial por alumno o el banco de preguntas validadas. *(offer / producto)*

### La versión más fuerte que ve el directorio
No es «una plataforma de IA para docentes». Es un **servicio de temporada para el profe particular de matemática**: en noviembre sube el programa de la mesa, sus alumnos practican desde WhatsApp entre clase y clase, y antes de cada clase recibe la lista de temas flojos de cada alumno. Así la clase paga rinde más y el alumno llega a la mesa mejor preparado.

Se vende como un **pase de temporada con nombre y fecha**, por ejemplo «Pase Mesas de febrero», con una garantía simple y un caso real del propio fundador. Aula, Moodle e instituciones quedan para después.

Esto difiere de lo planteado: hoy se ofrece una escalera de cinco planes y tres modos de uso.

## The competition

Fuentes públicas, revisadas el 26/11/2026. Los precios en dólares son los publicados; en Argentina se pagan al dólar tarjeta (≈ $1.950). La investigación de reseñas es **liviana**: solo hay datos para Gauth y Wayground.

### Tabla (de más directo a menos)
| Competidor | Tipo | Precio comparable | Qué resuelve | Fuente |
|---|---|---|---|---|
| **ChatGPT Go / Plus** | Indirecto | Go USD 6/mes (≈ $11.700), Plus USD 20/mes (≈ $39.000), gratis limitado | El profe pega el temario y pide ejercicios. No hay ficha por alumno ni link para el alumno con pistas controladas. | [MDZ](https://www.mdzol.com/tecnologia/llego-chatgpt-go-la-argentina-el-plan-barato-ia-cuesta-6-dolares-n1407017) |
| **Khanmigo para docentes** | Indirecto | Gratis (piloto, en español en LatAm) | Planificaciones, rúbricas y actividades para el docente. **El tutor para alumnos solo funciona en EE.UU.** | [Khan Academy](https://blog.khanacademy.org/?p=16634) |
| **Wayground (ex Quizizz)** | Indirecto | Gratis; Standard USD 59 y Premier USD 99 por usuario por mes | Cuestionarios y juegos con informes, pensados para escuelas | [Capterra](https://www.capterra.com/p/207437/Quizizz/pricing/) |
| **Teachy** | Indirecto | Gratis 100 créditos por día; Premium varía por país | Más de 60 herramientas de IA para docentes; currículo brasileño | [Pillitteri](https://pasqualepillitteri.it/es/news/28556/teachy-ai-docentes-guia) |
| **Gauth** | Sustituto (del lado del alumno) | Plus USD 11,99/mes | Resuelve la tarea por foto, paso a paso | [Stork](https://www.stork.ai/es/gauth) |
| **Photomath Plus** | Sustituto (del lado del alumno) | ≈ USD 9,99/mes | Resuelve ejercicios por foto | [Subger](https://subger.com/es/service/photomath-plus) |
| **Google Forms, Classroom, Moodle** | Sustituto | Gratis | Cuestionarios armados a mano | — |
| **PDF propio + WhatsApp** | Sustituto (el más común) | Gratis, a costa del tiempo del profe | Guías y corrección en clase | — |
| **Una clase particular extra** | Sustituto | Licenciado: $25.000–60.000 por hora en CABA; −25 % en el interior (abril 2026) | Más horas de clase | [CuántoMeCuesta](https://cuantomecuesta.com/ar/clases-particulares/) |

### Rango de precios para el comprador (el profe)
- **Lo más barato:** gratis (Forms, Khanmigo, PDF y WhatsApp, ChatGPT gratis).
- **Lo intermedio:** ChatGPT Go, ≈ $11.700 por mes.
- **Lo más caro:** ChatGPT Plus ≈ $39.000 por mes, Wayground Standard ≈ $115.000 por mes.
- **MaestrIA:** $20.000 por mes por 5 alumnos, o $50.000 por 90 días (≈ $16.700 por mes). Queda arriba de lo gratis y de Go, y abajo de Plus.
- **El ancla que importa:** el bloque cuesta **menos que una hora de clase de un licenciado** en cualquier región del país.

### Mapa de posicionamiento (en texto)
Eje X: genérico ↔ atado al programa del profe y a la mesa. Eje Y: sirve al profe ↔ sirve al alumno.

- **Genérico y para el profe:** ChatGPT, Khanmigo docente, Teachy.
- **Genérico y para el alumno:** Gauth y Photomath, que **dan la respuesta**.
- **Atado al programa y para el profe:** Wayground y Forms, pero armados a mano, sin IA que entienda el programa y sin diagnóstico por tema.
- **Atado al programa, para el alumno, con el diagnóstico de vuelta al profe:** **nadie lo cubre bien. Es el lugar de MaestrIA.**

### De qué se quejan (temas, todavía livianos)
1. **«Te da la respuesta, no aprendés» y las respuestas incorrectas en los solucionadores.** Gauth tiene 2,3 en Trustpilot sobre 86 reseñas, con quejas de anuncios para ver la respuesta y de respuestas erróneas antes de un examen ([Stork](https://www.stork.ai/es/gauth)). *Tema con evidencia: varias reseñas.*
2. **El precio en dólares que paga el docente de su bolsillo, y funciones que pasan a ser pagas.** Wayground: «the premium version can be expensive, especially for educators paying out of pocket» ([Capterra](https://www.capterra.com/p/207437/Quizizz/pricing/)). *Tema liviano: menos de 3 citas leídas.*
3. **Currículo que no coincide.** Teachy alinea con Brasil y no con LatAm ([Pillitteri](https://pasqualepillitteri.it/es/news/28556/teachy-ai-docentes-guia)). *Tema liviano.*

### El hueco
Nadie junta estas cuatro cosas:
1. el programa real del profe (o el diseño curricular provincial);
2. la práctica del alumno sin cuenta, desde WhatsApp;
3. **pistas que no regalan la respuesta**, al revés que Gauth y Photomath;
4. **el diagnóstico por tema que vuelve al profe** antes de la próxima clase paga.

Todo eso cuesta menos que una hora de clase y se paga en pesos con Mercado Pago, frente a herramientas que cobran en dólares.

### La amenaza
- **ChatGPT, o cualquier profe con un prompt,** puede acercarse en minutos a «generar ejercicios del programa». No puede, sin desarrollo, darle a cada alumno un link con pistas controladas ni devolver la ficha por tema. **La defensa es la ficha y el historial por alumno, no la generación de preguntas.**
- **Khanmigo** podría abrir el tutor para alumnos en LatAm: es gratis y tiene marca. Es la amenaza más seria a mediano plazo.
- **Wayground** podría agregar «subí tu programa». Hoy apunta a escuelas y cobra en dólares.

## The buyer panel

**3 buy · 37 pass** (8% buy) out of 40 simulated buyers. Seed 2611, so the same cards can be dealt again.

These are simulated buyers, not customers. Use this to find objections and weak spots, then confirm the big ones with real people before you spend.

### By segment

| group | buyers | buy rate |
| --- | ---: | ---: |
| Docente de escuela con cargos que suma particulares en temporada de mesas | 14 | 14% |
| Estudiante avanzado o profe recién recibido que da particulares para vivir | 14 | 7% |
| Dueño o coordinador de un centro de apoyo escolar con 4 a 8 profes | 4 | 0%  (thin) |
| Profe particular consolidado de ingreso universitario o terciario, con agenda llena | 8 | 0% |

### By buying behaviour

| group | buyers | buy rate |
| --- | ---: | ---: |
| Busca ahorrar tiempo en temporada | 6 | 33%  (thin) |
| Early adopter tecnológico | 3 | 33%  (thin) |
| Ya usa ChatGPT gratis | 8 | 0% |
| Lo resuelve con PDF y WhatsApp | 10 | 0% |
| Desconfía de la IA en matemática | 5 | 0%  (thin) |
| Cuida cada peso | 5 | 0%  (thin) |
| Compra por recomendación de colegas | 3 | 0%  (thin) |

### By income

| group | buyers | buy rate |
| --- | ---: | ---: |
| $8,660,000 to $15,636,000 | 13 | 15% |
| under $8,660,000 | 13 | 8% |
| $15,636,000 and up | 14 | 0% |

### Why they pass

| reason | buyers | in their words |
| --- | ---: | --- |
| habit | 14 | "Ya le pido ejercicios nuevos a ChatGPT o Gemini gratis cuando los necesito, y eso me resuelve. No veo qué me agrega pagar por una app que arma prácticas a partir de mi programa, sobre todo si mis alumnos igual no las van a usar." (P002) · "Ya saco ejercicios gratis con ChatGPT o Gemini y los ajusto a mano para cada alumno, así que la herramienta tiene que hacer algo que yo no puedo hacer en diez minutos. La ficha por alumno sí me interesa, pero no veo que el resto justifique pagar todos los meses." (P003) |
| trust | 12 | "Enseño matemática hace años y mis materiales están revisados uno por uno; no me alcanza con que la IA diga que corrige bien, ya vi errores en ejercicios. Con 2 alumnos gratis lo pruebo, pero no pago hasta ver que respeta mi forma de explicar." (P007) · "No confío en que una IA me explique matemática sin equivocarse; ya vi errores en ejercicios generados por IA y prefiero mis propios materiales, que reviso yo. Además en marzo se me van los alumnos y no lo voy a usar." (P009) |
| timing | 5 | "Estoy en plena temporada de mesas y cada semana tengo alumnos escribiendo a la noche antes del examen. No tengo ganas de aprender otra plataforma ahora ni de cargar programas en PDF; si la pruebo, sería con los 2 alumnos gratis y recién después de que pase la época de exámenes." (P004) · "Estoy en plena temporada de mesas y exámenes, con alumnos pidiendo ejercicios todo el día. Ya le pido ejercicios a ChatGPT o Gemini gratis y me sirven; pagar por otra app me obliga a subir PDFs, configurar cosas y aprender algo nuevo justo cuando menos tiempo tengo." (P006) |
| need | 4 | "Ya le pido ejercicios a ChatGPT o Gemini gratis cuando necesito material, y me sirven. No veo qué me daría esta app que no pueda armar yo en diez minutos, y pagar 20.000 por mes por algo que me reemplaza trabajo que hoy hago gratis no tiene sentido para mí." (P020) · "Yo les armo las prácticas a mis alumnos a mano y me sale gratis con ChatGPT y un PDF del programa; no veo qué me agrega pagar 20 mil por mes para algo que ya hago. Y además el alumno tiene que estar mandando links por WhatsApp a una app que no conozco." (P026) |
| price | 2 | "20.000 por mes es lo que me entra por una sola clase, y no veo con claridad si la ficha por alumno me devuelve esa plata en alumnos que pagan. Lo del link de WhatsApp sin cuenta me gusta, pero eso no paga la suscripción." (P025) · "Por $20.000 al mes por cada 5 alumnos me sale casi una clase por mes, y no tengo claro que mis alumnos lo vayan a usar. Ya tengo Khan Academy y ejercicios gratis, así que primero probaría el plan gratis con 2 alumnos antes de pagar." (P030) |

### Why they buy

| reason | buyers | in their words |
| --- | ---: | --- |
| convenience | 2 | "En diciembre y febrero no me alcanzan las horas para preparar a cada alumno, y si una app me marca qué le falta a cada uno antes de la mesa, me ahorra varias tardes. Lo pagaría sólo en temporada, cuando de verdad tengo el doble de alumnos." (P001) · "En diciembre y febrero no doy abasto: si mis alumnos pueden practicar solos desde un link de WhatsApp la noche antes del examen y yo veo qué les falta, me ahorra horas de mensajes. Veinte mil pesos por cinco alumnos me parece poco para eso." (P015) |
| need | 1 | "Tengo unos 8 alumnos y antes de cada mesa me cuesta saber qué tema le falta a cada uno. Si la ficha me lo dice sin que yo arme nada, la pago, porque el tiempo que me ahorra vale más que 20.000 por mes." (P014) |

### What would flip a no

- Ver con alumnos reales que la practican sola antes de la mesa y que la ficha me muestra algo que no sabía de ellos.
- Probarla con dos o tres de mis alumnos actuales, con sus propios PDF de programa, y que la ficha me muestre algo que yo no había detectado y que después se confirme en la clase.
- Que con los 2 alumnos gratis vea que hacen los ejercicios solos, que la ficha me dice algo que no sabía de ellos, y que me deje un par de clases más libres en la semana.
- Que mis profes lo usen desde el WhatsApp que ya tienen, sin que yo tenga que cargar nada ni aprender algo nuevo, y que me muestre qué temas le faltan a cada alumno antes de la mesa de examen.
- Que probara con mis dos alumnos gratis durante una o dos semanas y viera que practican solos desde el link de WhatsApp y que la ficha me dice qué temas les faltan sin que yo tenga que hacer nada extra.
- Poder revisar y editar cada cuestionario antes de que llegue al alumno, y comprobar con mis propios ejercicios que las respuestas y las pistas están bien.
- Que la ficha por alumno me muestre con precisión qué temas le faltan y me ahorre tiempo de corrección real, probado con mis propios alumnos durante un mes sin pagar.
- Que me muestren cuestionarios de mi propio programa revisados por un profesor de matemática, sin errores, y que pueda probarlo gratis durante toda la temporada de mesas.
- Ver que alumnos reales de otro profe practican de verdad con la app y que eso se traduce en mejores notas en la mesa, o poder probarla con mis propios alumnos sin pagar durante un par de meses.
- Que con un par de alumnos reales de prueba, gratis, vea que lo usan sola de forma regular durante dos o tres semanas y que la ficha me ahorra tiempo de preparación en clase.
- Ver con mis propios alumnos que la ficha marca temas flojos que yo no había detectado y que después la práctica mejora sus notas en la mesa.
- Poder revisar y corregir cada cuestionario antes de que lo reciba el alumno, o cargar mis propios ejercicios.

Buyers say they would buy **1.0 times** in the first month on average.

40 buyers gave all four price answers. Run founder-pricing's van_westendorp.py on the answers folder.

## Pricing

### Recomendación
**Gratis con 2 alumnos para siempre → $15.000 por mes por bloque de 5 alumnos.** Opcional: el **pase de 90 días** que ya existe, a **$35.000** (≈ $11.700/mes) para el que prefiere pagar una vez, mostrado *después* de que el profe vio practicar a sus alumnos, nunca como primera oferta.

### Por qué ese número
| Evidencia | v1 (40 personas) | v2 (20 personas) |
|---|---|---|
| Rango aceptable (Van Westendorp) | $5.045 – $25.048 | $3.030 – $17.965 |
| Precio indiferente (IPP) | $11.969 | $8.032 |
| «Caro» (mediana) | — | $12.000 |
| «Demasiado caro» (mediana) | — | $20.000 |

- $15.000 queda **dentro de los dos rangos**. $20.000 (el precio actual de `planes.ts`) queda **fuera** del rango v2 y en el borde del «demasiado caro».
- Ancla que funciona: **menos que una clase de un licenciado** ($25.000–60.000/h CABA, −25 % interior). Ancla que no funciona: «unos $9.000 por mes» del pase v2 — bajó la referencia y la gente respondió precios más bajos.
- El precio **no** fue el motivo principal de rechazo (2 de 37 en v1, 1 de 20 en v2). Los motivos fueron **confianza** y **hábito**. Bajar el precio no destraba la venta; destraba la prueba gratis bien acompañada.

### Qué NO cambiar todavía
- No bajar a $12.000: el margen cae a 54 % y año 1 a ≈ $377.000.
- No subir a $20.000 hasta tener 10 profes pagos y medir cuántos se quedan.

### Implementación (sin tocar prod: Mauro decide y carga las env vars)
- `MAESTRIA_PRECIO_MENSUAL_BLOQUE=15000` (bloque de 5, `ALUMNOS_POR_BLOQUE` no cambia), `MAESTRIA_PRUEBA_DIAS=0` (gratis 2 alumnos sin vencimiento, tanda AA1).
- Pase: `MAESTRIA_PRECIO_PASE_BLOQUE=35000` por los 90 días que ya existen (`DIAS_PASE`), como segunda opción.
- Precio fundador: un código en `/admin/codigos` (propuesta `FUNDADOR`: 33 % ≈ $10.000/mes, 3 meses, 20 usos), en vez de un pase barato: conserva el ancla mensual.

## The offer

### Problemas del profe (en sus palabras, del panel)
1. «No sé si mis alumnos van a practicar en casa.» (hábito)
2. «¿La IA corrige bien matemática y respeta cómo explico yo?» (confianza)
3. «En diciembre no tengo tiempo de aprender otra plataforma.» (tiempo)
4. «Esto lo hago gratis con ChatGPT y un PDF.» (sustituto)
5. «En marzo se me van los alumnos.» (estacionalidad)
6. «$20.000 es una clase.» (precio, minoritario)

### El stack (qué recibe y qué resuelve)
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

### Ecuación de valor (1–10)
| | v1 (pago mensual) | v2 (Pase Mesas) | v3 propuesta (gratis→pago) |
|---|---|---|---|
| Resultado soñado («llegar a clase sabiendo qué reforzar») | 6 | 7 | 7 |
| Probabilidad percibida | 4 | 4 | **7** (lo ve con sus 2 alumnos antes de pagar) |
| Demora | 6 | 6 | 7 |
| Esfuerzo | 5 | **3** («revisás cada pregunta» se leyó como trabajo) | 6 (videollamada + «nada sale sin tu OK, en 1 clic») |

### Re-prueba (honesta)
- v1 (mensual $20.000 + pase 90 días $50.000): **3 de 40 compran (8 %)**. En las mismas 20 personas: 3 de 20.
- v2 (Pase Mesas $35.000 / fundador $25.000, garantía, pausa): **0 de 20**.
- Por qué empeoró: pago **por adelantado**, ancla «$9.000/mes» que abarató la referencia, y «revisás cada pregunta» sonó a esfuerzo. Casi todos dijeron: **«primero pruebo gratis con 2 alumnos y si practican pago»**.
- Por lo tanto la v3 no es una oferta para comprar en frío: es **una oferta para empezar gratis**, y la venta ocurre adentro de la app cuando el profe ve evidencia.

### Oferta v3 (la que va a la landing /profes y al anuncio)
> **Empezá gratis con 2 alumnos.** Subís el programa (o te lo cargo yo en 15 minutos por videollamada), MaestrIA arma la práctica y **nada le llega al alumno sin tu OK**. Tus alumnos practican desde un link de WhatsApp, sin crear cuenta, con pistas que nunca les dan la respuesta. Cada lunes ves quién practicó y qué tema le falta.
> Cuando quieras sumar al 3.er alumno: **$15.000 por mes por 5 alumnos** (menos que una clase). Primeros 20 profes: código fundador, $10.000 los primeros 3 meses. En marzo pausás sin perder nada.

**Nombre de la oferta:** «Gratis con 2 alumnos». Ocultar Aula, Institución y Autodidacta de la venta principal.

## The numbers

> **Nota del CFO (27/11).** El bloque deja **$12.640 de cada $15.000 (84 %)**: la IA cuesta poco (≈ $470 por bloque-mes, medido en `ai_usage_log`), así que el negocio no se cae por costos variables. El que pesa es el **anuncio**: $60.000 de $79.500 de fijos. Con anuncios prendidos hacen falta **~6-7 bloques pagos por mes** (≈ 5-6 profes) solo para no perder; sin anuncios (solo Vercel) alcanza con **2 bloques**. La meta de ~20 profes (≈ 25 bloques) deja ~$790.000 en el año 1, pero ese número depende de una rampa **supuesta**, no medida: el panel simulado compra 8 %, por debajo del 25 % que pide el chequeo. **Conclusión: no gastar en anuncios de MaestrIA hasta tener 5 profes pagando de forma orgánica**; ahí el fijo de anuncios ya está cubierto antes de prenderlo. Precio: $15.000 queda adentro de las dos curvas; $20.000 mejora el margen (72 %) pero cae fuera de la curva v2 ("caro" desde $12.000 de mediana).

## Unit economics: MaestrIA · plan Particular (bloque de 5 alumnos, mensual)

Every number below comes from the input file. Nothing is looked up or guessed.

### One bloque-mes (5 alumnos, 1 mes)

| line | per bloque-mes (5 alumnos, 1 mes) |
| --- | ---: |
| Price | $15,000.00 |
| IA Gemini por bloque-mes (estimado con costos medidos: 10 cuestionarios + 200 correcciones + 100 devoluciones + 100 pistas ≈ USD 0,24 × 1.950) | -$470.00 |
| Comisión Mercado Pago con IVA (estimado 7,6 %) | -$1,140.00 |
| Reserva garantía 14 días (estimado: 5 % de reintegros) | -$750.00 |
| **Contribution** (what each bloque-mes (5 alumnos, 1 mes) leaves to pay the fixed costs) | **$12,640.00** (84%) |

### The margin that matters

Fixed costs: $79,500 a month (Vercel (USD 20, 50 % atribuido a MaestrIA) $19,500, Anuncios Meta MaestrIA ($2.000/día) $60,000, Neon Postgres (plan gratis) $0).

- **Break-even: 1 bloque-mes (5 alumnos, 1 mes)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (1 a day): **63%** of every sale, after every cost.
- Capacity: 3 a day.

### Year 1, month by month

| month | bloque-mes (5 alumnos, 1 mes)s a day | revenue | profit | cumulative (after $28,000 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $30,150 | -$54,094 | -$82,094 |
| 2 | 0 | $75,150 | -$16,174 | -$98,267 |
| 3 | 0 | $225,000 | $110,100 | $11,833 |
| 4 | 1 | $300,150 | $173,426 | $185,259 |
| 5 | 0 | $120,150 | $21,746 | $207,006 |
| 6 | 0 | $149,850 | $46,774 | $253,779 |
| 7 | 0 | $149,850 | $46,774 | $300,553 |
| 8 | 0 | $180,000 | $72,180 | $372,733 |
| 9 | 0 | $180,000 | $72,180 | $444,913 |
| 10 | 0 | $180,000 | $72,180 | $517,093 |
| 11 | 0 | $210,150 | $97,586 | $614,679 |
| 12 | 1 | $270,000 | $148,020 | $762,699 |

- **Year 1 operating profit: $790,699** on $2,070,450 of revenue.
- After the $28,000 startup spend: $762,699.
- Startup money earned back: month 3.
- Cash you need before it pays for itself: **$98,267**.

### What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 63% | 1 | $790,699 |
| Price -10% | 59% | 1 | $583,654 |
| Volume -20% | 58% | 1 | $441,759 |
| Unit costs +15% | 61% | 1 | $741,837 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.

## Marketing

### A quién primero
1. **Docente de escuela con cargos que suma particulares en mesas** (el segmento que más compró en v1: 14 %).
2. **Profe recién recibido que vive de particulares** (7 %), sensible al precio: entra por el gratis.
Dejar para después: centros de apoyo (0 de 4) y profes de ingreso consolidados (0 de 8): no compran sin pruebas de colegas.

### Canales, en orden (con 2 h/día)
| # | Canal | Costo | Qué medir | Por qué |
|---|---|---|---|---|
| 1 | **Red propia de Mauro**: colegas del terciario, ex-alumnos del profesorado, grupos de WhatsApp de docentes de Salta | $0 | profes que activan 2 alumnos | «compra por recomendación» y «desconfía de la IA» se destraban con alguien conocido |
| 2 | **Reels orgánicos** en @maestria.edu.app y @profemaurol: «armé la práctica de la mesa en 3 minutos» (pantalla real con datos ficticios) | $0 | visitas a /profes, altas | demuestra el «esfuerzo bajo» que la v2 no transmitió |
| 3 | **Profesorados y grupos de Facebook** de docentes de matemática (Salta → NOA → resto) | $0 | altas con `origen` | alcance nacional sin pauta |
| 4 | **Meta ads** a /profes, AR 25–60 (campaña 52502237071285, pausada) | $2.000/día | costo por profe activado (no por clic) | **solo después** de 5 profes pagos orgánicos |

### Mensaje
- Titular: **«Empezá gratis con 2 alumnos. Nada le llega sin tu OK.»**
- Prueba: captura de la revisión de preguntas + resumen de «quién practicó».
- Ancla: «Menos que una clase por mes, para 5 alumnos.»
- Evitar: «IA que corrige todo», «ahorrá horas revisando» (suena a trabajo extra), «$9.000/mes».

### Calendario estacional
- **Ahora–20/12:** mesas de diciembre. Ventana corta: activar gratis, cobrar poco.
- **Febrero:** mesas de febrero/marzo y ingresos. **Es la ventana real de cobro.** El anuncio de MaestrIA, si se aprueba, apunta a **1–28/2**.
- **Marzo:** pausa y retención; medir cuántos vuelven en abril.

### Embudo y metas para «verificado comercialmente»
Alta → activa (sube programa + 2 alumnos practican en 7 días) → 3.er alumno → paga.
**Criterio de verificación (propuesto):** **≥ 15 profes activados y ≥ 5 pagando**, al menos 3 fuera de la red directa de Mauro, antes del 31/1.

## Brand

- **Qué es, en una línea:** la práctica para tus alumnos, armada con tu programa, que te dice qué reforzar antes de la clase.
- **Promesa:** el profe sigue siendo el profe. La IA prepara; el profe aprueba.
- **Personalidad:** colega docente del interior, claro, sin humo de «IA revolucionaria». Voseo. Ejemplos de mesas, no de Silicon Valley.
- **Prueba de confianza visible:** «nada le llega al alumno sin tu OK», «pistas, nunca la respuesta», firma de Mauro como profe de matemática real.
- **Nombre:** MaestrIA (en Facebook la página quedó «Maestria IA» por la regla de mayúsculas; en IG @maestria.edu.app). Mantener la grafía MaestrIA en la app y en las piezas.
- **Mascota Afi:** no aplica acá (es de AfiniaJobs); no mezclar.
- **Sistema visual:** el de la app (`app/tokens.css`). Las piezas de anuncio salen del mismo sistema; nada de rojo ni degradés fuera de tokens.
- **Riesgo de marca:** un error de matemática en una pregunta mostrada en un anuncio. Toda pieza usa ejercicios revisados por Mauro.

## Operations

### Capacidad del fundador (2 h/día ≈ 60 h/mes)
| Tarea | Tiempo | Con 20 profes |
|---|---|---|
| Videollamada de arranque | 15–20 min | 20 × 20 = ~7 h (una vez) |
| Soporte por WhatsApp | ~10 min/profe/mes | ~3,5 h/mes |
| Revisar extracción de programas que fallan | ~15 min c/u | depende del test de 10 PDFs |
| Reintegros de garantía | 5 min c/u | <1 h |
| Contenido orgánico (2 reels/semana) | ~3 h/semana | 12 h/mes |
**Entra en 2 h/día hasta ~30 profes.** El cuello de botella es la videollamada de arranque, no el cobro (ya automatizado).

### Procesos que tienen que existir antes de cobrar
1. **Cobro → activación automática**: el webhook ya existe (`app/api/pagos/mercadopago`, Ronda T: valida firma, consulta el pago y acredita una sola vez). Falta **verificar de punta a punta** en staging con un pago de prueba y confirmar que `MERCADOPAGO_WEBHOOK_SECRET` esté en Vercel.
2. **Reintegro de garantía**: botón o pedido por WhatsApp; Mauro devuelve desde Mercado Pago.
3. **Pausa de marzo**: estado `pausado` que conserva fichas y no cobra.
4. **Alerta de costo de IA**: aviso si el gasto diario en `ai_usage_log` supera USD 1 (hoy ≈ USD 0,01/día).
5. **Calidad de extracción**: probar con 10 programas reales en PDF (de colegas, sin datos de alumnos) y registrar qué falla.

### Costos reales (sin cambios en numbers.json)
IA medida muy por debajo del supuesto; Vercel y Neon sin cambio. El único costo que mueve la aguja es la pauta.

## Launch plan

### La prueba (antes de poner plata)
**Hipótesis:** si el profe ve a sus 2 alumnos practicar en la primera semana, paga $15.000 por el bloque de 5.
**Pasa si**, al 31/1: ≥ 15 profes activados (programa + 2 alumnos practicando en 7 días) y ≥ 5 pagando, 3 de ellos fuera de la red de Mauro. **Falla si** hay < 2 pagos: se revisa el producto, no el precio.

### Cuenta regresiva
| Cuándo | Qué | Quién |
|---|---|---|
| 27/11 noche | Tanda AB (agentes): landing /profes v3, mensaje de WhatsApp en el arranque, resumen semanal, muro del 3.er alumno con evidencia, precios por env, ocultar Aula/Institución/autodidacta, copy de garantía y pausa | agentes en ramas, PR en verde |
| 28/11 | Probar en staging, revisar PRs, mergear lo que esté bien | Mauro |
| 28/11 | Cargar env vars de precio en Vercel (decisión de Mauro) | Mauro |
| 29/11–20/12 | Red propia: 10 colegas con videollamada de 15 min, gratis 2 alumnos | Mauro |
| Dic | 2 reels orgánicos/semana | Mauro + videos Remotion |
| 15/12 | Prueba de punta a punta del webhook de Mercado Pago en staging (ya existe) | agentes + Mauro |
| 31/1 | **Revisión: ¿verificado?** Si sí → OK de pauta | Mauro |
| 1–28/2 | Si hay OK: campaña MaestrIA $2.000/día a /profes | Mauro aprueba gasto |

### Hoja de ruta del día de la campaña (si llega)
1. Pieza: video Remotion con datos ficticios + titular v3.
2. Destino: /profes con `?origen=meta`.
3. Medir costo por **profe activado**, no por clic. Corte: si a los 7 días cuesta > $15.000 por profe activado, pausar.

### Revisión a 30 días
Altas, activados, % con 2 alumnos practicando, 3.er alumno, pagos, reintegros, costo IA real, horas de Mauro.

_The panel is simulated buyers and the numbers are projections from your inputs. Confirm demand with real customers and costs with real quotes before you spend. Not financial, legal or tax advice._
