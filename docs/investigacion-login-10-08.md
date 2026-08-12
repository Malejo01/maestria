# Investigación — fallas de login del 2026-08-10

Relevado el **2026-08-12** sobre la rama `claude/planning-module-screenshots-153f8c`.
Nadie reportó el incidente a mano: se descubrió mirando el panel de Sentry dos días después.

Fuentes: Sentry (`personal-667/maestria`), la base de producción de Neon
(`noisy-smoke-23995229`, sólo lecturas) y sondas HTTP de sólo lectura contra
`https://v0-malejo-math-app.vercel.app`. El release que corría era
`a3bb0557f281a61c88bc4063bc8fd603be7a697f`, commiteado el **2026-08-06 20:20 UTC**:
**no hubo ningún deploy entre ese día y el incidente**, así que nada de esto lo
introdujo un cambio de código. Lo que cambió fue la carga.

> **Respuesta corta a la pregunta del docente.** Cuántos alumnos **no llegaron a entrar**:
> **cero, con un margen de ±1**. Los 31 alumnos que aparecen en la base entraron y los 31
> rindieron. Lo que se perdió no fue gente, fue tiempo: el grupo tardó **37 minutos** en
> terminar de loguearse y cada alumno necesitó **unos 10 intentos** de promedio.
> El margen de ±1 y qué haría falta para cerrarlo están explicados en la sección 4.

---

## 1. Qué pasó

Entre las **22:05:50** y las **23:42:29 UTC** del 2026-08-10, mientras un docente tomaba un
diagnóstico de matemática con 30 alumnos en simultáneo, el POST de inicio de sesión con
Google falló **305 veces** con `MissingCSRF`. Los alumnos veían la pantalla de error de
NextAuth, volvían atrás y apretaban de nuevo. Todos terminaron entrando, algunos a la
primera y otros después de media hora.

El sistema **se cura solo**: una vez que el navegador logra fijar una cookie de CSRF
coherente, el error no vuelve a ocurrir para ese navegador nunca más. Por eso el incidente
se apagó sin que nadie tocara nada, y por eso durante los seis días previos —con Sentry ya
instalado y mirando— **no hubo un solo `MissingCSRF`**: el bug sólo dispara en el primer
contacto de un navegador con la aplicación, y hasta esa noche nunca habían llegado treinta
primeros contactos juntos.

---

## 2. La evidencia

### 2.1 Los issues de Sentry

| Issue | Error | Ruta | Eventos | Ventana |
|---|---|---|---|---|
| [MAESTRIA-9](https://personal-667.sentry.io/issues/MAESTRIA-9) | `MissingCSRF: CSRF token was missing during an action signin` | `POST /api/auth/signin/google` | 305 | 22:05:50 – 23:42:29 |
| [MAESTRIA-A](https://personal-667.sentry.io/issues/MAESTRIA-A) | `at ri (...)` — sin símbolos | `POST /api/auth/signin/google` | 305 | igual |
| [MAESTRIA-G](https://personal-667.sentry.io/issues/MAESTRIA-G) | `InvalidCheck: pkceCodeVerifier value could not be parsed` | `GET /api/auth/callback/google` | 10 | 22:07:55 – 23:16:49 |
| [MAESTRIA-F](https://personal-667.sentry.io/issues/MAESTRIA-F) | `at a4 (...)` — sin símbolos | `GET /api/auth/callback/google` | 10 | igual |
| [MAESTRIA-C](https://personal-667.sentry.io/issues/MAESTRIA-C) | `CallbackRouteError` | `GET /api/auth/callback/google` | 4 | — |
| [MAESTRIA-B](https://personal-667.sentry.io/issues/MAESTRIA-B) / [MAESTRIA-J](https://personal-667.sentry.io/issues/MAESTRIA-J) | causas del anterior (`iss` faltante, error en el body de la respuesta) | ídem | 2 + 2 | — |
| [MAESTRIA-D](https://personal-667.sentry.io/issues/MAESTRIA-D) / [MAESTRIA-H](https://personal-667.sentry.io/issues/MAESTRIA-H) | detalles del anterior | ídem | 2 + 2 | — |

**Los pares no son fallas distintas: son la misma falla contada dos veces.** El logger de
`@auth/core` (`lib/utils/logger.js`) hace **dos** `console.error` por error — primero el
mensaje, después el stack:

```js
console.error(`${red}[auth][error]${reset} ${name}: ${error.message}`)
if (error.cause && "err" in error.cause) { /* [auth][cause] + [auth][details] */ }
else if (error.stack) { console.error(error.stack.replace(/.*/, "").substring(1)) }
```

Y `sentry.server.config.ts` engancha `captureConsoleIntegration({ levels: ['error'] })`, así
que cada `console.error` se convierte en un evento. De ahí que MAESTRIA-9 y MAESTRIA-A tengan
**exactamente** 305 cada uno, y MAESTRIA-G y MAESTRIA-F exactamente 10.

> **El total real es 305 fallas de login, no 610.** Igual para las 10 de PKCE y las 4 de
> callback. Es la primera trampa de lectura de este panel y conviene dejarla escrita.

De paso: MAESTRIA-A y MAESTRIA-F son **literalmente la otra mitad** de MAESTRIA-9 y
MAESTRIA-G, y llegan sin simbolicar. No aportaron nada al diagnóstico. La causa de eso está
relevada en [deuda-tecnica.md §5](deuda-tecnica.md#5-source-maps-de-sentry-con-turbopack--diagnóstico-sin-arreglo)
y sigue sin arreglar; acá no molestó sólo porque el mensaje de error se explicaba solo.

### 2.2 El volumen de tráfico

Del dataset de spans, ventana 22:00–00:00 UTC. **Ojo con estos números**: `tracesSampleRate`
es `0.1`, así que son extrapolaciones ×10 de muestras chicas (el `1670` sale de 167 muestras;
el `30`, de 3). Sirven para el orden de magnitud, no para una razón exacta.

| Medición | Valor (extrapolado) | Qué significa |
|---|---|---|
| `GET /api/auth/[...nextauth]` | ~1670 | `/session` + `/csrf` + `/callback` |
| `POST /api/auth/[...nextauth]` | ~330 | prácticamente todo `signin/google` |
| `POST https://oauth2.googleapis.com/token` | ~30 | intercambios de código OAuth **exitosos** |
| `POST` a Neon dentro de un `GET /api/auth/*` | ~120 | 4 queries por login exitoso → ~30 logins |

Dos lecturas importantes:

- **~305 de ~330 POST de signin fallaron.** Es del orden del **90 %**, no un caso de borde.
  Con 33 muestras el intervalo es ancho (grosso modo 70–100 %), pero la conclusión aguanta:
  fallar era el resultado *normal*, entrar era la excepción.
- **~30 intercambios de token y ~120 queries a Neon convergen en ~30 callbacks exitosos**,
  que es exactamente lo que dice la base (31). Son tres mediciones independientes que dan lo
  mismo; eso es lo que permite afirmar el número final con confianza.

### 2.3 Navegadores

Nueve combinaciones distintas de navegador/SO sobre los 305 eventos: Chrome 149/150/151,
Edge 149/151 y Brave 149/151, sobre Windows y Android. Es el perfil de un aula con equipos
propios, no el de un laboratorio con una imagen única. **Brave —el navegador más agresivo con
las cookies— aporta 32 de 305 eventos (10 %), sin sobrerrepresentación.**

> **Advertencia de lectura:** el tag `user.geo` de estos eventos dice *US, Ashburn*. Eso es la
> región de Vercel (`iad1`), no de dónde estaban los alumnos. Son eventos de servidor.

### 2.4 La base de datos

Ventana 22:00–00:00 UTC:

| Medición | Valor |
|---|---|
| Usuarios creados | **31** (todos `ALUMNO`, todos `is_onboarded`) |
| Usuarios creados como invitado (`is_guest`) | **0** |
| Alumnos distintos con al menos un `quiz_attempt` | **31** |
| `quiz_attempt` totales | 84 (2,71 por alumno) |
| Alumnos creados que **no** llegaron a rendir | **0** |
| Alumnos que rindieron sin haberse creado esa noche | **0** |
| Primera alta / última alta | 22:05:58 / **22:42:51** |
| Demora mediana desde el primer error | **5,6 min** (media 6,7) |
| Altas después de los primeros 10 minutos | **5** |
| Primer / último intento terminado | 22:26:40 / 23:40:29 |

El conjunto de los 31 que se crearon y el de los 31 que rindieron es **exactamente el mismo**:
intersección 31, ninguno de un lado sin el otro. No hubo un solo alumno que lograra crear la
cuenta y se quedara sin rendir.

La cola de altas es la parte fea: 22:19, 22:31 y **22:42**. Ese último alumno pasó **37
minutos** peleando con la pantalla de login antes de poder empezar.

El docente **no** aparece logueándose en la ventana (su `updated_at` no se movió): ya tenía
sesión abierta de antes, que es coherente con que a él no le pasara nada. Es también la razón
por la que no se enteró.

**Dato aparte, y pesa para la sección 6:** hay 1 aula creada, con **0 miembros y 0
asignaciones**, y los 84 intentos tienen `classroom_id` y `assignment_id` en `NULL`. El
diagnóstico **no se tomó dentro de un aula**. No hay lista de curso en el sistema.

---

## 3. Causa raíz

**Cada request a la aplicación pasa por dos instancias completas e independientes de Auth.js,
y las dos emiten su propia cookie de CSRF. Cuando el navegador llega sin cookie, se lleva dos
tokens distintos y se queda con el que llegó último, que no siempre es el que el cliente
acaba de recibir por `GET /api/auth/csrf`. El `POST` posterior manda un token que no coincide
con la cookie y Auth.js lo rechaza con `MissingCSRF`.**

Está reproducido contra producción. Va por partes.

### 3.1 `MissingCSRF` no significa "faltaba la cookie"

`@auth/core@0.41.2`, `lib/actions/callback/oauth/csrf-token.js` (viene por `next-auth`, no
está en el repo — se lee en `node_modules/`):

```js
if (cookieValue) {
    const [csrfToken, csrfTokenHash] = cookieValue.split("|")
    const expectedCsrfTokenHash = await createHash(`${csrfToken}${options.secret}`)
    if (csrfTokenHash === expectedCsrfTokenHash) {
        const csrfTokenVerified = isPost && csrfToken === bodyValue   // ← acá
        return { csrfTokenVerified, csrfToken }
    }
}
// New CSRF token
```

```js
export function validateCSRF(action, verified) {
  if (verified) return
  throw new MissingCSRF(`CSRF token was missing during an action ${action}`)
}
```

El mensaje dice *missing*, pero el `throw` se dispara igual cuando la cookie **está** y su
token **no coincide** con el del body. Buscar una cookie ausente era el camino equivocado, y
es lo que más tiempo cuesta si uno se cree el texto del error.

La otra mitad importante del mismo bloque: **si la cookie es válida, no se emite una nueva.**
De ahí que el sistema se cure solo.

### 3.2 Hay dos instancias de Auth.js por request

[`proxy.ts`](../proxy.ts) exporta `auth((req) => ...)` como middleware, y su `matcher` cubre
todo, incluidas las rutas del propio NextAuth (`'/(api|trpc)(.*)'`, y el primer patrón
tampoco excluye `api/auth`). El wrapper de `next-auth@5.0.0-beta.31` (`lib/index.js` dentro
del paquete) hace esto:

```js
async function handleAuth(args, config, userMiddlewareOrRoute) {
  const request = reqWithEnvURL(args[0])
  const sessionResponse = await getSession(request.headers, config)   // Auth.js completo
  ...
  const finalResponse = new Response(response?.body, response)
  // Preserve cookies from the session response
  for (const cookie of sessionResponse.headers.getSetCookie())
    finalResponse.headers.append("set-cookie", cookie)               // ← se pegan al response
  return finalResponse
}
```

`getSession()` llama a `Auth()`, que llama a `init()`, que llama a `createCSRFToken()`. Si el
request no trae cookie de CSRF, **el middleware genera un token nuevo y lo pega como
`Set-Cookie` en la respuesta**. Después el route handler de `app/api/auth/[...nextauth]`
hace exactamente lo mismo, con su propio token.

### 3.3 Reproducido en producción

Sondas de sólo lectura (`GET`, sin efectos de servidor: con estrategia JWT el endpoint de
CSRF no escribe nada).

**Un `GET /api/auth/csrf` sin cookies devuelve dos cookies de CSRF distintas:**

```
Set-Cookie: __Host-authjs.csrf-token=b8313b63…|caf27645…; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: __Secure-authjs.callback-url=…
Set-Cookie: __Host-authjs.csrf-token=fd223f74…|3e1997da…; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: __Secure-authjs.callback-url=…

{"csrfToken":"fd223f74…"}
```

Dos `__Host-authjs.csrf-token` con **valores diferentes** en la misma respuesta, y dos
`__Secure-authjs.callback-url` duplicadas. Eso es la huella de las dos instancias.

**`GET /api/auth/session` hace lo mismo** (dos cookies de CSRF distintas), y `GET /sign-in`
emite una sola: la del middleware, porque la página no es Auth.js.

**El secreto sí es el mismo en ambos runtimes.** Devolviéndole al servidor una cookie recién
emitida, la respuesta vuelve **sin ningún** `Set-Cookie` de CSRF y con el body igual al token
de la cookie: las dos instancias la aceptan. Descarta una hipótesis que valía la pena mirar
(`AUTH_SECRET` presente en Node y ausente en el Edge, cayendo al literal de
[`auth.ts:35`](../auth.ts#L35)).

**Y el disparo, reproducido:** un cliente frío que pide `/api/auth/csrf` y `/api/auth/session`
en paralelo — que es lo que hace el navegador cuando `SessionProvider`
([`app/layout.tsx`](../app/layout.tsx)) todavía está montando y el alumno ya apretó
"Ingresar con Google":

```
15 corridas: 10 terminan con la cookie que coincide, 5 con la cookie pisada
```

**5 de 15 (33 %)** terminan con una cookie que haría fallar el `POST` con `MissingCSRF`. Y eso
desde una sola máquina, con buena conexión y sólo dos requests compitiendo.

### 3.4 Por qué se ve así y no de otra forma

| Hecho observado | Lo explica |
|---|---|
| Falla ~90 % de los POST pero todos terminan entrando | La cookie válida no se rota nunca (§3.1): el primer acierto cierra el problema para ese navegador |
| Cero `MissingCSRF` en los 6 días previos con Sentry mirando | Sólo dispara en el primer contacto de un navegador. 30 primeros contactos juntos no habían pasado nunca |
| Ningún deploy asociado | No es un cambio de código, es un cambio de concurrencia |
| El docente no lo sufrió | Ya tenía sesión y cookie desde antes |
| 10 `InvalidCheck: pkceCodeVerifier` + 4 `CallbackRouteError` | Consecuencia del reintento: cada click nuevo pisa el `pkceCodeVerifier` del anterior, y el callback que vuelve de Google trae el verifier viejo |

### 3.5 Lo que no cierra del todo

Reproduzco **33 %** de fallas; esa noche fue **~90 %**. La diferencia es real y no la puedo
cerrar desde acá. Amplificadores plausibles, ninguno verificado:

- Latencia de una red escolar compartida, que ensancha la ventana de carrera.
- Más requests sin cookie compitiendo por respuesta: los prefetch de RSC de Next también
  pasan por el middleware y también emiten cookie de CSRF.
- Alumnos recargando, abriendo pestañas o haciendo doble click, que multiplica los requests
  fríos concurrentes.

**Qué haría falta para cerrarlo:** los headers `Set-Cookie` reales de un request fallido, con
su orden. Eso hoy no está en ningún lado (Sentry no guarda headers de respuesta y los logs de
runtime de Vercel de esa ventana ya expiraron). En la práctica, lo que faltó fue
instrumentación (§5), no razonamiento.

Aun así: **el mecanismo está probado y es suficiente para producir exactamente este error en
exactamente esta ruta.** No hace falta una segunda causa para explicar el incidente; hace
falta más evidencia sólo para explicar la magnitud.

### 3.6 Hipótesis descartadas

Se dejan escritas porque descartarlas cuesta tiempo y no conviene volver a pagarlo.

| Hipótesis | Veredicto | Por qué |
|---|---|---|
| Un `POST` propio a `/api/auth/signin/google` en vez de `signIn()` | **Descartada** | Los cuatro puntos de login del repo usan `signIn()` de `next-auth/react`: [`app/sign-in/[[...sign-in]]/page.tsx:35`](../app/sign-in/[[...sign-in]]/page.tsx#L35), [`components/navbar.tsx:189`](../components/navbar.tsx#L189), [`app/(app)/aulas/page.tsx:208`](../app/(app)/aulas/page.tsx#L208), [`app/aula/[codigo]/page.tsx:182`](../app/aula/[codigo]/page.tsx#L182). No hay un `<form>` propio |
| CDN sirviendo un token de CSRF cacheado y compartido | **Descartada** | `Cache-Control: private, no-cache, no-store` y `X-Vercel-Cache: MISS` tanto en `/api/auth/csrf` como en `/sign-in`; cada sonda devolvió un token distinto. Un token compartido además habría dejado a 30 personas afuera, no a 0 |
| `AUTH_URL` / `trustHost` / `basePath` mal configurados | **Descartada** | `trustHost: true`, sin `basePath` propio; las cookies vuelven con los prefijos `__Host-`/`__Secure-` correctos para HTTPS, o sea que ambos runtimes resuelven bien origen y protocolo |
| Secreto distinto entre el middleware (Edge) y el handler (Node) | **Descartada** | Una cookie emitida por el handler es aceptada por los dos en el request siguiente (§3.3). Además el middleware validó los JWT de sesión de los alumnos, que llegaron a rutas no públicas |
| Cookies bloqueadas o de tercera parte en el navegador del alumno | **Descartada como causa** | La cookie es de primera parte, `SameSite=Lax`, `__Host-`, sobre un POST del mismo origen. Brave, el más agresivo, aporta 10 % de los eventos sin sobrerrepresentación, y los 31 alumnos terminaron autenticándose. No se puede excluir del todo como contribuyente en algún equipo suelto |
| `GHSA-8fpg-xm3f-6cx3` de next-auth ([deuda-tecnica §3b.2](deuda-tecnica.md#2-next-auth--directa-critical)) | **Descartada para este incidente** | Ese advisory describe chequeos de autenticación que fallan **abiertos**. Acá el fallo es cerrado y en el CSRF. Sigue valiendo parchear, por sus propios motivos |

---

## 4. Cuántos alumnos no pudieron entrar

**Cero, ±1.**

El razonamiento, con lo que la evidencia sí soporta:

1. Se crearon **31 cuentas** entre las 22:05:58 y las 22:42:51, todas `ALUMNO`, todas
   onboardeadas, ninguna como invitado.
2. **Esos mismos 31** —ni uno más, ni uno menos— completaron al menos un `quiz_attempt`.
3. Tres mediciones independientes convergen en ~30-31 logins exitosos: las filas de `users`,
   los ~30 intercambios de token contra `oauth2.googleapis.com` y las ~120 queries a Neon
   dentro de los `GET /api/auth/*` (4 por login exitoso).
4. El docente informó **30 alumnos**. **31 ≥ 30.**

Como el número de cuentas **iguala o supera** el tamaño de curso informado, no queda lugar
para un alumno que se haya quedado afuera.

### El margen, y por qué es ±1 y no 0

**La base sólo ve a quien tuvo éxito.** Un alumno que se cansó y cerró la notebook no deja
rastro en ningún lado:

- No hay fila en `users` (se crea recién en el callback de OAuth, después del login).
- No hay fila de invitado: se usó el login con Google, no el join por código
  ([`lib/guest-session.ts`](../lib/guest-session.ts) quedó sin usar, 0 invitados).
- No hay identidad en Sentry: los 305 eventos son de servidor y llevan `Users Impacted: 0`
  (ver §5).
- No hay lista de curso contra la cual comparar: el examen no se tomó dentro de un aula.

O sea que el `0` **no** se deduce de haber contado a los que fallaron —eso es imposible con
los datos que hay—, sino de que los que entraron ya cubren el curso entero. Si la lista real
fuera de 32 o más, no podríamos distinguir "uno abandonó" de "uno faltó". **Ese ±1 lo cierra
el docente confirmando cuántos alumnos había en el aula esa noche, y nada más.**

### Lo que sí se perdió

No fue gente, fue tiempo de examen, y no repartido parejo:

| | |
|---|---|
| Intentos fallidos de login | **305** |
| Intentos por alumno (promedio) | **~10** |
| Demora mediana en entrar | **5,6 min** |
| Alumnos que tardaron más de 10 min | **5** |
| Peor caso | **37 min** (última alta 22:42:51) |
| Ventana total de altas | 22:05:58 → 22:42:51 |

Cinco alumnos empezaron el diagnóstico con más de diez minutos de desventaja y uno con
treinta y siete. Si el diagnóstico tenía tiempo contra reloj, **eso** es lo que hay que
decidir si se repite, no el acceso.

---

## 5. Lo que faltó medir

Ordenado por cuánto habría cambiado esta investigación.

1. **Identidad en los eventos de servidor de Sentry.** Los 305 eventos dicen
   `Users Impacted: 0`. `sentry.server.config.ts` pone `sendDefaultPii: false` (bien) pero
   nadie llama a `Sentry.setUser()`. Con un **hash con sal** del id de usuario o de la cookie
   de sesión —no el id crudo, no el email— "305 eventos" habría sido "N personas distintas, M
   de ellas nunca lo lograron". **Es la única medición que convierte este informe de un rango
   con margen en un número.** Costo: unas pocas líneas en un helper de servidor.
2. **El examen fuera de un aula.** 1 aula, 0 miembros, 0 asignaciones, 84 intentos con
   `classroom_id NULL`. Sin lista de curso el producto **no puede** contestar "quién falta",
   por diseño. Es la razón de fondo por la que hubo que acotar con "31 ≥ 30".
3. **`tracesSampleRate: 0.1`.** Los conteos de la §2.2 son ×10 sobre 33 y 3 muestras. Alcanzan
   para el orden de magnitud y no para una razón. Subirlo a 1.0 **sólo para `/api/auth/*`** es
   barato: es un puñado de requests por sesión.
4. **Sin alerta.** El incidente se descubrió a mano dos días después. `MissingCSRF` en el
   endpoint de login es el ejemplo de manual de una alerta.
5. **Stacks sin simbolicar** ([deuda-tecnica §5](deuda-tecnica.md#5-source-maps-de-sentry-con-turbopack--diagnóstico-sin-arreglo)).
   MAESTRIA-A y MAESTRIA-F son la mitad ilegible de MAESTRIA-9 y MAESTRIA-G. Acá no costó
   nada porque el mensaje se explicaba solo; la próxima puede no ser así.
6. **Los logs de runtime de Vercel de esa ventana ya expiraron**, y con ellos la única fuente
   que tenía los `Set-Cookie` reales en orden. Ver §3.5.

---

## 6. Qué hacer antes del próximo examen

Separado en arreglos (cambian el código) y mitigaciones (cambian el operativo). **Las
mitigaciones alcanzan solas para tomar el examen mañana**; los arreglos son para que esto no
dependa del operativo.

### Mitigaciones operativas — hacer sí o sí, cuestan cero código

| # | Qué | Certeza | Por qué |
|---|---|---|---|
| M1 | **Login escalonado 10 minutos antes de empezar**, en tandas de 5 | **Alta** | El bug dispara **sólo** en el primer contacto y se cura solo. Sin 30 primeros contactos simultáneos, no hay incidente. Es la mitigación que más compra por menos plata |
| M2 | **Tomar el examen dentro de un aula**, con la asignación creada y los alumnos unidos por código | **Alta** | Da la lista de curso que hoy no existe. Sin esto, la próxima vez tampoco se va a poder contestar "quién no entró". Además habilita M3 |
| M3 | **Plan B por código de invitado** si el login con Google se traba | Media | [`lib/guest-session.ts`](../lib/guest-session.ts) es un camino de cookie propio, sin NextAuth ni CSRF de Auth.js: este bug no lo toca. Pero **sólo sirve si el examen es una asignación de aula** (M2) |
| M4 | **Alerta en Sentry sobre `MissingCSRF`** y sobre cualquier error en `/api/auth/*` | Alta | Que no haya que descubrirlo leyendo el panel dos días después |

### Arreglos — propuestos, no aplicados

**A1 — Sacar `/api/auth/*` del matcher del middleware.** Costo: una línea. Certeza: alta
sobre la causa probada; parcial sobre el residuo (ver A2).

Es lo que la documentación de NextAuth recomienda y lo que evita que corran dos instancias de
Auth.js sobre el mismo request. `/api/auth/*` ya está en `PUBLIC_PATHS`, así que el middleware
no le estaba aportando ninguna protección: sólo duplicaba cookies.

```diff
--- a/proxy.ts
+++ b/proxy.ts
 export const config = {
   matcher: [
-    // Skip Next.js internals and static assets
-    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
-    // Always run for API routes
-    '/(api|trpc)(.*)',
+    // `api/auth` queda afuera a propósito. El wrapper `auth()` corre una
+    // instancia completa de Auth.js por request y emite su propia cookie
+    // `__Host-authjs.csrf-token`. Sobre las rutas del propio NextAuth eso
+    // duplica la cookie y puede pisar el token que el cliente acaba de
+    // recibir por GET /api/auth/csrf, y el POST de signin muere con
+    // MissingCSRF. Ver docs/investigacion-login-10-08.md.
+    // No pierde protección: /api/auth ya está en PUBLIC_PATHS.
+    '/((?!api/auth|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
   ],
 }
```

El segundo patrón se puede borrar: `/api/*` ya cae dentro del primero (sólo excluye `_next` y
extensiones estáticas). Conviene verificarlo con un test de rutas antes de mergear, no de
memoria.

**A2 — Darle la sesión a `SessionProvider` desde el servidor.** Costo: bajo, con una
contraindicación real. Certeza: alta sobre el residuo.

A1 saca una de las dos fuentes de cookie, pero queda una carrera menor entre dos requests
fríos a `/api/auth/*`: `GET /api/auth/session` (que dispara `SessionProvider` al montar) y
`GET /api/auth/csrf` (que dispara `signIn()`). Si la sesión llega última, pisa igual. Pasarle
la sesión desde el servidor elimina ese fetch automático:

```diff
--- a/app/layout.tsx
+++ b/app/layout.tsx
+import { auth } from '@/auth'
 import { SessionProvider } from 'next-auth/react'

-export default function RootLayout({ children }: ...) {
+export default async function RootLayout({ children }: ...) {
+  const session = await auth()
   return (
     <html lang="es" className="bg-background">
       <body className={...}>
-        <SessionProvider>
+        <SessionProvider session={session}>
```

**Contraindicación:** esto vuelve dinámico el layout raíz para *todas* las rutas, incluidas
las estáticas. Hay que medir el impacto antes de mergearlo; si molesta, la alternativa es
mover el `SessionProvider` a los layouts que de verdad lo necesitan.

**A3 — Subir `next-auth` al último `5.0.0-beta`.** Costo: bajo, con smoke test manual
obligatorio. Certeza: **desconocida** para este bug.

Ya está priorizado en
[deuda-tecnica.md → Arreglar antes de invitar usuarios](deuda-tecnica.md#arreglar-antes-de-invitar-usuarios),
por `GHSA-8fpg-xm3f-6cx3`. Hay que **verificar** si upstream cambió el `handleAuth` de §3.2;
si no lo cambió, este bump no arregla nada de acá. **No sustituye a A1.** Mismo smoke test
que pide la deuda técnica: login con Google, sesión de invitado y switch ALUMNO↔DOCENTE.

**A4 — Instrumentación**, en el orden de la §5: identidad hasheada en los eventos de servidor
(1), muestreo al 100 % en `/api/auth/*` (3), alerta (4). Es lo que hace que la próxima vez la
pregunta del docente se conteste en cinco minutos y con un número, no en una tarde y con un
rango.

### Cómo verificar que quedó arreglado

Sin desplegar no se puede afirmar nada, así que el criterio de aceptación es concreto:

1. Contra el deploy nuevo, `GET /api/auth/csrf` **sin cookies** tiene que devolver **una sola**
   cabecera `Set-Cookie: __Host-authjs.csrf-token`, y su token tiene que ser igual al
   `csrfToken` del body.
2. La sonda concurrente de §3.3 (`/api/auth/csrf` y `/api/auth/session` en paralelo, cliente
   frío, 15 corridas) tiene que dar **0 mismatches**, no 5.
3. Recién con (1) y (2) en verde tiene sentido volver a tomar examen con 30 personas sin M1.
   **Mientras tanto, M1 no es opcional.**

---

## 7. Veredicto

**¿Se puede volver a tomar examen con 30 personas?** Sí, aplicando **M1 y M2**. Con login
escalonado el bug no llega a dispararse, y con el examen dentro de un aula la próxima vez la
pregunta "quién no entró" tiene respuesta directa en vez de una reconstrucción forense.

**¿Hay que repetirle el examen a alguien?** Por no haber podido entrar, **no**: entraron los
31. Por haber empezado tarde, es una decisión pedagógica del docente, no técnica — **5 alumnos
arrancaron con más de 10 minutos de desventaja y 1 con 37**.
