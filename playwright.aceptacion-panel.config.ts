import { defineConfig } from '@playwright/test';

/**
 * C-ROBOT-PANEL (26 nov 2026): el robot del panel recorre cada noche las líneas A1 a A9 de la lista de
 * aceptación (~/Gerencia/LISTA-DE-ACEPTACION-DIVOOX.md, sección 3) contra el SITIO DE PRUEBAS y solo con
 * cuentas de prueba. Se corre con el lanzador, que escribe el parte:
 *   node scripts/aceptacion/panel.mjs
 * Cada línea es su propio test: una que falla no frena a las demás.
 */
export default defineConfig({
  testDir: './e2e/aceptacion/panel',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.ACEPTACION_JSON || 'test-results/aceptacion-panel.json' }],
  ],
  outputDir: 'test-results/aceptacion-panel',
  use: {
    baseURL: process.env.ACEPTACION_URL || 'https://staging.tumbite.com',
    trace: 'retain-on-failure',
  },
});
