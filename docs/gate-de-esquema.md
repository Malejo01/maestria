# Gate de esquema

Cómo se evita que vuelva a desplegarse código que pide un esquema que la base no
tiene. Escrito el **24/08/2026**, después de la segunda vez.

## Por qué existe

Dos incidentes, la misma falla:

| Migración | Qué faltaba | Consecuencia | Cómo se detectó |
|---|---|---|---|
| **019** | tabla `feedback_reports` | el botón de reportar problemas tiraba 500 | por casualidad, mirando Sentry (`MAESTRIA-Z`) — llegó porque la ruta hace `console.error` |
| **023** | `curriculum.tipos_pregunta_sugeridos` | `/practicar` mostró **"no hay temas cargados"** durante **nueve días**, para **todos los niveles** | porque Mauro fue a usarlo |

En las dos, el código se mergeó y se desplegó, la migración quedó sin correr, y
nada lo dijo. [tests/migrations.test.ts](../tests/migrations.test.ts) vigila la
numeración *dentro del repo*; nadie miraba si la base estaba al día.

El agujero es de **orden**, y es estructural: el push a `main` dispara el deploy
solo, y la migración se corre a mano. Por construcción existe una ventana en la
que el código desplegado pide un esquema que la base no tiene. No se cierra con
disciplina: se cierra haciendo que esa ventana rompa algo ruidoso.

## Qué corre

```bash
npm run check:schema
```

[scripts/check-schema-drift.ts](../scripts/check-schema-drift.ts) lee los
`scripts/0NN-*.sql`, los **aplica en orden** sobre un modelo en memoria
([scripts/lib/schema-model.ts](../scripts/lib/schema-model.ts)) y compara el
resultado contra el catálogo real. Sale con código 1 y nombra el runner exacto:

```
✖ Faltan 2 objeto(s) en la base:

    tabla   feedback_reports
      → npx tsx scripts/run-migration-019.ts

    columna curriculum.tipos_pregunta_sugeridos
      → npx tsx scripts/run-migration-023.ts
```

*(Esa salida es real: se produjo simulando la base del 15/08. El chequeo habría
atrapado los dos incidentes.)*

**Aplica RENAME y DROP, no acumula CREATE y ADD.** El primer prototipo sólo
juntaba lo que las migraciones crean y reportó `ai_generation_log` (015) como
faltante — no falta, la 016 la renombró a `ai_usage_log`. Un detector que grita
por algo que está bien deja de leerse a las dos semanas.

**Lo que no modela, a propósito:** las columnas declaradas dentro de un `CREATE
TABLE` (su cuerpo trae constraints y CHECKs con comas, y un parser aproximado de
eso da falsos positivos), los índices, las constraints, los `COMMENT` y los
backfills. Cubre exactamente la forma de los dos incidentes reales: tabla que
falta, y columna agregada por `ADD COLUMN` que falta. Para lo demás está
`schema_migrations`, que registra la corrida en vez de deducirla.

## El rol de sólo lectura

El chequeo consulta **`pg_catalog`** (`pg_class`, `pg_attribute`), no
`information_schema`. No es estilo:

> `information_schema` sólo muestra los objetos sobre los que el rol tiene algún
> privilegio. Un rol de CI sin un solo `GRANT` vería la base vacía, y el chequeo
> reportaría que falta absolutamente todo.

`pg_class` y `pg_attribute` tienen SELECT público. Consecuencia práctica: **el
rol del pipeline puede auditar el esquema entero sin poder leer una sola fila de
datos de un alumno.**

Lo que el rol necesita, y nada más:

```sql
CREATE ROLE ci_schema_check LOGIN PASSWORD '<generada, guardada sólo en el secreto de GitHub>';
GRANT CONNECT ON DATABASE neondb TO ci_schema_check;
GRANT USAGE ON SCHEMA public TO ci_schema_check;

-- Único GRANT sobre datos, y es el marcador de entorno de la migración 017:
-- `resolveDbTarget` lo lee para saber contra qué base está hablando.
-- No tiene datos personales.
GRANT SELECT ON deployment_env TO ci_schema_check;
```

Sin `INSERT`, `UPDATE`, `DELETE` ni `SELECT` sobre ninguna otra tabla. Si alguien
se lleva ese secreto, se lleva la lista de nombres de columnas.

La cadena de conexión de ese rol va al secreto de GitHub
**`DATABASE_URL_READONLY`**. Mientras el secreto no exista, el job avisa con un
`::warning::` y pasa — un gate que rompe todos los builds el día que se mergea
no sobrevive a la primera tarde.

`check-schema-drift.ts` declara `destructive: false`, así que **no pide
`CONFIRM_PRODUCTION`**: eso es lo que lo hace usable desde CI sin ninguna
variable de intención.

## Cuándo corre

Sólo en **push a `main`**, después de `test-and-build`.

En un PR **no** corre, y es deliberado: un PR que agrega una migración va a
mostrar drift hasta que la migración se aplique. Ahí el drift no es un defecto,
es el estado esperado. Bloquear PRs por eso enseñaría a ignorar el job, que es
como se muere un gate.

## Cómo lo desbloqueás cuando falla

El job en rojo dice exactamente qué correr. Son dos pasos y no necesita commit:

1. Correr el runner que nombra la salida:

   ```bash
   npx tsx scripts/run-migration-0NN.ts
   ```

   (Pide que tipees el project id de Neon, como cualquier escritura contra
   producción.)

2. **Actions → el workflow en rojo → "Re-run failed jobs".** Sólo se re-ejecuta
   `schema-gate`; `test-and-build` no se vuelve a correr.

Toma segundos. Y mientras tanto **producción sigue sirviendo el build anterior**:
no hay pantalla rota, hay un deploy que no salió.

Si el drift es legítimo y querés desplegar igual —por ejemplo, una migración que
se decidió no correr todavía— el desbloqueo es sacar del repo la migración que
no se va a aplicar, no saltear el gate. Un gate con bypass es un gate apagado.

## Lo que falta para que bloquee de verdad

**Hoy el job marca en rojo pero no frena el deploy.** Vercel despliega por su
cuenta al recibir el push a `main`, sin mirar GitHub Actions. Un rojo inmediato
ya es infinitamente mejor que nueve días, pero no es el gate.

Para cerrarlo hay que tomar control del deploy. Dos caminos:

**A. Recomendado — apagar el auto-deploy a producción de Vercel y desplegar
desde el workflow.** Se conservan los preview deploys de PR. Se agrega un job
`deploy` que corre después de `schema-gate` y hace `vercel deploy --prod`.
Necesita `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` como secretos.
Con esto el orden queda garantizado por la topología del workflow, no por que
alguien se acuerde.

**B. No recomendado — el "Ignored Build Step" de Vercel.** Se puede poner un
comando que decida si Vercel construye o no. El problema es la semántica: exit 0
**saltea** el build y exit 1 lo ejecuta, así que un drift detectado se
manifestaría como un deploy **"Skipped"**. Un fallo que se presenta como "no
pasó nada" es exactamente la enfermedad que este documento trata.

## Escalón siguiente

`schema_migrations` (migración 024): que cada runner registre su corrida. Vuelve
el chequeo exacto en vez de deducido, y cubre lo que el parser no ve —índices,
constraints, `COMMENT`, backfills—. El backfill inicial de esa tabla sale de
correr este chequeo.
