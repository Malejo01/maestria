-- Migration: Destinatario individual de una asignación y de un diagnóstico
-- Version: 028
-- Description: Tanda L (L0). Un diagnóstico armado desde la ficha de UN alumno
--              es sólo para ese alumno, aunque comparta el grupo con otros 15.
--              Hasta acá toda asignación era del grupo entero: los cuestionarios
--              del diagnóstico de un alumno particular los veía todo el grupo.
--
-- ES ADITIVA E IDEMPOTENTE
--
-- Columnas nuevas con IF NOT EXISTS (todas NULL, sin DEFAULT: las filas que ya
-- existen quedan como estaban, del grupo), índices con IF NOT EXISTS, y el
-- CHECK se borra y se vuelve a crear (NOT VALID + VALIDATE): Postgres no tiene
-- ADD CONSTRAINT IF NOT EXISTS. Se puede correr dos veces.
--
-- SIN BACKFILL, a propósito: las asignaciones de diagnóstico que ya existen
-- (en producción, las 5 a 11) siguen siendo del grupo hasta que Mauro decida.
--
-- LA REGLA (lib/destinatario.ts, pura y con tests)
--
--   solo_user_id y solo_invitacion_id en NULL → la asignación es del grupo.
--   Con uno cargado → es sólo para esa persona. Una invitación que todavía no
--   se reclamó no la ve nadie: no hay alumno detrás.
--
-- LA VÁLVULA
--
-- Las lecturas leen estas columnas con `to_jsonb(a) ->> 'solo_user_id'`: sin
-- la 028 la clave no existe, da NULL, y todo es del grupo, como hoy. Armar un
-- diagnóstico INDIVIDUAL sin la 028 responde 409 (no hay dónde guardar el
-- destinatario); el del grupo sigue andando. Nada da 500 porque falte.
--
-- QUIÉN ESCRIBE CADA COSA (ver "Lecciones operativas" del roadmap)
--
--   classroom_assignments.solo_user_id / solo_invitacion_id
--     guardarYAsignar (lib/diagnostico-server.ts), con el destinatario del
--     diagnóstico. Cuando la invitación se usa ("Soy yo" al entrar, K5, o al
--     guardar la ficha del alumno, J2), traspasarDestinatario
--     (lib/destinatario-server.ts) pasa solo_invitacion_id → solo_user_id.
--     Cuando un invitado crea su cuenta, /api/student/guest/claim pasa
--     solo_user_id del invitado a la cuenta.
--
--   diagnosticos.user_id / invitation_id
--     crearDiagnostico, y los mismos dos traspasos de arriba.
--
-- Las dos columnas de invitación son ON DELETE CASCADE, como en fichas_alumno:
-- borrar la invitación de alguien que nunca entró se lleva su diagnóstico. Por
-- eso el traspaso corre ANTES de borrar la invitación usada.

-- ─── 1. A quién va una asignación ────────────────────────────────────────────

ALTER TABLE classroom_assignments
  ADD COLUMN IF NOT EXISTS solo_user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS solo_invitacion_id INTEGER NULL REFERENCES classroom_invitations(id) ON DELETE CASCADE;

ALTER TABLE classroom_assignments DROP CONSTRAINT IF EXISTS classroom_assignments_un_destinatario;

ALTER TABLE classroom_assignments
  ADD CONSTRAINT classroom_assignments_un_destinatario
  CHECK (solo_user_id IS NULL OR solo_invitacion_id IS NULL) NOT VALID;

ALTER TABLE classroom_assignments VALIDATE CONSTRAINT classroom_assignments_un_destinatario;

CREATE INDEX IF NOT EXISTS idx_assignments_solo_user ON classroom_assignments(solo_user_id) WHERE solo_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_solo_inv ON classroom_assignments(solo_invitacion_id) WHERE solo_invitacion_id IS NOT NULL;

COMMENT ON COLUMN classroom_assignments.solo_user_id IS 'Si está, la asignación es sólo para este alumno (L0). Con las dos en NULL es del grupo.';

COMMENT ON COLUMN classroom_assignments.solo_invitacion_id IS 'Sólo para quien entre por esta invitación. Pasa a solo_user_id cuando la invitación se usa.';

-- ─── 2. De quién es un diagnóstico ───────────────────────────────────────────

ALTER TABLE diagnosticos
  ADD COLUMN IF NOT EXISTS user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invitation_id INTEGER NULL REFERENCES classroom_invitations(id) ON DELETE CASCADE;

ALTER TABLE diagnosticos DROP CONSTRAINT IF EXISTS diagnosticos_un_destinatario;

ALTER TABLE diagnosticos
  ADD CONSTRAINT diagnosticos_un_destinatario
  CHECK (user_id IS NULL OR invitation_id IS NULL) NOT VALID;

ALTER TABLE diagnosticos VALIDATE CONSTRAINT diagnosticos_un_destinatario;

CREATE INDEX IF NOT EXISTS idx_diagnosticos_user ON diagnosticos(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diagnosticos_invitation ON diagnosticos(invitation_id) WHERE invitation_id IS NOT NULL;

COMMENT ON COLUMN diagnosticos.user_id IS 'El alumno del diagnóstico individual (L0). Con user_id e invitation_id en NULL, el diagnóstico es del grupo.';
