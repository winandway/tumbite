import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonCamara } from './camara';

/**
 * C-CAMARA-EN-TODA-SUBIDA (regla global de Richard, 9 nov 2026) — todos los países.
 * Toda casilla de subir imagen ofrece «Tomar foto».
 */
afterEach(() => vi.unstubAllGlobals());

const tactil = (si: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: si })),
  );

describe('botón «Tomar foto» de la web', () => {
  it('en el celular abre la cámara trasera del teléfono y entrega la foto a la casilla', async () => {
    tactil(true);
    const alTomar = vi.fn();
    render(<BotonCamara idioma="es" alTomar={alTomar} alFallar={() => {}} />);
    const entrada = screen.getByLabelText('Tomar foto', { selector: 'input' });
    expect(entrada.getAttribute('capture')).toBe('environment');
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(entrada as HTMLInputElement, foto);
    expect(alTomar).toHaveBeenCalledWith(foto);
  });

  it('en la computadora abre la cámara web en una ventanita con su botón', async () => {
    tactil(false);
    const parar = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: parar }] })),
      },
    });
    render(<BotonCamara idioma="es" alTomar={() => {}} alFallar={() => {}} />);
    await userEvent.click(screen.getByTestId('boton-camara'));
    expect(await screen.findByRole('dialog', { name: 'Cámara' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tomar la foto' })).not.toBeDisabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(parar).toHaveBeenCalled();
  });

  it('sin cámara o sin permiso lo dice en palabras, nunca una ventana en blanco', async () => {
    tactil(false);
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new Error('NotAllowedError');
        }),
      },
    });
    const alFallar = vi.fn();
    render(<BotonCamara idioma="es" alTomar={() => {}} alFallar={alFallar} />);
    await userEvent.click(screen.getByTestId('boton-camara'));
    await waitFor(() => expect(alFallar).toHaveBeenCalled());
    expect(String(alFallar.mock.calls[0]?.[0])).toContain('Sube la foto desde tus archivos');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('candado: ninguna casilla de imagen sin cámara', () => {
  const raiz = join(__dirname, '..', '..', '..', '..');
  const fuentes = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const r = join(dir, n);
      if (statSync(r).isDirectory()) return n === 'node_modules' ? [] : fuentes(r);
      return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [r] : [];
    });

  it('web: toda casilla de archivo de imagen ofrece «Tomar foto»', () => {
    const sin = fuentes(join(raiz, 'apps', 'panel', 'src')).filter((f) => {
      const s = readFileSync(f, 'utf8');
      // Solo las casillas de IMAGEN (las de .csv no llevan cámara).
      if (!/type="file"/.test(s) || !/accept="image/.test(s)) return false;
      return !/BotonCamara|capture=/.test(s);
    });
    expect(sin.map((f) => f.slice(raiz.length + 1))).toEqual([]);
  });

  it('apps: todo archivo que abre la galería también ofrece la cámara', () => {
    const sin = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap((d) => fuentes(join(raiz, d)))
      .filter((f) => {
        if (f.endsWith('elegirCapturas.ts')) return false;
        const s = readFileSync(f, 'utf8');
        return /launchImageLibraryAsync/.test(s) && !/fotoConCamara\(|capturasConCamara\(/.test(s);
      });
    expect(sin.map((f) => f.slice(raiz.length + 1))).toEqual([]);
  });
});
