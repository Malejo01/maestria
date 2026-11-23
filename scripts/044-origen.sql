-- Migration: De qué canal llegó cada persona (ronda V, V1)
-- Version: 044
-- Description: Los links de difusión llevan ?origen=ig|wa|fb|tt|li|yt|otro (y
-- ?ref=CODIGO, para los referidos de V3). La primera visita lo guarda en una
-- cookie por 30 días; al registrarse (Google o invitado que entra a un grupo)
-- queda acá. Lo lee /admin/embudo (por canal) y /admin/docentes.
--
-- ES ADITIVA E IDEMPOTENTE: ADD COLUMN IF NOT EXISTS. Correrla dos veces deja
-- lo mismo. No depende de ninguna de la 037 a la 043.
--
-- LA VÁLVULA (lib/origen-server.ts): sin la 044, el registro sigue igual y no
-- guarda el canal; el panel muestra a todos en "sin dato".

ALTER TABLE users ADD COLUMN IF NOT EXISTS origen TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS origen_ref TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS origen_el DATE;

COMMENT ON COLUMN users.origen IS 'V1 (ronda V): el canal del link de la primera visita (ig, wa, fb, tt, li, yt, otro). NULL: sin dato.';

COMMENT ON COLUMN users.origen_ref IS 'V1/V3 (ronda V): el código de referido del link de la primera visita, si había.';
