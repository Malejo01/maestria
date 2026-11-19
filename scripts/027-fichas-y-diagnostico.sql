-- Migration: Ficha del alumno y diagnóstico inicial
-- Version: 027
-- Description: Tanda J. La ficha pedagógica de cada alumno (por docente), el
--              diagnóstico inicial de un grupo, los resultados cargados a mano
--              desde la versión impresa, y quitar alumnos sin borrar su historia.
--
-- ES ADITIVA E IDEMPOTENTE
--
-- Tablas nuevas con IF NOT EXISTS, columnas nuevas con IF NOT EXISTS (las que
-- son NOT NULL traen DEFAULT, así las filas existentes quedan válidas), índices
-- con IF NOT EXISTS y un único backfill con ON CONFLICT DO NOTHING. Ninguna
-- restricción existente cambia. Se puede correr dos veces.
--
-- LA VÁLVULA (la misma idea que la 026)
--
-- El código de la tanda J trata la falta de cualquier objeto de esta migración
-- como "la función todavía no está": sin `fichas_alumno` la ficha sigue siendo
-- el campo único de siempre; sin `diagnosticos` no aparece "Armar diagnóstico";
-- sin `classroom_members.removed_at` quitar a un alumno usa `status` y
-- `updated_at`. Nada responde 500 porque falte. Correrla en producción es lo
-- que enciende la ficha y el diagnóstico; la corre Mauro.
--
-- QUIÉN ESCRIBE CADA COSA (ver "Lecciones operativas" del roadmap)
--
--   classroom_members.removed_at
--     La escribe quitarAlumno (lib/alumnos-docente-server.ts), al quitar a un
--     alumno de los grupos del docente. "Volver a sumar" la deja en NULL; si el
--     alumno vuelve solo con el link del grupo (que no se tocó), queda el valor
--     viejo. Por eso sólo se lee junto con status = 'removed': en la lista
--     "Quitados" de Mis alumnos.
--
--   fichas_alumno
--     La escribe PUT /api/teacher/fichas (lib/fichas-server.ts). Una ficha
--     armada para una invitación pasa al alumno (user_id) cuando el docente la
--     guarda de nuevo después de que el alumno entró. El backfill de abajo copia
--     el `contexto` que ya existía a `observaciones`.
--
--   diagnosticos, teacher_quizzes.tipo/diagnostico_id/unidad_id
--     `diagnosticos` lo escribe POST /api/teacher/diagnosticos; cada
--     cuestionario, POST /api/teacher/diagnosticos/[id]/cuestionarios.
--     `tipo` vale 'tarea' para todo lo demás (el DEFAULT); el motor de
--     cuestionarios lo lee para no mostrar la devolución hasta el final.
--
--   diagnostico_resultados_impresos
--     Los escribe POST /api/teacher/diagnosticos/impreso/[quizId], cuando el
--     docente carga bien / mal / sin responder desde el papel.
--
-- LO QUE A PROPÓSITO NO HAY
--
--   Ninguna columna de "aceptada" en las invitaciones: la ficha de una
--   invitación se encuentra al leer, por el mismo cruce de nombre con el que
--   hoy el alumno hereda el contexto (025).
--
--   Ninguna columna de cierre en `diagnosticos`: un diagnóstico no "termina",
--   es la foto del punto de partida. Si hace falta saber si alguien lo rindió,
--   se mira quiz_attempts.

-- ─── 1. Quitar alumnos sin borrar su historia ────────────────────────────────

ALTER TABLE classroom_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

COMMENT ON COLUMN classroom_members.removed_at IS 'Cuándo el docente lo quitó de sus grupos. Sólo significa algo con status = removed. Lo escribe quitarAlumno.';

-- ─── 2. La ficha del alumno ──────────────────────────────────────────────────
-- Una por docente y alumno. Antes de que el alumno entre, cuelga de la
-- invitación. Nunca guarda el nombre: el nombre vive donde vivía siempre
-- (classroom_members.display_name, classroom_invitations.nombre).
--
-- invitation_id es ON DELETE CASCADE y no SET NULL: una ficha que sólo tiene
-- invitación quedaría con las dos columnas en NULL y violaría el CHECK, y el
-- borrado de la invitación fallaría. Si el docente quita a alguien que nunca
-- entró, su ficha se va con él.

CREATE TABLE IF NOT EXISTS fichas_alumno (
  id               SERIAL PRIMARY KEY,
  teacher_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  invitation_id    INTEGER REFERENCES classroom_invitations(id) ON DELETE CASCADE,
  edad             SMALLINT CHECK (edad IS NULL OR (edad > 0 AND edad < 120)),
  anio_cursa       TEXT,
  institucion      TEXT,
  orientacion      TEXT,
  materia_id       INTEGER REFERENCES teacher_programs(id) ON DELETE SET NULL,
  fecha_examen     DATE,
  como_evalua      TEXT,
  temas_dificiles  JSONB NOT NULL DEFAULT '[]',
  observaciones    TEXT,
  contacto         TEXT,
  responsable      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR invitation_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS fichas_alumno_docente_alumno ON fichas_alumno(teacher_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fichas_alumno_invitacion ON fichas_alumno(invitation_id) WHERE invitation_id IS NOT NULL;

COMMENT ON TABLE fichas_alumno IS 'Ficha pedagógica de un alumno, por docente. Sólo los campos edad, anio_cursa, orientacion, como_evalua y temas_dificiles van a la IA; nombre, contacto, responsable e institución nunca. La escribe PUT /api/teacher/fichas.';

COMMENT ON COLUMN fichas_alumno.temas_dificiles IS 'Ids de temas (teacher_programs.units[].topics[].id) de la materia elegida.';

-- El contexto que ya existía pasa a observaciones, para no perder nada. Uno por
-- docente y alumno: si el alumno tiene contexto en dos grupos del mismo
-- docente, gana el más reciente.
INSERT INTO fichas_alumno (teacher_id, user_id, observaciones)
SELECT DISTINCT ON (c.teacher_id, m.user_id) c.teacher_id, m.user_id, btrim(m.contexto)
FROM classroom_members m
JOIN classrooms c ON c.id = m.classroom_id
WHERE m.contexto IS NOT NULL AND btrim(m.contexto) <> '' AND m.user_id <> c.teacher_id
ORDER BY c.teacher_id, m.user_id, m.updated_at DESC NULLS LAST
ON CONFLICT (teacher_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

INSERT INTO fichas_alumno (teacher_id, invitation_id, observaciones)
SELECT c.teacher_id, i.id, btrim(i.contexto)
FROM classroom_invitations i
JOIN classrooms c ON c.id = i.classroom_id
WHERE i.contexto IS NOT NULL AND btrim(i.contexto) <> ''
ON CONFLICT (invitation_id) WHERE invitation_id IS NOT NULL DO NOTHING;

-- ─── 3. El diagnóstico de un grupo ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diagnosticos (
  id                 SERIAL PRIMARY KEY,
  teacher_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  classroom_id       INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  teacher_program_id INTEGER NOT NULL REFERENCES teacher_programs(id) ON DELETE CASCADE,
  modo               TEXT NOT NULL CHECK (modo IN ('por_unidad', 'integral')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_classroom ON diagnosticos(classroom_id);

COMMENT ON TABLE diagnosticos IS 'Diagnóstico inicial de un grupo: uno o varios teacher_quizzes con tipo = diagnostico. Lo escribe POST /api/teacher/diagnosticos.';

-- ─── 4. El diagnóstico es un cuestionario con otro tipo ──────────────────────

ALTER TABLE teacher_quizzes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'tarea';

ALTER TABLE teacher_quizzes ADD COLUMN IF NOT EXISTS diagnostico_id INTEGER REFERENCES diagnosticos(id) ON DELETE CASCADE;

ALTER TABLE teacher_quizzes ADD COLUMN IF NOT EXISTS unidad_id TEXT;

CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_diagnostico ON teacher_quizzes(diagnostico_id) WHERE diagnostico_id IS NOT NULL;

COMMENT ON COLUMN teacher_quizzes.tipo IS 'tarea (todo lo de siempre) o diagnostico. El diagnóstico se rinde sin devolución hasta el final.';

-- ─── 5. Resultados cargados a mano desde la versión impresa ──────────────────
-- No entran a topic_mastery ni a student_misconceptions: no hay respuesta real
-- para diagnosticar el error, sólo bien o mal. Quedan en el resultado del
-- diagnóstico y nada más. Como la ficha, cuelgan de la invitación si el alumno
-- todavía no entró (y se van con ella).

CREATE TABLE IF NOT EXISTS diagnostico_resultados_impresos (
  id               SERIAL PRIMARY KEY,
  teacher_quiz_id  INTEGER NOT NULL REFERENCES teacher_quizzes(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  invitation_id    INTEGER REFERENCES classroom_invitations(id) ON DELETE CASCADE,
  respuestas       JSONB NOT NULL,
  cargado_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR invitation_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_diagnostico_impresos_quiz ON diagnostico_resultados_impresos(teacher_quiz_id);

COMMENT ON COLUMN diagnostico_resultados_impresos.respuestas IS '{ "<índice de pregunta>": "bien" | "mal" | "sin_responder" }. Lo escribe POST /api/teacher/diagnosticos/impreso/[quizId].';
