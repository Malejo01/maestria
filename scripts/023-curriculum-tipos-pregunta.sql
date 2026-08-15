-- Migration: Mezcla sugerida de tipos de pregunta por unidad del currículum
-- Version: 023
-- Description: Le da a cada fila de `curriculum` un lugar donde declarar qué
--              proporción de cada tipo de pregunta corresponde a esa unidad.
--
-- POR QUÉ EN LA BASE Y NO COMO DEFAULT DEL CLIENTE
--
-- La alternativa era resolverlo en components/curriculum-selector.tsx, que ya
-- conoce nivel, carrera, materia y temas, y cambiar ahí el default de
-- DEFAULT_QUESTION_TYPES. Se descartó por cuatro razones:
--
-- 1. Es una regla de una cátedra, no de una pantalla. Escribirla en el cliente
--    obliga a un `if (carrera === 'Tecnicatura Superior en Análisis de
--    Sistemas')` dentro de un componente de React: una decisión pedagógica de
--    una institución, hardcodeada en la UI, invisible para quien lea el
--    programa. `contexto_profesional` (migración 022) ya sentó el precedente
--    contrario y por los mismos motivos.
--
-- 2. Cobertura. El default del cliente sólo corre en el paso de parámetros del
--    selector. /api/generate-quiz también se llama desde subject-content (aulas
--    y cuestionarios del docente), y todo llamador que no manda `questionTypes`
--    cae al fallback `['multiple_choice']` — exactamente el 35,2% de acierto
--    sobre un piso de azar de 25% que motivó este cambio. Resolviéndolo en el
--    servidor, se corrigen todos los llamadores de una vez.
--
-- 3. Granularidad. La mezcla NO es uniforme dentro del programa: la Unidad 1
--    (Lógica) casi no admite respuestas numéricas y la Unidad 7 (Derivadas) es
--    donde más pegan. Una constante del cliente llega, como mucho, al nivel de
--    materia. Acá una fila YA ES una unidad, así que la granularidad por unidad
--    sale gratis.
--
-- 4. Retoque sin deploy. La proporción se va a ajustar con el próximo
--    diagnóstico. En la base es un UPDATE; en el cliente es un release.
--
-- Forma: {"numeric": 45, "short_answer": 30, "multiple_choice": 20, "true_false": 5}
-- Son pesos relativos, no porcentajes: lo que importa es la proporción entre
-- ellos. lib/question-mix.ts normaliza y reparte por restos mayores.
--
-- Sin CHECK a propósito, igual que `contexto_profesional`: la validación de
-- forma vive en parseQuestionTypeMix(), que descarta lo que no cumple en vez de
-- hacer fallar una generación entera por una fila mal cargada.

ALTER TABLE curriculum
  ADD COLUMN IF NOT EXISTS tipos_pregunta_sugeridos JSONB;

COMMENT ON COLUMN curriculum.tipos_pregunta_sugeridos IS
  'Mezcla sugerida de tipos de pregunta para la unidad: {"numeric": 45, "short_answer": 30, "multiple_choice": 20, "true_false": 5}. Pesos relativos, no porcentajes. NULL = el generador reparte parejo entre los tipos pedidos (comportamiento previo a la migración 023).';
