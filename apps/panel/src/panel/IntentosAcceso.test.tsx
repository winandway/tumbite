import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntentosAcceso, textoResultado } from './IntentosAcceso';

/**
 * C-INTENTOS-ACCESO (24 nov 2026, Richard) — todos los países. El equipo ve cada intento de crear cuenta
 * y de entrar, también los que no terminaron, con el error en palabras.
 */
describe('intentos de crear cuenta y de entrar en el panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lista los fallidos y los buenos con el resultado en palabras', async () => {
    const pedidas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      pedidas.push(String(url));
      return new Response(
        JSON.stringify({
          conFallos: true,
          resumen: [{ accion: 'entrar', codigo: 'correo_sin_cuenta', veces: 2 }],
          intentos: [
            {
              resultado: 'fallo',
              accion: 'registro',
              paso: 'formulario',
              correo: 'n•••@ejemplo.com',
              codigo: 'validacion',
              detalle: 'telefono',
              app: 'repartidor',
              version: '0.1.69',
              plataforma: 'android',
              pais: 'VE',
              ciudad: null,
              fecha: '2026-11-24 14:50:00',
            },
            {
              resultado: 'ok',
              accion: 'registro',
              paso: 'servidor',
              correo: 'a•••@ejemplo.com',
              codigo: 'cuenta_creada',
              detalle: null,
              app: 'repartidor',
              version: '0.1.69',
              plataforma: 'android',
              pais: 'VE',
              ciudad: null,
              fecha: '2026-11-24 15:01:00',
            },
          ],
        }),
        { status: 200 },
      );
    });
    render(<IntentosAcceso idioma="es" app="repartidor" desde="2026-11-18" hasta="2026-11-24" />);
    expect(await screen.findByText('Casillas mal escritas')).toBeTruthy();
    expect(screen.getByText('Cuenta creada')).toBeTruthy();
    expect(screen.getByText('En el teléfono (formulario)')).toBeTruthy();
    expect(screen.getByTestId('intentos-resumen').textContent).toContain(
      'No hay cuenta con ese correo',
    );
    expect(pedidas[0]).toContain('/datos/admin/accesos?app=repartidor&desde=2026-11-18');
  });

  it('una casilla rechazada por el servidor también se dice', () => {
    expect(textoResultado('datos:telefono', 'es')).toBe('Casilla rechazada: telefono');
    expect(textoResultado('clave_incorrecta', 'en')).toBe('Wrong password');
  });
});
