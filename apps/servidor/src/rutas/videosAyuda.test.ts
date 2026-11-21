import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { videoAyudaPara } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';

/**
 * C-VER-VIDEO (21 nov 2026, pedido de Richard) — todos los países. «Ver video»: un enlace con ícono de
 * reproducir que abre una ventanita con un video vertical de ayuda. El video vive en el almacén (nunca
 * en el paquete), uno por idioma, y se enciende por ajuste: sin ajuste, el enlace no existe. Se pone la
 * dirección y aparece sin compilar la app otra vez. Pieza reutilizable para otras pantallas.
 */
const ES = 'fotos-de-la-entrada-es-0a1b2c3d.mp4';
const EN = 'fotos-de-la-entrada-en-4e5f6a7b.mp4';

async function escenario() {
  const almacen = crearAlmacenPruebas();
  const m = mundo({ BUCKET: almacen.bucket });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Persona');
  const poner = (cuerpo: object, token = admin.token) =>
    m.llamar('PUT', '/datos/admin/videos-ayuda', cuerpo, token);
  const publico = () => m.llamar('GET', '/datos/videos-ayuda');
  return { m, almacen, admin, cliente, poner, publico };
}

describe('C-VER-VIDEO: los videos de ayuda se encienden por ajuste', () => {
  it('nace apagado: sin ajuste no hay ningún video', async () => {
    const e = await escenario();
    const r = await e.publico();
    expect(r.estado).toBe(200);
    expect(r.datos).toEqual({ videos: {} });
    expect(r.res.headers.get('cache-control')).toMatch(/max-age=300/);
  });

  it('solo se enciende con un video que ya está en el almacén, y cada idioma por separado', async () => {
    const e = await escenario();
    // Todavía no se subió: no se enciende un enlace que no reproduce nada.
    const sin = await e.poner({ clave: 'fotos-entrada', es: ES });
    expect(sin.estado).toBe(422);
    expect((await e.publico()).datos).toEqual({ videos: {} });
    await e.almacen.bucket.put(`docs-video/${ES}`, new Uint8Array([0, 0, 0, 24]));
    expect((await e.poner({ clave: 'fotos-entrada', es: ES })).estado).toBe(200);
    const uno = (await e.publico()).datos.videos;
    expect(uno).toEqual({ 'fotos-entrada': { es: `/media/docs-video/${ES}` } });
    // En inglés todavía no hay video: el enlace no sale en inglés (nunca el de otro idioma).
    expect(videoAyudaPara(uno, 'fotos-entrada', 'es')).toBe(`/media/docs-video/${ES}`);
    expect(videoAyudaPara(uno, 'fotos-entrada', 'en')).toBeNull();
    await e.almacen.bucket.put(`docs-video/${EN}`, new Uint8Array([0, 0, 0, 24]));
    expect((await e.poner({ clave: 'fotos-entrada', en: EN })).estado).toBe(200);
    expect((await e.publico()).datos.videos['fotos-entrada']).toEqual({
      es: `/media/docs-video/${ES}`,
      en: `/media/docs-video/${EN}`,
    });
    // Y el video se sirve por partes desde el almacén (el iPhone lo exige).
    const parte = await e.m.crudo(`/media/docs-video/${ES}`, { headers: { range: 'bytes=0-1' } });
    expect(parte.status).toBe(206);
    // Apagar un idioma.
    expect((await e.poner({ clave: 'fotos-entrada', es: null })).estado).toBe(200);
    expect((await e.publico()).datos.videos['fotos-entrada']).toEqual({
      en: `/media/docs-video/${EN}`,
    });
  });

  it('solo el equipo lo cambia; un nombre raro o una pantalla desconocida no pasan', async () => {
    const e = await escenario();
    await e.almacen.bucket.put(`docs-video/${ES}`, new Uint8Array([1]));
    expect((await e.poner({ clave: 'fotos-entrada', es: ES }, e.cliente.token)).estado).toBe(403);
    expect(
      (await e.m.llamar('PUT', '/datos/admin/videos-ayuda', { clave: 'fotos-entrada', es: ES }))
        .estado,
    ).toBe(401);
    expect(
      (await e.poner({ clave: 'fotos-entrada', es: 'https://otro-sitio.example/video.mp4' }))
        .estado,
    ).toBe(400);
    expect((await e.poner({ clave: 'pantalla-inventada', es: ES })).estado).toBe(400);
    expect((await e.publico()).datos).toEqual({ videos: {} });
  });

  it('mirar no escribe', async () => {
    const e = await escenario();
    await e.almacen.bucket.put(`docs-video/${ES}`, new Uint8Array([1]));
    await e.poner({ clave: 'fotos-entrada', es: ES });
    const escritas: string[] = [];
    const preparado = e.m.DB.prepare.bind(e.m.DB);
    e.m.DB.prepare = (sql: string) => {
      if (
        /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql) &&
        !/sesiones|limites|intentos/i.test(sql)
      )
        escritas.push(sql);
      return preparado(sql);
    };
    await e.publico();
    await e.publico();
    e.m.DB.prepare = preparado;
    expect(escritas).toEqual([]);
  });

  it('candados del código: la pieza no reproduce sola, tiene cerrar y vive en «Fotos de la entrada»', () => {
    const leer = (ruta: string) =>
      readFileSync(join(__dirname, '..', '..', '..', '..', ruta), 'utf8');
    const pieza = leer('packages/movil/src/VerVideo.tsx');
    expect(pieza).not.toMatch(/autoplay|autoPlay|shouldPlay/);
    expect(pieza).toContain('mediaPlaybackRequiresUserAction');
    expect(pieza).toContain('testID="ver-video-cerrar"');
    expect(pieza).toContain("'/datos/videos-ayuda'");
    expect(leer('packages/movil/src/FotosPuerta.tsx')).toContain('<VerVideo clave="fotos-entrada"');
    expect(leer('packages/movil/src/index.ts')).toContain("'./VerVideo'");
  });
});
