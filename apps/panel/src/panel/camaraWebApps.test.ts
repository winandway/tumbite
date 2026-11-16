import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CamaraApp,
  type OrigenFoto,
  fotoDe as fotoDeLogica,
  preguntarOrigen as preguntarLogica,
} from '../../../../packages/movil/src/camaraLogica';
import { camaraDeComputadora } from '../../../../packages/movil/src/camaraWeb';

// Lo mismo que hace camara.ts de las apps: la pieza única con la cámara de la computadora.
const fotoDe = <F extends { uri: string }>(
  idioma: 'es' | 'en',
  camara: CamaraApp<F>,
  deArchivos: () => Promise<F | null>,
  preguntar: (i: 'es' | 'en') => Promise<OrigenFoto>,
) => fotoDeLogica(idioma, camara, deArchivos, preguntar, camaraDeComputadora);
const preguntarOrigen = (idioma: 'es' | 'en', plataforma: string, alerta: never) =>
  preguntarLogica(idioma, plataforma, alerta, camaraDeComputadora);

/**
 * C-CAMARA-EN-TODA-SUBIDA, la COMPUTADORA en las apps web (15 nov 2026) — todos los países. En el
 * navegador de una computadora, «Tomar foto» de las apps (cliente, Driver, Restaurants) caía al
 * selector de archivos. Ahora abre la cámara web en una ventanita con su botón, como el panel; sin
 * cámara o sin permiso lo dice en palabras y deja subir desde archivos. Se prueba aquí (jsdom) la
 * pieza única de las apps, `packages/movil/src/camaraLogica.ts` + `camaraWeb.ts`.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const pantalla = (tactil: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: tactil })),
  );
const camaraTelefono = () => ({
  pedirPermiso: vi.fn(async () => ({ granted: true })),
  tomar: vi.fn(async () => ({ canceled: false, assets: [{ uri: 'blob:selector-de-archivos' }] })),
});
const esperar = () => new Promise((r) => setTimeout(r, 0));
const boton = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

function camaraWeb(falla = false) {
  const parar = vi.fn();
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        if (falla) throw new Error('NotAllowedError');
        return { getTracks: () => [{ stop: parar }] };
      }),
    },
  });
  return parar;
}

describe('«Tomar foto» de las apps en la computadora', () => {
  it('abre la cámara web en una ventanita con su botón (no el selector de archivos)', async () => {
    pantalla(false);
    const parar = camaraWeb();
    // jsdom no dibuja: el cuadro del video sale de un lienzo simulado.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AA');
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const telefono = camaraTelefono();
    const promesa = fotoDe(
      'es',
      telefono,
      async () => null,
      async () => 'camara',
    );
    await esperar();
    const ventana = document.querySelector('[role="dialog"]');
    expect(ventana?.getAttribute('aria-label')).toBe('Cámara');
    expect(document.querySelector('video')).not.toBeNull();
    const capturar = boton('camara-web-capturar');
    expect(capturar?.textContent).toBe('Tomar la foto');
    capturar?.click();
    const foto = await promesa;
    expect(foto).toMatchObject({ uri: 'data:image/jpeg;base64,AA', mimeType: 'image/jpeg' });
    // La foto NO vino del selector de archivos de expo-image-picker, y la luz se apagó.
    expect(telefono.tomar).not.toHaveBeenCalled();
    expect(parar).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('sin cámara o sin permiso lo dice en palabras y no deja la ventanita abierta', async () => {
    pantalla(false);
    camaraWeb(true);
    await expect(
      fotoDe(
        'en',
        camaraTelefono(),
        async () => null,
        async () => 'camara',
      ),
    ).rejects.toThrow(/Upload the photo from your files/);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    await expect(
      fotoDe(
        'es',
        camaraTelefono(),
        async () => null,
        async () => 'camara',
      ),
    ).rejects.toThrow(/Sube la foto desde tus archivos/);
  });

  it('«Cerrar» y Escape cierran sin foto y apagan la cámara', async () => {
    pantalla(false);
    const parar = camaraWeb();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const uno = fotoDe(
      'es',
      camaraTelefono(),
      async () => null,
      async () => 'camara',
    );
    await esperar();
    boton('camara-web-cerrar')?.click();
    expect(await uno).toBeNull();
    const dos = fotoDe(
      'es',
      camaraTelefono(),
      async () => null,
      async () => 'camara',
    );
    await esperar();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await dos).toBeNull();
    expect(parar).toHaveBeenCalledTimes(2);
  });

  it('una casilla de un solo botón pregunta «Tomar foto / Subir desde archivos» en la computadora', async () => {
    pantalla(false);
    const alerta = vi.fn();
    const r = preguntarOrigen('es', 'web', alerta as never);
    await esperar();
    const textos = [...document.querySelectorAll('[role="dialog"] button')].map(
      (b) => b.textContent,
    );
    expect(textos).toEqual(['Cancelar', 'Subir desde archivos', 'Tomar foto']);
    boton('camara-web-tomar')?.click();
    expect(await r).toBe('camara');
    expect(alerta).not.toHaveBeenCalled();
  });

  it('en el navegador del teléfono sigue el selector del teléfono (ya ofrece la cámara)', async () => {
    pantalla(true);
    expect(camaraDeComputadora.disponible()).toBe(false);
    expect(await preguntarOrigen('es', 'web', vi.fn() as never)).toBe('archivos');
    const telefono = camaraTelefono();
    expect(
      await fotoDe(
        'es',
        telefono,
        async () => null,
        async () => 'camara',
      ),
    ).toEqual({
      uri: 'blob:selector-de-archivos',
    });
    expect(telefono.tomar).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
