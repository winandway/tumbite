import { describe, expect, it, vi } from 'vitest';

import {
  capturasDe as capturasConCamara,
  fotoDe as fotoConCamara,
  preguntarOrigen as preguntarOrigenFoto,
} from '../../../packages/movil/src/camaraLogica';

/**
 * C-CAMARA-EN-TODA-SUBIDA (regla global de Richard, 9 nov 2026) — todos los países. La pieza
 * única de las apps: «Tomar foto» o «Subir desde archivos». Las apps no corren en vitest: aquí se
 * prueba la pieza común (el candado que revisa todas las casillas está en camara.test.tsx del panel).
 */
const camara = (permiso: boolean, foto: { uri: string; fileName?: string } | null) => ({
  pedirPermiso: vi.fn(async () => ({ granted: permiso })),
  tomar: vi.fn(async () => ({ canceled: !foto, assets: foto ? [foto] : null })),
});

describe('pieza de cámara de las apps', () => {
  it('ofrece «Tomar foto» y «Subir desde archivos» (y cancelar)', async () => {
    const alerta = vi.fn((_t, _m, botones) => botones[0].onPress());
    expect(await preguntarOrigenFoto('es', 'ios', alerta as never)).toBe('camara');
    const botones = alerta.mock.calls[0]?.[2] as { text: string }[];
    expect(botones.map((b) => b.text)).toEqual(['Tomar foto', 'Subir desde archivos', 'Cancelar']);
    // En la web no hay ventanita nativa: se abre el selector de archivos del navegador.
    expect(await preguntarOrigenFoto('es', 'web', alerta as never)).toBe('archivos');
  });

  it('con «Tomar foto» pide el permiso y entrega la foto de la cámara', async () => {
    const c = camara(true, { uri: 'file://camara.jpg' });
    const archivos = vi.fn(async () => ({ uri: 'file://galeria.jpg' }));
    expect(await fotoConCamara('es', c, archivos, async () => 'camara')).toEqual({
      uri: 'file://camara.jpg',
    });
    expect(c.pedirPermiso).toHaveBeenCalled();
    expect(archivos).not.toHaveBeenCalled();
  });

  it('con «Subir desde archivos» usa la galería de siempre', async () => {
    const c = camara(true, { uri: 'file://camara.jpg' });
    expect(
      await fotoConCamara(
        'es',
        c,
        async () => ({ uri: 'file://galeria.jpg' }),
        async () => 'archivos',
      ),
    ).toEqual({ uri: 'file://galeria.jpg' });
    expect(c.tomar).not.toHaveBeenCalled();
  });

  it('sin permiso lo dice en palabras', async () => {
    await expect(
      fotoConCamara(
        'es',
        camara(false, null),
        async () => null,
        async () => 'camara',
      ),
    ).rejects.toThrow(/sube la foto desde tus archivos/);
  });

  it('en los casos de ayuda, la foto de la cámara entra como una captura más', async () => {
    const elegir = capturasConCamara(
      async () => [{ uri: 'file://a.jpg', nombre: 'captura-1.jpg' }],
      camara(true, { uri: 'file://c.jpg', fileName: 'c.jpg' }),
      'es',
      async () => 'camara',
    );
    expect(await elegir(3)).toEqual([{ uri: 'file://c.jpg', nombre: 'c.jpg' }]);
  });
});
