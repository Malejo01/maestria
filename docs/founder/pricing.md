# Pricing · MaestrIA (plan Particular)

## Recomendación
**Gratis con 2 alumnos para siempre → $15.000 por mes por bloque de 5 alumnos.** Opcional: el **pase de 90 días** que ya existe, a **$35.000** (≈ $11.700/mes) para el que prefiere pagar una vez, mostrado *después* de que el profe vio practicar a sus alumnos, nunca como primera oferta.

## Por qué ese número
| Evidencia | v1 (40 personas) | v2 (20 personas) |
|---|---|---|
| Rango aceptable (Van Westendorp) | $5.045 – $25.048 | $3.030 – $17.965 |
| Precio indiferente (IPP) | $11.969 | $8.032 |
| «Caro» (mediana) | — | $12.000 |
| «Demasiado caro» (mediana) | — | $20.000 |

- $15.000 queda **dentro de los dos rangos**. $20.000 (el precio actual de `planes.ts`) queda **fuera** del rango v2 y en el borde del «demasiado caro».
- Ancla que funciona: **menos que una clase de un licenciado** ($25.000–60.000/h CABA, −25 % interior). Ancla que no funciona: «unos $9.000 por mes» del pase v2 — bajó la referencia y la gente respondió precios más bajos.
- El precio **no** fue el motivo principal de rechazo (2 de 37 en v1, 1 de 20 en v2). Los motivos fueron **confianza** y **hábito**. Bajar el precio no destraba la venta; destraba la prueba gratis bien acompañada.

## Qué NO cambiar todavía
- No bajar a $12.000: el margen cae a 54 % y año 1 a ≈ $377.000.
- No subir a $20.000 hasta tener 10 profes pagos y medir cuántos se quedan.

## Implementación (sin tocar prod: Mauro decide y carga las env vars)
- `MAESTRIA_PRECIO_MENSUAL_BLOQUE=15000` (bloque de 5, `ALUMNOS_POR_BLOQUE` no cambia), `MAESTRIA_PRUEBA_DIAS=0` (gratis 2 alumnos sin vencimiento, tanda AA1).
- Pase: `MAESTRIA_PRECIO_PASE_BLOQUE=35000` por los 90 días que ya existen (`DIAS_PASE`), como segunda opción.
- Precio fundador: un código en `/admin/codigos` (propuesta `FUNDADOR`: 33 % ≈ $10.000/mes, 3 meses, 20 usos), en vez de un pase barato: conserva el ancla mensual.
