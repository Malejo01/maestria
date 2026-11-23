-- Migration: Referidos (ronda V, V3)
-- Version: 046
-- Description: Cada docente tiene su código de referido (users.codigo_referido)
-- y su link /?ref=CODIGO. Quien se registra con ese link queda anotado en
-- `referidos`. Cuando paga su primer plan, al que lo trajo se le suman 30 días
-- (una vez por referido): `pago_id` dice qué pago lo disparó y `premiado_el`
-- cuándo se sumaron (NULL con pago_id = premio pendiente, se suma en su
-- próximo pago).
--
-- ES ADITIVA E IDEMPOTENTE: IF NOT EXISTS en todo. Correrla dos veces deja lo
-- mismo. No depende de ninguna de la 037 a la 045: `pago_id` es un número sin
-- clave foránea (la tabla `pagos` es de la 039).
--
-- LA VÁLVULA: además de la migración, nada se activa sin
-- MAESTRIA_REFERIDOS_ACTIVO=1 (lib/referidos.ts). Sin la 046, el código de
-- referido no se muestra ni se acepta y el registro sigue igual.

ALTER TABLE users ADD COLUMN IF NOT EXISTS codigo_referido TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_codigo_referido ON users (codigo_referido) WHERE codigo_referido IS NOT NULL;

CREATE TABLE IF NOT EXISTS referidos (
  id           SERIAL PRIMARY KEY,
  referente_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referido_id  TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  codigo       TEXT NOT NULL,
  creado_el    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pago_id      INTEGER,
  pagado_el    TIMESTAMPTZ,
  premiado_el  TIMESTAMPTZ,
  dias_premio  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_referidos_referente ON referidos (referente_id);

COMMENT ON TABLE referidos IS 'V3 (ronda V): quién trajo a quién con su link de referido, y el premio de 30 días cuando el referido pagó su primer plan.';
