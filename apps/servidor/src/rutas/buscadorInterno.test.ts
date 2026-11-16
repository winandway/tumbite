import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { medidorDeLecturas, sembrarVolumen } from '../pruebas/lecturas';

/**
 * C-BUSCADOR-SERIO y C-SUPERADMIN-ENLACES (15 nov 2026, Richard buscó «407F» en el superadmin y no
 * salió; y la ficha de «Prueba en vivo» decía «Esta página no existe»). Todos los países.
 */

const ID = (n: number, comienzo = '407f2f00') =>
  `${comienzo}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P_VIVO = ID(1);
const P_NOVI = ID(2);
const P_ESPERA = ID(3, '407f2fff');
const P_BORRADO = ID(4, '407faaaa');
const P_MONTO = ID(5, 'aaaa0000');
const P_MONTO_VIEJO = ID(6, 'bbbb0000');
const VIAJE = ID(7, 'c0ffee00');
const TICKET = ID(8, '407f9999');
const RESTAURANTE_RARO = 'zz-vivo-r-2ff1f76da2c5';

type Base = D1Database;
const correr = async (db: Base, sql: string, ...v: unknown[]) => {
  await db
    .prepare(sql)
    .bind(...v)
    .run();
};

function pedido(
  db: Base,
  id: string,
  estado: string,
  extra: Partial<Record<string, unknown>> = {},
) {
  const v = {
    cliente: 'c-ana',
    restaurante: RESTAURANTE_RARO,
    zona: 'US-FL-MIAMI',
    total: 2800,
    hace: '-10 minutes',
    repartidor: null as string | null,
    ...extra,
  };
  return correr(
    db,
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio,
       servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento,
       ganancia, plan, direccion, lat, lng, zona_id, creado_en, pagado_en)
     VALUES (?, ?, ?, ?, ?, '[]', 2000, 300, 200, 0, 300, ?, 400, 1600, 600, 0, 200, 'basico', 'Calle 1',
       25.78, -80.2, ?, datetime('now', ?), CASE WHEN ? = 'pago_pendiente' THEN NULL ELSE datetime('now', ?) END)`,
    id,
    v.cliente,
    v.restaurante,
    v.repartidor,
    estado,
    v.total,
    v.zona,
    v.hace,
    estado,
    v.hace,
  );
}

/** Siembra lo mínimo de cada tipo, directo en SQL (antes de la primera petición). */
async function sembrar(db: Base) {
  await correr(
    db,
    "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('US-MI-NOVI', 'Novi', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 30, 1)",
  );
  const usuario = (
    id: string,
    nombre: string,
    rol: string,
    correo: string,
    telefono: string | null,
    canonico: string | null,
    activo = 1,
  ) =>
    correr(
      db,
      `INSERT INTO usuarios (id, correo, nombre, telefono, rol, clave_hash, zona_id, activo, correo_canonico, telefono_canonico)
       VALUES (?, ?, ?, ?, ?, 'x', 'US-FL-MIAMI', ?, ?, ?)`,
      id,
      correo,
      nombre,
      telefono,
      rol,
      activo,
      correo,
      canonico,
    );
  await usuario(
    'c-ana',
    'Ángela Ruiz',
    'cliente',
    'ana.ruiz@ejemplo.com',
    '+1 (305) 555-4821',
    '13055554821',
  );
  await usuario('c-viejo', 'Jose Viejo', 'cliente', 'viejo@ejemplo.com', '305-555-9911', null);
  await usuario(
    'c-borrado',
    'Cuenta borrada',
    'cliente',
    'borrada-c@tumbite.invalid',
    null,
    null,
    0,
  );
  await usuario('r-carla', 'Carla Veloz', 'repartidor', 'carla@ejemplo.com', null, null);
  await usuario('u-dueno', 'Dueño Uno', 'restaurante', 'dueno@ejemplo.com', null, null);
  await usuario('u-dueno2', 'Dueño Dos', 'restaurante', 'dueno2@ejemplo.com', null, null);
  await correr(
    db,
    "INSERT INTO repartidores (usuario_id, codigo, zona_id) VALUES ('r-carla', 'US-MIA-000123', 'US-FL-MIAMI')",
  );
  await correr(
    db,
    "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES ('r-carla', 'moto', 'AB123C')",
  );
  await correr(
    db,
    "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado) VALUES ('v-1', 'r-carla', 'carro', 'xyz987', 'FL')",
  );
  await correr(
    db,
    "INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, estado, zona_id) VALUES (?, 'u-dueno', 'Prueba en vivo', 25.77, -80.19, 'aprobado', 'US-FL-MIAMI')",
    RESTAURANTE_RARO,
  );
  await correr(
    db,
    "INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, estado, zona_id) VALUES ('r-sabor', 'u-dueno2', 'Sabor Ñandú', 25.77, -80.19, 'aprobado', 'US-FL-MIAMI')",
  );
  await pedido(db, P_VIVO, 'pagado', { repartidor: 'r-carla' });
  await pedido(db, P_NOVI, 'entregado', { zona: 'US-MI-NOVI', hace: '-2 days' });
  await pedido(db, P_ESPERA, 'pago_pendiente', { hace: '-1 minutes' });
  await pedido(db, P_BORRADO, 'cancelado', { cliente: 'c-borrado', hace: '-5 days' });
  await pedido(db, P_MONTO, 'entregado', {
    total: 1234,
    hace: '-3 days',
    restaurante: 'r-sabor',
    cliente: 'c-viejo',
  });
  await pedido(db, P_MONTO_VIEJO, 'entregado', { total: 1234, hace: '-40 days' });
  await correr(
    db,
    `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general)
     VALUES (?, 'moto', 'viaje_pasajero', 'c-ana', 'US-FL-MIAMI', 'terminada')`,
    VIAJE,
  );
  await correr(
    db,
    `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion,
       destino_lat, destino_lng, destino_direccion, pin_recogida)
     VALUES (?, 'terminado', 'sistema', 'k', 25.7, -80.2, 'Origen', 25.8, -80.1, 'Destino', '1234')`,
    VIAJE,
  );
  await correr(
    db,
    `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, usuario_id, pedido_id)
     VALUES (?, 'codigo-secreto-largo', 'queja', 'Ángela Ruiz', 'ana.ruiz@ejemplo.com', 'Pedido tarde', 'c-ana', ?)`,
    TICKET,
    P_VIVO,
  );
}

async function escenario() {
  const m = mundo();
  // La primera petición arma el esquema (columnas e índices); después se siembra.
  const admin = await m.cuenta('admin');
  await sembrar(m.DB);
  const buscar = async (q: string) =>
    (
      await m.llamar(
        'GET',
        `/datos/admin/buscar?q=${encodeURIComponent(q)}`,
        undefined,
        admin.token,
      )
    ).datos as {
      grupos: { tipo: string; resultados: Record<string, unknown>[] }[];
      salto: string | null;
      avisoMonto: boolean;
    };
  const grupo = (r: Awaited<ReturnType<typeof buscar>>, tipo: string) =>
    r.grupos.find((g) => g.tipo === tipo)?.resultados ?? [];
  const lista = async (consulta: string) =>
    (await m.llamar('GET', `/datos/admin/pedidos?${consulta}`, undefined, admin.token)).datos as {
      pedidos: Record<string, unknown>[];
      siguiente: string | null;
      porCodigo: boolean;
      encontrado: { cerrados: boolean; vivos: boolean; otrasCiudades: string[] } | null;
      avisoMonto: boolean;
    };
  return { m, admin, buscar, grupo, lista };
}

describe('C-BUSCADOR-SERIO · el buscador de arriba del superadmin', () => {
  it('un código corto encuentra TODOS los pedidos que empiezan así, de cualquier estado y ciudad, el más reciente primero', async () => {
    const { buscar, grupo } = await escenario();
    for (const q of ['407F', '407f', '#407F']) {
      const pedidos = grupo(await buscar(q), 'pedidos');
      expect(
        pedidos.map((p) => p.id),
        q,
      ).toEqual([P_ESPERA, P_VIVO, P_NOVI, P_BORRADO]);
      expect(pedidos.map((p) => p.estado)).toEqual([
        'pago_pendiente',
        'pagado',
        'entregado',
        'cancelado',
      ]);
      expect(pedidos.map((p) => p.ciudad)).toEqual(['Miami', 'Miami', 'Novi', 'Miami']);
    }
    // El cliente con la cuenta borrada no rompe nada y no se muestra su nombre.
    const r = await buscar('407faa');
    expect(grupo(r, 'pedidos')).toHaveLength(1);
    expect(grupo(r, 'pedidos')[0]?.detalle).toBe('Prueba en vivo');
    // El ticket con el mismo comienzo también sale, en su grupo.
    expect(grupo(await buscar('407F'), 'tickets').map((t) => t.id)).toEqual([TICKET]);
  });

  it('un id entero salta directo a su ficha, también si no es un UUID', async () => {
    const { buscar } = await escenario();
    expect((await buscar(P_NOVI.toUpperCase())).salto).toBe(`/orders/${P_NOVI}`);
    expect((await buscar(RESTAURANTE_RARO)).salto).toBe(`/restaurants/${RESTAURANTE_RARO}`);
    expect((await buscar(VIAJE)).salto).toBe(`/rides/${VIAJE}`);
  });

  it('nombres sin acentos ni mayúsculas, desde la primera letra', async () => {
    const { buscar, grupo } = await escenario();
    for (const q of ['ange', 'ÁNG', 'Ángela r', 'a'])
      expect(
        grupo(await buscar(q), 'clientes').map((c) => c.titulo),
        q,
      ).toContain('Ángela Ruiz');
    expect(grupo(await buscar('sabor nan'), 'restaurantes').map((r) => r.titulo)).toEqual([
      'Sabor Ñandú',
    ]);
    expect(grupo(await buscar('prueba'), 'restaurantes').map((r) => r.id)).toEqual([
      RESTAURANTE_RARO,
    ]);
    // La cuenta borrada no aparece entre los clientes.
    expect(grupo(await buscar('cuenta'), 'clientes')).toEqual([]);
  });

  it('teléfono por el final y por el comienzo (cuentas nuevas y viejas), siempre enmascarado', async () => {
    const { buscar, grupo } = await escenario();
    const porFinal = await buscar('4821');
    expect(grupo(porFinal, 'clientes').map((c) => c.id)).toEqual(['c-ana']);
    expect(grupo(porFinal, 'clientes')[0]?.detalle).toContain('+1 ••• ••• 4821');
    expect(JSON.stringify(porFinal)).not.toContain('555');
    expect(JSON.stringify(porFinal)).not.toContain('ana.ruiz@');
    expect(grupo(await buscar('(305) 555'), 'clientes').map((c) => c.id)).toEqual([
      'c-ana',
      'c-viejo',
    ]);
    expect(grupo(await buscar('9911'), 'clientes').map((c) => c.id)).toEqual(['c-viejo']);
    expect(grupo(await buscar('+13055554821'), 'clientes').map((c) => c.id)).toEqual(['c-ana']);
  });

  it('correo exacto o a medias, repartidor por nombre, código y placa, vehículos por placa', async () => {
    const { buscar, grupo } = await escenario();
    const porCorreo = await buscar('ANA.RUIZ@ejemplo.com');
    expect(grupo(porCorreo, 'clientes').map((c) => c.id)).toEqual(['c-ana']);
    expect(grupo(porCorreo, 'tickets').map((t) => t.id)).toEqual([TICKET]);
    expect(grupo(await buscar('ana.r@'), 'clientes')).toEqual([]);
    expect(grupo(await buscar('ana.ru'), 'clientes').map((c) => c.id)).toEqual([]);
    expect(grupo(await buscar('carla@'), 'repartidores').map((c) => c.id)).toEqual(['r-carla']);
    expect(grupo(await buscar('us-mia-0001'), 'repartidores').map((c) => c.id)).toEqual([
      'r-carla',
    ]);
    expect(grupo(await buscar('carl'), 'repartidores')[0]).toMatchObject({
      id: 'r-carla',
      enlace: '/drivers/r-carla',
    });
    expect(grupo(await buscar('ab-123'), 'repartidores').map((c) => c.id)).toEqual(['r-carla']);
    const placa = await buscar('XYZ9');
    expect(grupo(placa, 'vehiculos')).toEqual([
      expect.objectContaining({ titulo: 'XYZ987', enlace: '/drivers/r-carla' }),
    ]);
    expect(grupo(placa, 'repartidores').map((c) => c.id)).toEqual(['r-carla']);
  });

  it('monto solo en los últimos 30 días, y lo avisa; viaje por su código', async () => {
    const { buscar, grupo } = await escenario();
    const r = await buscar('$12.34');
    expect(r.avisoMonto).toBe(true);
    expect(grupo(r, 'pedidos').map((p) => p.id)).toEqual([P_MONTO]);
    const v = await buscar('c0ffee');
    expect(grupo(v, 'viajes')).toEqual([
      expect.objectContaining({ id: VIAJE, estado: 'terminado', ciudad: 'Miami' }),
    ]);
  });

  it('solo el equipo puede buscar', async () => {
    const { m } = await escenario();
    const cliente = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/admin/buscar?q=407f', undefined, cliente.token)).estado,
    ).toBe(403);
    expect((await m.llamar('GET', '/datos/admin/buscar?q=407f')).estado).toBe(401);
  });
});

describe('C-BUSCADOR-SERIO · «Pedidos en curso» con la misma lógica', () => {
  it('Vivos incluye «Esperando pago»; Cerrados y Todos; el viejo «cerrados=1» sigue sirviendo', async () => {
    const { lista } = await escenario();
    const vivos = await lista('estado=vivos');
    expect(vivos.pedidos.map((p) => p.id).sort()).toEqual([P_VIVO, P_ESPERA].sort());
    expect(vivos.pedidos.find((p) => p.id === P_ESPERA)).toMatchObject({
      estado: 'pago_pendiente',
      luz: 'verde',
    });
    const cerrados = await lista('estado=cerrados&servicio=comida');
    expect(cerrados.pedidos.map((p) => p.id)).toEqual([P_NOVI, P_MONTO, P_BORRADO, P_MONTO_VIEJO]);
    expect(cerrados.pedidos.find((p) => p.id === P_BORRADO)?.cliente).toBeNull();
    expect((await lista('cerrados=1&servicio=comida')).pedidos).toHaveLength(4);
    expect((await lista('estado=todos&servicio=comida')).pedidos).toHaveLength(6);
    // C-MONITOREO-SERVICIOS: con «Todos» los servicios, el viaje en moto entra en la misma lista.
    const juntos = await lista('estado=cerrados');
    expect(juntos.pedidos.map((p) => p.id)).toEqual([
      VIAJE,
      P_NOVI,
      P_MONTO,
      P_BORRADO,
      P_MONTO_VIEJO,
    ]);
    expect(juntos.pedidos.find((p) => p.id === VIAJE)).toMatchObject({
      tipo: 'viaje',
      servicio: 'moto',
    });
    expect((await lista('estado=todos&zona=US-MI-NOVI')).pedidos.map((p) => p.id)).toEqual([
      P_NOVI,
    ]);
  });

  it('un código se busca sin importar el estado ni la ciudad, y dice dónde se encontró', async () => {
    const { lista } = await escenario();
    const r = await lista('estado=vivos&zona=US-FL-MIAMI&q=%23407F');
    expect(r.porCodigo).toBe(true);
    expect(r.pedidos.map((p) => p.id)).toEqual([P_ESPERA, P_VIVO, P_NOVI, P_BORRADO]);
    expect(r.encontrado).toEqual({ cerrados: true, vivos: false, otrasCiudades: ['Novi'] });
    const cada = r.pedidos.find((p) => p.id === P_VIVO);
    expect(cada).toMatchObject({
      restaurante: 'Prueba en vivo',
      cliente: 'Ángela Ruiz',
      repartidor: 'Carla Veloz',
      repartidorCodigo: 'US-MIA-000123',
      ciudad: 'Miami',
      total: 2800,
      moneda: 'USD',
    });
    expect(String(cada?.creadoEn)).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it('por persona, comercio o monto, con el estado elegido', async () => {
    const { lista } = await escenario();
    expect((await lista('estado=todos&q=ange')).pedidos.map((p) => p.id)).toEqual([
      P_ESPERA,
      P_VIVO,
      P_NOVI,
      P_MONTO_VIEJO,
    ]);
    expect((await lista('estado=cerrados&q=sabor')).pedidos.map((p) => p.id)).toEqual([P_MONTO]);
    expect((await lista('estado=todos&q=carla')).pedidos.map((p) => p.id)).toEqual([P_VIVO]);
    const monto = await lista('estado=todos&q=12.34');
    expect(monto.avisoMonto).toBe(true);
    expect(monto.pedidos.map((p) => p.id)).toEqual([P_MONTO]);
    expect((await lista('estado=todos&q=zzzz')).pedidos).toEqual([]);
  });

  it('pagina de a 50 con «Cargar más», sin repetidos ni saltos (con ciudad y sin ella)', async () => {
    const { m, admin, lista } = await escenario();
    // 120 pedidos cerrados más en Miami, dos por segundo (fechas que empatan).
    await m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 120)
       INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
         cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia,
         plan, direccion, zona_id, creado_en)
       SELECT 'pag-' || printf('%03d', i), 'c-viejo', 'r-sabor', CASE WHEN i % 2 = 0 THEN 'entregado' ELSE 'cancelado' END,
         '[]', 1, 1, 1, 0, 0, 3, 0, 0, 0, 0, 0, 'basico', 'x', 'US-FL-MIAMI', datetime('now', '-' || (i / 2) || ' hours')
       FROM n`,
    ).run();
    // C-MONITOREO-SERVICIOS: solo comida (los pedidos) y con todos los servicios (el viaje en moto de
    // Miami entra una vez, en su lugar, sin repetirse ni saltarse en ninguna página).
    for (const filtro of [
      'estado=cerrados&zona=US-FL-MIAMI&servicio=comida',
      'estado=cerrados&servicio=comida',
      'estado=todos&servicio=comida',
      'estado=cerrados&zona=US-FL-MIAMI',
      'estado=cerrados',
      'estado=todos',
    ]) {
      const vistos: string[] = [];
      let despues = '';
      for (let vuelta = 0; vuelta < 10; vuelta++) {
        const r = await lista(
          `${filtro}${despues ? `&despues=${encodeURIComponent(despues)}` : ''}`,
        );
        expect(r.pedidos.length).toBeLessThanOrEqual(50);
        vistos.push(...r.pedidos.map((p) => String(p.id)));
        if (!r.siguiente) break;
        despues = r.siguiente;
      }
      const conViaje = filtro.includes('comida') ? 0 : 1;
      const esperados =
        (filtro.includes('MIAMI') ? 123 : filtro.includes('todos') ? 126 : 124) + conViaje;
      if (conViaje) expect(vistos, filtro).toContain(VIAJE);
      expect(vistos, filtro).toHaveLength(esperados);
      expect(new Set(vistos).size, filtro).toBe(esperados);
    }
    const mal = await m.llamar(
      'GET',
      '/datos/admin/pedidos?despues=1%3B%20DROP',
      undefined,
      admin.token,
    );
    expect(mal.estado).toBe(400);
  });
});

describe('C-SUPERADMIN-ENLACES · las fichas del servidor aceptan ids que no son UUID', () => {
  it('restaurante, cliente, repartidor, pedido y ticket abren con su id', async () => {
    const { m, admin } = await escenario();
    for (const ruta of [
      `/datos/admin/restaurantes/${RESTAURANTE_RARO}`,
      '/datos/admin/clientes/c-ana',
      '/datos/admin/repartidores/r-carla',
      `/datos/admin/pedidos/${P_VIVO}`,
      `/datos/admin/tickets/${TICKET}`,
    ])
      expect((await m.llamar('GET', ruta, undefined, admin.token)).estado, ruta).toBe(200);
    const r = await m.llamar(
      'GET',
      `/datos/admin/restaurantes/${RESTAURANTE_RARO}`,
      undefined,
      admin.token,
    );
    expect(r.datos.restaurante?.nombre ?? r.datos.nombre).toBe('Prueba en vivo');
  });
});

// ───────────────────────── Presupuesto: nada de recorridos ni escrituras ─────────────────────────

const GRANDES = new Set([
  'pedidos',
  'usuarios',
  'restaurantes',
  'operaciones',
  'viajes',
  'tickets',
  'vehiculos',
  'repartidores',
  'repartidor_datos',
  'cotizaciones_viaje',
  'sesiones',
]);

/** Los nombres de tabla de una consulta con sus apodos («pedidos p» → p = pedidos). */
function apodos(sql: string): Map<string, string> {
  const m = new Map<string, string>();
  const reservadas = new Set(['on', 'where', 'left', 'join', 'order', 'limit', 'group', 'inner']);
  // eslint-disable-next-line security/detect-unsafe-regex -- solo pruebas, sobre consultas propias
  for (const x of sql.matchAll(/\b(?:from|join)\s+([a-z_]+)(?:\s+(?:as\s+)?([a-z_]+))?/gi)) {
    const tabla = (x[1] ?? '').toLowerCase();
    m.set(tabla, tabla);
    const apodo = (x[2] ?? '').toLowerCase();
    if (apodo && !reservadas.has(apodo)) m.set(apodo, tabla);
  }
  return m;
}

/** Envuelve la base: anota cada consulta (con sus valores) que corre mientras `anotando` es true. */
function grabadora(db: D1Database) {
  const consultas: { sql: string; valores: unknown[] }[] = [];
  let anotando = false;
  const envuelta = new Proxy(db, {
    get(objetivo, clave) {
      if (clave === 'prepare')
        return (sql: string) => {
          const real = objetivo.prepare(sql);
          const anotar = (valores: unknown[]) => {
            if (anotando) consultas.push({ sql, valores });
          };
          const con = (s: D1PreparedStatement, valores: unknown[]): D1PreparedStatement =>
            new Proxy(s, {
              get(o, k) {
                if (k === 'bind') return (...v: unknown[]) => con(o.bind(...v), v);
                if (k === 'first' || k === 'all' || k === 'run' || k === 'raw')
                  return (...a: unknown[]) => {
                    anotar(valores);
                    return (o[k] as (...x: unknown[]) => unknown)(...a);
                  };
                const x = Reflect.get(o, k) as unknown;
                return typeof x === 'function' ? x.bind(o) : x;
              },
            });
          return con(real, []);
        };
      const x = Reflect.get(objetivo, clave) as unknown;
      return typeof x === 'function' ? x.bind(objetivo) : x;
    },
  });
  return {
    db: envuelta,
    consultas,
    anotar: (si: boolean) => {
      anotando = si;
    },
  };
}

describe('C-BUSCADOR-SERIO · presupuesto (la nube no se come el dinero)', () => {
  it('con el volumen del sitio de pruebas, ninguna consulta del buscador recorre una tabla grande, y buscar no escribe', async () => {
    let g!: ReturnType<typeof grabadora>;
    const m = mundo({}, { envolver: (db) => (g = grabadora(db)).db });
    await sembrarVolumen(m.DB);
    const admin = await m.cuenta('admin');
    await sembrar(m.DB);
    // Calentar: la primera petición arma el esquema (índices incluidos).
    await m.llamar('GET', '/datos/admin/buscar?q=x', undefined, admin.token);
    const cambios = async () =>
      Number((await m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
    const antes = await cambios();
    g.anotar(true);
    const entradas = [
      '407F',
      '#407f2f',
      P_NOVI,
      RESTAURANTE_RARO,
      'a',
      'persona 12',
      'ÁNG',
      'restaurante 4',
      '4821',
      '(305) 555',
      '+13055550012',
      'ana.ruiz@ejemplo.com',
      'vol1',
      'US-MIA-0001',
      'AB-123',
      'XYZ9',
      '$12.34',
      'c0ffee',
    ];
    for (const q of entradas)
      expect(
        (
          await m.llamar(
            'GET',
            `/datos/admin/buscar?q=${encodeURIComponent(q)}`,
            undefined,
            admin.token,
          )
        ).estado,
        q,
      ).toBe(200);
    for (const consulta of [
      'estado=vivos',
      'estado=cerrados',
      'estado=todos&orden=antiguos',
      'estado=cerrados&zona=US-FL-MIAMI',
      'estado=vivos&zona=US-FL-MIAMI',
      'estado=todos&q=407f',
      'estado=cerrados&q=persona%201',
      'estado=todos&q=4821',
      'estado=todos&q=%2412.34',
    ])
      expect(
        (await m.llamar('GET', `/datos/admin/pedidos?${consulta}`, undefined, admin.token)).estado,
        consulta,
      ).toBe(200);
    expect(
      (
        await m.llamar(
          'GET',
          '/datos/admin/viajes?estado=vivos&zona=US-FL-MIAMI',
          undefined,
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/viajes?q=c0ffee', undefined, admin.token)).estado,
    ).toBe(200);
    // C-MONITOREO-SERVICIOS y C-FICHA-OPERACION: pestañas, contadores y las dos fichas, igual de
    // cuidadas (ninguna escribe, ninguna recorre una tabla grande).
    for (const ruta of [
      '/datos/admin/pedidos?estado=vivos&servicio=comida',
      '/datos/admin/pedidos?estado=cerrados&servicio=tiendas',
      '/datos/admin/pedidos?estado=todos&servicio=moto',
      '/datos/admin/pedidos?estado=vivos&servicio=auto&zona=US-FL-MIAMI',
      '/datos/admin/pedidos?estado=cerrados&servicio=envios&orden=antiguos',
      '/datos/admin/pedidos/contadores',
      '/datos/admin/pedidos/contadores?zona=US-FL-MIAMI',
      `/datos/admin/pedidos/${P_VIVO}`,
      `/datos/admin/viajes/${VIAJE}`,
    ])
      expect((await m.llamar('GET', ruta, undefined, admin.token)).estado, ruta).toBe(200);
    g.anotar(false);
    // Mirar no escribe: ni el buscador, ni la lista, ni la sesión, ni el registro del equipo.
    expect(await cambios()).toBe(antes);
    const malas: string[] = [];
    for (const { sql, valores } of g.consultas) {
      if (!/^\s*(SELECT|WITH)/i.test(sql)) {
        malas.push(`ESCRIBE: ${sql}`);
        continue;
      }
      const plan = await m.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .bind(...valores)
        .all<{ detail: string }>();
      const nombres = apodos(sql);
      for (const { detail } of plan.results) {
        const recorre = /^SCAN (\w+)/.exec(detail);
        const tabla = recorre ? nombres.get((recorre[1] ?? '').toLowerCase()) : undefined;
        if (detail.includes('AUTOMATIC')) malas.push(`${detail}: ${sql}`);
        // Un índice usado solo por el rol recorre TODAS las cuentas de ese rol (miles de clientes).
        else if (/USING (COVERING )?INDEX \w+ \(rol=\?\)$/.test(detail))
          malas.push(`${detail} (solo por el rol): ${sql.replace(/\s+/g, ' ').slice(0, 300)}`);
        // «telefono_canonico IS NULL» por su índice = todas las cuentas viejas.
        else if (/\(telefono_canonico=\?\)/.test(detail) && /telefono_canonico IS NULL/.test(sql))
          malas.push(`${detail} (todas las cuentas viejas): ${sql.slice(0, 200)}`);
        // «SCAN … USING INDEX» con LIMIT recorre el índice en orden y para al juntar la página
        // (solo la lista sin texto lo hace); un SCAN sin índice es la tabla entera.
        else if (tabla && GRANDES.has(tabla) && !/USING (COVERING )?INDEX/.test(detail))
          malas.push(`${detail}: ${sql.replace(/\s+/g, ' ').slice(0, 300)}`);
        else if (tabla && GRANDES.has(tabla) && /USING/.test(detail) && !/\bLIMIT\b/i.test(sql))
          malas.push(`${detail} (sin LIMIT): ${sql.replace(/\s+/g, ' ').slice(0, 300)}`);
      }
    }
    expect(malas, malas.join('\n')).toEqual([]);
    expect(g.consultas.length).toBeGreaterThan(50);
  });

  it('los índices nuevos están en la base y las consultas los usan', async () => {
    const m = mundo();
    await m.cuenta('admin');
    await sembrar(m.DB);
    const { results } = await m.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('usuarios_rol_nombre_plano', 'restaurantes_nombre_plano', 'usuarios_telefono_final', 'vehiculos_placa', 'repartidor_datos_placa', 'tickets_correo')",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual([
      'repartidor_datos_placa',
      'restaurantes_nombre_plano',
      'tickets_correo',
      'usuarios_rol_nombre_plano',
      'usuarios_telefono_final',
      'vehiculos_placa',
    ]);
  });
});

describe('C-BUSCADOR-SERIO · lecturas estimadas por búsqueda', () => {
  /**
   * Con el medidor de pruebas/lecturas.ts (estima con el plan de cada consulta; un rango de los
   * dos lados lo cuenta como 1/16 de la tabla aunque traiga 3 filas, así que los códigos salen
   * «caros» en la estimación y baratos de verdad). Sin los índices nuevos, un nombre o un
   * teléfono leía todas las cuentas del rol (4.000) y una placa, todos los vehículos.
   */
  it('cada búsqueda lee pocas filas con el volumen del sitio de pruebas', async () => {
    let medidor!: ReturnType<typeof medidorDeLecturas>;
    const m = mundo({}, { envolver: (db) => (medidor = medidorDeLecturas(db)).db });
    await sembrarVolumen(m.DB);
    const admin = await m.cuenta('admin');
    await sembrar(m.DB);
    await m.llamar('GET', '/datos/admin/buscar?q=x', undefined, admin.token);
    const topes: [string, number][] = [
      ['/datos/admin/buscar?q=407F', 500],
      ['/datos/admin/buscar?q=c0ffee', 500],
      ['/datos/admin/buscar?q=4821', 500],
      ['/datos/admin/buscar?q=a', 100],
      ['/datos/admin/buscar?q=persona%2012', 100],
      ['/datos/admin/buscar?q=restaurante%204', 100],
      ['/datos/admin/buscar?q=(305)%20555', 150],
      ['/datos/admin/buscar?q=vol1%40', 100],
      ['/datos/admin/buscar?q=US-MIA-0001', 100],
      ['/datos/admin/buscar?q=AB-123', 100],
      ['/datos/admin/buscar?q=XYZ9', 100],
      ['/datos/admin/buscar?q=%2412.34', 100],
      [`/datos/admin/buscar?q=${P_NOVI}`, 100],
      ['/datos/admin/pedidos?estado=cerrados&zona=US-FL-MIAMI', 500],
      ['/datos/admin/pedidos?estado=vivos&zona=US-FL-MIAMI', 1_200],
      ['/datos/admin/pedidos?estado=todos&q=persona%201', 400],
      ['/datos/admin/pedidos?estado=todos&q=407f', 500],
      // C-MONITOREO-SERVICIOS: pestañas, viajes y contadores, con el mismo cuidado.
      ['/datos/admin/pedidos?estado=cerrados&servicio=tiendas', 1_500],
      ['/datos/admin/pedidos?estado=vivos&servicio=moto', 200],
      ['/datos/admin/pedidos?estado=cerrados&servicio=auto&zona=US-FL-MIAMI', 1_500],
      ['/datos/admin/pedidos/contadores?zona=US-FL-MIAMI', 600],
      ['/datos/admin/pedidos/contadores', 600],
    ];
    const informe: string[] = [];
    for (const [ruta, tope] of topes) {
      const r = await medidor.medir(() => m.llamar('GET', ruta, undefined, admin.token));
      expect(r.resultado.estado, ruta).toBe(200);
      if (r.total > tope)
        informe.push(
          `${ruta} leyó ${r.total} (tope ${tope}):\n${r.lecturas
            .filter((l) => l.filas > 20)
            .map(
              (l) =>
                `  ${l.filas} (${l.escaneos.join(', ')}): ${l.sql.replace(/\s+/g, ' ').slice(0, 220)}`,
            )
            .join('\n')}`,
        );
    }
    expect(informe, informe.join('\n')).toEqual([]);
  });
});
