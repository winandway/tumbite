import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'compartido',
          include: ['packages/compartido/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'servidor',
          include: ['apps/servidor/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'panel',
          include: ['apps/panel/src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/compartido/src/**', 'apps/servidor/src/**', 'apps/panel/src/**'],
      exclude: ['**/*.test.*', '**/index.ts', 'apps/panel/src/main.tsx'],
      // Umbral global de la casa. Lo que toca dinero se exige al 90 %.
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
        'packages/compartido/src/dinero.ts': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});
