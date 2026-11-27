# Mensaje de arranque · tandas AA + AB de MaestrIA (noche del 27/11)

Para pegar en una sesión nueva de Claude Code, en la terminal de Antigravity, parado en `C:\Programacion\Math Malejo\MalejoMath`. Sirve también para **retomar** si la sesión se corta.

**Antes de pegarlo:**
1. `docs/founder/` y `docs/tandas/` ya están en el repo, sin commitear (los dejó Claude). No los borres.
2. Tus cambios sin commitear en `docs/calidad/` siguen ahí: la tanda no los toca.
3. `.env.staging.local` presente y la branch de staging de Neon despierta.
4. La PC enchufada y sin suspensión.
5. **Al pegarlo aprobás hasta USD 0,20 de Gemini en staging** (AB9 + AA4). Si no querés gastar nada, cambiá esa línea por «USD 0 en modelos, solo fixtures».

```
Tandas AA + AB de MaestrIA. Sos el lead; trabajá ítem por ítem, en el orden que dice docs/tandas/tanda-ab-2026-11-27.md.

1. git fetch origin. Partí siempre de origin/main.
2. Leé completos: CLAUDE.md, docs/roadmap.md, docs/founder/summary.md, docs/founder/offer.md, docs/founder/pricing.md, docs/tandas/tanda-aa-2026-11-26.md y docs/tandas/tanda-ab-2026-11-27.md.
3. AB1 primero: commiteá docs/founder/ y docs/tandas/ en la rama tanda-ab/ab1-founder (solo esas dos carpetas; no toques docs/calidad/).
4. Después el resto, una rama y una PR por ítem, con npm test y npm run build en verde. Ningún merge.

Reglas duras: nada contra producción (siempre npm run dev:staging y --env=staging; prod solo lectura donde el ítem lo pide); migraciones solo en staging; no cambiar precios, planes ni DIAS_PASE en el código; datos ficticios; nunca imprimir secretos ni tocar .env*. Gemini en staging: tope USD 0,20 en toda la noche, cada llamada anotada. A las 2 fallas o 2 horas en un ítem: [BLOQUEADO] y seguí. No pares a preguntar: ante la duda, lo más simple que falle cerrado, anotado en el informe.

Avance en docs/informes/tanda-ab-2026-11-27.md (si existe, retomá desde donde quedó). Al terminar AA4, cerrá el informe y actualizá docs/roadmap.md en su propia PR.
```

**Qué vas a encontrar a la mañana:** ~12 PR abiertas (`tanda-ab/*`), una rama `tanda-ab/integracion` para probar todo junto en staging, y el informe con las variables para Vercel y el link del anuncio.
