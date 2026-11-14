import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_DINERO_INICIAL,
  PROPINAS_PB_INICIALES,
  PROPINAS_VENEZUELA_PB,
  TARIFAS_COMIDA_VENEZUELA,
} from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-COMIDA-VENEZUELA (13 nov 2026) — Venezuela. La comida en El Vigía (estado Mérida) en dólares,
 * como el mercado local, con su equivalente en bolívares de referencia; Comida se abre en una
 * ciudad con UN paso del panel; la comisión de comida nunca queda en una moneda que no cubre la
 * ciudad. Estados Unidos no cambia ni un centavo.
 */
export const EL_VIGIA = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
};

export async function escenarioVe(host = 'staging.tumbite.com') {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'x', status: 'succeeded' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' }, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Cliente El Vigía');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenarioVe>>;

export const abrirComida = (e: E, extra: Record<string, unknown> = {}) =>
  e.m.llamar(
    'POST',
    '/datos/admin/comida/ciudades',
    { zona: EL_VIGIA, motivo: 'Comida de pruebas en El Vigía', ...extra },
    e.admin.token,
  );

/** Un restaurante de El Vigía se registra (su país sale de su ubicación) y el equipo lo aprueba. */
export async function restauranteVe(e: E) {
  const dueno = await e.m.cuenta('restaurante', 'Dueño Arepera');
  const r = await e.m.llamar(
    'PUT',
    '/datos/mi-restaurante',
    {
      ...RESTAURANTE_BASE,
      nombre: 'Arepera El Vigía',
      direccion: 'Avenida Bolívar, El Vigía, Mérida',
      lat: 8.6225,
      lng: -71.651,
      categoria: 'Venezolana',
      telefono: '+584141234567',
    },
    dueno.token,
  );
  expect(r.estado).toBe(201);
  const rid = r.datos.restaurante.id as string;
  await e.m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${rid}`,
    { estado: 'aprobado' },
    e.admin.token,
  );
  const plato = await e.m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Arepa reina pepiada', nombreEn: 'Reina pepiada arepa', precioCentavos: 450 },
    dueno.token,
  );
  expect(plato.estado).toBe(201);
  await e.m.abrir(dueno.token);
  return { dueno, rid, platoId: plato.datos.plato.id as string };
}

describe('C-COMIDA-VENEZUELA: Comida se abre en El Vigía con un paso del panel', () => {
  it('deja el país en dólares con las tarifas del mercado, efectivo y pago móvil, y Comida encendida', async () => {
    const e = await escenarioVe();
    const r = await abrirComida(e);
    expect(r.estado).toBe(201);
    expect(r.datos.zona).toEqual({ id: EL_VIGIA.id, pais: 'VE', moneda: 'USD' });
    expect(r.datos.estado).toBe('disponible');
    const ve = (await e.m.llamar('GET', '/datos/admin/paises/VE', undefined, e.admin.token)).datos;
    expect(ve.config.moneda).toBe('USD');
    expect(ve.config.tarifas).toEqual(TARIFAS_COMIDA_VENEZUELA);
    expect(ve.config.topes).not.toBeNull();
    expect(ve.config.efectivoActivo).toBe(true);
    expect(ve.config.transferenciaRepartidorActiva).toBe(true);
    expect(ve.config.propinasPb).toEqual([...PROPINAS_VENEZUELA_PB]);
    // Repetirlo no duplica la ciudad.
    expect((await abrirComida(e)).estado).toBe(201);
    const n = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM zonas WHERE id = ?')
      .bind(EL_VIGIA.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it('no abre Comida si la comisión de comida del país está en otra moneda (la trampa de moneda)', async () => {
    const e = await escenarioVe();
    await e.m.DB.prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-food-ve-ves', 'food', 'conductor', 'VE', 'prepago', 'VES', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    const r = await abrirComida(e);
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('moneda');
    expect(
      await e.m.DB.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(EL_VIGIA.id).first(),
    ).toBeNull();
  });

  it('el canario marca una ciudad con Comida encendida cuya moneda no cuadra con su país', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const { saludComidaPaises } = await import('../internacional/tarifas');
    expect(await saludComidaPaises(e.m.DB)).toBe('ok');
    // Alguien pasa el país a bolívares desde el panel sin tocar la ciudad: pedidos con 409 y canario en rojo.
    await e.m.DB.prepare(
      "UPDATE config SET valor = json_set(valor, '$.moneda', 'VES') WHERE clave = 'pais:VE'",
    ).run();
    expect(await saludComidaPaises(e.m.DB)).toBe('error');
  });

  it('en producción no se abre Comida en un país nuevo', async () => {
    const e = await escenarioVe('divoox.com');
    const r = await abrirComida(e);
    expect(r.estado).toBe(409);
    expect(
      await e.m.DB.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(EL_VIGIA.id).first(),
    ).toBeNull();
  });
});

describe('C-COMIDA-VENEZUELA: el carrito en dólares con el equivalente en bolívares', () => {
  it('las tarifas del restaurante salen en dólares, con las propinas del país y la tasa del día', async () => {
    const e = await escenarioVe();
    await abrirComida(e);
    const { rid } = await restauranteVe(e);
    const sinTasa = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${rid}`);
    expect(sinTasa.estado).toBe(200);
    expect(sinTasa.datos.moneda).toBe('USD');
    expect(sinTasa.datos.pais).toBe('VE');
    expect(sinTasa.datos.config).toEqual(TARIFAS_COMIDA_VENEZUELA);
    expect(sinTasa.datos.propinasPb).toEqual([...PROPINAS_VENEZUELA_PB]);
    expect(sinTasa.datos.tasaReferencia).toBeNull();
    await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 250 }, e.admin.token);
    const conTasa = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${rid}`);
    expect(conTasa.datos.tasaReferencia).toMatchObject({ moneda: 'VES', tasa: 250 });
  });

  it('en Venezuela no se ofrece la tarjeta aunque el pedido sea en dólares', async () => {
    const e = await escenarioVe();
    await abrirComida(e);
    const { rid, platoId } = await restauranteVe(e);
    const r = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId, cantidad: 2 }],
        propinaCentavos: 0,
        direccion: 'Calle 5, El Vigía',
        lat: 8.6235,
        lng: -71.649,
        metodoPago: 'tarjeta',
      },
      e.cliente.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('metodoPago');
    const pais = await e.m.llamar('GET', `/datos/pais?restauranteId=${rid}`);
    expect(pais.datos.tarjetaActiva).toBe(false);
  });

  it('Estados Unidos no cambia: mismas tarifas, mismas propinas, sin bolívares y con tarjeta', async () => {
    const e = await escenarioVe();
    await abrirComida(e);
    const dueno = await e.m.cuenta('restaurante');
    const r = await e.m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await e.m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      e.admin.token,
    );
    await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 250 }, e.admin.token);
    const us = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${rid}`);
    expect(us.datos.moneda).toBe('USD');
    expect(us.datos.pais).toBe('US');
    expect(us.datos.config).toEqual(CONFIG_DINERO_INICIAL);
    expect(us.datos.propinasPb).toEqual([...PROPINAS_PB_INICIALES]);
    expect(us.datos.tasaReferencia).toBeNull();
    const pais = await e.m.llamar('GET', `/datos/pais?restauranteId=${rid}`);
    expect(pais.datos.tarjetaActiva).toBe(true);
  });
});
