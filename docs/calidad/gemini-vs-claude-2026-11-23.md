# Gemini contra Claude Haiku (23/11/2026) — medición salteada

Ronda Y · Y4. **Es sólo medición: el modelo por defecto no se cambió y no se cambia.** La app sigue generando con `AI_MODEL` (`lib/ai-model.ts`).

## Por qué no hay números todavía

El encargo decía que se usara la `ANTHROPIC_API_KEY` de staging si estaba, y si no, que quedara como paso manual. **No está**: no aparece en `.env.staging.local` ni en `.env.local`. Por eso la medición con los modelos reales **se salteó** y no se gastó nada en IA.

Lo que sí quedó listo y probado es el script, [`scripts/qa/comparar-gemini-claude.ts`](../../scripts/qa/comparar-gemini-claude.ts):

- **Las mismas 40 generaciones con los dos modelos.** Son 10 temas, de primario a superior y de Matemática a Enfermería, en 4 combinaciones de modo y tipos (sólo opción múltiple; práctico con numérica y corta; mixto con verdadero o falso; y tipos de Moodle). Cada generación pide 6 preguntas. Todo corre contra staging y sólo lee.
- **Las métricas:**
  - cuántas generaciones funcionaron;
  - cuántas preguntas se entregaron sobre las pedidas;
  - qué parte de lo que devolvió el modelo descartaron los validadores (con el observador de U4);
  - los tipos pedidos que no salieron (los avisos de U1);
  - el tiempo, en promedio y p90;
  - los tokens y el costo estimado.
- **10 pares a ciegas:** de 10 generaciones elegidas al azar (con semilla), la primera pregunta de cada modelo, en orden A/B también al azar. La clave va en un archivo aparte, para leerlas sin saber de quién es cada una.
- **Una recomendación automática** que compara las métricas y siempre aclara que el modelo por defecto no cambió.

**Cómo se probó:**

- Sin la clave, el script avisa y no hace nada.
- Con `--simulado`, los dos modelos son simulados (`MockLanguageModelV3` del AI SDK): corrió las 80 generaciones y escribió el informe y la clave. Así quedó comprobado el circuito entero (el modelo a medir entra en `generateQuiz`, el observador cuenta, se arman la tabla, los pares y la clave) sin clave y sin gasto. Los números del simulado no dicen nada de los modelos reales.

**Lo que se tocó en la app para poder medir (sin cambiar el comportamiento):**

- `generateQuiz` acepta un cuarto parámetro, opcional, `{ modelo }`, que sólo usa este script. La app nunca lo pasa, así que sigue con `google(AI_MODEL)`.
- `lib/ai-usage.ts` tiene el precio de `claude-haiku-5-5` (US$0,10 por millón de tokens de entrada y US$0,50 de salida, en prompts de hasta 100K), para estimar el costo.
- Se sumó **`@ai-sdk/anthropic` 3.0.139** como `devDependency`, fijada exacta: es chica, de la misma familia que `@ai-sdk/google` y sólo la usa el script.

## Paso manual para Mauro

1. Conseguí una clave de la API de Anthropic, de una cuenta con saldo. Las 40 generaciones de Haiku cuestan centavos.
2. En PowerShell, desde la carpeta del repo:

```powershell
$env:ANTHROPIC_API_KEY = "${claveDeAnthropic}"
npx tsx scripts/qa/comparar-gemini-claude.ts --env=staging
```

3. El script escribe `docs/calidad/gemini-vs-claude-<fecha>.md` y `…-clave.md` y reemplaza este archivo si es del mismo día. Leé primero los **10 pares a ciegas** y anotá cuál preferís; recién después abrí la clave.

Para no dejar la clave en la sesión: `Remove-Item Env:ANTHROPIC_API_KEY`.

**Detalles técnicos que el script ya resuelve:**

- Claude Haiku 5.5 rechaza `temperature`, `topP` y `topK` con valores que no son los de fábrica, y la generación de MaestrIA manda `temperature`. El script envuelve el modelo con un middleware del AI SDK que los saca, sólo para Haiku.
- Las opciones de Gemini (`thinkingConfig`) se ignoran con otro proveedor.

**Riesgo conocido:** Haiku 5.5 piensa por defecto (thinking adaptivo). Si el AI SDK no se lleva bien con eso al pedir el objeto estructurado, va a aparecer en la columna "Generaciones que funcionaron". En ese caso, el siguiente paso es probar con esfuerzo `low` por `providerOptions`, todavía como medición.

## Recomendación

**Quedarse con Gemini hasta tener los números.** Haiku sólo valdría la pena si en esta medición:

1. funciona en las mismas o más generaciones;
2. los validadores le descartan lo mismo o menos (la tasa de descarte es la que más pesa: cada pregunta descartada es tiempo de espera y una tanda más);
3. **los pares a ciegas salen claramente a su favor;**
4. el costo por generación no sube.

Aun así, el paso siguiente sería **probarlo en staging detrás de una variable**, nunca cambiar el modelo por defecto en producción directamente. Esa decisión es de Mauro.
