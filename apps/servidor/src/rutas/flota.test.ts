import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-FLOTA-PROPIA (10 nov 2026, punto B3) — Chile y todos los países. Un restaurante con sus
 * propios repartidores: los invita, ellos usan Divoox Driver y reciben SOLO los pedidos de ese
 * restaurante. Ficha: docs/investigaciones-rea/2026-11-10-flota-propia-restaurante.md.
 * Encendido solo en el sitio de pruebas hasta que Richard decida el reparto del dinero.
 */
afterEach(() => vi.unstubAllGlobals());

const PRUEBAS = { host: 'staging.tumbite.com' };
const CERCA = { lat: 25.7702, lng: -80.1902 };
const LEJOS = { lat: 25.79, lng: -80.21 };

async function escena(opciones: { host?: string } = PRUEBAS) {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' }, opciones);
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  async function restaurante(nombre: string) {
    const dueno = await m.cuenta('restaurante', `Dueño de ${nombre}`);
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre },
      dueno.token,
    );
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Plato', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    async function pedido() {
      const p = await m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rid,
          lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
          propinaCentavos: 300,
          direccion: '300 Calle Prueba',
          lat: 25.775,
          lng: -80.195,
        },
        cliente.token,
      );
      const id = p.datos.pedidoId as string;
      await m.DB.prepare(
        "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
      )
        .bind(id)
        .run();
      await m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/aceptar`,
        { minutos: 5 },
        dueno.token,
      );
      return id;
    }
    return { dueno, rid, pedido };
  }
  async function repartidor(nombre: string, donde: { lat: number; lng: number }) {
    const rep = await m.cuenta('repartidor', nombre);
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, ...donde }, rep.token);
    const correo = (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(rep.id)
      .first<{
        correo: string;
      }>())!.correo;
    const ofertas = async () =>
      (
        (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos
          .ofertas as { pedidoId?: string; id?: string }[]
      ).map((o) => o.pedidoId ?? o.id);
    return { ...rep, correo, ofertas };
  }
  /** El restaurante invita por correo y el repartidor acepta desde su app. */
  async function sumarALaFlota(
    r: { dueno: { token: string } },
    rep: { token: string; correo: string },
  ) {
    const inv = await m.llamar(
      'POST',
      '/datos/mi-restaurante/flota/invitaciones',
      { nombre: 'Repartidor', correo: rep.correo },
      r.dueno.token,
    );
    expect(inv.estado).toBe(201);
    const mias = await m.llamar('GET', '/datos/repartidor/flota', undefined, rep.token);
    const id = mias.datos.invitaciones[0].id as string;
    const ok = await m.llamar(
      'POST',
      `/datos/repartidor/flota/invitaciones/${id}/aceptar`,
      {},
      rep.token,
    );
    expect(ok.estado).toBe(200);
    return inv;
  }
  const propia = (r: { dueno: { token: string } }, respaldo = false) =>
    m.llamar('PUT', '/datos/mi-restaurante/flota', { modo: 'propia', respaldo }, r.dueno.token);
  return { m, restaurante, repartidor, sumarALaFlota, propia };
}

describe('flota propia del restaurante (C-FLOTA-PROPIA)', () => {
  it('en producción todavía no se puede encender; en pruebas sí', async () => {
    const prod = await escena({});
    const r = await prod.restaurante('Sabor Uno');
    const no = await prod.propia(r);
    expect(no.estado).toBe(409);
    const ver = await prod.m.llamar('GET', '/datos/mi-restaurante/flota', undefined, r.dueno.token);
    expect(ver.datos).toMatchObject({ disponible: false, modo: 'divoox' });

    // Tampoco se pueden mandar invitaciones donde todavía no está encendida.
    const inv = await prod.m.llamar(
      'POST',
      '/datos/mi-restaurante/flota/invitaciones',
      { nombre: 'Leo', correo: 'leo@ejemplo.com' },
      r.dueno.token,
    );
    expect(inv.estado).toBe(409);

    const e = await escena();
    const r2 = await e.restaurante('Sabor Dos');
    expect((await e.propia(r2)).estado).toBe(200);
    const ver2 = await e.m.llamar('GET', '/datos/mi-restaurante/flota', undefined, r2.dueno.token);
    expect(ver2.datos).toMatchObject({ disponible: true, modo: 'propia', respaldo: false });
  });

  it('el restaurante invita, el repartidor acepta en su app y aparece en la flota', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const rep = await e.repartidor('Rita Reparto', CERCA);
    const inv = await e.sumarALaFlota(r, rep);
    expect(inv.datos.enlace).toMatch(/\/driver\/fleet\/[\w-]{20,}$/);
    const flota = await e.m.llamar('GET', '/datos/mi-restaurante/flota', undefined, r.dueno.token);
    expect(flota.datos.repartidores).toEqual([
      expect.objectContaining({ id: rep.id, nombre: 'Rita Reparto', conectado: true }),
    ]);
    expect(flota.datos.invitaciones).toEqual([]);
    const mia = await e.m.llamar('GET', '/datos/repartidor/flota', undefined, rep.token);
    expect(mia.datos.flota).toMatchObject({ restaurante: 'Sabor Uno' });
    // El restaurante lo retira y deja de ser de su flota.
    const fuera = await e.m.llamar(
      'DELETE',
      `/datos/mi-restaurante/flota/repartidores/${rep.id}`,
      undefined,
      r.dueno.token,
    );
    expect(fuera.estado).toBe(200);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/flota', undefined, rep.token)).datos.flota,
    ).toBeNull();
  });

  it('el enlace de la invitación dice de qué restaurante es, y otro restaurante no ve la flota ajena', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const otro = await e.restaurante('Sabor Otro');
    const inv = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/flota/invitaciones',
      { nombre: 'Leo', correo: 'leo@ejemplo.com' },
      r.dueno.token,
    );
    const token = String(inv.datos.enlace).split('/').pop();
    const pub = await e.m.llamar('GET', `/datos/flota/invitacion/${token}`);
    expect(pub.datos).toMatchObject({
      restaurante: 'Sabor Uno',
      nombre: 'Leo',
      estado: 'pendiente',
    });
    const ajena = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/flota',
      undefined,
      otro.dueno.token,
    );
    expect(ajena.datos.invitaciones).toEqual([]);
    // Cancelar la invitación la deja sin efecto.
    await e.m.llamar(
      'DELETE',
      `/datos/mi-restaurante/flota/invitaciones/${inv.datos.invitacion.id}`,
      undefined,
      r.dueno.token,
    );
    expect((await e.m.llamar('GET', `/datos/flota/invitacion/${token}`)).datos.estado).toBe(
      'cancelada',
    );
  });

  it('con flota propia el pedido va SOLO a sus repartidores, aunque uno de la red esté más cerca', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const propio = await e.repartidor('Paco Propio', LEJOS);
    const deLaRed = await e.repartidor('Rosa Red', CERCA);
    await e.sumarALaFlota(r, propio);
    await e.propia(r);
    const id = await r.pedido();
    expect(await deLaRed.ofertas()).not.toContain(id);
    expect(await propio.ofertas()).toContain(id);
  });

  it('un repartidor de flota propia no recibe pedidos de otros restaurantes', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const otro = await e.restaurante('Sabor Otro');
    const propio = await e.repartidor('Paco Propio', CERCA);
    await e.sumarALaFlota(r, propio);
    await e.propia(r);
    const ajeno = await otro.pedido();
    expect(await propio.ofertas()).not.toContain(ajeno);
  });

  it('sin repartidor propio libre y sin respaldo no cae a la red: se avisa al restaurante una sola vez', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const deLaRed = await e.repartidor('Rosa Red', CERCA);
    await e.propia(r, false);
    const id = await r.pedido();
    expect(await deLaRed.ofertas()).not.toContain(id);
    expect(await deLaRed.ofertas()).not.toContain(id);
    const fila = await e.m.DB.prepare('SELECT flota_aviso_en FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ flota_aviso_en: string | null }>();
    expect(fila?.flota_aviso_en).toBeTruthy();
    const pedidos = await e.m.llamar(
      'GET',
      '/datos/mi-restaurante/flota',
      undefined,
      r.dueno.token,
    );
    expect(pedidos.datos.sinRepartidor).toEqual([expect.objectContaining({ id })]);
  });

  it('invitar dos veces a la misma persona reemplaza la invitación: no se acumulan', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const invitar = () =>
      e.m.llamar(
        'POST',
        '/datos/mi-restaurante/flota/invitaciones',
        { nombre: 'Leo', correo: 'leo@ejemplo.com' },
        r.dueno.token,
      );
    const primera = await invitar();
    await invitar();
    const ver = await e.m.llamar('GET', '/datos/mi-restaurante/flota', undefined, r.dueno.token);
    expect(ver.datos.invitaciones).toHaveLength(1);
    const viejo = String(primera.datos.enlace).split('/').pop();
    expect((await e.m.llamar('GET', `/datos/flota/invitacion/${viejo}`)).datos.estado).toBe(
      'cancelada',
    );
  });

  it('con respaldo encendido, si la flota propia no puede, el pedido pasa a la red de Divoox', async () => {
    const e = await escena();
    const r = await e.restaurante('Sabor Uno');
    const deLaRed = await e.repartidor('Rosa Red', CERCA);
    await e.propia(r, true);
    const id = await r.pedido();
    expect(await deLaRed.ofertas()).toContain(id);
  });
});
