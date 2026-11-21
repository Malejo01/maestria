-- Migration: Lo que salió del uso real con alumnos (tanda M)
-- Version: 029
-- Description: Dos cosas, las dos aditivas.
--
--   M1 · `quiz_attempts.client_attempt_id`: el id que el navegador del alumno
--        genera ANTES del primer envío del resultado y repite en cada
--        reintento. Con conexión inestable el mismo resultado puede llegar dos
--        veces (el primer POST se guardó pero la respuesta no volvió); el índice
--        único hace que el segundo no cree otro intento: save-result devuelve el
--        que ya estaba.
--
--   M6 · Contexto del reporte en `feedback_reports`: de qué cuestionario,
--        asignación y grupo es la pregunta reportada, y su número. Hasta acá el
--        reporte guardaba sólo `question_id` ("q3") y había que cruzar intentos
--        a mano para saber de qué cuestionario era.
--
-- ES ADITIVA E IDEMPOTENTE
--
-- Todo con IF NOT EXISTS, todo NULL y sin DEFAULT: las filas que ya existen
-- quedan como estaban. Se puede correr dos veces.
--
-- LA VÁLVULA
--
-- Sin la 029, save-result ignora `clientAttemptId` y guarda como hoy (el
-- borrador local y los reintentos del navegador no dependen de la base), y el
-- reporte se guarda sin el contexto. Nada da 500 porque falte.
--
-- QUIÉN ESCRIBE CADA COLUMNA (lección del roadmap: una columna sin escritor es
-- letra muerta desde el día uno)
--
--   client_attempt_id → app/api/quiz/save-result (M1).
--   teacher_quiz_id, assignment_id, classroom_id, question_index →
--                       app/api/feedback (M6), desde el botón de reportar.
--   status 'visto' / 'resuelto' → app/api/admin/reportes/[id] (M6).
--
-- Uso:
--   npx tsx scripts/run-migration-029.ts --env=staging
--   npx tsx scripts/run-migration-029.ts            (producción: la corre Mauro)

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS client_attempt_id TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_client_attempt
  ON quiz_attempts(client_attempt_id) WHERE client_attempt_id IS NOT NULL;

-- M6: contexto del reporte
ALTER TABLE feedback_reports
  ADD COLUMN IF NOT EXISTS teacher_quiz_id INTEGER NULL REFERENCES teacher_quizzes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_id INTEGER NULL REFERENCES classroom_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classroom_id INTEGER NULL REFERENCES classrooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS question_index INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_reports_classroom
  ON feedback_reports(classroom_id) WHERE classroom_id IS NOT NULL;

-- M6: los estados del buzón son nuevo → visto → resuelto. La 019 había
-- previsto 'revisado' y 'descartado', que nadie escribió nunca (los 9 reportes
-- de producción están en 'nuevo'). El CHECK se amplía —no se achica— para que
-- cualquier fila que alguien haya marcado a mano siga siendo válida; la app
-- lee 'revisado' como visto y 'descartado' como resuelto. Se borra y se vuelve
-- a crear (Postgres no tiene ADD CONSTRAINT IF NOT EXISTS): idempotente.
ALTER TABLE feedback_reports DROP CONSTRAINT IF EXISTS feedback_reports_status_check;

ALTER TABLE feedback_reports
  ADD CONSTRAINT feedback_reports_status_check
  CHECK (status IN ('nuevo', 'visto', 'resuelto', 'revisado', 'descartado')) NOT VALID;

ALTER TABLE feedback_reports VALIDATE CONSTRAINT feedback_reports_status_check;
