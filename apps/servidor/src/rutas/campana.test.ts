import { describe, expect, it } from 'vitest';
import { mundo, RESTAURANTE_BASE } from '../pruebas/ayuda';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard) — todos los países. La campana es de LECTURA: cuenta solo
 * lo que esa persona todavía no vio; al abrirla va a cero, se guarda en el servidor por cuenta (lo
 * leído en la computadora tampoco sale nuevo en el celular) y vuelve a contar solo con algo NUEVO.
 * Mirar no escribe; abrirla escribe UNA fila como mucho («visto hasta»), nunca una por aviso.
 *
 * C-CONTADORES-DE-TAREA: los números del menú cuentan tareas; no bajan por mirar ni por abrir la
 * campana, bajan al hacer la tarea.
 */
type Campana = {
  avisos: { tipo: string; id: string; en: string; leido: boolean }[];
  sinLeer: number;
};

async function armar() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const otroAdmin = await m.cuenta('admin', 'Otra Persona del Equipo');
  const conductor = await m.cuenta('repartidor', 'Conductor Sin Ciudad');
  // Un conductor real que nunca dijo su ciudad: queda en la zona por defecto, «sin zona».
  await m.DB.prepare(
    "INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, 'US-FL-MIAMI') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = 'US-FL-MIAMI', ubicacion_en = NULL, ciudad_elegida_en = NULL",
  )
    .bind(conductor.id)
    .run();
  await m.DB.prepare('UPDATE usuarios SET zona_id = NULL WHERE id = ?').bind(conductor.id).run();
  const ticket = (id: string, cuando = '-5 minutes') =>
    m.DB.prepare(
      `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, creado_en, actualizado_en)
       VALUES (?, ?, 'soporte', 'Ana', 'ana@ejemplo.com', 'Ayuda con mi pedido', datetime('now', ?), datetime('now', ?))`,
    )
      .bind(id, `c-${id}`, cuando, cuando)
      .run();
  const leer = async (token: string) => {
    const r = await m.llamar('GET', '/datos/panel/avisos', undefined, token);
    expect(r.estado).toBe(200);
    return r.datos as { campana: Campana; menu?: { clave: string; cantidad: number }[] };
  };
  const abrir = (token: string, campana: string, c: Campana) =>
    m.llamar('POST', '/datos/campana/visto', { campana, hasta: hastaDe(c) }, token);
  const cambios = async () =>
    (await m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0;
  return { m, admin, otroAdmin, conductor, ticket, leer, abrir, cambios };
}

const hastaDe = (c: Campana) => c.avisos.reduce((h, a) => (a.en > h ? a.en : h), '');

describe('C-CAMPANA-SE-VACIA · la campana del superadmin', () => {
  it('abrirla deja el número en cero, sigue en cero al volver y en otro aparato, y vuelve con algo nuevo', async () => {
    const e = await armar();
    await e.ticket('t1');
    const antes = await e.leer(e.admin.token);
    // Cada aviso dice qué pasó: un ticket nuevo y un conductor sin ciudad.
    expect(antes.campana.sinLeer).toBe(2);
    expect(antes.campana.avisos.map((a) => a.tipo).sort()).toEqual(['sin_zona', 'ticket']);
    expect(antes.campana.avisos.every((a) => !a.leido)).toBe(true);

    expect((await e.abrir(e.admin.token, 'superadmin', antes.campana)).estado).toBe(200);
    const despues = await e.leer(e.admin.token);
    expect(despues.campana.sinLeer).toBe(0);
    // Lo leído queda como historial, sin contar.
    expect(despues.campana.avisos).toHaveLength(2);
    expect(despues.campana.avisos.every((a) => a.leido)).toBe(true);
    // Es por persona: el otro del equipo todavía no lo vio.
    expect((await e.leer(e.otroAdmin.token)).campana.sinLeer).toBe(2);

    // Llega algo NUEVO: vuelve a contar uno.
    await e.ticket('t2', '+2 seconds');
    const nuevo = await e.leer(e.admin.token);
    expect(nuevo.campana.sinLeer).toBe(1);
    expect(nuevo.campana.avisos.find((a) => a.id === 't2')?.leido).toBe(false);
  });

  it('abrir la campana NO baja los números del menú (son tareas)', async () => {
    const e = await armar();
    await e.ticket('t1');
    const antes = await e.leer(e.admin.token);
    await e.abrir(e.admin.token, 'superadmin', antes.campana);
    const menu = (await e.leer(e.admin.token)).menu ?? [];
    expect(menu.find((x) => x.clave === 'tickets')?.cantidad).toBe(1);
    expect(menu.find((x) => x.clave === 'drivers')?.cantidad).toBe(1);
  });

  it('mirar no escribe; abrirla escribe UNA fila como mucho y repetirlo no escribe nada', async () => {
    const e = await armar();
    for (const id of ['t1', 't2', 't3', 't4']) await e.ticket(id);
    await e.m.sesionLista(e.admin.token);
    const c0 = await e.cambios();
    const leida = await e.leer(e.admin.token);
    await e.leer(e.admin.token);
    expect(await e.cambios()).toBe(c0); // mirar: cero escrituras
    await e.abrir(e.admin.token, 'superadmin', leida.campana);
    const c1 = await e.cambios();
    expect(c1 - c0).toBe(1); // cinco avisos, UNA fila
    await e.abrir(e.admin.token, 'superadmin', leida.campana);
    expect(await e.cambios()).toBe(c1); // otra vez lo mismo: nada
  });

  it('una fecha del futuro no deja la campana muda: se guarda como mucho «ahora»', async () => {
    const e = await armar();
    const r = await e.m.llamar(
      'POST',
      '/datos/campana/visto',
      { campana: 'superadmin', hasta: '2999-01-01 00:00:00' },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    await e.ticket('t9', '+2 seconds');
    expect((await e.leer(e.admin.token)).campana.avisos.find((a) => a.id === 't9')?.leido).toBe(
      false,
    );
  });

  it('solo se marca una campana conocida, con sesión', async () => {
    const e = await armar();
    const hasta = '2026-01-01 00:00:00';
    expect(
      (await e.m.llamar('POST', '/datos/campana/visto', { campana: 'superadmin', hasta })).estado,
    ).toBe(401);
    expect(
      (await e.m.llamar('POST', '/datos/campana/visto', { campana: 'otra', hasta }, e.admin.token))
        .estado,
    ).toBe(400);
    // La del superadmin es solo del equipo.
    expect(
      (
        await e.m.llamar(
          'POST',
          '/datos/campana/visto',
          { campana: 'superadmin', hasta },
          e.conductor.token,
        )
      ).estado,
    ).toBe(403);
  });
});

describe('C-CAMPANA-SE-VACIA · la consulta cabe en D1', () => {
  it('ninguna consulta de la cabecera une más de cinco partes (D1: «too many terms in compound SELECT»)', async () => {
    const consultas: string[] = [];
    const m = mundo(
      {},
      {
        envolver: (db) =>
          new Proxy(db, {
            get(blanco, prop, recibidor) {
              const v = Reflect.get(blanco, prop, recibidor) as unknown;
              if (prop === 'prepare' && typeof v === 'function')
                return (sql: string) => {
                  consultas.push(sql);
                  return (v as (q: string) => unknown).call(blanco, sql);
                };
              return typeof v === 'function' ? (v as () => unknown).bind(blanco) : v;
            },
          }),
      },
    );
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    consultas.length = 0;
    expect((await m.llamar('GET', '/datos/panel/avisos', undefined, admin.token)).estado).toBe(200);
    expect((await m.llamar('GET', '/datos/panel/avisos', undefined, dueno.token)).estado).toBe(200);
    expect(consultas.length).toBeGreaterThan(0);
    for (const q of consultas)
      expect((q.match(/\bUNION\b/gi) ?? []).length, q.slice(0, 120)).toBeLessThanOrEqual(4);
  });
});

describe('C-CONTADORES-DE-TAREA · los números del menú bajan al hacer la tarea', () => {
  it('«Repartidores»: un conductor sin ciudad que de verdad está en la ciudad por defecto se puede confirmar, y el número baja', async () => {
    const e = await armar();
    const menu = async () =>
      ((await e.leer(e.admin.token)).menu ?? []).find((x) => x.clave === 'drivers')?.cantidad ?? 0;
    expect(await menu()).toBe(1);
    const r = await e.m.llamar(
      'PUT',
      `/datos/admin/conductores/${e.conductor.id}/ciudad`,
      { zonaId: 'US-FL-MIAMI', motivo: 'Confirmó que vive en Miami' },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(await menu()).toBe(0);
    // Y ya tenía su ciudad: confirmarla otra vez sí dice que ya está ahí.
    const otra = await e.m.llamar(
      'PUT',
      `/datos/admin/conductores/${e.conductor.id}/ciudad`,
      { zonaId: 'US-FL-MIAMI', motivo: 'Otra vez' },
      e.admin.token,
    );
    expect(otra.estado).toBe(409);
  });

  it('«Tickets»: responder un ticket lo saca de la cuenta', async () => {
    const e = await armar();
    await e.ticket('t1');
    await e.ticket('t2');
    const menu = async () =>
      ((await e.leer(e.admin.token)).menu ?? []).find((x) => x.clave === 'tickets')?.cantidad ?? 0;
    expect(await menu()).toBe(2);
    const r = await e.m.llamar(
      'POST',
      '/datos/admin/tickets/t1/mensajes',
      { texto: 'Ya lo revisamos, gracias por escribir.' },
      e.admin.token,
    );
    expect(r.estado).toBeLessThan(300);
    expect(await menu()).toBe(1);
  });
});

describe('C-CAMPANA-SE-VACIA · la campana del panel del restaurante', () => {
  it('el pedido nuevo es un aviso que se lee; el pedido por aceptar es una tarea del menú', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
         pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, creado_en)
       VALUES ('p1', ?, ?, 'pagado', '[]', 2000, 399, 199, 0, 200, 2798, 0, 0, 0, 0, 300, 'inicial', '', '', 'US-FL-MIAMI', 'USD', datetime('now', '-3 minutes'))`,
    )
      .bind(cliente.id, rid)
      .run();
    const leer = async () =>
      (await m.llamar('GET', '/datos/panel/avisos', undefined, dueno.token)).datos as {
        campana: Campana;
        menu: { clave: string; cantidad: number }[];
      };
    const antes = await leer();
    expect(antes.campana.sinLeer).toBe(1);
    expect(antes.menu.find((x) => x.clave === 'orders')?.cantidad).toBe(1);
    await m.llamar(
      'POST',
      '/datos/campana/visto',
      { campana: 'restaurante', hasta: hastaDe(antes.campana) },
      dueno.token,
    );
    const despues = await leer();
    expect(despues.campana.sinLeer).toBe(0);
    // Leerlo no lo acepta: el pedido sigue esperando en el menú.
    expect(despues.menu.find((x) => x.clave === 'orders')?.cantidad).toBe(1);
    await m.DB.prepare("UPDATE pedidos SET estado = 'aceptado' WHERE id = 'p1'").run();
    expect((await leer()).menu.find((x) => x.clave === 'orders')).toBeUndefined();
  });
});

describe('C-CAMPANA-SE-VACIA · las campanas de las apps (cliente y conductor)', () => {
  async function conPedido() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const conductor = await m.cuenta('repartidor');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    await m.DB.prepare("UPDATE restaurantes SET estado = 'aprobado' WHERE id = ?").bind(rid).run();
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
         pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, creado_en, aceptado_en)
       VALUES ('p1', ?, ?, 'aceptado', '[]', 2000, 399, 199, 0, 200, 2798, 0, 0, 0, 0, 300, 'inicial', '', '', 'US-FL-MIAMI', 'USD', datetime('now', '-9 minutes'), datetime('now', '-4 minutes'))`,
    )
      .bind(cliente.id, rid)
      .run();
    return { m, cliente, conductor };
  }

  it('cliente: abrir «Avisos» deja el número en cero; un cambio nuevo del pedido vuelve a contar', async () => {
    const { m, cliente } = await conPedido();
    const leer = async () =>
      (await m.llamar('GET', '/datos/mis-avisos', undefined, cliente.token)).datos as Campana & {
        pendientes: number;
      };
    const antes = await leer();
    expect(antes.sinLeer).toBe(1);
    const r = await m.llamar(
      'POST',
      '/datos/campana/visto',
      { campana: 'cliente', hasta: hastaDe(antes) },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    const despues = await leer();
    expect(despues.sinLeer).toBe(0);
    expect(despues.avisos).toHaveLength(1); // queda como historial
    // El pedido sigue en curso (las versiones publicadas de la app leen `pendientes`): no cambia.
    expect(despues.pendientes).toBe(1);
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'listo', listo_en = datetime('now', '+2 seconds') WHERE id = 'p1'",
    ).run();
    expect((await leer()).sinLeer).toBe(1);
  });

  it('conductor: las ofertas vencidas no salen «nuevas» en cada vistazo; abrir la campana la deja en cero', async () => {
    const { m, conductor } = await conPedido();
    await m.DB.prepare(
      "INSERT INTO ofertas (pedido_id, repartidor_id, estado, creada_en) VALUES ('p1', ?, 'vencida', datetime('now', '-30 minutes'))",
    )
      .bind(conductor.id)
      .run();
    const leer = async () =>
      (await m.llamar('GET', '/datos/repartidor/avisos', undefined, conductor.token))
        .datos as Campana;
    const antes = await leer();
    expect(antes.sinLeer).toBe(1);
    // Su fecha es la de la oferta vencida, no «ahora» (si no, volvería a salir nueva al rato).
    const hace20 = await m.DB.prepare("SELECT datetime('now', '-20 minutes') AS t").first<{
      t: string;
    }>();
    expect((antes.avisos[0]?.en ?? '9') < (hace20?.t ?? '')).toBe(true);
    await m.llamar(
      'POST',
      '/datos/campana/visto',
      { campana: 'repartidor', hasta: hastaDe(antes) },
      conductor.token,
    );
    expect((await leer()).sinLeer).toBe(0);
    expect((await leer()).sinLeer).toBe(0);
  });
});
