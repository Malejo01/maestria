# Ronda nocturna O · 22/11/2026 — informe de la mañana

Trabajo en loop sin supervisión, desde las 00:40 (hora de Argentina). Una rama desde `main` por ítem, PR, merge con el CI en verde. **Nada contra producción**: toda migración corrió sólo en staging, dos veces.

## Estado ítem por ítem

| Ítem | Estado | PR | Qué se probó | Gasto de IA |
|---|---|---|---|---|
| N1 · Aviso al que reportó (migración 030) | hecho | [#74](https://github.com/Malejo01/maestria/pull/74) | Tests de permisos, del texto y del componente; en staging, de punta a punta con un invitado (ver abajo) | US$0 (no llama a la IA) |

**Gasto de IA acumulado de la noche:** US$0,00 (tope: US$10; a los US$8 se pasa a modelos simulados).

## Detalle

### N1 · Aviso al que reportó

- Migración **030** (`scripts/030-aviso-de-reporte.sql`, runner `scripts/run-migration-030.ts`): `respuesta`, `respondido_por`, `resuelto_el`, `aviso_visto_el` en `feedback_reports`, índice parcial de pendientes y backfill de `resuelto_el` (no de `aviso_visto_el`: Clarita tiene que recibir el suyo). Se agregó **`respondido_por`**, que no estaba en el SQL del encargo: sin esa columna no hay forma de escribir "Mauro te dejó un mensaje" sin dejar el nombre fijo en el código.
- Probado en staging: un invitado ("Prueba N1 Invitada") reportó la pregunta 2 de "Prueba M1 · sin conexión"; Irina (admin temporal por `.env.development.local`, ya borrado) lo pasó a visto y a resuelto con mensaje; el invitado vio el aviso en `/aulas` a 390 y 1280; tocó Entendido; la API devolvió `[]`, la base guardó `aviso_visto_el`, y al recargar no apareció más. El buzón muestra "Lo vio el 22/11".
- Un error que encontró la prueba en staging y no los tests: con la 030 corrida, la consulta del buzón tenía columnas ambiguas (`f.*` ya las traía). Corregido antes del PR.

## Pasos manuales de Mauro, en orden

1. Migración 030 en producción:
   ```powershell
   $env:CONFIRM_PRODUCTION="noisy-smoke-23995229"; npx tsx scripts/run-migration-030.ts
   ```
   Después, entrar a `/admin/reportes` → Resueltos: los 9 tienen que decir "Aviso pendiente" (el de Clarita) o "Sin aviso: lo reportó un admin" (los 8 tuyos).

## Decisiones que quedaron pendientes

(se completa al cierre)

## Datos de prueba que quedaron en staging

- Invitado **"Prueba N1 Invitada"** (`guest_746f3dcd015289be8016e284589db685`) en el grupo Lengua de Irina, y su reporte **#2** (resuelto, aviso visto).
