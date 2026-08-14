-- Migration: Carrera y contexto profesional en el currículum
-- Version: 022
-- Description: Habilita currículos de nivel Superior por carrera, y les da un
--              lugar donde guardar la aplicación profesional de cada unidad.
--
-- Por qué una columna `carrera` y no meterla en `materia`:
--
-- `jurisdiccion` significa "diseño curricular oficial de una provincia". El
-- programa de una cátedra de un instituto terciario NO es eso, y cargarlo con
-- jurisdiccion='Salta' lo vuelve indistinguible del diseño oficial salteño —
-- además de chocar con cualquier currículum Superior provincial que se cargue
-- después. `carrera` es el discriminante que faltaba: NULL para todo K-12, que
-- no tiene carrera, y con valor para Superior.
--
-- La alternativa era codificar la carrera dentro del nombre de la materia
-- ("Matemática Análisis de Sistemas 1er año"). Se descartó porque deja la
-- separación a cargo del alumno: un estudiante de Enfermería vería la materia
-- en su selector y tendría que darse cuenta de que no es la suya. Con una
-- columna, elige su carrera y las demás no existen para él.

ALTER TABLE curriculum
  ADD COLUMN IF NOT EXISTS carrera TEXT;

COMMENT ON COLUMN curriculum.carrera IS
  'Carrera terciaria/universitaria a la que pertenece la fila. NULL para Primario y Secundario, que se organizan por grado y no por carrera.';

-- Contexto profesional por unidad (una fila de curriculum = una unidad/eje).
-- Forma: {"aplicacion": "...", "herramientas": ["...", "..."]}
-- Lo consume lib/education-context.ts para que un alumno de sistemas reciba
-- ejercicios de su dominio (modelar crecimiento de usuarios, optimizar un
-- inventario) en vez de matemática genérica.
ALTER TABLE curriculum
  ADD COLUMN IF NOT EXISTS contexto_profesional JSONB;

COMMENT ON COLUMN curriculum.contexto_profesional IS
  'Aplicación profesional de la unidad: {"aplicacion": texto, "herramientas": [texto]}. NULL cuando el programa no la declara.';

-- Unicidad de fila. No existía: el seeder de Secundario ya captura errores de
-- "duplicate"/"unique" y los cuenta como filas salteadas, pero como no había
-- constraint esa rama nunca se ejecutaba y un runner corrido dos veces
-- duplicaba en silencio. Esto hace funcionar el código que ya estaba escrito.
--
-- NULLS NOT DISTINCT (PG15+, acá corre PG17) es imprescindible: por defecto
-- Postgres considera que dos NULL son distintos, así que con `carrera` NULL en
-- todo K-12 la constraint no protegería ninguna de las 307 filas existentes —
-- exactamente las que más nos importa no duplicar.
--
-- DROP + ADD en vez de "ADD CONSTRAINT IF NOT EXISTS", que Postgres no soporta.
-- Un bloque DO tampoco sirve acá: el runner parte el archivo en ";\n" y los
-- punto y coma internos del $$ ... $$ lo romperían.
ALTER TABLE curriculum
  DROP CONSTRAINT IF EXISTS curriculum_fila_unica;

ALTER TABLE curriculum
  ADD CONSTRAINT curriculum_fila_unica
  UNIQUE NULLS NOT DISTINCT (jurisdiccion, nivel, carrera, grado, materia, eje);

-- Q0 del selector Superior: SELECT DISTINCT carrera WHERE nivel = 'Superior'.
-- Parcial porque sólo Superior tiene carrera y el índice no debe cargar con las
-- 307 filas de K-12 que la tienen en NULL.
CREATE INDEX IF NOT EXISTS idx_curriculum_carrera
  ON curriculum(nivel, carrera)
  WHERE carrera IS NOT NULL;
