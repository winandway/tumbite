import { defineConfig, devices } from '@playwright/test';

/** Prueba de humo del panel web: las rutas principales deben responder 200. */
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: process.env.URL_BASE ?? 'http://localhost:4173' },
  projects: [{ name: 'celular', use: { ...devices['Pixel 7'] } }],
  webServer: process.env.URL_BASE
    ? undefined
    : {
        command: 'npm run preview -w @tumbite/panel -- --port 4173',
        port: 4173,
        reuseExistingServer: true,
      },
});
