> **Nota del CFO (27/11).** El bloque deja **$12.640 de cada $15.000 (84 %)**: la IA cuesta poco (≈ $470 por bloque-mes, medido en `ai_usage_log`), así que el negocio no se cae por costos variables. El que pesa es el **anuncio**: $60.000 de $79.500 de fijos. Con anuncios prendidos hacen falta **~6-7 bloques pagos por mes** (≈ 5-6 profes) solo para no perder; sin anuncios (solo Vercel) alcanza con **2 bloques**. La meta de ~20 profes (≈ 25 bloques) deja ~$790.000 en el año 1, pero ese número depende de una rampa **supuesta**, no medida: el panel simulado compra 8 %, por debajo del 25 % que pide el chequeo. **Conclusión: no gastar en anuncios de MaestrIA hasta tener 5 profes pagando de forma orgánica**; ahí el fijo de anuncios ya está cubierto antes de prenderlo. Precio: $15.000 queda adentro de las dos curvas; $20.000 mejora el margen (72 %) pero cae fuera de la curva v2 ("caro" desde $12.000 de mediana).

# Unit economics: MaestrIA · plan Particular (bloque de 5 alumnos, mensual)

Every number below comes from the input file. Nothing is looked up or guessed.

## One bloque-mes (5 alumnos, 1 mes)

| line | per bloque-mes (5 alumnos, 1 mes) |
| --- | ---: |
| Price | $15,000.00 |
| IA Gemini por bloque-mes (estimado con costos medidos: 10 cuestionarios + 200 correcciones + 100 devoluciones + 100 pistas ≈ USD 0,24 × 1.950) | -$470.00 |
| Comisión Mercado Pago con IVA (estimado 7,6 %) | -$1,140.00 |
| Reserva garantía 14 días (estimado: 5 % de reintegros) | -$750.00 |
| **Contribution** (what each bloque-mes (5 alumnos, 1 mes) leaves to pay the fixed costs) | **$12,640.00** (84%) |

## The margin that matters

Fixed costs: $79,500 a month (Vercel (USD 20, 50 % atribuido a MaestrIA) $19,500, Anuncios Meta MaestrIA ($2.000/día) $60,000, Neon Postgres (plan gratis) $0).

- **Break-even: 1 bloque-mes (5 alumnos, 1 mes)s a day.** Below that you lose money every month.
- **Profit margin at your plan** (1 a day): **63%** of every sale, after every cost.
- Capacity: 3 a day.

## Year 1, month by month

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

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 63% | 1 | $790,699 |
| Price -10% | 59% | 1 | $583,654 |
| Volume -20% | 58% | 1 | $441,759 |
| Unit costs +15% | 61% | 1 | $741,837 |

No red flags in these numbers. They are only as good as the inputs: check every cost against a real quote.
