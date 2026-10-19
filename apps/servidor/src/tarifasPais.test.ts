import { describe, expect, it, vi } from 'vitest';
import { CONFIG_DINERO_INICIAL, calcularPedido } from '@tumbite/compartido';
import { TOPES_PRUEBA } from './pruebas/paisPrueba';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-TARIFAS-PAIS (19 oct 2026): cada pedido se calcula con las tarifas de SU país, en SU moneda, y
 * guarda la moneda y la configuración aplicada. Estados Unidos sigue exactamente igual (la
 * configuración global de siempre). Un país sin tarifas escritas no recibe pedidos: el servidor
 * nunca reutiliza las cifras en dólares para pesos o bolívares. Sin Stripe real.
 */
async function escenario() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push(`${init?.method ?? 'GET'} ${url}`);
    return new Response(
      JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_secret', status: 'requires_capture' }),
      { status: 200 },
    );
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Arepa', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 200,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  /** Pasa el restaurante a una zona de Colombia (mismo lugar del mapa, para no tocar la cobertura). */
  async function aColombia() {
    await m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('CO-PRUEBA','Prueba','CO','COP','America/Bogota',25.77,-80.19,30,1)",
    ).run();
    await m.DB.prepare("UPDATE restaurantes SET zona_id = 'CO-PRUEBA' WHERE id = ?")
      .bind(rid)
      .run();
    await m.llamar('PUT', '/datos/admin/paises/CO', { efectivoActivo: true }, admin.token);
  }
  const fila = (id: string) =>
    m.DB.prepare('SELECT moneda, tarifas_json, total, envio, servicio FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{
        moneda: string;
        tarifas_json: string | null;
        total: number;
        envio: number;
        servicio: number;
      }>();
  return { m, admin, cliente, rid, plato, pedir, aColombia, fila, llamadas };
}

/** Tarifas de ejemplo en pesos, SOLO para la prueba (las reales las fija Richard). */
const TARIFAS_COP = {
  ...CONFIG_DINERO_INICIAL,
  envioBase: 5000,
  envioPorKm: 1000,
  envioMaximo: 12000,
  servicioMinimo: 1000,
  servicioMaximo: 5000,
  pedidoMinimo: 0,
  cargoPedidoPequeno: 0,
  pagoMinimoRepartidor: 4000,
};

describe('C-TARIFAS-PAIS: tarifas y moneda por país en el servidor', () => {
  it('Estados Unidos: el total es idéntico al de la configuración global y queda guardada en USD', async () => {
    const e = await escenario();
    const p = await e.pedir();
    expect(p.estado).toBe(201);
    const f = await e.fila(p.datos.pedidoId);
    const esperado = calcularPedido({
      lineas: [{ precioCentavos: 1500, cantidad: 2 }],
      plan: 'inicial',
      propina: 200,
      distanciaKm: p.datos.desglose.distanciaKm ?? null,
      config: CONFIG_DINERO_INICIAL,
    });
    expect(f?.total).toBe(p.datos.desglose.totalCliente);
    expect(p.datos.desglose.servicio).toBe(esperado.servicio);
    expect(f?.moneda).toBe('USD');
    expect(JSON.parse(String(f?.tarifas_json))).toEqual(CONFIG_DINERO_INICIAL);
    // Stripe sigue recibiendo dólares.
    expect(e.llamadas.some((l) => l.includes('/payment_intents'))).toBe(true);
  });

  it('un país sin tarifas escritas no recibe pedidos (nunca hereda las cifras en dólares)', async () => {
    const e = await escenario();
    await e.aColombia();
    const p = await e.pedir({ metodoPago: 'efectivo' });
    expect(p.estado).toBe(409);
    expect(String(p.datos.error)).toContain('isn’t taking orders in this country');
    const n = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM pedidos').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('con tarifas en pesos, el pedido se calcula con ellas y guarda COP y la configuración aplicada', async () => {
    const e = await escenario();
    await e.aColombia();
    const g = await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: TARIFAS_COP, topes: TOPES_PRUEBA, efectivoActivo: true },
      e.admin.token,
    );
    expect(g.estado).toBe(200);
    const p = await e.pedir({ metodoPago: 'efectivo' });
    expect(p.estado).toBe(201);
    expect(p.datos.moneda).toBe('COP');
    const f = await e.fila(p.datos.pedidoId);
    expect(f?.moneda).toBe('COP');
    expect(f?.envio).toBeGreaterThanOrEqual(5000);
    expect(JSON.parse(String(f?.tarifas_json))).toEqual(TARIFAS_COP);
    // Cambiar después las tarifas del país no reescribe lo que ya se aplicó al pedido.
    await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: { ...TARIFAS_COP, envioBase: 9000 }, topes: TOPES_PRUEBA },
      e.admin.token,
    );
    expect(JSON.parse(String((await e.fila(p.datos.pedidoId))?.tarifas_json)).envioBase).toBe(5000);
    const vista = await e.m.llamar(
      'GET',
      `/datos/pedidos/${p.datos.pedidoId}`,
      undefined,
      e.cliente.token,
    );
    expect(vista.datos.pedido.moneda).toBe('COP');
  });

  it('la tarjeta no se ofrece en una moneda distinta del dólar: no se crea pedido ni cobro', async () => {
    const e = await escenario();
    await e.aColombia();
    await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: TARIFAS_COP, topes: TOPES_PRUEBA, efectivoActivo: true },
      e.admin.token,
    );
    const p = await e.pedir({ metodoPago: 'tarjeta' });
    expect(p.estado).toBe(409);
    expect(e.llamadas.some((l) => l.includes('/payment_intents'))).toBe(false);
    const n = await e.m.DB.prepare('SELECT COUNT(*) AS n FROM pedidos').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('las tarifas del país se validan: el mínimo del servicio no puede pasar del máximo', async () => {
    const e = await escenario();
    const g = await e.m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      { tarifas: { ...TARIFAS_COP, servicioMinimo: 9000, servicioMaximo: 100 } },
      e.admin.token,
    );
    expect(g.estado).toBeGreaterThanOrEqual(400);
  });
});
