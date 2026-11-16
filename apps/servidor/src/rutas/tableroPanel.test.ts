import { describe, expect, it } from 'vitest';
import { mundo, RESTAURANTE_BASE } from '../pruebas/ayuda';

/**
 * C-PANEL-ARMAZON: los tableros del panel leen datos reales y NO escriben nada. El resumen del
 * superadmin (pedidos y viajes por día, estados, personas, lo último) y la campana de cada rol.
 */
describe('C-PANEL-ARMAZON · tablero y avisos del panel', () => {
  async function armar() {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    const meter = (id: string, estado: string, cuando: string) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
           pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, creado_en)
         VALUES (?, ?, ?, ?, '[]', 2000, 399, 199, 0, 200, 2798, 0, 0, 0, 0, 300, 'inicial', '', '', 'US-FL-MIAMI', 'USD', datetime('now', ?))`,
      )
        .bind(id, cliente.id, rid, estado, cuando)
        .run();
    return { m, admin, dueno, cliente, meter };
  }

  it('el tablero del superadmin cuenta por día, por estado y compara la semana con la anterior', async () => {
    const { m, admin, meter } = await armar();
    await meter('p1', 'entregado', '-1 hours');
    await meter('p2', 'cancelado', '-2 days');
    await meter('p3', 'pagado', '-2 days');
    await meter('p4', 'entregado', '-9 days');
    await meter('p5', 'pago_pendiente', '-1 hours'); // un pago sin terminar no es un pedido
    await m.DB.prepare(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto) VALUES ('t1', 'c1', 'soporte', 'Ana', 'ana@ejemplo.com', 'No llega mi pedido')",
    ).run();
    const r = await m.llamar('GET', '/datos/admin/tablero', undefined, admin.token);
    expect(r.estado).toBe(200);
    const t = r.datos.tablero;
    expect(t.porDia).toHaveLength(14);
    expect(t.porDia.reduce((s: number, d: { pedidos: number }) => s + d.pedidos, 0)).toBe(4);
    expect(t.porDia.at(-1).dia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t.pedidos30).toEqual({ entregados: 2, enCurso: 1, cancelados: 1 });
    expect(t.semana).toEqual({ pedidos: 3, anterior: 1 });
    expect(t.personas).toMatchObject({ clientes: 1, restaurantes: 0, restaurantesPorAprobar: 1 });
    expect(t.viajes30).toEqual({ terminados: 0, enCurso: 0, cancelados: 0 });
    expect(t.actividad).toEqual([
      expect.objectContaining({ id: 't1', asunto: 'No llega mi pedido', estado: 'abierto' }),
    ]);
  });

  it('solo el equipo ve el tablero del superadmin', async () => {
    const { m, dueno } = await armar();
    expect((await m.llamar('GET', '/datos/admin/tablero', undefined, dueno.token)).estado).toBe(
      403,
    );
    expect((await m.llamar('GET', '/datos/admin/tablero')).estado).toBe(401);
  });

  it('la campana trae lo de cada rol: tickets para el equipo, pedidos por aceptar para el restaurante', async () => {
    const { m, admin, dueno, cliente, meter } = await armar();
    await meter('p1', 'pagado', '-5 minutes');
    await meter('p2', 'entregado', '-1 hours');
    await m.DB.prepare(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto) VALUES ('t1', 'c1', 'soporte', 'Ana', 'ana@ejemplo.com', 'Ayuda')",
    ).run();
    const delAdmin = (await m.llamar('GET', '/datos/panel/avisos', undefined, admin.token)).datos;
    expect(delAdmin.avisos).toEqual([
      { clave: 'tickets', cantidad: 1 },
      { clave: 'restaurantes', cantidad: 1 },
    ]);
    const delRest = (await m.llamar('GET', '/datos/panel/avisos', undefined, dueno.token)).datos;
    expect(delRest.avisos).toEqual([{ clave: 'pedidos', cantidad: 1 }]);
    const delCliente = await m.llamar('GET', '/datos/panel/avisos', undefined, cliente.token);
    expect(delCliente.datos.avisos).toEqual([]);
    expect((await m.llamar('GET', '/datos/panel/avisos')).estado).toBe(401);
  });

  it('leer el tablero y la campana no escribe nada en la base', async () => {
    const { m, admin, dueno, meter } = await armar();
    await meter('p1', 'pagado', '-5 minutes');
    await m.sesionLista(admin.token);
    const cambios = async () =>
      (await m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0;
    const antes = await cambios();
    await m.llamar('GET', '/datos/admin/tablero', undefined, admin.token);
    await m.llamar('GET', '/datos/panel/avisos', undefined, admin.token);
    await m.llamar('GET', '/datos/panel/avisos', undefined, dueno.token);
    expect(await cambios()).toBe(antes);
  });
});
