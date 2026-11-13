import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { contarFilas } from '../presupuestoFilas';
import { mundo } from '../pruebas/ayuda';

/** C-CIUDAD-PRUEBAS: la ciudad de pruebas del simulador (solo pruebas y local). Todos los países. */
const SECRETO = 'secreto-del-reloj-de-pruebas-largo';

async function conSesion(host?: string) {
  const m = mundo({ RELOJ_SECRETO: SECRETO }, host ? { host } : {});
  const admin = await m.cuenta('admin');
  const dueno = await m.cuenta('restaurante');
  const rep = await m.cuenta('repartidor', 'Repartidor Ciudad');
  const r = await m.llamar(
    'PUT',
    '/datos/mi-restaurante',
    {
      nombre: 'Cocina Ciudad',
      direccion: '1 Calle',
      lat: 25.77,
      lng: -80.19,
      telefono: '3055550100',
    },
    dueno.token,
  );
  const rid = r.datos.restaurante?.id as string;
  // Su ficha de repartidor nace al conectarse por primera vez.
  await m.llamar(
    'POST',
    '/datos/repartidor/conectar',
    { conectado: true, lat: 25.77, lng: -80.19 },
    rep.token,
  );
  const sesion = (cuerpo: Record<string, unknown>) =>
    m.llamar('POST', '/datos/interno/ciudad/sesion', cuerpo, undefined, {
      'x-reloj-secreto': SECRETO,
    });
  return { m, admin, rid, rep, sesion };
}

describe('C-CIUDAD-PRUEBAS', () => {
  it('en producción las tres rutas no existen (ni con el secreto ni siendo admin)', async () => {
    const { m, admin, sesion } = await conSesion('divoox.com');
    expect((await sesion({ id: 's1', accion: 'empezar' })).estado).toBe(404);
    expect(
      (await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token)).estado,
    ).toBe(404);
    expect(
      (await m.llamar('POST', '/datos/admin/ciudad-pruebas/parar', { sesion: 's1' }, admin.token))
        .estado,
    ).toBe(404);
  });

  it('sin el secreto el simulador no escribe; sin ser admin no se mira', async () => {
    const { m, rep } = await conSesion('staging.tumbite.com');
    const sinSecreto = await m.llamar('POST', '/datos/interno/ciudad/sesion', {
      id: 's1',
      accion: 'empezar',
    });
    expect(sinSecreto.estado).toBe(404);
    expect(
      (await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, rep.token)).estado,
    ).toBe(403);
  });

  it('empieza, avanza con sus fallos, se pide parar y termina; la pantalla solo lee lo de la sesión', async () => {
    const { m, admin, rid, rep, sesion } = await conSesion('staging.tumbite.com');
    expect(
      (
        await sesion({
          id: 'ciudad-1',
          accion: 'empezar',
          semilla: 7,
          restaurantes: [rid],
          repartidores: [rep.id],
          meta: { pedidos: 10 },
        })
      ).datos.estado,
    ).toBe('corriendo');
    const fallo = {
      cuando: '2026-11-13T10:00:00Z',
      comportamiento: 'doble toque',
      mensaje: 'respondió 409',
    };
    expect(
      (await sesion({ id: 'ciudad-1', accion: 'avance', resumen: { pedidos: 3 }, fallos: [fallo] }))
        .datos.estado,
    ).toBe('corriendo');

    // Mirar no escribe ni una fila.
    const contada = contarFilas(m.DB);
    const res = await app.request(
      'https://staging.tumbite.com/datos/admin/ciudad-pruebas',
      { headers: { authorization: `Bearer ${admin.token}`, 'cf-connecting-ip': '10.9.9.9' } },
      { DB: contada.db, RELOJ_SECRETO: SECRETO },
    );
    expect(res.status).toBe(200);
    const vivo = (await res.json()) as {
      sesion: { id: string; estado: string; fallos: unknown[]; resumen: Record<string, number> };
      repartidores: { id: string; nombre: string }[];
      restaurantes: { id: string }[];
    };
    expect(contada.cuenta.escritas).toBe(0);
    expect(vivo.sesion).toMatchObject({
      id: 'ciudad-1',
      estado: 'corriendo',
      resumen: { pedidos: 3 },
    });
    expect(vivo.sesion.fallos).toEqual([fallo]);
    expect(vivo.restaurantes.map((r) => r.id)).toEqual([rid]);
    expect(vivo.repartidores.map((r) => r.nombre)).toEqual(['Repartidor Ciudad']);

    // El superadmin pide parar; el simulador lo ve en el siguiente avance y termina.
    const parar = await m.llamar(
      'POST',
      '/datos/admin/ciudad-pruebas/parar',
      { sesion: 'ciudad-1' },
      admin.token,
    );
    expect(parar.datos.pedida).toBe(true);
    expect((await sesion({ id: 'ciudad-1', accion: 'avance' })).datos.estado).toBe('parar');
    expect((await sesion({ id: 'ciudad-1', accion: 'terminar' })).datos.estado).toBe('terminada');
    const fin = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    expect(fin.datos.sesion.estado).toBe('terminada');
    expect(fin.datos.sesion.fin).toBeTruthy();
  });
});
