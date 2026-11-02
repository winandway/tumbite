import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'compartido',
          include: ['packages/compartido/src/**/*.test.{ts,tsx}'],
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
          name: 'tiempo-real',
          include: ['apps/tiempo-real/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'verificador',
          include: ['apps/verificador/src/**/*.test.ts'],
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
      include: [
        'packages/compartido/src/**',
        'apps/servidor/src/**',
        'apps/panel/src/**',
        'apps/tiempo-real/src/**',
        'apps/verificador/src/**',
      ],
      exclude: [
        '**/*.test.*',
        '**/index.ts',
        'apps/panel/src/main.tsx',
        'apps/tiempo-real/src/pruebas.ts',
      ],
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
        // C-COBERTURA-DINERO (COB-7, 2 nov 2026): archivos de dinero del servidor que se subieron
        // al 90 % de líneas; ninguno puede volver a bajar de ahí.
        ...Object.fromEntries(
          [
            'finanzas/reloj.ts',
            'finanzas/rutasEmpresa.ts',
            'finanzas/rutasAdmin.ts',
            'finanzas/billetera.ts',
            'finanzas/cobrosRuta.ts',
            'finanzas/conductor.ts',
            'plus.ts',
            'tarjetasRegalo.ts',
            'viajesCobro.ts',
            'internacional/recargas.ts',
            'sms.ts',
            // C-PROMO-RESTAURANTE (BRE-5): la promoción que paga el restaurante.
            'promociones.ts',
            'rutas/promociones.ts',
            // C-DESCUENTOS-RECALCULO (BRE-5c): cupón, Plus y regalo en los recálculos del pedido.
            'descuentosPedido.ts',
            // C-ENVIO-UNA-VEZ (BRE-R3): crear el pedido y validar cupones (el envío una sola vez).
            'rutas/pedidos.ts',
            'rutas/cupones.ts',
          ].map((f) => [`apps/servidor/src/${f}`, { lines: 90 }]),
        ),
        // C-PROMO-RESTAURANTE (BRE-5): el reparto del pedido y la promoción, al 90 % de líneas.
        'packages/compartido/src/bolsillos.ts': { lines: 90 },
        'packages/compartido/src/promociones.ts': { lines: 90 },
      },
    },
  },
});
