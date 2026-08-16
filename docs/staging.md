# Runbook — Entorno de staging

Staging es **persistente**, no un preview de PR. Los previews efímeros de Vercel nacen y mueren con la rama y no sirven para acumular estado ni para ensayar una migración; staging existe justamente para eso.

**Invariante:** staging **nunca** tiene datos personales reales. No es una recomendación — [`scripts/lib/db-target.ts`](../scripts/lib/db-target.ts) se niega a marcar una branch como `staging` si detecta un solo email sin anonimizar.

---

## 1. Arquitectura

```
GitHub                Vercel                        Neon
──────                ──────                        ────
branch  staging  →   proyecto maestria-staging  →  branch  staging   (datos falsos)
branch  main     →   proyecto MalejoMath        →  branch  production (datos reales)
```

Van **dos proyectos de Vercel** en vez de un Custom Environment porque la cuenta está en plan Hobby y los custom environments son Pro. El costo es que las variables se administran en dos lugares; a cambio, el aislamiento es total (otro dominio, otro token, otro OAuth client).

---

## 2. Puesta en marcha

### 2.0 El camino corto: un solo comando

[`scripts/create-staging-branch.ts`](../scripts/create-staging-branch.ts) encadena §2.1, §2.2 y la verificación en una corrida:

```bash
npx tsx scripts/create-staging-branch.ts
```

Necesita `NEON_API_KEY` en `.env.local`, además de `NEON_PROJECT_ID` y la `DATABASE_URL` de producción. **Borrá la `NEON_API_KEY` apenas termine**: esa credencial puede borrar cualquier branch del proyecto, producción incluida, y ningún otro script la usa.

Qué hace, en orden:

1. Crea la branch `staging` desde la branch raíz, con datos al momento.
2. Espera hasta que responda un `SELECT 1` real — no hasta que la API diga `ready`, que describe el compute y no que el endpoint acepte consultas. Timeout 90 s.
3. Corre la migración 017 contra la branch nueva.
4. Corre `anonymize-staging.ts`, que anonimiza **y** deja la marca de `staging`.
5. **Verifica sin creerle al anonimizador**: trae los valores reales de producción y comprueba que ninguno sobreviva. Es la diferencia con `assertAnonymized`, que mira un patrón (`@staging.invalid`) y por eso no puede ver una tabla que el anonimizador no conoce.
6. Recién ahí escribe `.env.staging.local`.

> **La branch sobrevive si y sólo si los seis pasos salieron bien.** Cualquier fallo —incluido un solo dato real encontrado en el paso 5, o un Ctrl-C durante la espera— la borra. Si el borrado mismo falla, el script grita con el `curl` para borrarla a mano; no es un warning que se pueda pasar por alto. La lógica está en [`scripts/lib/branch-guard.ts`](../scripts/lib/branch-guard.ts), con tests.

El script **se niega a pisar** una branch `staging` existente: para refrescar, borrala primero (§5). Y no cubre §2.3-§2.5 — el OAuth client, los secretos propios y las variables en Vercel siguen siendo a mano.

Lo que sigue es el mismo procedimiento paso a paso, que es lo que hay que leer cuando algo del script falla.

### 2.1 Branch de Neon

Consola de Neon → *Branches* → *Create branch*:

- **Nombre:** `staging`
- **Origen:** la branch de producción, *Include data up to* → `Now`

Es copy-on-write: tarda segundos y al principio no ocupa almacenamiento extra.

Copiá las connection strings (pooled y unpooled) a un `.env.staging.local` local — el mismo formato que `.env.local`. **Ese archivo no se commitea** (`.gitignore` ya cubre `.env*.local`).

### 2.2 Anonimizar — obligatorio, antes de nada más

La branch recién creada es una **copia exacta de producción**: nombres reales de alumnos, emails, y tokens OAuth de Google que todavía funcionan.

```bash
npx tsx scripts/run-migration-017.ts --env=staging
```

```bash
npx tsx scripts/anonymize-staging.ts --env=staging
```

Qué borra ([`scripts/anonymize-staging.ts`](../scripts/anonymize-staging.ts)):

| Dato | Queda |
|---|---|
| `users.id` (es el `sub` de Google) | `stg-user-0001`… |
| `users.name` | Nombre sintético |
| `users.email` | `usuarioN@staging.invalid` (los invitados siguen en `NULL`) |
| `users.image` | `NULL` — la foto de perfil identifica igual que el nombre |
| `accounts.provider_account_id` | Derivado del id nuevo |
| `accounts.access_token` / `refresh_token` / `id_token` | `NULL` — **son credenciales de Google vivas** |
| `classroom_members.display_name` | Sincronizado con el nombre nuevo |
| `verification_tokens` | Vaciada (el identificador es un email) |
| `teacher_program_uploads` | Vaciada (PDFs y Word reales de docentes) |

Lo que **se preserva** a propósito: `role`, `nivel`, `grado`, `is_guest`, y todo el historial de intentos y programas. Eso es lo que hace que staging sirva para reproducir bugs — la forma de los datos es real, la identidad no.

Recién al terminar, el script marca la branch como `staging`. Si algo falla en el medio, **borrá la branch y volvé a clonarla** en vez de arreglarla a mano: sale más barato que quedarte con dudas.

> `.invalid` es un TLD reservado por el RFC 2606 y no se puede delegar nunca. Un dump de staging filtrado no le puede llegar a una persona real ni por accidente.

### 2.3 OAuth client separado en Google

Sin esto el login de staging falla, y sólo el de staging.

Google Cloud Console → *APIs & Services* → *Credentials* → *Create OAuth client ID* (Web application):

- **Authorized redirect URI:** `https://<tu-dominio-staging>.vercel.app/api/auth/callback/google`

Client separado y no una URI extra en el de producción: así las credenciales de staging no sirven contra producción.

### 2.4 Segundo proyecto en Vercel

*Add New* → *Project* → misma repo (`Malejo01/MalejoMath`) → nombre `maestria-staging`.

En *Settings* → *Git*: **Production Branch = `staging`**. Es el paso que hace que este proyecto siga la rama `staging` en vez de `main`.

En *Settings* → *Git* → *Ignored Build Step*, para que no gaste builds con los PRs del otro proyecto:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; else exit 0; fi
```

(en Vercel, `exit 1` = construí, `exit 0` = saltá. Sí, está al revés de lo que uno espera.)

### 2.5 Variables de entorno

| Variable | Producción | Staging |
|---|---|---|
| `DATABASE_URL` | branch `production` | **branch `staging`** |
| `DATABASE_URL_UNPOOLED` | ídem | **ídem staging** |
| `AUTH_SECRET` | secreto A | **secreto B, distinto** |
| `NEXTAUTH_SECRET` | = `AUTH_SECRET` | = `AUTH_SECRET` de staging |
| `AUTH_URL` / `NEXTAUTH_URL` | dominio de prod | dominio de staging |
| `GOOGLE_CLIENT_ID` / `_SECRET` | client de prod | **client de staging (§2.3)** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | key de prod | **key aparte, con cuota propia** |
| `NEON_PROJECT_ID` | igual | igual |

Dos que no conviene compartir aunque tiente:

- **`AUTH_SECRET`**: compartirlo hace que una sesión de staging sea válida en producción. Es una escalada de privilegios completa.
- **La key de Gemini**: probar en staging quema cuota de producción, y con el rate limiting de la Etapa 1 en juego, ensucia las métricas de costo.

---

## 3. Correr migraciones

Toda migración va **a staging primero**. La numeración la valida `tests/migrations.test.ts` en CI, así que dos ramas no pueden reclamar el mismo número sin que el build lo cante.

```bash
npx tsx scripts/run-migration-0NN.ts --env=staging
```

Verificá en el sitio de staging que la app siga funcionando, y recién ahí:

```bash
npx tsx scripts/run-migration-0NN.ts
```

Sin `--env`, el script usa `.env.local` (producción) y **te va a pedir confirmación escrita**:

```
  ╔════════════════════════════════════════════════════════════╗
  ║  ⚠  ESTO ES PRODUCCIÓN — HAY DATOS DE DOCENTES Y ALUMNOS   ║
  ╚════════════════════════════════════════════════════════════╝

   Acción : migración 018
   Host   : ep-twilight-smoke-am4b6vzf-pooler.c-5.us-east-1.aws.neon.tech
   Proyecto: noisy-smoke-23995229

   Escribí "noisy-smoke-23995229" para continuar (o Enter para abortar):
```

En CI, donde no hay terminal, el equivalente es `CONFIRM_PRODUCTION=noisy-smoke-23995229`.

### Cómo sabe cuál es cuál

El marcador es una fila en la tabla `deployment_env` ([migración 017](../scripts/017-deployment-env.sql)), no una lista de hostnames en el código — un hostname hardcodeado deja de proteger en cuanto restaurás desde un backup y el endpoint cambia.

La sutileza: una branch clonada hereda la fila diciendo `'production'`, igual que el original. Por eso la tabla también guarda `origin_host`, el host donde la fila se escribió:

| `environment` | `origin_host` vs host actual | Interpretación |
|---|---|---|
| `production` | **iguales** | Producción real → pide confirmación |
| `production` | distintos | Clon sin marcar → probablemente staging recién creado |
| `staging` | — | Staging ya anonimizado → corre sin fricción |

Si la tabla no existe, se asume producción. Todos los caminos de duda terminan del lado seguro.

---

## 4. Promover staging → producción

```
feature/*  →  staging  →  main
```

1. PR de `feature/*` a `staging`. CI corre tests y build.
2. Merge → Vercel despliega `maestria-staging`.
3. Migraciones a staging (§3) y prueba manual en el sitio de staging.
4. PR de `staging` a `main`.
5. Merge → Vercel despliega producción.
6. Migraciones a producción, con la confirmación escrita.

El paso 6 va **después** del deploy, así que toda migración tiene que ser compatible hacia atrás: entre el deploy y la migración, el código nuevo convive con el schema viejo. Las que agregan columnas (`ADD COLUMN IF NOT EXISTS`) lo son naturalmente; las que renombran, no — la 016 (`ai_generation_log` → `ai_usage_log`) es exactamente el caso que hay que partir en dos deploys.

---

## 5. Refrescar staging

Cuando staging se llenó de basura de pruebas, o querés datos parecidos a los de producción de nuevo:

1. Neon → borrar la branch `staging`. (A mano y a propósito: puede estar en uso, y el script no la pisa por su cuenta.)
2. `npx tsx scripts/create-staging-branch.ts` — hace los pasos 3 a 5 de abajo y los verifica (§2.0).
3. Actualizá la connection string en Vercel si cambió; `.env.staging.local` ya lo hizo el script.

A mano, si el script falla o querés hacerlo por partes:

1. Neon → borrar la branch `staging`.
2. Crearla otra vez desde producción (§2.1).
3. `npx tsx scripts/run-migration-017.ts --env=staging`
4. `npx tsx scripts/anonymize-staging.ts --env=staging`
5. Si la connection string cambió, actualizala en `.env.staging.local` y en Vercel.

Los pasos 3 y 4 no son opcionales: sin ellos la branch sigue marcada como producción, y todo script que apunte ahí va a exigir la confirmación de producción. La fricción es el recordatorio.

---

## 6. Qué falta

- **No hay migraciones automáticas en el deploy.** A propósito: correrlas a mano obliga a mirar qué se está por hacer. Cuando el equipo crezca, revisarlo.
- **La anonimización no toca el texto generado por IA** (`student_misconceptions.tip`, `student_tips`). Son observaciones sobre errores de aprendizaje, no identificadores — pero si alguna vez el prompt empieza a incluir el nombre del alumno en la respuesta, esto hay que revisarlo.
