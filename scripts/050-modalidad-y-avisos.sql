-- Migration: La modalidad del docente y los avisos guardados (tanda AC, AC1)
-- Version: 050
-- Description:
--   1. users.modalidad: cómo da clases el docente, 'particular' o 'curso'.
--      NULL (todos los de hoy) = la regla B1 de siempre (gratis: 2 particulares
--      + 1 curso de hasta 35). Con 'particular', todos sus alumnos nuevos
--      (también los que entran por el link) cuentan como particulares: gratis 2.
--      La escriben la bienvenida (PATCH /api/user/profile) y «Cómo das clases».
--   2. avisos_guardados: los avisos de la campanita que no se pueden deducir de
--      otros datos (el alumno que no entró por el cupo, AC1; el resumen de los
--      lunes, AC5). Uno por (user_id, clave): repetir no duplica. Los escriben
--      el ingreso por código (/api/classrooms/join) y el cron de los lunes.
--
-- ES ADITIVA E IDEMPOTENTE. No depende de la 037 a la 049.
--
-- LA VÁLVULA: sin la 050, la modalidad se lee como NULL (todo como hoy), la
-- bienvenida no pregunta, «Cómo das clases» no aparece y los avisos guardados
-- no se escriben ni se leen (lib/modalidad-server.ts, lib/avisos-guardados-server.ts).

ALTER TABLE users ADD COLUMN IF NOT EXISTS modalidad TEXT;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_modalidad_check') THEN ALTER TABLE users ADD CONSTRAINT users_modalidad_check CHECK (modalidad IS NULL OR modalidad IN ('particular', 'curso')); END IF; END $$;

COMMENT ON COLUMN users.modalidad IS 'AC1 (tanda AC): particular | curso | NULL (regla B1). La escriben la bienvenida y «Cómo das clases».';

CREATE TABLE IF NOT EXISTS avisos_guardados (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  clave      TEXT NOT NULL,
  titulo     TEXT NOT NULL,
  detalle    TEXT NOT NULL,
  href       TEXT NOT NULL,
  creado_el  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_avisos_guardados_user ON avisos_guardados (user_id, creado_el DESC);

COMMENT ON TABLE avisos_guardados IS 'AC1/AC5 (tanda AC): avisos de la campanita que no se deducen de otros datos. Los escriben /api/classrooms/join y /api/cron/aviso-semanal.';
