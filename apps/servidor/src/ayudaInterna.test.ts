import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';
import { AYUDA_INTERNA, CAPTURAS_AYUDA } from './ayudaInterna/guias';
import { esDocsInterno } from './app';

/**
 * C-AYUDA-INTERNA (16 nov 2026, Richard) — todos los países. Lo que explica nuestro panel de
 * operaciones vive solo dentro del superadmin: la ayuda («?») se lee con la sesión del equipo, sin
 * caché compartida y fuera de los buscadores; sus capturas igual. Las direcciones públicas viejas de
 * Docs (/docs/operations/…) y sus capturas responden 410.
 */
describe('C-AYUDA-INTERNA: la ayuda del equipo es solo para el equipo', () => {
  it('sin sesión, o con una cuenta que no es del equipo, no se ve nada', async () => {
    const m = mundo();
    const cliente = await m.cuenta('cliente');
    const restaurante = await m.cuenta('restaurante');
    expect((await m.llamar('GET', '/datos/admin/ayuda')).estado).toBe(401);
    expect((await m.llamar('GET', '/datos/admin/ayuda', undefined, cliente.token)).estado).toBe(
      403,
    );
    expect((await m.llamar('GET', '/datos/admin/ayuda', undefined, restaurante.token)).estado).toBe(
      403,
    );
    const foto = '/datos/admin/ayuda/captura/monitoreo-pestanas-es.webp';
    expect((await m.llamar('GET', foto)).estado).toBe(401);
    expect((await m.llamar('GET', foto, undefined, cliente.token)).estado).toBe(403);
  });

  it('el equipo la lee en su idioma, privada y con noindex', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const es = await m.llamar('GET', '/datos/admin/ayuda?idioma=es', undefined, admin.token);
    expect(es.estado).toBe(200);
    expect(es.res.headers.get('x-robots-tag')).toContain('noindex');
    expect(es.res.headers.get('cache-control')).toContain('private');
    const secciones = es.datos.secciones as {
      id: string;
      guias: { id: string; capturas: { src: string }[] }[];
    }[];
    expect(secciones.map((s) => s.id)).toEqual(['start', 'monitoring', 'support', 'settings']);
    const ids = secciones.flatMap((s) => s.guias.map((g) => g.id));
    expect(ids).toContain('search-orders-rides-people');
    expect(ids).toContain('flagged-content');
    expect(ids).toContain('two-person-approval');
    // Las capturas salen por la dirección privada, nunca por /docs.
    for (const g of secciones.flatMap((s) => s.guias))
      for (const c of g.capturas) expect(c.src).toMatch(/^\/datos\/admin\/ayuda\/captura\//);
    const en = await m.llamar('GET', '/datos/admin/ayuda?idioma=en', undefined, admin.token);
    expect(en.datos.secciones[0].titulo).toBe('Start here');
  });

  it('la captura sale del almacén solo para el equipo, y nada fuera de la lista', async () => {
    const almacen = crearAlmacenPruebas();
    await almacen.bucket.put('ayuda-interna/monitoreo-pestanas-es.webp', new Uint8Array([1, 2, 3]));
    await almacen.bucket.put('fotos/otra/cosa.webp', new Uint8Array([4]));
    const m = mundo({ BUCKET: almacen.bucket });
    const admin = await m.cuenta('admin');
    const ok = await m.llamar(
      'GET',
      '/datos/admin/ayuda/captura/monitoreo-pestanas-es.webp',
      undefined,
      admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(ok.res.headers.get('content-type')).toBe('image/webp');
    expect(ok.res.headers.get('x-robots-tag')).toContain('noindex');
    expect(ok.res.headers.get('cache-control')).toContain('private');
    for (const otro of [
      'cosa.webp',
      '..%2Ffotos%2Fotra%2Fcosa.webp',
      'monitoreo-inventada-es.webp',
    ])
      expect(
        (await m.llamar('GET', `/datos/admin/ayuda/captura/${otro}`, undefined, admin.token))
          .estado,
      ).toBe(404);
  });

  it('cada guía está completa en los dos idiomas, con capturas de su idioma', () => {
    const ids = (i: 'es' | 'en') => AYUDA_INTERNA[i].flatMap((s) => s.guias.map((g) => g.id));
    expect(ids('es')).toEqual(ids('en'));
    expect(ids('es').length).toBeGreaterThanOrEqual(11);
    for (const i of ['es', 'en'] as const)
      for (const g of AYUDA_INTERNA[i].flatMap((s) => s.guias)) {
        expect(g.resumen.length, `${i} ${g.id}`).toBeGreaterThan(40);
        expect(g.explicacion?.length ?? 0, `${i} ${g.id}`).toBeGreaterThanOrEqual(3);
        expect(g.pasos.length, `${i} ${g.id}`).toBeGreaterThanOrEqual(2);
        expect(g.capturas?.length ?? 0, `${i} ${g.id}`).toBeGreaterThan(0);
        for (const c of g.capturas ?? []) {
          expect(c.archivo.endsWith(`-${i}.webp`), c.archivo).toBe(true);
          expect(c.alt.length).toBeGreaterThan(30);
        }
      }
    expect(CAPTURAS_AYUDA.size).toBeGreaterThan(40);
  });

  it('las direcciones públicas viejas de Docs y sus capturas responden 410', async () => {
    const m = mundo();
    for (const ruta of [
      '/docs/operations',
      '/docs/operations/search-orders-rides-people',
      '/es/docs/operations/monitor-live-orders-rides',
      '/docs/monitoreo-buscador-en.webp',
      '/docs/doble-firma-es.webp',
      '/docs/recorrido-moderacion-computadora-bandeja-en.webp',
    ]) {
      const r = await m.llamar('GET', ruta);
      expect(r.estado, ruta).toBe(410);
      expect(r.res.headers.get('x-robots-tag'), ruta).toContain('noindex');
    }
    const grande = await m.llamar('GET', '/media/docs-grande/monitoreo-pestanas-en-1a2b3c4d.webp');
    expect(grande.estado).toBe(410);
    // Lo que sigue siendo público no cae en la regla.
    expect(esDocsInterno('/docs/ordering')).toBe(false);
    expect(esDocsInterno('/docs/restaurants/panel-tour')).toBe(false);
    expect(esDocsInterno('/docs/recorrido-moderacion-chat-en.webp')).toBe(false);
  });
});
