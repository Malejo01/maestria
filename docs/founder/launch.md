# Lanzamiento · MaestrIA

## La prueba (antes de poner plata)
**Hipótesis:** si el profe ve a sus 2 alumnos practicar en la primera semana, paga $15.000 por el bloque de 5.
**Pasa si**, al 31/1: ≥ 15 profes activados (programa + 2 alumnos practicando en 7 días) y ≥ 5 pagando, 3 de ellos fuera de la red de Mauro. **Falla si** hay < 2 pagos: se revisa el producto, no el precio.

## Cuenta regresiva
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

## Hoja de ruta del día de la campaña (si llega)
1. Pieza: video Remotion con datos ficticios + titular v3.
2. Destino: /profes con `?origen=meta`.
3. Medir costo por **profe activado**, no por clic. Corte: si a los 7 días cuesta > $15.000 por profe activado, pausar.

## Revisión a 30 días
Altas, activados, % con 2 alumnos practicando, 3.er alumno, pagos, reintegros, costo IA real, horas de Mauro.
