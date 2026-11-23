/**
 * Ronda V · V5 — Los valores de app/tokens.css para lo que no puede leer
 * variables de CSS (la imagen para compartir, que se dibuja en el servidor).
 * Así los colores siguen saliendo de los tokens, nunca de un literal.
 *
 * `leerTokens` es puro; `tokensDelSistema` lee el archivo.
 */

/** Las variables `--nombre: valor;` del bloque claro (`[data-theme="claro"]`) o del oscuro (`[data-theme="oscuro"]`). */
export function leerTokens(css: string, modo: 'claro' | 'oscuro' = 'claro'): Record<string, string> {
  const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }))
  const esOscuro = (sel: string) => /oscuro|dark/.test(sel)
  const elegido =
    modo === 'oscuro'
      ? bloques.find((b) => esOscuro(b.selector))
      : bloques.find((b) => /claro/.test(b.selector)) ?? bloques.find((b) => /:root/.test(b.selector) && !esOscuro(b.selector))
  const salida: Record<string, string> = {}
  for (const m of (elegido?.cuerpo ?? '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) salida[m[1]] = m[2].trim()
  return salida
}

export async function tokensDelSistema(modo: 'claro' | 'oscuro' = 'claro'): Promise<Record<string, string>> {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  return leerTokens(await readFile(join(process.cwd(), 'app', 'tokens.css'), 'utf8'), modo)
}
