-- Migration: Cerrar el ciclo de "A reforzar" (ronda O, O2)
-- Version: 031
-- Description: Cuándo y quién marcó como superado un tema a reforzar
-- (`student_misconceptions`, migración 009).
--
--   resolved_at → cuándo pasó a resuelto.
--   resolved_by → 'auto' (3 aciertos seguidos en ese tema del programa) o el
--                 id del docente que lo marcó a mano.
--
-- ES ADITIVA E IDEMPOTENTE
--
-- IF NOT EXISTS, NULL y sin DEFAULT: las filas que ya existen quedan como
-- estaban. Se puede correr dos veces.
--
-- LA VÁLVULA
--
-- Sin la 031, la regla automática y el botón del docente ponen `resolved` en
-- TRUE igual (esa columna es de la 009) y sólo falta el cuándo y el quién,
-- "Ya lo dominás" se lista sin fecha. Nada da 500.
--
-- QUIÉN ESCRIBE CADA COLUMNA (lección del roadmap: una columna que describe un
-- final tiene que nacer con su escritor)
--
--   resolved, resolved_at, resolved_by='auto' → lib/a-reforzar-server.ts, al
--       guardar un intento (app/api/quiz/save-result).
--   resolved, resolved_at, resolved_by=<docente> → PATCH
--       app/api/teacher/classrooms/[id]/students/[userId].
--   Volver a "a reforzar" (el docente se equivocó) los limpia: el mismo PATCH.
--
-- Uso:
--   npx tsx scripts/run-migration-031.ts --env=staging
--   npx tsx scripts/run-migration-031.ts            (producción: la corre Mauro)

ALTER TABLE student_misconceptions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_student_misconceptions_pendientes
  ON student_misconceptions(user_id)
  WHERE resolved = FALSE;
