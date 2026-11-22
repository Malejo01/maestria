-- Migration: Modo autodidacta, el alumno que se prepara solo (ronda T, E1)
-- Version: 040
-- Description: Un alumno mayor de 18 sube el programa de su materia, pone la
-- fecha del examen, hace un diagnóstico, recibe un plan hasta el examen y
-- practica y rinde simulacros.
--
--   users.mayor_de_18_el            la declaración obligatoria de que es mayor
--                                   de 18 (y cuándo la hizo).
--   teacher_programs.personal       la materia personal del alumno: el dueño es
--                                   él, así que no aparece en ningún panel
--                                   docente (las consultas del docente filtran
--                                   por dueño, y además por `personal`).
--   teacher_programs.fecha_examen   la fecha del examen.
--   autodidacta_resultados          lo que dejó cada diagnóstico, práctica o
--                                   simulacro, tema por tema: de ahí salen
--                                   "Lo que ya sabés / Lo que tenés que
--                                   reforzar" y el plan.
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN / CREATE TABLE / INDEX IF NOT EXISTS.
--
-- LA VÁLVULA (lib/autodidacta-server.ts): sin la 040, la entrada "Me preparo
-- solo para un examen" no se muestra. Nada da 500.
--
-- Uso:
--   npx tsx scripts/run-migration-040.ts --env=staging
--   npx tsx scripts/run-migration-040.ts            (producción: la corre Mauro)

ALTER TABLE users ADD COLUMN IF NOT EXISTS mayor_de_18_el TIMESTAMPTZ;

ALTER TABLE teacher_programs ADD COLUMN IF NOT EXISTS personal BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE teacher_programs ADD COLUMN IF NOT EXISTS fecha_examen DATE;

CREATE TABLE IF NOT EXISTS autodidacta_resultados (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id  INTEGER NOT NULL REFERENCES teacher_programs(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('diagnostico', 'practica', 'simulacro')),
  por_tema    JSONB NOT NULL,
  nota        NUMERIC(4, 2),
  creado_el   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autodidacta_resultados ON autodidacta_resultados (user_id, program_id, creado_el DESC);

COMMENT ON TABLE autodidacta_resultados IS 'E1 (ronda T): diagnóstico, prácticas y simulacros del alumno autodidacta, tema por tema.';
