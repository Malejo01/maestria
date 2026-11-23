-- Migration: Los tipos de pregunta "como en Moodle" (ronda T, F2 a F7)
-- Version: 042
-- Description: La 013 dejó en quiz_answers.question_type un CHECK con los
-- cuatro tipos de siempre. Esta lo amplía, de una sola vez, con los tipos de
-- F2 a F7, para que una respuesta de esos tipos se guarde con su tipo:
--
--   multiple_response   opción múltiple con varias correctas (F2)
--   matching            emparejamiento (F3)
--   ordering            ordenamiento (F4)
--   gapselect           seleccionar la palabra de cada hueco (F5)
--   ddwtos              arrastrar palabras a los huecos (F5)
--   missing_word        la palabra faltante (F6)
--   calculated          calculada, con comodines (F7)
--
-- ES IDEMPOTENTE: saca el CHECK (IF EXISTS) y lo vuelve a poner con la lista
-- completa. Correrla dos veces deja lo mismo. Es aditiva: todo lo que el
-- CHECK de antes aceptaba lo sigue aceptando.
--
-- LA VÁLVULA (lib/tipos-moodle-server.ts): sin la 042, una respuesta de estos
-- tipos se guarda como `short_answer`, con el tipo real en
-- `answer_payload.tipo` y lo elegido y lo correcto en texto. No se pierde nada.
--
-- Uso:
--   npx tsx scripts/run-migration-042.ts --env=staging
--   npx tsx scripts/run-migration-042.ts            (producción: la corre Mauro)

ALTER TABLE quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_question_type_check;

ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_question_type_check CHECK (question_type IN ('multiple_choice', 'short_answer', 'true_false', 'numeric', 'multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos', 'missing_word', 'calculated'));
