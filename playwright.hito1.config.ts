import { defineConfig } from '@playwright/test';

/** Hito 1 contra el SITIO DE PRUEBAS. Uso: HITO1_URL=https://staging.tumbite.com npx playwright test -c playwright.hito1.config.ts */
export default defineConfig({
  testDir: './e2e/hito1',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: process.env.HITO1_URL, trace: 'retain-on-failure' },
});
