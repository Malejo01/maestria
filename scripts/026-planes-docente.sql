-- Migration: Planes del docente
-- Version: 026
-- Description: Nivel de plan, vencimiento, inicio de la prueba y notas de
--              acreditación, sobre `users`.
--
-- POR QUÉ
--
-- Tanda G: cobrarle a un docente sin facturación automática. Mauro acredita a
-- mano desde /admin/planes después de que el docente paga por un link de
-- MercadoPago; estas columnas guardan lo que acreditó y hasta cuándo.
--
-- CORRERLA ES LO QUE ENCIENDE EL COBRO
--
-- El código (lib/planes.ts) trata como `exento` a cualquier docente cuyo
-- `plan_nivel` no se pueda leer: columna inexistente, nula o consulta fallida.
-- Así el código puede estar en `main` antes que esta migración en producción
-- sin cerrarle nada a nadie. Al correrla, todo docente queda en nivel 0 con la
-- prueba sin arrancar: la prueba de 30 días empieza cuando ve el aviso (G2).
--
-- Es aditiva e idempotente: columnas nuevas con IF NOT EXISTS. `plan_nivel`
-- tiene DEFAULT 0, así que las filas existentes quedan en 0 y ninguna
-- restricción cambia. Los alumnos también reciben la columna: no se lee para
-- ellos.
--
-- QUIÉN ESCRIBE CADA COLUMNA (ver "Lecciones operativas" del roadmap)
--
--   plan_nivel, plan_vence_el  → /admin/planes (lib/planes-server.ts, acreditarPlan)
--                                y el aviso de prueba (iniciarPrueba): nivel 0, +30 días
--   prueba_iniciada_el         → iniciarPrueba, una sola vez
--   plan_notas                 → acreditarPlan: agrega una línea por acreditación

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_nivel SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_vence_el TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS prueba_iniciada_el TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_notas TEXT;

COMMENT ON COLUMN users.plan_nivel IS 'Plan del docente: 0 prueba (10 alumnos), 1-4 bloques de 5 alumnos, 5 tope (150). Lo escriben /admin/planes y el aviso de prueba.';

COMMENT ON COLUMN users.plan_vence_el IS 'Hasta cuándo vale el plan. Nulo: no vence (prueba sin arrancar, o acreditado sin fecha).';

COMMENT ON COLUMN users.prueba_iniciada_el IS 'Cuándo aceptó el aviso de la prueba de 30 días. Nulo: todavía no lo vio.';

COMMENT ON COLUMN users.plan_notas IS 'Historial de acreditaciones a mano: una línea por acreditación, con quién, cuándo y con qué pagó.';
