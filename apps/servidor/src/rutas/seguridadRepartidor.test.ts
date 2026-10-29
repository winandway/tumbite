import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

// C-SEGURIDAD-REPARTIDOR: emergencia que avisa al equipo, incidente y recorrido compartido.
describe('C-SEGURIDAD-REPARTIDOR', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emergencia con número del país y aviso al equipo; incidente; recorrido que se apaga', async () => {
    const enviados: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      enviados.push(String(init?.body ?? ''));
      return new Response('{}', { status: 200 });
    });
    const m = mundo({ ADMIN_CORREOS: 'equipo@ejemplo.com', YAD_TOKEN: 'x' });
    const rep = await m.cuenta('repartidor', 'Rafa Seguro');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.78, lng: -80.2 },
      rep.token,
    );
    const cli = await m.cuenta('cliente');
    expect((await m.llamar('POST', '/datos/repartidor/emergencia', {}, cli.token)).estado).toBe(
      403,
    );
    const em = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.78, lng: -80.2 },
      rep.token,
    );
    expect(em.estado).toBe(201);
    expect(em.datos.numero).toBe('911');
    expect(enviados.some((b) => b.includes('EMERGENCIA') && b.includes('equipo@ejemplo.com'))).toBe(
      true,
    );
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/repartidor/incidentes',
          { motivo: 'animal', detalle: 'Un perro suelto en la entrega' },
          rep.token,
        )
      ).estado,
    ).toBe(201);
    const admin = await m.cuenta('admin');
    const lista = await m.llamar('GET', '/datos/admin/seguridad', undefined, admin.token);
    expect(lista.datos.incidentes.map((i: { tipo: string }) => i.tipo).sort()).toEqual([
      'emergencia',
      'incidente',
    ]);
    const comp = await m.llamar('POST', '/datos/repartidor/compartir-recorrido', {}, rep.token);
    const codigo = String(comp.datos.url).split('/driver-trip/')[1]!;
    const ver = await m.llamar('GET', `/datos/publico/recorrido/${codigo}`);
    expect(ver.datos.recorrido).toMatchObject({
      terminado: false,
      nombre: 'Rafa',
      ubicacion: { lat: 25.78, lng: -80.2 },
    });
    await m.DB.prepare(
      "UPDATE recorridos_compartidos SET expira_en = datetime('now', '-1 minutes')",
    ).run();
    expect((await m.llamar('GET', `/datos/publico/recorrido/${codigo}`)).datos.recorrido).toEqual({
      terminado: true,
    });
  });
});
