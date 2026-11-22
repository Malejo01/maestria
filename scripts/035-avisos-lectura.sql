-- Migration: Lectura de avisos para todos los roles (tanda P, P3)
-- Version: 035
-- Description: La campanita deja de ser sólo del docente: el alumno (con
-- cuenta o invitado) también tiene la suya (P3). Los avisos se siguen
-- calculando de lo que ya está en la base; lo único que se guarda es hasta
-- cuándo los marcó como leídos, para contar los no leídos.
--
--   avisos_lectura (user_id PK, visto_el) → la última vez que tocó
--   "Marcar todo como leído", para cualquier rol (docente, alumno, invitado).
--
-- Lo que la 034 guardaba para el docente (users.avisos_docente_visto_el) se
-- COPIA acá en esta misma migración. La columna de la 034 no se borra: es la
-- válvula del docente mientras la 035 no corra, y borrarla rompería un
-- despliegue anterior que todavía la lee. Desde la 035 el código lee de
-- avisos_lectura y escribe sólo ahí.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE IF NOT EXISTS; la copia es un
-- upsert que se queda con la fecha más nueva. Se puede correr dos veces. Si la
-- 034 no corrió, la copia no hace nada (el bloque mira primero si la columna
-- existe).
--
-- LA VÁLVULA (lib/avisos/lectura-server.ts)
--
-- Sin la 035 (42P01): el docente usa la columna de la 034; el alumno ve la
-- campanita con sus avisos pero sin "no leídos" ni "Marcar todo como leído".
-- Nada da 500.
--
-- QUIÉN ESCRIBE LA TABLA: POST /api/teacher/avisos y POST /api/avisos
-- ("Marcar todo como leído"), por lib/avisos/lectura-server.ts.
--
-- Uso:
--   npx tsx scripts/run-migration-035.ts --env=staging
--   npx tsx scripts/run-migration-035.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS avisos_lectura (
  user_id  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visto_el TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE avisos_lectura IS 'P3: hasta cuándo cada persona (docente, alumno o invitado) marcó sus avisos como leídos. Lo escriben POST /api/teacher/avisos y POST /api/avisos.';

-- El bloque va en una sola línea a propósito: el runner parte el archivo por
-- ";" + salto de línea, y un DO de varias líneas quedaría partido.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'avisos_docente_visto_el') THEN INSERT INTO avisos_lectura (user_id, visto_el) SELECT id, avisos_docente_visto_el FROM users WHERE avisos_docente_visto_el IS NOT NULL ON CONFLICT (user_id) DO UPDATE SET visto_el = GREATEST(avisos_lectura.visto_el, EXCLUDED.visto_el); END IF; END $$;
