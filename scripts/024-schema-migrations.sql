-- Migration: Registro de migraciones aplicadas
-- Version: 024
-- Description: Una fila por migración corrida, para que "¿la base está al día?"
--              se responda leyendo un registro en vez de deduciéndolo.
--
-- POR QUÉ, SI YA EXISTE check-schema-drift.ts
--
-- El chequeo de drift deduce: arma el esquema que declaran los `0NN-*.sql` y lo
-- compara contra el catálogo. Eso alcanza para las dos fallas que ya tuvimos
-- —tabla que falta (019), columna que falta (023)— y no alcanza para el resto
-- de lo que hace una migración:
--
--   * índices          (`CREATE INDEX IF NOT EXISTS ...`)
--   * constraints      (la 022 agrega `curriculum_fila_unica`)
--   * COMMENT ON       (la 023 documenta la columna en la propia base)
--   * backfills        (la 008 hace `UPDATE users SET name = display_name`)
--
-- Una migración que sólo haga eso pasa el chequeo de drift sin haberse corrido.
-- Un registro no deduce nada: o la fila está o no está.
--
-- POR QUÉ NO ES UN FRAMEWORK DE MIGRACIONES
--
-- Sigue sin haberlo, y sigue siendo a propósito. Esto es una tabla y un helper
-- de ~40 líneas; los runners se siguen corriendo a mano, con el guardrail de
-- `db-target.ts` intacto. Lo único que cambia es que ahora dejan rastro.
--
-- `checksum` guarda el SHA-256 del .sql tal como estaba al aplicarse. No sirve
-- para detectar que falta una migración —para eso está `version`— sino para
-- detectar lo contrario: que alguien editó una migración YA aplicada, con lo
-- cual el repo y la base dicen cosas distintas y nadie se entera.
--
-- Las migraciones sin archivo .sql (la 018, que vive entera en su runner)
-- guardan el checksum del runner. Se marca cuál de los dos se midió en
-- `filename`.

CREATE TABLE IF NOT EXISTS schema_migrations (
  -- Los tres dígitos, como texto: '009' ordena bien y no pierde el cero.
  version     TEXT PRIMARY KEY,
  -- Archivo cuyo contenido se midió: el .sql, o el runner cuando no hay .sql.
  filename    TEXT NOT NULL,
  checksum    TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'runner' cuando la escribió el propio run-migration-NNN.ts, 'backfill'
  -- cuando la dedujo scripts/backfill-schema-migrations.ts sobre una base que
  -- ya tenía la migración aplicada de antes. La distinción importa: una fila de
  -- backfill es una inferencia, no un testimonio.
  source      TEXT NOT NULL DEFAULT 'runner' CHECK (source IN ('runner', 'backfill'))
);

COMMENT ON TABLE schema_migrations IS
  'Una fila por migración aplicada. La escribe cada run-migration-NNN.ts al terminar; scripts/backfill-schema-migrations.ts cubre las anteriores a la 024.';
