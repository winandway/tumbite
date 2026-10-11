import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';

// Cabecera mínima de un WebP de verdad: RIFF....WEBP
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 1, 2, 3, 4,
]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function preparar() {
  const r2 = crearAlmacenPruebas();
  const m = mundo({ BUCKET: r2.bucket });
  async function subir(token: string, cuerpo: Uint8Array, tipo = 'image/webp') {
    const res = await app.request(
      '/datos/mi-restaurante/fotos',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': tipo,
          'cf-connecting-ip': '10.1.1.1',
        },
        body: cuerpo as BodyInit,
      },
      { DB: m.DB, BUCKET: r2.bucket },
    );
    return { estado: res.status, datos: (await res.json()) as { url?: string; error?: string } };
  }
  const ver = (url: string) => app.request(url, {}, { DB: m.DB, BUCKET: r2.bucket });
  return { ...m, r2, subir, ver };
}

describe('fotos de restaurantes y platos', () => {
  it('reconoce el tipo por los bytes, no por lo que dice el navegador', () => {
    expect(tipoReal(WEBP)).toBe('image/webp');
    expect(tipoReal(JPG)).toBe('image/jpeg');
    expect(tipoReal(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('el dueño sube una foto, se guarda en el almacén y se ve en público', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const r = await m.subir(dueno.token, WEBP);
    expect(r.estado).toBe(201);
    expect(r.datos.url).toMatch(/^\/media\/fotos\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
    expect(m.r2.datos.size).toBe(1);
    const res = await m.ver(r.datos.url!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(WEBP);
  });

  it('la foto queda puesta en el restaurante y en el plato, y no se pierde al editar', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const { datos } = await m.subir(dueno.token, WEBP);
    const rest = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, imagen: datos.url },
      dueno.token,
    );
    expect(rest.datos.restaurante.imagen).toBe(datos.url);
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza margarita', precioCentavos: 1400, imagen: datos.url },
      dueno.token,
    );
    expect(plato.datos.plato.imagen).toBe(datos.url);
  });

  it('no acepta enlaces a sitios ajenos como foto', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, imagen: 'https://sitio-ajeno.example/foto.png' },
      dueno.token,
    );
    expect(r.estado).toBe(400);
    expect(r.datos.campo).toBe('imagen');
  });

  it('rechaza lo que no es foto, lo que pesa de más y a quien no es restaurante', async () => {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    expect((await m.subir(dueno.token, WEBP)).estado).toBe(422); // aún no tiene restaurante
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const svg = await m.subir(dueno.token, new TextEncoder().encode('<svg/>'), 'image/png');
    expect(svg.estado).toBe(415);
    const grande = new Uint8Array(MAX_FOTO_BYTES + 1);
    grande.set(JPG);
    expect((await m.subir(dueno.token, grande, 'image/jpeg')).estado).toBe(413);
    const cliente = await m.cuenta('cliente');
    expect((await m.subir(cliente.token, WEBP)).estado).toBe(403);
    expect(m.r2.datos.size).toBe(0);
  });

  it('no deja leer fuera de la carpeta de fotos', async () => {
    const m = preparar();
    expect((await m.ver('/media/fotos/..%2F..%2Fsecreto/x.webp')).status).toBe(404);
    expect((await m.ver('/media/fotos/abc/no-existe.webp')).status).toBe(404);
  });
});
