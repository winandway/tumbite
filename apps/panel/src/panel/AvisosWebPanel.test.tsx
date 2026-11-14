import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosWebPanel, darDeBajaAlSalir } from './AvisosWebPanel';
import { api } from './api';

/** C-AVISOS-WEB (14 nov 2026) — todos los países: los avisos también en el panel del restaurante. */
const USUARIO = {
  id: 'u-panel-1',
  nombre: 'Dueña',
  correo: 'd@ejemplo.com',
  rol: 'restaurante',
} as never;

describe('C-AVISOS-WEB · panel del restaurante en computadora', () => {
  const pedir = vi.fn(async () => 'denied');
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: pedir });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    pedir.mockClear();
  });

  it('explica antes y pide el permiso solo al tocar el botón; «Ahora no» la cierra', async () => {
    render(<AvisosWebPanel usuario={USUARIO} idioma="es" />);
    expect(screen.getByTestId('avisos-web-panel')).toHaveTextContent(
      'Entérate de cada pedido aunque el panel esté cerrado',
    );
    expect(pedir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Activar avisos' }));
    expect(pedir).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('avisos-web-panel')).toHaveTextContent('están bloqueados'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByTestId('avisos-web-panel')).toBeNull();
  });

  it('el panel monta la tarjeta en Pedidos y su compilación sirve el trabajador en /panel', () => {
    const raiz = join(__dirname, '../../../..');
    expect(readFileSync(join(raiz, 'apps/panel/src/panel/PanelApp.tsx'), 'utf8')).toContain(
      '<AvisosWebPanel usuario={usuario} idioma={idioma} />',
    );
    expect(readFileSync(join(raiz, 'apps/panel/package.json'), 'utf8')).toContain(
      'dist/panel/avisos-sw.js',
    );
  });
});

describe('C-AVISOS-WEB · el panel da de baja al cerrar sesión', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('borra la suscripción de este navegador antes de salir, y sale igual si el servidor no responde', async () => {
    const quitar = vi.fn(async () => true);
    const suscripcion = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      unsubscribe: quitar,
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: async (alcance: string) =>
          alcance === '/panel/'
            ? { pushManager: { getSubscription: async () => suscripcion } }
            : undefined,
      },
      configurable: true,
    });
    window.history.pushState(null, '', '/panel/orders');
    const pedir = vi.spyOn(api, 'pedir').mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();
    const fin = darDeBajaAlSalir();
    await vi.advanceTimersByTimeAsync(3500);
    await fin; // el servidor nunca contestó y aun así terminó (tope de 3 segundos)
    expect(pedir).toHaveBeenCalledWith('DELETE', '/datos/avisos-web/suscripcion', {
      endpoint: suscripcion.endpoint,
    });
    const panel = readFileSync(join(__dirname, 'PanelApp.tsx'), 'utf8');
    const salir = panel.slice(panel.indexOf('async function salir('));
    expect(salir.indexOf('darDeBajaAlSalir()')).toBeGreaterThan(-1);
    expect(salir.indexOf('darDeBajaAlSalir()')).toBeLessThan(salir.indexOf('api.salir()'));
  });
});
