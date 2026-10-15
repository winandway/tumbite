import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'apps/panel/scripts/**',
      'apps/cliente/scripts/**',
      '**/dist-web/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.dist-worker/**',
      '**/.dist-tiempo-real/**',
      '**/.dist-reloj/**',
      '**/.wrangler/**',
      '**/coverage/**',
      'out-deploy/**',
      '.recorrido/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    // Scripts de la casa en Node (preparar el recorrido, Stripe simulado).
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Código de pruebas: no viaja a producción. Se permite leer archivos y usar tipos sueltos en respuestas.
    files: ['**/*.test.{ts,tsx}', '**/pruebas/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  prettier,
);
