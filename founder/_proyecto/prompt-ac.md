# Mensaje de arranque · tanda AC de MaestrIA (28/11)

Para pegar en una sesión nueva de Claude Code, en la terminal de Antigravity, parado en `C:\Programacion\Math Malejo\MalejoMath`. Sirve también para **retomar**.

**Antes de pegarlo:**
1. **Mergeadas #158 → #170 y después #171**, en ese orden (el conflicto AB3/AA1 ya está resuelto en `tanda-ab/integracion`: si GitHub lo marca, quedate con la versión de esa rama).
2. `docs/tandas/tanda-ac-2026-11-28.md` está en el repo sin commitear (lo dejó Claude). No lo borres.
3. `.env.staging.local` presente y la branch de staging de Neon despierta. Si querés que AC7 se haga, cargá ahí las credenciales `TEST-` de Mercado Pago.
4. PC enchufada y sin suspensión.
5. **Al pegarlo aprobás hasta USD 0,10 de Gemini en staging** (AC4 y AC8).

```
Tanda AC de MaestrIA. Sos el lead; trabajá ítem por ítem, AC1 a AC8, en orden.

1. git fetch origin y git checkout main && git pull. Si el pull se queja de archivos sin seguimiento en docs/founder/ o en docs/tandas/tanda-aa-2026-11-26.md y tanda-ab-2026-11-27.md, borrá esas copias locales (son las mismas que ya están en main) y repetí el pull; tanda-ac-2026-11-28.md no se borra. Comprobá que #158 a #171 estén en main; si no, pará y avisame.
2. Leé completos: CLAUDE.md, docs/roadmap.md, docs/informes/tanda-ab-2026-11-27.md y docs/tandas/tanda-ac-2026-11-28.md.
3. Primero commiteá docs/tandas/tanda-ac-2026-11-28.md en la rama de AC1 (solo ese archivo; no toques docs/calidad/ ni docs/founder/).
4. Una rama y una PR por ítem desde main, con npm test y npm run build en verde. Ningún merge.

Reglas duras: nada contra producción (siempre npm run dev:staging y --env=staging; prod solo lectura donde el ítem lo pide); migraciones solo en staging y con válvula; no cambiar precios, niveles, DIAS_PASE ni cupoGratis(); datos ficticios; nunca imprimir secretos ni tocar .env*. Gemini en staging: tope USD 0,10, cada llamada anotada. A las 2 fallas o 2 horas en un ítem: [BLOQUEADO] y seguí. No pares a preguntar: ante la duda, lo más simple que falle cerrado, anotado en el informe.

Avance en docs/informes/tanda-ac-2026-11-28.md (si existe, retomá desde donde quedó). Al terminar AC8, cerrá el informe y actualizá docs/roadmap.md en su propia PR.
```

**Qué vas a encontrar:** ~9 PR (`tanda-ac/*`), una rama `tanda-ac/integracion`, la migración nueva para correr en prod (AC1) y `CRON_SECRET` para cargar en Vercel (AC5).
