-- Migration: Lo que descartan los validadores al generar (ronda Y, Y1)
-- Version: 049
-- Description: La salud del sistema en /admin mide, de las generaciones de las
-- últimas 24 h, cuántas fallaron (eso ya está: ai_usage_log.status) y cuántas
-- preguntas descartaron los validadores (forma, tipo no pedido, repetidas…).
-- Lo segundo no se guardaba: el observador de U4 sólo vivía en memoria.
--
-- Dos columnas en ai_usage_log, para la fila de cada generación:
--   preguntas_crudas       las que devolvió el modelo, en todas sus tandas;
--   preguntas_descartadas  las que no pasaron los validadores.
--
-- ES ADITIVA E IDEMPOTENTE. No depende de la 037 a la 048.
--
-- LA VÁLVULA: sin la 049, la generación no escribe estas columnas (el 42703 se
-- ataja en lib/ai-usage.ts) y /admin/salud muestra la tasa de descarte como
-- "sin dato".

ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS preguntas_crudas INTEGER;
ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS preguntas_descartadas INTEGER;

COMMENT ON COLUMN ai_usage_log.preguntas_crudas IS 'Y1 (ronda Y): preguntas que devolvió el modelo en esta generación (todas las tandas).';
COMMENT ON COLUMN ai_usage_log.preguntas_descartadas IS 'Y1 (ronda Y): preguntas que descartaron los validadores en esta generación.';
