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
      '**/dist-web/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.dist-worker/**',
      '**/.wrangler/**',
      '**/coverage/**',
      'out-deploy/**',
      '**/*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
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
