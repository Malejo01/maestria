-- ─── Migración 021 — Respuestas sin calificar ────────────────────────────────
--
-- Hasta ahora una respuesta sólo podía ser correcta o incorrecta, y eso obligó
-- a mentir cada vez que la corrección no llegó a correr. `short_answer` se
-- corrige llamando a Gemini desde `/api/quiz/grade-short-answer`: cuando esa
-- llamada fallaba, el cliente escribía `is_correct = false` y el alumno quedaba
-- con una respuesta marcada mal que nadie había mirado.
--
-- ─── Qué NO se puede recuperar ───────────────────────────────────────────────
--
-- Esta migración NO tiene backfill, y no es una omisión: **las filas anteriores
-- no distinguen "incorrecta" de "sin calificar", y no hay forma de separarlas
-- retroactivamente.** Cuando la ruta devolvía 500 el cliente guardaba `false`
-- sin dejar ninguna marca de que la corrección había fallado, así que el dato
-- que permitiría diferenciarlas nunca se escribió.
--
-- En concreto: de la prueba del 2026-08-10, 225 de 238 respuestas cortas
-- quedaron en `false` y ahí se quedan. Se sabe por el reporte
-- `scripts/report-short-answer-regrade.ts` que 15 de ellas eran correctas
-- (coincidencia exacta con la respuesta esperada), pero de las otras 210 no se
-- puede afirmar nada: pueden ser errores genuinos o fallas de la API, y el
-- registro no alcanza para decidirlo. Toda lectura histórica de esas filas
-- tiene que tomarlas como lo que dicen ser —incorrectas— sabiendo que una parte
-- no lo es.
--
-- ─── Por qué NULL y no una columna nueva ─────────────────────────────────────
--
-- `is_correct` pasa de NOT NULL a nullable, y NULL significa "sin calificar",
-- que es literalmente lo que NULL quiere decir en SQL: desconocido.
--
-- La alternativa era dejar `is_correct = false` y marcar el estado en otra
-- columna. Se descartó por una razón práctica: con la lógica de tres valores,
-- un `WHERE NOT is_correct` escrito por cualquiera en el futuro **excluye** las
-- sin calificar, mientras que con un booleano en `false` las contaría como
-- errores. La opción elegida falla del lado seguro por construcción; la otra
-- depende de que todos se acuerden, y este bug existe justamente porque alguien
-- no se acordó.
ALTER TABLE quiz_answers
  ALTER COLUMN is_correct DROP NOT NULL;

COMMENT ON COLUMN quiz_answers.is_correct IS
  'true/false cuando la respuesta se corrigió; NULL = no se pudo corregir (ver answer_payload->>''gradingStatus''). Las filas anteriores a la migración 021 nunca son NULL: en esa época una falla de corrección se guardaba como false.';

-- El motivo va en `answer_payload`, que para `short_answer` ya es libre (ver
-- migración 013). No amerita columna propia: es metadato de un caso de borde,
-- no algo por lo que se filtre. La forma queda:
--   { "selectedText": ..., "acceptedAnswers": [...],
--     "gradingStatus": "ungraded", "gradingReason": "ai_unavailable" }

-- El conteo a nivel intento. Sin esto, `total_questions - correct_answers`
-- vuelve a contar las sin calificar como errores — el mismo bug, una tabla más
-- arriba. Con la columna, `total = correctas + incorrectas + sin_calificar`
-- cierra sin desarmar el JSONB de cada fila.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS ungraded_answers INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN quiz_attempts.ungraded_answers IS
  'Respuestas que no se pudieron corregir. Quedan fuera del numerador Y del denominador de score: un intento de 10 preguntas con 2 sin calificar se puntúa sobre 8.';

-- La consulta real es "mostrame qué quedó sin calificar", que sobre el total de
-- respuestas es una fracción chica. Índice parcial: sólo indexa las filas que
-- se buscan, y no crece con las millones de respuestas corregidas.
CREATE INDEX IF NOT EXISTS idx_quiz_answers_ungraded
  ON quiz_answers(quiz_attempt_id)
  WHERE is_correct IS NULL;
