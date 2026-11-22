import { describe, expect, it } from 'vitest';
import { conciliar } from './conciliacion';
import { mundo, RESTAURANTE_BASE } from './pruebas/ayuda';

/**
 * C-CUENTA-PRUEBA (21 nov 2026) — todos los países. Los reportes y conteos del superadmin dejan fuera,
 * por defecto, lo que hacen las cuentas de prueba (el cliente, el conductor o el dueño del restaurante
 * marcados como prueba). `?cuentas=prueba|todas` lo cambia. La conciliación de dinero NO esconde nada:
 * sus tres igualdades siguen midiendo todo y lo de las cuentas de prueba se muestra APARTE.
 */
async function escenario() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const dueno = await m.cuenta('restaurante');
  const duenoPrueba = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente');
  const clientePrueba = await m.cuenta('cliente');
  const repartidor = await m.cuenta('repartidor');
  const repartidorPrueba = await m.cuenta('repartidor');
  const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token)).datos
    .restaurante.id as string;
  const ridPrueba = (
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, duenoPrueba.token)
  ).datos.restaurante.id as string;
  await m.DB.batch([
    m.DB.prepare("UPDATE restaurantes SET estado = 'aprobado' WHERE id IN (?, ?)").bind(
      rid,
      ridPrueba,
    ),
    m.DB.prepare(
      "INSERT OR IGNORE INTO repartidores (usuario_id, zona_id) VALUES (?, 'US-FL-MIAMI')",
    ).bind(repartidor.id),
    m.DB.prepare(
      "INSERT OR IGNORE INTO repartidores (usuario_id, zona_id) VALUES (?, 'US-FL-MIAMI')",
    ).bind(repartidorPrueba.id),
    m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id IN (?, ?, ?)').bind(
      clientePrueba.id,
      duenoPrueba.id,
      repartidorPrueba.id,
    ),
  ]);
  const meter = (
    id: string,
    clienteId: string,
    restauranteId: string,
    total: number,
    opciones: { repartidor?: string; pagoRest?: number } = {},
  ) =>
    m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
         pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, metodo_pago, creado_en, entregado_en)
       VALUES (?, ?, ?, ?, 'entregado', '[]', ?, 0, 0, 0, 0, ?, 0, ?, 0, 0, 100, 'inicial', '', '', 'US-FL-MIAMI', 'USD', 'tarjeta',
         -- Hace un rato, pero siempre dentro del día de hoy (UTC): pasada la medianoche no cae ayer.
         MAX(datetime('now', 'start of day'), datetime('now', '-1 hours')),
         MAX(datetime('now', 'start of day'), datetime('now', '-1 hours')))`,
    )
      .bind(
        id,
        clienteId,
        restauranteId,
        opciones.repartidor ?? null,
        total,
        total,
        opciones.pagoRest ?? 0,
      )
      .run();
  const hoy = new Date().toISOString().slice(0, 10);
  const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const informe = (extra = '') =>
    m.llamar(
      'GET',
      `/datos/admin/informes?desde=${dia(-2)}&hasta=${dia(1)}${extra}`,
      undefined,
      admin.token,
    );
  return {
    m,
    admin,
    cliente,
    clientePrueba,
    repartidor,
    repartidorPrueba,
    rid,
    ridPrueba,
    meter,
    hoy,
    informe,
  };
}

/** Cuatro pedidos entregados: uno real y tres que tocan una cuenta de prueba (cliente, dueño, conductor). */
async function cuatroPedidos(e: Awaited<ReturnType<typeof escenario>>) {
  await e.meter('p-real', e.cliente.id, e.rid, 1000);
  await e.meter('p-cliente', e.clientePrueba.id, e.rid, 2000);
  await e.meter('p-dueno', e.cliente.id, e.ridPrueba, 4000);
  await e.meter('p-conductor', e.cliente.id, e.rid, 8000, { repartidor: e.repartidorPrueba.id });
}

describe('C-CUENTA-PRUEBA · el resumen del superadmin no cuenta las cuentas de prueba', () => {
  it('pedidos, ventas, restaurantes y repartidores de la ciudad son solo los reales', async () => {
    const e = await escenario();
    await cuatroPedidos(e);
    const metricas = async (extra = '') => {
      const r = await e.m.llamar('GET', `/datos/admin/resumen${extra}`, undefined, e.admin.token);
      expect(r.estado).toBe(200);
      return (r.datos.ciudades as { id: string; metricas: Record<string, number> }[]).find(
        (z) => z.id === 'US-FL-MIAMI',
      )!.metricas;
    };
    const reales = await metricas();
    expect(reales.pedidos30).toBe(1);
    expect(reales.ventas30).toBe(1000);
    expect(reales.pedidosHoy).toBe(1);
    expect(reales.restaurantes).toBe(1);
    expect(reales.repartidores).toBe(1);
    const prueba = await metricas('?cuentas=prueba');
    expect(prueba.pedidos30).toBe(3);
    expect(prueba.ventas30).toBe(14000);
    expect(prueba.restaurantes).toBe(1);
    expect(prueba.repartidores).toBe(1);
    const todas = await metricas('?cuentas=todas');
    expect(todas.pedidos30).toBe(4);
    expect(todas.ventas30).toBe(15000);
    expect(todas.restaurantes).toBe(2);
    expect(todas.repartidores).toBe(2);
  });
});

describe('C-CUENTA-PRUEBA · los conteos por ciudad no cuentan las cuentas de prueba', () => {
  it('restaurantes y repartidores de cada ciudad son solo los reales', async () => {
    const e = await escenario();
    const miami = async (extra = '') =>
      (
        (await e.m.llamar('GET', `/datos/admin/zonas${extra}`, undefined, e.admin.token)).datos
          .zonas as { id: string; restaurantes: number; repartidores: number }[]
      ).find((z) => z.id === 'US-FL-MIAMI')!;
    expect(await miami()).toMatchObject({ restaurantes: 1, repartidores: 1 });
    expect(await miami('?cuentas=prueba')).toMatchObject({ restaurantes: 1, repartidores: 1 });
    expect(await miami('?cuentas=todas')).toMatchObject({ restaurantes: 2, repartidores: 2 });
  });
});

describe('C-CUENTA-PRUEBA · el informe no cuenta las cuentas de prueba', () => {
  it('filas y embudo: solo lo real por defecto; «prueba» y «todas» por parámetro; el CSV igual', async () => {
    const e = await escenario();
    await cuatroPedidos(e);
    const r = await e.informe();
    expect(r.estado).toBe(200);
    expect(r.datos.filas).toEqual([
      expect.objectContaining({ pedidos: 1, entregados: 1, ventas: 1000 }),
    ]);
    expect(r.datos.embudo.iniciados).toBe(1);
    const p = await e.informe('&cuentas=prueba');
    expect(p.datos.filas[0]).toMatchObject({ pedidos: 3, ventas: 14000 });
    expect(p.datos.embudo.iniciados).toBe(3);
    const t = await e.informe('&cuentas=todas');
    expect(t.datos.filas[0]).toMatchObject({ pedidos: 4, ventas: 15000 });
    const csv = await e.m.crudo(`/datos/admin/informes?desde=${e.hoy}&hasta=${e.hoy}&formato=csv`, {
      method: 'GET',
      headers: { authorization: `Bearer ${e.admin.token}` },
    });
    const filas = (await csv.text()).split('\n');
    expect(filas).toHaveLength(2);
    expect(filas[1]).toContain(',1000,');
  });
});

describe('C-CUENTA-PRUEBA · el tablero del panel no cuenta las cuentas de prueba', () => {
  it('pedidos, viajes y personas son solo los reales', async () => {
    const e = await escenario();
    await cuatroPedidos(e);
    await e.m.DB.batch([
      e.m.DB.prepare(
        "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general) VALUES ('v-real', 'carro', 'viaje_pasajero', ?, 'US-FL-MIAMI', 'terminada')",
      ).bind(e.cliente.id),
      e.m.DB.prepare(
        "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general) VALUES ('v-prueba', 'carro', 'viaje_pasajero', ?, 'US-FL-MIAMI', 'terminada')",
      ).bind(e.clientePrueba.id),
    ]);
    const r = await e.m.llamar('GET', '/datos/admin/tablero', undefined, e.admin.token);
    expect(r.estado).toBe(200);
    const t = r.datos.tablero;
    expect(t.pedidos30.entregados).toBe(1);
    expect(t.viajes30.terminados).toBe(1);
    expect(t.personas.clientes).toBe(1);
    expect(t.personas.restaurantes).toBe(1);
    expect(t.personas.repartidores).toBe(1);
    const todas = (
      await e.m.llamar('GET', '/datos/admin/tablero?cuentas=todas', undefined, e.admin.token)
    ).datos.tablero;
    expect(todas.pedidos30.entregados).toBe(4);
    expect(todas.viajes30.terminados).toBe(2);
    expect(todas.personas.clientes).toBe(2);
    expect(todas.personas.restaurantes).toBe(2);
    expect(todas.personas.repartidores).toBe(2);
  });
});

describe('C-CUENTA-PRUEBA · la conciliación del dinero no esconde nada', () => {
  it('un descuadre de una cuenta de prueba SIGUE contando y se muestra aparte', async () => {
    const e = await escenario();
    // Un pedido de prueba que debía pagar 700 al restaurante y no se abonó (no hay movimiento en el libro).
    await e.meter('c-prueba', e.clientePrueba.id, e.rid, 1000, { pagoRest: 700 });
    const r = await conciliar(e.m.DB, e.hoy);
    expect(r.cuadra).toBe(false);
    expect(r.detalle.cuadraRestaurantes).toBe('NO');
    expect(r.vendido).toBe(1000);
    expect(r.detalle.pruebaPedidos).toBe(1);
    expect(r.detalle.pruebaVendido).toBe(1000);
  });

  it('un descuadre REAL se ve igual aunque haya cuentas de prueba, y sin pruebas el detalle no cambia', async () => {
    const e = await escenario();
    await e.meter('c-real', e.cliente.id, e.rid, 1000, { pagoRest: 700 });
    const sin = await conciliar(e.m.DB, e.hoy);
    expect(sin.cuadra).toBe(false);
    expect(sin.detalle).not.toHaveProperty('pruebaPedidos');
    await e.meter('c-prueba', e.clientePrueba.id, e.rid, 3000);
    const con = await conciliar(e.m.DB, e.hoy);
    expect(con.cuadra).toBe(false);
    expect(con.detalle.restaurantesEsperado).toBe(700);
    expect(con.detalle.pruebaPedidos).toBe(1);
    expect(con.detalle.pruebaVendido).toBe(3000);
  });
});
