# MaestrIA · Pasos manuales para integrar todo (27/11, noche)

Estado verificado a las 23:30: **AB (#158–#171) y AC (#172–#179) con el CI en verde, nada mergeado en `main`.** La PR **#180** (`tanda-ac/integracion` → `main`) junta todo. Producción tiene las migraciones **hasta la 049**. En Vercel ya existen `MAESTRIA_PRECIO_MENSUAL_BLOQUE`, `MAESTRIA_PRECIO_PASE_BLOQUE` (desde el 16/11, con los precios viejos), `MAESTRIA_WHATSAPP_CONTACTO` y `CRON_SECRET` (desde el 23/11).

## Esta noche o mañana temprano (≈ 45 min)

### 1 · Mirar staging (15 min)
```
git fetch origin
git checkout tanda-ac/integracion
npm run dev:staging
```
- `/profes?origen=meta&ref=AD-x` y «Empezar gratis».
- `/precios`: una sola oferta adelante; Aula/Institución/Autodidacta detrás del botón.
- `/sign-in/dev` como un docente `aa4-docente-…` (particular): arranque en «Listo», «Esta semana», la campanita con el muro, «Crear curso» deshabilitado.
- Un docente de curso: «Particulares 0 de 2 · Curso 3 de 35».
- Generar una tarea y tocar «Compartir»: tiene que abrir «Revisá y aprobá».

### 2 · Mergear (5 min)
1. Mergear **#180** en `main`. Una sola PR con todo AB + AC.
2. Las PR de #158 a #171 apuntan a `main`: GitHub las marca como mergeadas solas. Las de AC (#172–#179) apuntan a ramas de AB: **cerralas sin mergear** (su contenido ya entró con #180).
3. Vercel despliega solo. Las válvulas hacen que funcione aunque la migración 050 no esté todavía.

### 3 · Migración 050 en producción (5 min)
```
git checkout main
git pull
npx tsx scripts/run-migration-050.ts
```
Pide escribir el id del proyecto (`noisy-smoke-23995229`). Agrega `users.modalidad` y `avisos_guardados`. Sin ella: modalidad sin dato (regla vieja), sin aviso del muro ni de los lunes.

### 4 · Vercel (5 min)
| Variable | Hacer |
|---|---|
| `MAESTRIA_PRECIO_MENSUAL_BLOQUE` | **editar** → `15000` |
| `MAESTRIA_PRECIO_PASE_BLOQUE` | **editar** → `35000` |
| `MAESTRIA_WHATSAPP_CONTACTO` | ya está |
| `CRON_SECRET` | ya está (23/11). El informe pide que sea igual a `RESPALDO_SECRETO`: revisá que coincidan |
| `MAESTRIA_PRUEBA_DIAS` | opcional (`0` es el valor por defecto) |
Después: **Redeploy** de producción para que tome los precios.

### 5 · En producción (5 min)
- `/admin/codigos` → crear **`FUNDADOR`**: 33 %, Particular, mensual, 3 meses, 20 usos.
- Revisar `/profes`, `/precios` (tiene que decir $15.000) y `/admin/embudo` (fila «Criterio de verificación»).

### 6 · Limpieza local (2 min)
- En el repo, si `git pull` se queja: borrar las copias sin seguimiento de `docs/founder/` y `docs/tandas/` (ya vienen en `main`), **menos** `tanda-ad-2026-11-28.md` si vas a lanzar la tanda AD.
- Borrar `C:\Programacion\Math Malejo\pruebas-programas\_entrega-27-11` (copia de paso).
- Tus cambios en `docs/calidad/` siguen ahí, sin tocar.

## Cuando puedas (no bloquea)
- **Video `public/profes/reel.mp4`** para `/profes` (hoy muestra una captura).
- **AC7 · Mercado Pago de prueba:** credenciales `TEST-` (Access Token + clave del webhook en modo prueba) en `.env.staging.local`, un Preview de Vercel con las variables de staging como URL pública y un comprador de prueba. Pasos exactos en `docs/informes/tanda-ac-2026-11-28.md`, AC7.
- **Meta:** ver si aprobaron el anuncio de clases; si sí, sumar Instagram repartiendo los mismos $3.000/día. El 1/12 miramos el costo por conversación. **La campaña de MaestrIA sigue pausada en $0.**

## Desde el 29/11 · la prueba comercial
10 colegas con videollamada de 15 min, gratis con 2 alumnos, código `FUNDADOR` para el que quiera pasar a pago. Desde acá cuenta el criterio: **≥ 15 activados y ≥ 5 pagando, 3 fuera de tu red, al 31/1** (se ve en `/admin/embudo`).
