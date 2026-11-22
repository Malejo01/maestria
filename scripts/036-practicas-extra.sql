-- Migration: Prácticas extra de una tarea (tanda P, P4)
-- Version: 036
-- Description: Al terminar una tarea, el alumno (con cuenta o invitado) puede
-- "Practicar otra vez con preguntas nuevas": la misma configuración de la
-- tarea (temas, nivel, modo, tipos, cantidad, la materia del grupo) con
-- preguntas distintas. NO es un intento de la tarea: no cambia la nota ni el
-- conteo de intentos. Se guarda como práctica del grupo (assignment_id NULL,
-- classroom_id del grupo) y se ve aparte, como "Prácticas extra".
--
--   practicas_extra              → una fila por práctica pedida (reserva).
--                                  Es lo que cuenta el tope: 3 por alumno, por
--                                  tarea y por día. Se cuenta la reserva y no
--                                  el intento terminado porque lo que cuesta
--                                  es generar, no terminar.
--   quiz_attempts.practica_extra_id → el intento que salió de esa práctica.
--                                  Con esto el informe del grupo y la ficha
--                                  cuentan "Prácticas extra" por tarea.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS, ADD COLUMN IF
-- NOT EXISTS (NULL, sin DEFAULT: ningún intento existente cambia). Se puede
-- correr dos veces.
--
-- LA VÁLVULA (lib/practica-extra-server.ts)
--
-- Sin la 036 (42P01 / 42703): el botón no aparece y el guardado de intentos
-- sigue exactamente igual. Nada da 500.
--
-- QUIÉN ESCRIBE: POST /api/student/practica-extra (la reserva) y
-- POST /api/quiz/save-result (el vínculo del intento).
--
-- Uso:
--   npx tsx scripts/run-migration-036.ts --env=staging
--   npx tsx scripts/run-migration-036.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS practicas_extra (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES classroom_assignments(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creada_el     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practicas_extra_tope ON practicas_extra(user_id, assignment_id, creada_el);

COMMENT ON TABLE practicas_extra IS 'P4: "Practicar otra vez con preguntas nuevas" de una tarea. Una fila por práctica pedida; el tope (3 por alumno, tarea y día) cuenta estas filas. La escribe POST /api/student/practica-extra.';

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS practica_extra_id INTEGER NULL REFERENCES practicas_extra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_practica_extra ON quiz_attempts(practica_extra_id) WHERE practica_extra_id IS NOT NULL;

COMMENT ON COLUMN quiz_attempts.practica_extra_id IS 'P4: el intento salió de una práctica extra de una tarea (assignment_id queda NULL: no es un intento de la tarea). Lo escribe POST /api/quiz/save-result.';
