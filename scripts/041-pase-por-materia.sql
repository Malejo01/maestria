-- Migration: El pase por materia del modo autodidacta (ronda T, E2)
-- Version: 041
-- Description: Gratis, el alumno sube el programa, hace el diagnóstico y dos
-- prácticas. Con el pase de esa materia, todo (prácticas del plan y
-- simulacros) hasta el examen + 7 días.
--
--   teacher_programs.pase_hasta   hasta qué día vale el pase de la materia
--                                 personal (fecha del examen + 7). NULL: sin
--                                 pase. Lo escribe el webhook de Mercado Pago
--                                 al acreditar un pago `pase_alumno`.
--   autodidacta_usos              cada cuestionario generado del modo
--                                 autodidacta (diagnóstico, práctica o
--                                 simulacro): con esto se cuenta lo gratis.
--                                 El gasto de IA por alumno queda en
--                                 ai_usage_log (endpoint 'autodidacta').
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN / CREATE TABLE / INDEX IF NOT EXISTS.
--
-- LA VÁLVULA (lib/autodidacta-server.ts): sin la 041, la materia personal se
-- usa como en E1 (sin límite de lo gratis ni pase). Nada da 500.
--
-- Uso:
--   npx tsx scripts/run-migration-041.ts --env=staging
--   npx tsx scripts/run-migration-041.ts            (producción: la corre Mauro)

ALTER TABLE teacher_programs ADD COLUMN IF NOT EXISTS pase_hasta DATE;

CREATE TABLE IF NOT EXISTS autodidacta_usos (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id  INTEGER NOT NULL REFERENCES teacher_programs(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('diagnostico', 'practica', 'simulacro')),
  creado_el   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autodidacta_usos_programa ON autodidacta_usos (program_id, tipo);

COMMENT ON COLUMN teacher_programs.pase_hasta IS 'E2 (ronda T): hasta qué día vale el pase de la materia personal (examen + 7). NULL: sin pase.';

COMMENT ON TABLE autodidacta_usos IS 'E2 (ronda T): cada cuestionario generado del modo autodidacta, para contar lo gratis (diagnóstico y 2 prácticas).';
