-- Migration: Tipo de plan (Particular o Aula) y docentes fundadoras (ronda T, B1)
-- Version: 037
-- Description: Hasta acá había un solo tipo de plan, por bloques de alumnos
-- (sirve al profe particular, no al docente de un curso). Se suma el plan
-- Aula: cursos de hasta 35 alumnos, sin funciones individuales.
--
--   users.plan_tipo        'particular' (el de siempre) o 'aula'. Por defecto
--                          'particular': ningún docente actual cambia.
--   users.aula_cursos      cuántos cursos pagos tiene en el plan Aula.
--   users.fundadora_desde  la marca de docente fundadora (B2): un birrete con
--                          estrella para siempre. La pone y la saca sólo el
--                          admin, desde /admin/planes.
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN IF NOT EXISTS con DEFAULT (las filas
-- existentes quedan 'particular', 0 y NULL). El CHECK se agrega sólo si no
-- existe. Se puede correr dos veces.
--
-- LA VÁLVULA (lib/planes-server.ts)
--
-- Sin la 037 (42703): todos son 'particular', sin cursos Aula y sin marca de
-- fundadora; el plan funciona exactamente como antes. Nada da 500.
--
-- QUIÉN ESCRIBE: /admin/planes (acreditar Aula, marcar fundadora).
--
-- Uso:
--   npx tsx scripts/run-migration-037.ts --env=staging
--   npx tsx scripts/run-migration-037.ts            (producción: la corre Mauro)

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tipo TEXT NOT NULL DEFAULT 'particular';

ALTER TABLE users ADD COLUMN IF NOT EXISTS aula_cursos SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS fundadora_desde TIMESTAMPTZ;

-- En una sola línea a propósito: el runner parte el archivo por ";" + salto de línea.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_plan_tipo_check') THEN ALTER TABLE users ADD CONSTRAINT users_plan_tipo_check CHECK (plan_tipo IN ('particular', 'aula')); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_aula_cursos_check') THEN ALTER TABLE users ADD CONSTRAINT users_aula_cursos_check CHECK (aula_cursos >= 0); END IF; END $$;

COMMENT ON COLUMN users.plan_tipo IS 'B1 (ronda T): particular (por bloques de alumnos, con funciones individuales) o aula (cursos de hasta 35, sin funciones individuales).';

COMMENT ON COLUMN users.fundadora_desde IS 'B2 (ronda T): docente fundadora desde esa fecha. Sólo el admin la pone o la saca.';
