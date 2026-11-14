import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosWebPanel } from './AvisosWebPanel';

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
