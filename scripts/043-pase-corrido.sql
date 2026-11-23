-- Migration: El pase autodidacta se corre con la fecha del examen (ronda U, U2)
-- Version: 043
-- Description: Si el alumno cambia la fecha del examen con el pase pagado, el
-- pase se corre a la fecha nueva + 7 días, UNA SOLA VEZ POR PASE, y nunca se
-- acorta. Esta columna guarda cuándo se corrió; al acreditarse un pase nuevo
-- vuelve a NULL.
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN IF NOT EXISTS. Correrla dos veces deja
-- lo mismo.
--
-- NO DEPENDE DE LA 040 NI DE LA 041: la columna va en teacher_programs, que
-- existe desde siempre. En una base sin la 041 (sin pase_hasta) la columna
-- queda sin uso.
--
-- LA VÁLVULA (lib/autodidacta-server.ts, cambiarFechaDeExamen): sin la 043, la
-- fecha del examen se cambia igual y el pase NO se corre (lo conservador: no
-- se puede saber si ya se corrió una vez).

ALTER TABLE teacher_programs ADD COLUMN IF NOT EXISTS pase_corrido_el TIMESTAMPTZ;

COMMENT ON COLUMN teacher_programs.pase_corrido_el IS 'U2 (ronda U): cuándo se corrió el pase con la fecha del examen (una vez por pase). NULL: no se corrió.';
