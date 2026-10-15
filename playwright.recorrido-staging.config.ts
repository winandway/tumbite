import { defineConfig } from '@playwright/test';

/**
 * El recorrido completo contra el SITIO DE PRUEBAS, con Stripe en modo prueba de verdad.
 * Uso (solo desde GitHub, que guarda el secreto): RECORRIDO_URL=https://staging.tumbite.com
 * RECORRIDO_SECRETO=… npx playwright test -c playwright.recorrido-staging.config.ts
 */
export default defineConfig({
  testDir: './e2e/recorrido',
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: process.env.RECORRIDO_URL, trace: 'retain-on-failure' },
});
