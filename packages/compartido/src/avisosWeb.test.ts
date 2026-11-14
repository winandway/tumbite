import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appDeRuta, estadoAvisosWeb, textosAvisosWeb, type EntornoNavegador } from './avisosWeb';

/** C-AVISOS-WEB (13 nov 2026) — todos los países. */
const ANDROID: EntornoNavegador = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile',
  maxTouchPoints: 5,
  instalada: false,
  tieneServiceWorker: true,
  tienePush: true,
  permiso: 'default',
};
const IPHONE: EntornoNavegador = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15',
  maxTouchPoints: 5,
  instalada: false,
  tieneServiceWorker: true,
  tienePush: false,
  permiso: null,
};
const RAIZ = join(__dirname, '../../..');

describe('C-AVISOS-WEB · cuándo se pueden pedir los avisos', () => {
  it('en Android se pide (Chrome no exige instalar); concedido y bloqueado se respetan', () => {
    expect(estadoAvisosWeb(ANDROID)).toBe('pedir');
    expect(estadoAvisosWeb({ ...ANDROID, permiso: 'granted' })).toBe('permitido');
    expect(estadoAvisosWeb({ ...ANDROID, permiso: 'denied' })).toBe('bloqueado');
    expect(estadoAvisosWeb(null)).toBe('no-aplica');
  });

  it('en iPhone sin agregar a inicio no existe el permiso: se explica primero agregarla', () => {
    expect(estadoAvisosWeb(IPHONE)).toBe('iphone-sin-inicio');
    // El iPad moderno dice «Macintosh»: se reconoce por la pantalla táctil.
    expect(
      estadoAvisosWeb({ ...IPHONE, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }),
    ).toBe('iphone-sin-inicio');
    // Agregada a inicio (iOS 16.4 o superior): ya se puede pedir.
    expect(
      estadoAvisosWeb({ ...IPHONE, instalada: true, tienePush: true, permiso: 'default' }),
    ).toBe('pedir');
    // Una Mac de escritorio (sin pantalla táctil) no es un iPhone.
    expect(
      estadoAvisosWeb({
        ...ANDROID,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        maxTouchPoints: 0,
      }),
    ).toBe('pedir');
  });

  it('cada app se suscribe en su carpeta', () => {
    expect(appDeRuta('/restaurant/')).toEqual({ base: '/restaurant', app: 'restaurante' });
    expect(appDeRuta('/driver')).toEqual({ base: '/driver', app: 'repartidor' });
    expect(appDeRuta('/app/pedido/1')).toEqual({ base: '/app', app: 'cliente' });
    expect(appDeRuta('/panel/pedidos')).toEqual({ base: '/panel', app: 'panel' });
    expect(appDeRuta('/restaurant-terms')).toBeNull();
    expect(appDeRuta('/')).toBeNull();
  });

  it('los textos están en los dos idiomas y explican el caso del iPhone', () => {
    expect(textosAvisosWeb('es').iphone).toContain('Agregar a inicio');
    expect(textosAvisosWeb('en').iphone).toContain('Add to Home Screen');
  });
});

describe('C-AVISOS-WEB · el trabajador de avisos', () => {
  const sw = readFileSync(join(RAIZ, 'apps/cliente/scripts/avisos-sw.js'), 'utf8');

  it('solo muestra avisos y abre la app: no guarda copias (sin fetch ni caché)', () => {
    const codigo = sw.replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).toContain("addEventListener('push'");
    expect(codigo).toContain("addEventListener('notificationclick'");
    expect(codigo).not.toMatch(/addEventListener\(\s*'fetch'/);
    expect(codigo).not.toMatch(/\bcaches\b/);
  });

  it('instalable.mjs lo copia a cada app y nadie pide el permiso al cargar la página', () => {
    const inst = readFileSync(join(RAIZ, 'apps/cliente/scripts/instalable.mjs'), 'utf8');
    expect(inst).toContain("'avisos-sw.js'");
    expect(inst).not.toContain('requestPermission');
  });
});

describe('C-AVISOS-WEB · el momento útil de cada app', () => {
  it('restaurante al abrir sesión, repartidor al conectarse y cliente en su pedido; nunca al cargar', () => {
    const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
    expect(leer('apps/restaurante/src/Inicio.tsx')).toContain('<TarjetaAvisosWeb');
    expect(leer('apps/repartidor/src/Inicio.tsx')).toContain(
      '<TarjetaAvisosWeb visible={Boolean(estado?.conectado)} />',
    );
    expect(leer('apps/cliente/src/app/order/[id].tsx')).toContain('<TarjetaAvisosWeb />');
    // El permiso solo se pide desde el botón de la tarjeta (un toque), nunca en un efecto al cargar.
    const tarjeta = leer('packages/movil/src/TarjetaAvisosWeb.tsx');
    expect(tarjeta).toContain('alTocar={() => {');
    expect(leer('packages/movil/src/avisos.ts')).not.toContain('activarAvisosWeb');
    // Al cerrar sesión se borra la suscripción del navegador.
    expect(leer('packages/movil/src/avisos.ts')).toContain('darDeBajaAvisosWeb(api)');
  });
});
