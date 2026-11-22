# Ronda nocturna O · 22/11/2026 — informe de la mañana

Trabajo en loop sin supervisión, desde las 00:40 (hora de Argentina). Una rama desde `main` por ítem, PR, merge con el CI en verde. **Nada contra producción**: toda migración corrió sólo en staging, dos veces.

## Estado ítem por ítem

| Ítem | Estado | PR | Qué se probó | Gasto de IA |
|---|---|---|---|---|
| N1 · Aviso al que reportó (migración 030) | hecho | [#74](https://github.com/Malejo01/maestria/pull/74) | Tests de permisos, del texto y del componente; en staging, de punta a punta con un invitado (ver abajo) | US$0 (no llama a la IA) |
| N2 · Corregir en lote las preguntas marcadas | hecho | (este PR) | Tests con el modelo simulado (sí/no → afirmación, abierta → opción múltiple, valor de verdad cambiado → rechazada, sin aplicar no se escribe); en staging, dry-run del script y "Aplicar" desde *Mis tareas* | US$0,004 |

**Gasto de IA acumulado de la noche:** US$0,004 (medido en `ai_usage_log` de staging: 6 llamadas, US$0,0032; más ~US$0,0005 del dry-run del script, que no pasa por el registro) (tope: US$10; a los US$8 se pasa a modelos simulados).

## Detalle

### N1 · Aviso al que reportó

- Migración **030** (`scripts/030-aviso-de-reporte.sql`, runner `scripts/run-migration-030.ts`): `respuesta`, `respondido_por`, `resuelto_el`, `aviso_visto_el` en `feedback_reports`, índice parcial de pendientes y backfill de `resuelto_el` (no de `aviso_visto_el`: Clarita tiene que recibir el suyo). Se agregó **`respondido_por`**, que no estaba en el SQL del encargo: sin esa columna no hay forma de escribir "Mauro te dejó un mensaje" sin dejar el nombre fijo en el código.
- Probado en staging: un invitado ("Prueba N1 Invitada") reportó la pregunta 2 de "Prueba M1 · sin conexión"; Irina (admin temporal por `.env.development.local`, ya borrado) lo pasó a visto y a resuelto con mensaje; el invitado vio el aviso en `/aulas` a 390 y 1280; tocó Entendido; la API devolvió `[]`, la base guardó `aviso_visto_el`, y al recargar no apareció más. El buzón muestra "Lo vio el 22/11".
- Un error que encontró la prueba en staging y no los tests: con la 030 corrida, la consulta del buzón tenía columnas ambiguas (`f.*` ya las traía). Corregido antes del PR.

### N2 · Corregir en lote

- Endpoint `POST /api/teacher/quizzes/[id]/corregir-tipos` (no escribe): primero la regla de M2, después el modelo (`generateObject` + Zod, el modelo del generador), verificado: sin marcas de `problemaDeTipo`, mismo `topic`, y en verdadero o falso el modelo declara el valor de verdad y el servidor lo compara. Lo que no pasa queda como estaba, con el motivo.
- *Mis tareas* muestra "Corregir N preguntas" en cada cuestionario con marcas; *Revisar y editar*, arriba. El diálogo muestra antes → después con una casilla por pregunta. En *Mis tareas*, Aplicar guarda (con intentos ya hechos: copia y mueve las asignaciones, como *Revisar y editar*); en *Revisar y editar*, lo deja en pantalla sin guardar.
- **Numérica que pide palabras** (no estaba en el encargo): se pasa a opción múltiple, como la de verdadero o falso abierta.
- **Dry-run en staging** (cuestionario de prueba 39 con los casos reales del 20/11):
  ```
  Pregunta 1 · verdadero o falso escrito como pregunta · IA
    antes:   Aplicando el criterio de divisibilidad, ¿es el número 1.242 divisible por 9?  (V)
    después: El número 1.242 es divisible por 9 porque la suma de sus cifras es 9.  (V)
  Pregunta 2 · verdadero o falso con una pregunta abierta · IA
    después: opción múltiple, la correcta «El sentido de la desigualdad se invierte.»
  Pregunta 3 · pide un valor y la respuesta es un conjunto · regla (sin IA)
    después: Determiná el conjunto solución de $3x + 4 \leq 10$.  (+ las formas de intervalo)
  Pregunta 4 · verdadero o falso escrito como pregunta · IA
    antes:   ¿Es 91 un número primo?  (F)
    después: El número 91 es un número primo.  (F)
  marcadas: 4 · con corrección: 4 · ~US$0,0005
  ```
  La pregunta 1 traía la justificación pegada ("porque…"): el pedido ahora lo prohíbe, y en la corrida desde la pantalla salió "El número 1.242 es divisible por 9.".

## Pasos manuales de Mauro, en orden

1. Migración 030 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-030.ts
   ```
   Después, entrar a `/admin/reportes` → Resueltos: los 9 tienen que decir "Aviso pendiente" (el de Clarita) o "Sin aviso: lo reportó un admin" (los 8 tuyos).
2. Corrección en lote de las 18 preguntas marcadas de producción. Primero sólo mirar (no escribe; la IA sí se llama, ~US$0,01):
   ```powershell
   npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20
   ```
   Si lo que propone está bien, aplicarlo (los cuestionarios con intentos, como el 41, se guardan como copia y sus asignaciones pasan a la copia; las respuestas ya hechas no cambian):
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/qa/corregir-tipos.ts --desde=2026-11-20 --aplicar
   ```

## Decisiones que quedaron pendientes

(se completa al cierre)

## Datos de prueba que quedaron en staging

- Cuestionario **39 "Prueba N2 · tipos mal armados"** de Irina (Matemática, 3.º Sec.), ya corregido desde la pantalla.
- Invitado **"Prueba N1 Invitada"** (`guest_746f3dcd015289be8016e284589db685`) en el grupo Lengua de Irina, y su reporte **#2** (resuelto, aviso visto).
