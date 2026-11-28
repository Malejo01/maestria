# Mensaje de arranque · tanda AD de MaestrIA (noche del 27/11)

Para pegar en una sesión nueva de Claude Code, en la terminal de Antigravity, parado en `C:\Programacion\Math Malejo\MalejoMath`. Sirve también para **retomar**.

**Antes de pegarlo:**
1. Ideal: la PR #180 (integración AB + AC) mergeada. Si no llegaste, igual funciona: la tanda sale de `tanda-ac/integracion`.
2. `docs/tandas/tanda-ad-2026-11-28.md` está en el repo sin commitear (lo dejó Claude).
3. `.env.staging.local` presente, branch de staging de Neon despierta, PC enchufada y sin suspensión.
4. **Al pegarlo aprobás hasta USD 0,10 de Gemini en staging.**

```
Tanda AD de MaestrIA. Sos el lead; trabajá AD0 a AD5 en orden.

1. git fetch origin. Si la PR #180 está mergeada, partí de origin/main; si no, de origin/tanda-ac/integracion y apuntá las PR a esa rama. Si un checkout o pull se queja de archivos sin seguimiento en docs/founder/ o docs/tandas/ que ya están en la rama, borrá esas copias locales y repetí; tanda-ad-2026-11-28.md no se borra.
2. Leé completos: CLAUDE.md, docs/roadmap.md (sobre todo «EL SALTO PENDIENTE»), docs/informes/tanda-ac-2026-11-28.md y docs/tandas/tanda-ad-2026-11-28.md.
3. Commiteá docs/tandas/tanda-ad-2026-11-28.md en la rama de AD0 (solo ese archivo).
4. Una rama y una PR por ítem, con npm test y npm run build en verde. Ningún merge.

Reglas duras: nada contra producción (siempre npm run dev:staging y --env=staging; prod solo lectura donde se pide); migraciones solo en staging y con válvula; no cambiar precios, planes ni cupos; datos ficticios; nunca imprimir secretos ni tocar .env*. Gemini en staging: tope USD 0,10, cada llamada anotada. A las 2 fallas o 2 horas en un ítem: [BLOQUEADO] y seguí. No pares a preguntar: ante la duda, lo más simple que falle cerrado, anotado en el informe.

Avance en docs/informes/tanda-ad-2026-11-28.md (si existe, retomá desde donde quedó). Al terminar, cerrá el informe y actualizá docs/roadmap.md en su propia PR.
```
