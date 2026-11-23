-- Migration: El informe compartido con el alumno y la familia (ronda V, V4)
-- Version: 047
-- Description: Desde la ficha, "Compartir informe" arma un link de sólo
-- lectura y sin login (/informe/<token>) con lo que practicó el alumno, lo que
-- domina, lo que tiene que reforzar y los próximos pasos que escribe el
-- docente. El link vence a los 30 días y se puede revocar.
--
-- El token no se guarda: se guarda su SHA-256 (`token_hash`). Una copia de la
-- base no alcanza para abrir ningún informe.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS. No depende de
-- ninguna de la 037 a la 046.
--
-- LA VÁLVULA (lib/informe-familia-server.ts): sin la 047, el botón no aparece
-- en la ficha y /informe/<token> dice que el link no existe.

CREATE TABLE IF NOT EXISTS informes_compartidos (
  id              SERIAL PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alumno_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proximos_pasos  TEXT NOT NULL DEFAULT '',
  creado_el       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vence_el        TIMESTAMPTZ NOT NULL,
  revocado_el     TIMESTAMPTZ,
  visto_el        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_informes_compartidos_alumno ON informes_compartidos (teacher_id, alumno_id);

COMMENT ON TABLE informes_compartidos IS 'V4 (ronda V): links de sólo lectura del informe de un alumno para él y su familia (vencen a los 30 días, se revocan). Se guarda el hash del token, nunca el token.';
