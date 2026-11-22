-- Migration: La racha del alumno, en la base (ronda O, O4)
-- Version: 032
-- Description: Hasta acá la racha ("aprobadas seguidas") vivía sólo en el
-- localStorage del navegador: se perdía al cambiar de celular o al borrar los
-- datos, y un invitado que después creaba su cuenta empezaba de cero. Mauro
-- decidió (22/11) que la racha se queda pero se guarda en la base.
--
-- Una fila por alumno (cuenta o invitado). No hay racha por materia: hoy la
-- racha es una sola por alumno, y la regla no cambia (lib/racha.ts).
--
--   racha                → aprobadas seguidas, hoy.
--   mejor                → la más larga que tuvo.
--   migrada_de_local     → TRUE si el valor inicial salió del localStorage
--                          (se lee UNA vez, la primera vez que entra).
--   actualizada_el       → la última vez que cambió.
--
-- ES ADITIVA E IDEMPOTENTE: CREATE TABLE IF NOT EXISTS. Se puede correr dos veces.
--
-- LA VÁLVULA
--
-- Sin la 032 (42P01), save-result guarda el intento igual y no toca la racha,
-- la pantalla sigue mostrando la del navegador. Nada da 500.
--
-- QUIÉN ESCRIBE CADA COLUMNA
--
--   racha, mejor, actualizada_el → app/api/quiz/save-result (lib/racha-server.ts),
--       al guardar cada intento; y la primera migración desde el navegador.
--   migrada_de_local → app/api/student/racha (POST), una sola vez por alumno.
--
-- Uso:
--   npx tsx scripts/run-migration-032.ts --env=staging
--   npx tsx scripts/run-migration-032.ts            (producción: la corre Mauro)

CREATE TABLE IF NOT EXISTS rachas_alumno (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  racha            INTEGER NOT NULL DEFAULT 0 CHECK (racha >= 0),
  mejor            INTEGER NOT NULL DEFAULT 0 CHECK (mejor >= 0),
  migrada_de_local BOOLEAN NOT NULL DEFAULT FALSE,
  actualizada_el   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
