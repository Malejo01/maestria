-- Migration: Pulgar arriba / abajo del docente en cada pregunta (ronda O, O8)
-- Version: 033
-- Description: FASE 3 del roadmap ("loop de calidad"): el docente valora cada
-- pregunta en *Revisar y editar*. El pulgar abajo lleva un motivo, y los
-- últimos 10 pulgares abajo de ese docente en esa materia entran al prompt de
-- la generación como "Evitá esto".
--
--   docente_id          → quién valoró.
--   teacher_quiz_id     → el cuestionario (si se borra, se van sus valoraciones).
--   teacher_program_id  → la materia, para buscar "los de esta materia" sin JOIN.
--   indice              → la posición de la pregunta en el cuestionario.
--   valor               → 1 (arriba) o -1 (abajo).
--   motivo              → sólo en el pulgar abajo: uno de seis.
--   enunciado           → la consigna tal como estaba al valorarla (el
--                         cuestionario se puede editar después; el prompt
--                         necesita lo que el docente vio).
--   creado_el           → la última vez que se valoró.
--
-- Un docente tiene UNA valoración por pregunta (UNIQUE): tocar otra vez la cambia.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS. Se puede correr dos veces.
--
-- LA VÁLVULA
--
-- Sin la 033 (42P01): los pulgares no se muestran como guardados y guardar
-- responde que falta la migración, la generación no suma "Evitá esto" y
-- /admin/ai-usage no muestra el contador. Nada da 500.
--
-- QUIÉN ESCRIBE: app/api/teacher/quizzes/[id]/valoraciones (PUT y DELETE).
--
-- Uso:
--   npx tsx scripts/run-migration-033.ts --env=staging
--   npx tsx scripts/run-migration-033.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS pregunta_valoraciones (
  id                 SERIAL PRIMARY KEY,
  docente_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_quiz_id    INTEGER NOT NULL REFERENCES teacher_quizzes(id) ON DELETE CASCADE,
  teacher_program_id INTEGER NULL,
  indice             INTEGER NOT NULL CHECK (indice >= 0),
  valor              SMALLINT NOT NULL CHECK (valor IN (1, -1)),
  motivo             TEXT NULL CHECK (motivo IS NULL OR motivo IN ('fuera_del_programa', 'mal_redactada', 'respuesta_incorrecta', 'muy_facil', 'muy_dificil', 'tipo_equivocado')),
  enunciado          TEXT NOT NULL DEFAULT '',
  creado_el          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (docente_id, teacher_quiz_id, indice)
);

CREATE INDEX IF NOT EXISTS idx_pregunta_valoraciones_negativas
  ON pregunta_valoraciones(docente_id, teacher_program_id, creado_el DESC)
  WHERE valor = -1;
