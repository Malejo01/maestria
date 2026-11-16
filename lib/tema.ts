/**
 * Modo claro / oscuro.
 *
 * El modo vive en `data-theme` sobre <html>, que es lo que leen los tokens de
 * app/tokens.css. La app abre SIEMPRE en claro (brand-book.md): no se sigue la
 * preferencia del sistema operativo, porque una docente que entra por primera
 * vez no debería encontrarse con una pantalla negra. El oscuro se elige con el
 * botón de la barra y se recuerda en este navegador.
 *
 * No se usa next-themes: inyecta su <script> desde un componente cliente y
 * React 19 lo marca como error en consola. Acá el script va en el <head> desde
 * el layout de servidor, que es el lugar donde React sí lo admite.
 */
export type Tema = 'claro' | 'oscuro'

export const CLAVE_TEMA = 'maestria-tema'

/** Corre antes del primer pintado, para que el modo oscuro elegido no parpadee en claro. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem('${CLAVE_TEMA}')==='oscuro')document.documentElement.dataset.theme='oscuro'}catch(e){}`

/**
 * `theme-color` del navegador. Un <meta> no puede leer una variable CSS, así
 * que estos dos valores son el espejo de `--superficie-base` en cada modo. Si
 * cambia ese token en tokens.json, cambian acá. tests/tokens.test.ts lo exige.
 */
export const COLOR_DE_BARRA_DEL_NAVEGADOR: Record<Tema, string> = {
  claro: '#f6f7f9',
  oscuro: '#0f1217',
}
