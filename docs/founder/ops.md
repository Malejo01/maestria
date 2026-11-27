# Operaciones · MaestrIA

## Capacidad del fundador (2 h/día ≈ 60 h/mes)
| Tarea | Tiempo | Con 20 profes |
|---|---|---|
| Videollamada de arranque | 15–20 min | 20 × 20 = ~7 h (una vez) |
| Soporte por WhatsApp | ~10 min/profe/mes | ~3,5 h/mes |
| Revisar extracción de programas que fallan | ~15 min c/u | depende del test de 10 PDFs |
| Reintegros de garantía | 5 min c/u | <1 h |
| Contenido orgánico (2 reels/semana) | ~3 h/semana | 12 h/mes |
**Entra en 2 h/día hasta ~30 profes.** El cuello de botella es la videollamada de arranque, no el cobro (ya automatizado).

## Procesos que tienen que existir antes de cobrar
1. **Cobro → activación automática**: el webhook ya existe (`app/api/pagos/mercadopago`, Ronda T: valida firma, consulta el pago y acredita una sola vez). Falta **verificar de punta a punta** en staging con un pago de prueba y confirmar que `MERCADOPAGO_WEBHOOK_SECRET` esté en Vercel.
2. **Reintegro de garantía**: botón o pedido por WhatsApp; Mauro devuelve desde Mercado Pago.
3. **Pausa de marzo**: estado `pausado` que conserva fichas y no cobra.
4. **Alerta de costo de IA**: aviso si el gasto diario en `ai_usage_log` supera USD 1 (hoy ≈ USD 0,01/día).
5. **Calidad de extracción**: probar con 10 programas reales en PDF (de colegas, sin datos de alumnos) y registrar qué falla.

## Costos reales (sin cambios en numbers.json)
IA medida muy por debajo del supuesto; Vercel y Neon sin cambio. El único costo que mueve la aguja es la pauta.
