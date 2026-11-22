-- Migration: Avisarle al que reportó que su reporte se resolvió (tanda N, N1)
-- Version: 030
-- Description: Tres columnas en `feedback_reports` para cerrar el ciclo del
-- buzón: el admin marca un reporte como resuelto (M6) y, la próxima vez que
-- quien lo reportó entra a la app —con cuenta o como invitado—, ve un aviso
-- de que se corrigió, con un mensaje opcional del admin.
--
--   respuesta       → lo que el admin le contesta (opcional; vacío = texto por defecto).
--   respondido_por  → el nombre de pila del admin que lo resolvió ("Mauro te dejó un mensaje").
--   resuelto_el     → cuándo pasó a 'resuelto'. Sin esto no hay aviso.
--   aviso_visto_el  → cuándo la persona tocó "Entendido". Con esto el aviso no vuelve.
--
-- ES ADITIVA E IDEMPOTENTE
--
-- Todo con IF NOT EXISTS, todo NULL y sin DEFAULT. Se puede correr dos veces:
-- el UPDATE del final sólo toca filas con `resuelto_el` NULL.
--
-- LA VÁLVULA
--
-- Sin la 030, el buzón funciona como hoy (cambia el estado con el UPDATE de
-- M6) y GET /api/feedback/avisos devuelve una lista vacía: no se muestra
-- ningún aviso y nada da 500.
--
-- QUIÉN ESCRIBE CADA COLUMNA (lección del roadmap: una columna sin escritor es
-- letra muerta desde el día uno)
--
--   respuesta, respondido_por, resuelto_el → app/api/admin/reportes/[id] (PATCH a 'resuelto'),
--                                            al volver a 'nuevo' o 'visto' se limpian
--                                            resuelto_el y aviso_visto_el.
--   aviso_visto_el                         → app/api/feedback/avisos/visto (botón Entendido).
--
-- BACKFILL, A PROPÓSITO SÓLO DE `resuelto_el`
--
-- Los reportes que ya estaban resueltos toman resuelto_el = NOW() para que su
-- aviso salga igual. `aviso_visto_el` NO se completa: quien reportó la semana
-- pasada (Clarita, reporte #6, invitada) tiene que recibir el aviso.
--
-- Uso:
--   npx tsx scripts/run-migration-030.ts --env=staging
--   npx tsx scripts/run-migration-030.ts            (producción: la corre Mauro)

ALTER TABLE feedback_reports
  ADD COLUMN IF NOT EXISTS respuesta TEXT NULL,
  ADD COLUMN IF NOT EXISTS respondido_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS resuelto_el TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS aviso_visto_el TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_reports_aviso_pendiente
  ON feedback_reports(user_id)
  WHERE status = 'resuelto' AND aviso_visto_el IS NULL;

UPDATE feedback_reports SET resuelto_el = NOW() WHERE status = 'resuelto' AND resuelto_el IS NULL;
