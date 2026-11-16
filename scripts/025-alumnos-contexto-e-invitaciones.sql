-- Migration: Contexto del alumno e invitaciones
-- Version: 025
-- Description: Lo que el docente escribe cuando agrega a un alumno ("Análisis I ·
--              rinde el 12/12"), y los alumnos que agregó pero todavía no entraron.
--
-- POR QUÉ
--
-- El panel del docente pasa a organizarse por personas (Mis alumnos), no por
-- materias. La fila de cada persona muestra qué prepara y para cuándo, y eso es
-- texto libre que escribe el docente: no se puede deducir de nada. Y el docente
-- agrega a un alumno ANTES de que el alumno exista en el sistema —le pasa el
-- link después—, así que hace falta dónde guardar ese nombre mientras tanto.
--
-- Es aditiva: una columna nueva que admite NULL y una tabla nueva. No toca
-- ninguna fila existente ni cambia ninguna restricción, así que el código viejo
-- sigue funcionando igual contra una base con o sin esta migración aplicada.
--
-- QUIÉN ESCRIBE CADA COSA (la regla de "Lecciones operativas" del roadmap: una
-- columna nueva nombra a quien la escribe, o declara que todavía no existe)
--
--   classroom_members.contexto
--     Lo escribe PATCH /api/teacher/alumnos/[userId], cuando el docente edita
--     qué prepara un alumno desde su ficha.
--
--   classroom_invitations
--     Las crea POST /api/teacher/alumnos y las borra
--     DELETE /api/teacher/alumnos/invitaciones/[id].
--
-- LO QUE A PROPÓSITO NO HAY
--
-- No hay columna "aceptada". Una invitación no se marca como usada: cuando en
-- el grupo aparece un miembro con el mismo nombre, la lista los funde al leer
-- (lib/alumnos-docente.ts) y el miembro hereda el contexto. Una columna de
-- cierre obligaría a tocar el ingreso al grupo, que está en uso, para que
-- alguien la escriba — y si nadie la escribe, miente.

ALTER TABLE classroom_members
  ADD COLUMN IF NOT EXISTS contexto TEXT;

COMMENT ON COLUMN classroom_members.contexto IS 'Qué prepara el alumno y para cuándo, en palabras del docente. Texto libre. Lo escribe PATCH /api/teacher/alumnos/[userId].';

CREATE TABLE IF NOT EXISTS classroom_invitations (
  id           SERIAL PRIMARY KEY,
  classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  contexto     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classroom_invitations_classroom ON classroom_invitations(classroom_id);

COMMENT ON TABLE classroom_invitations IS 'Alumnos que el docente agregó por nombre y todavía no entraron al grupo. Sin columna de aceptada: se funden con el miembro del mismo nombre al leer.';
