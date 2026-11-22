-- Migration: Códigos de descuento (ronda T, C1)
-- Version: 038
-- Description: Mauro crea códigos para cobrar menos a alguien (el primero:
-- FUNDADORA-SIL, 50 % para Silvana). Se usan al pagar desde /precios (C2).
--
--   codigos_descuento        → el código: porcentaje, a qué plan aplica
--                              (particular, aula, pase_alumno o todos), si
--                              mensual, pase o ambos, cuántos meses dura desde
--                              el primer uso, usos máximos (personas), cuándo
--                              vence, si marca Fundadora, nota, quién lo creó y
--                              si sigue activo.
--   codigos_descuento_usos   → quién lo usó y cuándo por primera vez. Un uso
--                              es una persona: quien ya lo usó puede volver a
--                              aplicarlo mientras duren sus meses, sin gastar
--                              otro uso.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS. Se puede
-- correr dos veces.
--
-- LA VÁLVULA (lib/codigos-descuento-server.ts)
--
-- Sin la 038 (42P01): /admin/codigos dice que falta la migración y al pagar
-- no se aceptan códigos. Nada da 500.
--
-- QUIÉN ESCRIBE: /admin/codigos (crear, desactivar) y el cobro (C2: el uso).
--
-- Uso:
--   npx tsx scripts/run-migration-038.ts --env=staging
--   npx tsx scripts/run-migration-038.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS codigos_descuento (
  id            SERIAL PRIMARY KEY,
  codigo        TEXT NOT NULL UNIQUE CHECK (codigo = UPPER(codigo) AND codigo ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  porcentaje    SMALLINT NOT NULL CHECK (porcentaje BETWEEN 1 AND 100),
  aplica        TEXT NOT NULL DEFAULT 'todos' CHECK (aplica IN ('particular', 'aula', 'pase_alumno', 'todos')),
  forma         TEXT NOT NULL DEFAULT 'ambos' CHECK (forma IN ('mensual', 'pase', 'ambos')),
  meses         SMALLINT CHECK (meses IS NULL OR meses BETWEEN 1 AND 36),
  usos_maximos  INTEGER NOT NULL DEFAULT 1 CHECK (usos_maximos >= 1),
  vence_el      TIMESTAMPTZ,
  fundadora     BOOLEAN NOT NULL DEFAULT FALSE,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  nota          TEXT,
  creado_por    TEXT,
  creado_el     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS codigos_descuento_usos (
  codigo_id     INTEGER NOT NULL REFERENCES codigos_descuento(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primer_uso_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (codigo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_codigos_descuento_usos_user ON codigos_descuento_usos (user_id);

COMMENT ON TABLE codigos_descuento IS 'C1 (ronda T): códigos de descuento. Los crea el admin en /admin/codigos; se usan al pagar (C2).';
