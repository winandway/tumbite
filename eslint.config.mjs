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
      // Copias de trabajo temporales de los ayudantes (otras ramas en curso).
      '.claude/**',
      '**/dist/**',
      '**/.expo/**',
      // Proyectos nativos generados por «expo prebuild» al compilar los APK (no son código nuestro).
      'apps/*/android/**',
      'apps/*/ios/**',
      '**/.dist-worker/**',
      '**/.dist-tiempo-real/**',
      '**/.dist-reloj/**',
      'out-pruebas/**',
      'out-produccion/**',
      'out-deploy/**',
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
    // El generador de la identidad lee los vectores de identidad-divoox/ y escribe las piezas en
    // las carpetas de cada app: sus rutas se arman desde la raíz del repositorio, no del usuario.
    // Lo mismo para los de Google Play: leen la llave privada, el .aab y las fichas.
    files: [
      'scripts/marca/generar-identidad.mjs',
      'scripts/marca/fichas-tiendas.mjs',
      'scripts/marca/graficos-google-play.mjs',
      'scripts/tiendas/*.mjs',
    ],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    // Complementos de configuración de Expo: Node con módulos clásicos (los lee «expo prebuild»).
    files: ['plugins/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
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
    // El revisor de paquetes recorre la carpeta del paquete que arma CI (out-pruebas, out-produccion):
    // leer rutas variables es su trabajo. Solo esta regla y solo este archivo (C-ENTORNOS-SEPARADOS).
    files: ['scripts/verificar-paquete.mjs'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
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
