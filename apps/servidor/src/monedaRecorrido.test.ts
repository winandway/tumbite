import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_DINERO_INICIAL,
  type ConfigDinero,
  calcularPedido,
  distanciaKm,
} from '@tumbite/compartido';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';
import { avisoPedidoAlRestaurante, reciboDePedido } from './avisos';
import { usarTransporteCorreo } from './correo';
import { AVISOS } from './notificaciones';

/**
 * C-MONEDA-RECORRIDO (19 oct 2026): la moneda y las tarifas del país del restaurante viajan de punta
 * a punta. La app calcula el carrito con las MISMAS tarifas que el servidor (nunca las globales en
 * dólares para un restaurante de otro país), el restaurante público dice su moneda y los correos y
 * avisos de un pedido en pesos muestran pesos sin decimales. Estados Unidos no cambia. Sin Stripe.
 */

/** Tarifas de ejemplo en pesos, SOLO para la prueba (las reales las fija Richard). */
const TARIFAS_COP: ConfigDinero = {
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
const CLIENTE = { lat: 25.775, lng: -80.195 };

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_secret', status: 'requires_capture' }),
        { status: 200 },
      ),
  );
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
    { nombreEs: 'Arepa', precioCentavos: 15000 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  async function aColombia(conTarifas: boolean) {
    await m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('CO-PRUEBA','Prueba','CO','COP','America/Bogota',25.77,-80.19,30,1)",
    ).run();
    await m.DB.prepare("UPDATE restaurantes SET zona_id = 'CO-PRUEBA' WHERE id = ?")
      .bind(rid)
      .run();
    await m.llamar(
      'PUT',
      '/datos/admin/paises/CO',
      conTarifas ? { efectivoActivo: true, tarifas: TARIFAS_COP } : { efectivoActivo: true },
      admin.token,
    );
  }
  /** Lo que hace la app del cliente: pide las tarifas del restaurante y calcula el carrito. */
  async function carritoDeLaApp(propina: number, cantidad = 2) {
    const t = await m.llamar('GET', `/datos/config-dinero?restauranteId=${rid}`);
    const rest = (await m.llamar('GET', `/datos/restaurantes/${rid}`)).datos.restaurante;
    const km = distanciaKm(CLIENTE, { lat: rest.lat, lng: rest.lng });
    const d = calcularPedido({
      lineas: [{ precioCentavos: 15000, cantidad }],
      plan: rest.plan,
      propina,
      distanciaKm: km,
      config: t.datos.config,
    });
    return { tarifas: t, d, km };
  }
  const pedir = (extra: Record<string, unknown>, cantidad = 2) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad }],
        direccion: '300 Calle Prueba',
        ...CLIENTE,
        ...extra,
      },
      cliente.token,
    );
  return { m, rid, dueno, cliente, aColombia, carritoDeLaApp, pedir };
}

describe('C-MONEDA-RECORRIDO: tarifas por restaurante y moneda de punta a punta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
  });

  it('Estados Unidos: las tarifas del restaurante son la configuración global de siempre, en USD', async () => {
    const e = await escenario();
    const global = await e.m.llamar('GET', '/datos/config-dinero');
    expect(global.estado).toBe(200);
    expect(global.datos.config).toEqual(CONFIG_DINERO_INICIAL);
    const t = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${e.rid}`);
    expect(t.estado).toBe(200);
    expect(t.datos.config).toEqual(global.datos.config);
    expect(t.datos.moneda).toBe('USD');
    expect(t.datos.pais).toBe('US');
    // Un restaurante que no existe (o no está aprobado) no da tarifas.
    expect((await e.m.llamar('GET', '/datos/config-dinero?restauranteId=nada')).estado).toBe(404);
  });

  it('Colombia con tarifas: las de Colombia y COP; sin tarifas: 409 con el mensaje del servidor', async () => {
    const e = await escenario();
    await e.aColombia(false);
    const sin = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${e.rid}`);
    expect(sin.estado).toBe(409);
    expect(String(sin.datos.error)).toContain('country');
    await e.aColombia(true);
    const con = await e.m.llamar('GET', `/datos/config-dinero?restauranteId=${e.rid}`);
    expect(con.estado).toBe(200);
    expect(con.datos.config).toEqual(TARIFAS_COP);
    expect(con.datos.moneda).toBe('COP');
    expect(con.datos.pais).toBe('CO');
  });

  it('el restaurante público, la lista, la búsqueda y la ficha del superadmin llevan su moneda', async () => {
    const e = await escenario();
    const antes = await e.m.llamar('GET', `/datos/restaurantes/${e.rid}`);
    expect(antes.datos.restaurante.moneda).toBe('USD');
    const lista = await e.m.llamar('GET', '/datos/restaurantes');
    expect(lista.datos.restaurantes[0].moneda).toBe('USD');
    await e.aColombia(true);
    expect((await e.m.llamar('GET', `/datos/restaurantes/${e.rid}`)).datos.restaurante.moneda).toBe(
      'COP',
    );
    const enCo = await e.m.llamar('GET', '/datos/restaurantes?zona=CO-PRUEBA');
    expect(enCo.datos.restaurantes.map((r: { moneda: string }) => r.moneda)).toEqual(['COP']);
    // La búsqueda de platos: con Miami apagada, ese punto del mapa es la zona de Colombia.
    await e.m.DB.prepare("UPDATE zonas SET activa = 0 WHERE id = 'US-FL-MIAMI'").run();
    const busca = await e.m.llamar('GET', '/datos/buscar?q=arepa&lat=25.77&lng=-80.19');
    expect(busca.estado).toBe(200);
    expect(busca.datos.platos.length).toBe(1);
    expect(busca.datos.platos[0].moneda).toBe('COP');
  });

  it('el carrito de la app da el mismo total que el servidor, en USD y en COP', async () => {
    const e = await escenario();
    const us = await e.carritoDeLaApp(300);
    expect(us.tarifas.datos.moneda).toBe('USD');
    const pUs = await e.pedir({ propinaCentavos: 300, totalEsperado: us.d.totalCliente });
    expect(pUs.estado).toBe(201);
    expect(pUs.datos.desglose.totalCliente).toBe(us.d.totalCliente);

    await e.aColombia(true);
    const co = await e.carritoDeLaApp(6000);
    expect(co.tarifas.datos.moneda).toBe('COP');
    // Con las tarifas globales en dólares el total sería otro: justo lo que se rompía.
    const conGlobal = calcularPedido({
      lineas: [{ precioCentavos: 15000, cantidad: 2 }],
      plan: 'inicial',
      propina: 6000,
      distanciaKm: co.km,
      config: CONFIG_DINERO_INICIAL,
    });
    expect(conGlobal.totalCliente).not.toBe(co.d.totalCliente);
    const pCo = await e.pedir({
      propinaCentavos: 6000,
      totalEsperado: co.d.totalCliente,
      metodoPago: 'efectivo',
    });
    expect(pCo.estado).toBe(201);
    expect(pCo.datos.moneda).toBe('COP');
    expect(pCo.datos.desglose.totalCliente).toBe(co.d.totalCliente);
    // Y el total de la app con la global lo rechaza el servidor (no cobra otra cifra).
    const mal = await e.pedir({
      propinaCentavos: 6000,
      totalEsperado: conGlobal.totalCliente,
      metodoPago: 'efectivo',
    });
    expect(mal.estado).toBe(409);
  });

  it('ganancias, tablero, resumen y fichas suman por moneda: nunca mezclan dólares con pesos', async () => {
    const e = await escenario();
    const rep = await e.m.cuenta('repartidor', 'Rafa Rep');
    const admin = await e.m.cuenta('admin');
    const entregar = (id: string) =>
      llevarA(
        e.m.DB,
        id,
        'entregado',
        `repartidor_id = '${rep.id}', entregado_en = datetime('now'), pagado_en = datetime('now')`,
      );
    const us = await e.carritoDeLaApp(300);
    const pUs = await e.pedir({ propinaCentavos: 300, totalEsperado: us.d.totalCliente });
    await entregar(pUs.datos.pedidoId);
    await e.aColombia(true);
    const co = await e.carritoDeLaApp(6000, 3);
    const pCo = await e.pedir(
      {
        propinaCentavos: 6000,
        totalEsperado: co.d.totalCliente,
        metodoPago: 'efectivo',
      },
      3,
    );
    expect(pCo.estado).toBe(201);
    await entregar(pCo.datos.pedidoId);

    // Repartidor: un total por moneda; «totales» sigue siendo el de dólares.
    const g = await e.m.llamar('GET', '/datos/repartidor/ganancias', undefined, rep.token);
    expect(g.estado).toBe(200);
    const porMoneda = new Map(
      (g.datos.totalesPorMoneda as { moneda: string; total: number; entregas: number }[]).map(
        (x) => [x.moneda, x],
      ),
    );
    expect([...porMoneda.keys()]).toEqual(['USD', 'COP']);
    expect(porMoneda.get('USD')?.entregas).toBe(1);
    expect(porMoneda.get('COP')?.entregas).toBe(1);
    expect(g.datos.totales.total).toBe(porMoneda.get('USD')?.total);
    const pedidosG = g.datos.pedidos as { pedidoId: string; moneda: string }[];
    expect(pedidosG.find((p) => p.pedidoId === pCo.datos.pedidoId)?.moneda).toBe('COP');

    // Restaurante (ahora en Colombia): solo los pedidos en pesos, y lo dice.
    const filaCo = await e.m.DB.prepare('SELECT subtotal FROM pedidos WHERE id = ?')
      .bind(pCo.datos.pedidoId)
      .first<{ subtotal: number }>();
    const tab = await e.m.llamar('GET', '/datos/restaurante/tablero', undefined, e.dueno.token);
    expect(tab.datos.tablero.moneda).toBe('COP');
    expect(tab.datos.tablero.semana.pedidos).toBe(1);
    expect(tab.datos.tablero.semana.ventas).toBe(filaCo?.subtotal);
    const res = await e.m.llamar('GET', '/datos/restaurante/resumen', undefined, e.dueno.token);
    expect(res.datos.moneda).toBe('COP');
    expect(res.datos.resumen.ventas).toBe(filaCo?.subtotal);

    // Superadmin: ficha del repartidor y del cliente por moneda; cada ciudad en la suya.
    await e.m.DB.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
      .bind(rep.id)
      .run();
    const ficha = await e.m.llamar(
      'GET',
      `/datos/admin/repartidores/${rep.id}`,
      undefined,
      admin.token,
    );
    expect(
      (ficha.datos.repartidor.porMoneda as { moneda: string }[]).map((x) => x.moneda).sort(),
    ).toEqual(['COP', 'USD']);
    const fc = await e.m.llamar(
      'GET',
      `/datos/admin/clientes/${e.cliente.id}`,
      undefined,
      admin.token,
    );
    expect(fc.datos.cliente.pedidos).toBe(2);
    expect(fc.datos.cliente.gastado).toBe(us.d.totalCliente);
    expect(
      (fc.datos.cliente.gastadoPorMoneda as { moneda: string; monto: number }[]).find(
        (x) => x.moneda === 'COP',
      )?.monto,
    ).toBe(co.d.totalCliente);
    const resumen = await e.m.llamar('GET', '/datos/admin/resumen', undefined, admin.token);
    const ciudad = (id: string) =>
      (
        resumen.datos.ciudades as { id: string; metricas: { moneda: string; ventas30: number } }[]
      ).find((z) => z.id === id)?.metricas;
    expect(ciudad('CO-PRUEBA')?.moneda).toBe('COP');
    expect(ciudad('CO-PRUEBA')?.ventas30).toBe(co.d.totalCliente);
    expect(ciudad('US-FL-MIAMI')?.moneda).toBe('USD');
    expect(ciudad('US-FL-MIAMI')?.ventas30).toBe(us.d.totalCliente);
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/pedidos?cerrados=1',
      undefined,
      admin.token,
    );
    const enLista = lista.datos.pedidos as { id: string; moneda: string }[];
    expect(enLista.find((p) => p.id === pCo.datos.pedidoId)?.moneda).toBe('COP');
    expect(enLista.find((p) => p.id === pUs.datos.pedidoId)?.moneda).toBe('USD');
  });

  it('correos y avisos de un pedido en pesos muestran pesos sin decimales; en dólares, igual que antes', async () => {
    const enviados: { subject: string; text: string }[] = [];
    usarTransporteCorreo(async (_url, init) => {
      enviados.push(JSON.parse(String(init.body)) as { subject: string; text: string });
      return new Response(JSON.stringify({ success: true, message_id: 'm', rebotados: [] }), {
        status: 200,
      });
    });
    const env = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') } as never;
    const lineas = [{ nombreEs: 'Arepa', nombreEn: 'Arepa', precioCentavos: 15000, cantidad: 2 }];
    const base = {
      correo: 'cliente@ejemplo.com',
      nombre: 'Ana',
      idioma: 'es' as const,
      pedidoId: 'abcdef123456',
      restaurante: 'Sabor',
      lineas,
      subtotal: 30000,
      envio: 5000,
      servicio: 1500,
      propina: 6000,
      regalo: 0,
      total: 42500,
      direccion: 'Calle 1',
    };
    await reciboDePedido(env, { ...base, moneda: 'COP' });
    const co = enviados.at(-1)?.text.replace(/\s/g, ' ') ?? '';
    expect(co).toMatch(/42\.500/);
    expect(co).toMatch(/30\.000/);
    expect(co).not.toMatch(/425,00|425\.00|42\.500,00/);
    await avisoPedidoAlRestaurante(env, {
      correo: 'rest@ejemplo.com',
      idioma: 'es',
      pedidoId: 'abcdef123456',
      restaurante: 'Sabor',
      lineas,
      pagoRestaurante: 25500,
      notas: '',
      moneda: 'COP',
    });
    expect(enviados.at(-1)?.text.replace(/\s/g, ' ')).toMatch(/25\.500/);
    // En dólares (sin moneda, como los pedidos de siempre) no cambia nada.
    await reciboDePedido(env, { ...base, idioma: 'en', total: 4250 });
    expect(enviados.at(-1)?.text).toContain('Total: $42.50');
    // El aviso de un plato quitado: pesos sin decimales; en dólares, el texto de siempre.
    expect(AVISOS.platoQuitado('es', 'Arepa', 15000, 'COP').cuerpo.replace(/\s/g, ' ')).toMatch(
      /15\.000/,
    );
    expect(AVISOS.platoQuitado('en', 'Arepa', 1250).cuerpo).toBe(
      'We refunded $12.50. The rest of your order continues.',
    );
  });
});

/**
 * Para que no vuelva: las pantallas que muestran montos de un pedido no usan `formatearDolares`
 * (siempre dólares) ni leen importes con `dolaresACentavos` (siempre centavos de dólar). Las únicas
 * que pueden seguir en dólares son las de Stripe (billetera, retiros, disputas: Stripe solo cobra en
 * USD), la configuración global de EE. UU. y la calculadora pública de EE. UU.
 */
describe('C-MONEDA-RECORRIDO: ninguna pantalla de pedidos vuelve a los dólares fijos', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const PERMITIDOS = new Set([
    // Billetera de Stripe del restaurante: saldo, retiros y movimientos (solo tarjeta = USD).
    'apps/panel/src/panel/Billetera.tsx',
    // Configuración global: son las tarifas de Estados Unidos.
    'apps/panel/src/panel/AdminDinero.tsx',
    // Calculadora pública del sitio de EE. UU.
    'apps/panel/src/sitio/Calculadora.tsx',
  ]);
  const archivos = (dir: string): string[] =>
    readdirSync(join(raiz, dir)).flatMap((n) => {
      const r = `${dir}/${n}`;
      if (n === 'node_modules' || n.startsWith('.')) return [];
      if (statSync(join(raiz, r)).isDirectory()) return archivos(r);
      return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [r] : [];
    });

  it('cliente, restaurante, repartidor, paneles y piezas móviles no usan dólares fijos', () => {
    const revisados = [
      'apps/cliente/src',
      'apps/restaurante/src',
      'apps/repartidor/src',
      'apps/panel/src/panel',
      'packages/movil/src',
    ].flatMap(archivos);
    expect(revisados.length).toBeGreaterThan(40);
    const malos = revisados.filter(
      (r) =>
        !PERMITIDOS.has(r) &&
        /formatearDolares|dolaresACentavos|centavosATexto/.test(
          readFileSync(join(raiz, r), 'utf8'),
        ),
    );
    expect(malos).toEqual([]);
  });

  it('las pantallas de pedidos usan la moneda (y el carrito pide las tarifas del restaurante)', () => {
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    for (const r of [
      'apps/cliente/src/app/cart.tsx',
      'apps/cliente/src/app/order/[id].tsx',
      'apps/cliente/src/app/orders.tsx',
      'apps/cliente/src/app/restaurant/[id].tsx',
      'apps/restaurante/src/Inicio.tsx',
      'apps/restaurante/src/MiMenu.tsx',
      'apps/repartidor/src/grandes/Ganancias.tsx',
      'apps/panel/src/panel/Menu.tsx',
      'apps/panel/src/panel/SuperPedido.tsx',
      'apps/panel/src/panel/SuperFichas.tsx',
    ])
      expect(leer(r), r).toMatch(/formatearMonto|formatearTotales/);
    expect(leer('apps/cliente/src/app/cart.tsx')).toContain('/datos/config-dinero?restauranteId=');
    expect(leer('apps/restaurante/src/MiMenu.tsx')).toContain('montoEscrito(');
    expect(leer('apps/panel/src/panel/Menu.tsx')).toContain('montoEscrito(');
    // El servidor: correos del pedido y avisos con montos, en la moneda del pedido.
    const avisos = leer('apps/servidor/src/avisos.ts');
    expect(avisos).not.toContain('formatearDolares');
    expect(leer('apps/servidor/src/rutas/operacion.ts')).not.toContain('formatearDolares');
  });
});
