import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * ESLint 9 (flat config) + `eslint-config-next@16.2.4`, pineado a la misma
 * versión que `next`. Desde la 16 el paquete exporta configs planas directas,
 * así que no hace falta `FlatCompat` ni `@eslint/eslintrc`; los presets ya
 * traen typescript-eslint, react, react-hooks 7, jsx-a11y e import.
 *
 * `npm run lint` es `eslint .` — no `next lint`, que quedó deprecado.
 *
 * ── Sobre los `warn` de más abajo ────────────────────────────────────────────
 * ESLint entró a un proyecto que ya estaba escrito, y la primera corrida dio 79
 * errores en código preexistente. Se decidió no arreglarlos en la misma pasada
 * que instala la herramienta: cada uno se relevó, se clasificó y quedó anotado
 * en docs/deuda-tecnica.md, con el orden en que conviene cerrarlos.
 *
 * Bajarlos a `warn` y no a `off` es deliberado. `off` los borra del reporte y
 * entonces nada distingue "no lo arreglamos todavía" de "no existe"; `warn`
 * deja el lint en verde (ESLint sólo falla por errores) y a la vez mantiene el
 * inventario a la vista, que es lo que hace que la deuda se pueda cerrar.
 *
 * Ninguna de estas reglas está apagada para siempre: cada una vuelve a `error`
 * cuando su bloque llegue a cero. Como CI corre `npm test` y `npm run build`
 * pero NO el lint, bajar a `warn` no pone en verde nada que hoy esté en rojo
 * allá — la única consecuencia es local.
 */
const config = [
  {
    // `.claude/**` cubre los worktrees de git anidados. Los patrones de acá se
    // anclan a la raíz del proyecto, así que `.next/**` NO alcanza al `.next/`
    // de un worktree: sin esta entrada, `eslint .` entra a los chunks
    // compilados de la copia anidada y reporta decenas de miles de warnings
    // sobre código generado, que tapan por completo los del repo.
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/**', '.claude/**'],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    rules: {
      // 52 apariciones, 18 de ellas en app/api/generate-quiz/route.ts. Es la
      // contracara de no tener ORM: las filas de Neon vuelven sin forma y el
      // `any` es el atajo. Cerrarlo es el mismo trabajo que ya se hizo con las
      // 4 filas tipadas de la limpieza anterior (ver docs/deuda-tecnica.md 3a).
      '@typescript-eslint/no-explicit-any': 'warn',

      // 22 apariciones. Regla nueva de eslint-plugin-react-hooks 7: no existía
      // cuando se escribió este código. Varias son bootstrap de datos con
      // fetch, que es un falso positivo caro de reescribir; otras son resets de
      // estado que sí valdría la pena derivar en vez de sincronizar.
      'react-hooks/set-state-in-effect': 'warn',

      // 2 apariciones, ambas en app/api/generate-quiz/route.ts. Autofixeable
      // con `eslint --fix`; queda pendiente sólo para no mezclar un cambio de
      // código con el commit que instala la herramienta.
      'prefer-const': 'warn',

      // 2 apariciones: un `const module = await import('word-extractor')` en
      // dos rutas. No reasigna nada — declara una variable que se llama igual
      // que el `module` de CommonJS, que el bundler puede terminar sombreando.
      // Se arregla renombrando la variable.
      '@next/next/no-assign-module-variable': 'warn',
    },
  },

  {
    // `components/ui/` es shadcn/ui vendorizado (ver CLAUDE.md): se compone
    // sobre estos primitivos, no se los reescribe. Lintearlos con las reglas
    // del código propio reporta contra un upstream que no controlamos, y peor,
    // invita a "arreglarlos" y a que el próximo `npx shadcn add` pise el
    // arreglo. Se los revisa igual, pero sin severidad de error.
    files: ['components/ui/**'],
    rules: {
      'react-hooks/purity': 'warn',
    },
  },
]

export default config
