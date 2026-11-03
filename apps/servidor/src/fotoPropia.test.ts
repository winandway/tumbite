import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { jpegConGps } from './pruebas/fotoConGps';

/**
 * NXT-8x · C-TIENDAS-FOTO-PROPIA para todos: ningún negocio guarda en su portada, sus platos o sus
 * productos la foto que subió OTRO comercio (antes la regla vivía solo en los productos).
 */
async function negocio(m: ReturnType<typeof mundo>, nombre: string) {
  const d = await m.cuenta('restaurante', nombre);
  expect((await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, d.token)).estado).toBe(
    201,
  );
  const r = await m.crudo('/datos/mi-restaurante/fotos', {
    method: 'POST',
    headers: { authorization: `Bearer ${d.token}`, 'content-type': 'image/jpeg' },
    body: jpegConGps() as BodyInit,
  });
  const { url } = (await r.json()) as { url: string };
  return { ...d, foto: url };
}

describe('NXT-8x · la foto de otro comercio no se usa en ningún lado', () => {
  it('plato nuevo, plato editado y portada: con la foto propia sí, con la de otro 422 (es/en)', async () => {
    const m = mundo();
    const a = await negocio(m, 'Dueño A');
    const b = await negocio(m, 'Dueño B');
    const plato = { nombreEs: 'Cubano', precioCentavos: 1500 };
    // Con la propia, todo bien.
    const propio = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { ...plato, imagen: b.foto },
      b.token,
    );
    expect(propio.estado).toBe(201);
    const pid = propio.datos.plato.id as string;
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/mi-restaurante',
          { ...RESTAURANTE_BASE, imagen: b.foto },
          b.token,
        )
      ).estado,
    ).toBe(200);
    // Con la de A, nunca.
    const nuevo = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { ...plato, imagen: a.foto },
      b.token,
    );
    expect(nuevo.estado).toBe(422);
    expect(nuevo.datos.campo).toBe('imagen');
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/mi-restaurante/platos/${pid}`,
          { ...plato, imagen: a.foto },
          b.token,
        )
      ).estado,
    ).toBe(422);
    const portada = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, imagen: a.foto },
      b.token,
    );
    expect(portada.estado).toBe(422);
    // Una cuenta sin restaurante tampoco estrena el suyo con la foto de otro.
    const c = await m.cuenta('restaurante', 'Dueño C');
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/mi-restaurante',
          { ...RESTAURANTE_BASE, imagen: a.foto },
          c.token,
        )
      ).estado,
    ).toBe(422);
    // El aviso, en inglés.
    const en = await m.crudo('/datos/mi-restaurante/platos', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${b.token}`,
        'content-type': 'application/json',
        'x-idioma': 'en',
      },
      body: JSON.stringify({ ...plato, imagen: a.foto }),
    });
    expect(JSON.stringify(await en.json())).toContain('isn’t from your business');
  });
});
