import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // `.claude/worktrees/` son worktrees de git: copias completas del repo.
    // Sin esta línea, correr los tests desde la raíz con un worktree vivo
    // levanta también los suyos — medido el 16/08/2026: 67 archivos vistos,
    // 32 de ellos duplicados. Además de tardar el doble, sus fallas de
    // resolución del alias `@` se leen como si las hubiera causado el cambio
    // que estás probando.
    //
    // `node_modules`, `dist` y `.next` van explícitos porque declarar
    // `exclude` reemplaza los valores por defecto de vitest en vez de
    // sumarse a ellos.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.claude/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
