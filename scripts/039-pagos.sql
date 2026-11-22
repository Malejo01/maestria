-- Migration: Pagos desde la app con Mercado Pago Checkout Pro (ronda T, C2)
-- Version: 039
-- Description: El docente paga desde /precios: el servidor calcula el monto
-- (con el código de descuento, C1), crea una fila acá y una preferencia de
-- Mercado Pago con `external_reference` = el id de la fila. El webhook
-- consulta el pago a la API (nunca confía en el cuerpo) y, si está aprobado,
-- acredita el plan UNA sola vez.
--
--   pagos  → quién, qué plan (particular, aula, pase_alumno), mensual o pase,
--            cuánto (nivel o cursos), lista y monto final, el código usado,
--            estado (pendiente, aprobado, rechazado, cancelado), el id de la
--            preferencia y del pago de Mercado Pago, y cuándo se acreditó.
--
-- La idempotencia: `mp_payment_id` es único y el paso a 'aprobado' es un
-- UPDATE condicionado (WHERE estado <> 'aprobado'): el mismo pago notificado
-- dos veces acredita una sola vez.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS.
--
-- LA VÁLVULA (lib/pagos-server.ts)
--
-- Sin la 039 (42P01) o sin MERCADOPAGO_ACCESS_TOKEN: el botón Pagar vuelve a
-- lo de antes (el link fijo y la acreditación a mano; con código, WhatsApp a
-- Mauro). Nada da 500.
--
-- QUIÉN ESCRIBE: POST /api/pagos/checkout (la fila) y POST
-- /api/pagos/mercadopago (el webhook: el estado y la acreditación).
--
-- Uso:
--   npx tsx scripts/run-migration-039.ts --env=staging
--   npx tsx scripts/run-migration-039.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS pagos (
  id               SERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan             TEXT NOT NULL CHECK (plan IN ('particular', 'aula', 'pase_alumno')),
  forma            TEXT NOT NULL CHECK (forma IN ('mensual', 'pase')),
  cantidad         SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  monto_lista      INTEGER NOT NULL CHECK (monto_lista >= 0),
  monto            INTEGER NOT NULL CHECK (monto >= 0),
  codigo_id        INTEGER REFERENCES codigos_descuento(id) ON DELETE SET NULL,
  codigo           TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  mp_preference_id TEXT,
  mp_payment_id    TEXT UNIQUE,
  detalle          JSONB,
  acreditado_el    TIMESTAMPTZ,
  creado_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_el   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_user ON pagos (user_id, creado_el DESC);

COMMENT ON TABLE pagos IS 'C2 (ronda T): pagos con Mercado Pago Checkout Pro. Los escriben /api/pagos/checkout y el webhook /api/pagos/mercadopago.';
