-- Migration: La respuesta larga (ensayo) y su corrección (ronda W, W5)
-- Version: 048
-- Description: El ensayo es el único tipo que no se corrige solo. La IA
-- sugiere una nota y una devolución por criterio de la rúbrica; el docente la
-- confirma o la cambia, y recién ahí el alumno la ve. Mientras tanto, la
-- respuesta queda sin calificar (`is_correct` NULL, como las de la 021).
--
-- 1. Amplía el CHECK de quiz_answers.question_type con 'essay' (mismo DROP/ADD
--    idempotente que la 042, con los 11 tipos de antes más éste).
-- 2. `correcciones_ensayo`: la sugerencia de la IA y la corrección confirmada,
--    una por respuesta.
--
-- ES ADITIVA E IDEMPOTENTE. No depende de la 042: el CHECK se vuelve a poner
-- entero (si la 042 no corrió, éste ya incluye sus tipos).
--
-- LA VÁLVULA: sin la 048, la respuesta de un ensayo se guarda como
-- `short_answer` con `answer_payload.tipo = 'essay'` (la de la 042,
-- lib/tipos-moodle-server.ts), y la cola de corrección dice que todavía no
-- está disponible (sin la tabla, no se sugiere ni se confirma nada).

ALTER TABLE quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_question_type_check;

ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_question_type_check CHECK (question_type IN ('multiple_choice', 'short_answer', 'true_false', 'numeric', 'multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'calculated', 'essay'));

CREATE TABLE IF NOT EXISTS correcciones_ensayo (
  id              SERIAL PRIMARY KEY,
  quiz_answer_id  INTEGER NOT NULL UNIQUE REFERENCES quiz_answers(id) ON DELETE CASCADE,
  teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sugerencia      JSONB,
  sugerida_el     TIMESTAMPTZ,
  correccion      JSONB,
  nota            NUMERIC(4, 2),
  confirmada_el   TIMESTAMPTZ,
  creado_el       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correcciones_ensayo_docente ON correcciones_ensayo (teacher_id, confirmada_el);

COMMENT ON TABLE correcciones_ensayo IS 'W5 (ronda W): la corrección de una respuesta larga: lo que sugirió la IA y lo que confirmó el docente (el alumno ve sólo lo confirmado).';
