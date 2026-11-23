-- Migration: La materia de ejemplo (ronda V, V2)
-- Version: 045
-- Description: "Probar con una materia de ejemplo" crea, para el docente, una
-- materia, un grupo con alumnos ficticios que ya respondieron, una tarea y un
-- diagnóstico con resultados. Todo va marcado con `ejemplo = TRUE`:
--   teacher_programs.ejemplo  la materia
--   classrooms.ejemplo        el grupo
--   users.ejemplo             cada alumno ficticio
-- Lo marcado no cuenta para el plan, no aparece en la campanita, ni en el
-- embudo, ni en los números del admin, ni marca los hitos del docente; y se
-- borra con un botón (lib/materia-de-ejemplo-server.ts).
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN IF NOT EXISTS con DEFAULT FALSE. Lo que
-- ya existe queda en FALSE. No depende de ninguna de la 037 a la 044.
--
-- LA VÁLVULA: sin la 045, el botón no aparece (GET /api/teacher/ejemplo dice
-- `disponible: false`) y no se crea nada; las exclusiones leen la columna con
-- to_jsonb, así que tampoco fallan.

ALTER TABLE teacher_programs ADD COLUMN IF NOT EXISTS ejemplo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS ejemplo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS ejemplo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN teacher_programs.ejemplo IS 'V2 (ronda V): materia de ejemplo (contenido fijo, se borra con un botón). No cuenta para nada.';

COMMENT ON COLUMN classrooms.ejemplo IS 'V2 (ronda V): grupo de ejemplo con alumnos ficticios. No cuenta para el plan ni avisa.';

COMMENT ON COLUMN users.ejemplo IS 'V2 (ronda V): alumno ficticio de una materia de ejemplo.';
