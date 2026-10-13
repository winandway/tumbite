import { defineConfig } from '@playwright/test';

/**
 * El recorrido completo en el navegador, contra Tumbite armado como en producción en esta
 * computadora (scripts/recorrido/preparar.mjs). Stripe va simulado; nada sale a internet.
 * Uso: npm run recorrido   (CAPTURAS=1 guarda las capturas para Docs)
 */
const puerto = process.env.PUERTO_RECORRIDO ?? '8790';
export default defineConfig({
  testDir: './e2e/recorrido',
  workers: 1,
  timeout: 240_000,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${puerto}`, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node scripts/recorrido/stripe-simulado.mjs',
      port: Number(process.env.PUERTO_STRIPE ?? 12111),
      reuseExistingServer: true,
    },
    {
      command: `npx wrangler dev -c .recorrido/wrangler.jsonc --port ${puerto} --persist-to .recorrido/estado`,
      url: `http://localhost:${puerto}/datos/salud`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
