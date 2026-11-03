import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';

// Cabecera mínima de un WebP de verdad: RIFF....WEBP
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 4, 0, 0, 0,
  1, 2, 3, 4,
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

/** Un WebP con cabecera VP8X que dice sus medidas, del largo pedido (relleno en un bloque VP8). */
function webpDe(ancho: number, alto: number, largo = 64) {
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const le32 = (n: number) => [...le24(n), (n >>> 24) & 0xff];
  const relleno = Math.max(4, largo - 38);
  const cuerpo = [
    ...[0x57, 0x45, 0x42, 0x50],
    ...[0x56, 0x50, 0x38, 0x58],
    ...le32(10),
    0,
    0,
    0,
    0,
    ...le24(ancho - 1),
    ...le24(alto - 1),
    ...[0x56, 0x50, 0x38, 0x20],
    ...le32(relleno),
    ...Array.from({ length: relleno + (relleno % 2) }, () => 7),
  ];
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, ...le32(cuerpo.length), ...cuerpo]);
}

describe('NXT-7 · C-FOTOS-LIVIANAS: tres tamaños en WebP', () => {
  async function conFoto() {
    const m = preparar();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const completa = webpDe(1400, 1050, 3000);
    const r = await m.subir(dueno.token, completa);
    expect(r.estado).toBe(201);
    const id = r.datos.url!.split('/').pop()!.replace('.webp', '');
    const subirTam = async (bytes: Uint8Array, tam: string, de = id, tipo = 'image/webp') => {
      const res = await app.request(
        `/datos/mi-restaurante/fotos?de=${de}&tam=${tam}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${dueno.token}`,
            'content-type': tipo,
            'cf-connecting-ip': '10.1.1.2',
          },
          body: bytes as BodyInit,
        },
        { DB: m.DB, BUCKET: m.r2.bucket },
      );
      return { estado: res.status, datos: (await res.json()) as { url?: string; error?: string } };
    };
    return { m, dueno, id, url: r.datos.url!, completa, subirTam };
  }

  it('la tarjeta y la miniatura se guardan junto a la completa y cada una se sirve aparte', async () => {
    const { m, url, subirTam, id } = await conFoto();
    const tarjeta = webpDe(640, 480, 2000);
    const mini = webpDe(200, 150, 500);
    const t = await subirTam(tarjeta, 'tarjeta');
    expect(t.estado).toBe(201);
    expect(t.datos.url).toBe(url.replace('.webp', '-m.webp'));
    const s = await subirTam(mini, 'miniatura');
    expect(s.datos.url).toBe(url.replace('.webp', '-s.webp'));
    expect(new Uint8Array(await (await m.ver(s.datos.url!)).arrayBuffer())).toEqual(mini);
    expect(new Uint8Array(await (await m.ver(t.datos.url!)).arrayBuffer())).toEqual(tarjeta);
    expect((await m.ver(t.datos.url!)).headers.get('cache-control')).toContain('immutable');
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('peso y medidas: una miniatura grande o pesada, un JPEG o un tamaño raro no se guardan', async () => {
    const { subirTam } = await conFoto();
    expect((await subirTam(webpDe(800, 600, 500), 'miniatura')).estado).toBe(422);
    expect((await subirTam(webpDe(200, 150, 60 * 1024), 'miniatura')).estado).toBe(422);
    expect((await subirTam(webpDe(1400, 1050, 3000), 'tarjeta')).estado).toBe(422);
    expect((await subirTam(JPG, 'miniatura', undefined, 'image/jpeg')).estado).toBe(422);
    expect((await subirTam(webpDe(200, 150, 500), 'gigante')).estado).toBe(400);
    expect((await subirTam(webpDe(200, 150, 500), 'miniatura', '../otro')).estado).toBe(400);
    expect((await subirTam(webpDe(200, 150, 500), 'miniatura', 'no-existe')).estado).toBe(404);
  });

  it('una foto vieja sin tamaños entrega la completa (WebP o JPG), sin caché larga', async () => {
    const { m, url, completa } = await conFoto();
    const res = await m.ver(url.replace('.webp', '-s.webp'));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(completa);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    const dueno = await m.cuenta('restaurante', 'Dueño JPG');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const vieja = await m.subir(dueno.token, JPG, 'image/jpeg');
    const jpg = await m.ver(vieja.datos.url!.replace('.jpg', '-m.webp'));
    expect(jpg.status).toBe(200);
    expect(jpg.headers.get('content-type')).toBe('image/jpeg');
    expect((await m.ver('/media/fotos/nada/nada-s.webp')).status).toBe(404);
  });

  it('el tamaño chico de la foto de OTRO restaurante no se puede subir', async () => {
    const { id } = await conFoto();
    const m2 = await conFoto();
    expect((await m2.subirTam(webpDe(200, 150, 500), 'miniatura', id)).estado).toBe(404);
  });
});
