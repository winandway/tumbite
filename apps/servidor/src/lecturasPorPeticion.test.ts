import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './app';
import { conciliarPedidos } from './conciliacion';
import { CLAVE_HUELLA_ESQUEMA, reiniciarEsquema } from './esquema';
import { contarFilas } from './presupuestoFilas';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { crearBasePruebas } from './pruebas/d1';
import { type Lectura, medidorDeLecturas, sembrarVolumen } from './pruebas/lecturas';
import { LECTURAS_PESADAS, cuentaVuelta } from './vueltaPruebas';

/**
 * C-LECTURAS-POR-PETICION (13 nov 2026, regla global «la nube no se come el dinero»). Todos los
 * países. Una vuelta de la máquina de pruebas de dinero leía unas 590.000 filas del sitio de
 * pruebas. Las culpables, medidas por ruta: la revisión de la base en cada arranque de un servidor
 * (unas 3.200 filas que pagaba la primera petición), el registro (recorría todas las cuentas), el
 * panel del restaurante (todos los restaurantes), las ofertas del repartidor (todas las ofertas de
 * la historia en cada consulta) y la conciliación (que el simulador llamaba una vez por pedido).
 *
 * Esta prueba arma una base con el volumen del sitio de pruebas y pone un tope de filas leídas por
 * petición (estimadas con el plan de cada consulta: pruebas/lecturas.ts). Si una consulta vuelve a
 * recorrer una tabla grande, se pone en rojo y dice cuál.
 */
afterEach(() => vi.unstubAllGlobals());

const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(RAIZ, ...r), 'utf8');
/** El secreto del reloj de esta prueba: uno nuevo en cada corrida. */
const SEC = `reloj-${crypto.randomUUID()}`;

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'x', client_secret: 'y' }), { status: 200 }),
  );
  let medidor!: ReturnType<typeof medidorDeLecturas>;
  const m = mundo(
    { STRIPE_SECRET_KEY: 'sk_test_x', RELOJ_SECRETO: SEC },
    {
      host: 'staging.tumbite.com',
      envolver: (db) => (medidor = medidorDeLecturas(db)).db,
    },
  );
  await sembrarVolumen(m.DB);
  return { m, medidor };
}

/** El mensaje de rojo dice qué consulta leyó de más. */
const culpables = (l: Lectura[]) =>
  l
    .filter((x) => x.filas > 20)
    .map((x) => `${x.filas} filas (${x.escaneos.join(', ')}): ${x.sql}`)
    .join('\n');

describe('C-LECTURAS-POR-PETICION · ninguna ruta recorre una tabla grande', () => {
  it('un servidor que arranca otra vez con el mismo código no vuelve a revisar la base entera', async () => {
    const { m, medidor } = await escenario();
    const primera = await medidor.medir(() => m.llamar('GET', '/datos/version'));
    // La primera vez revisa todo (decenas de consultas) y deja su huella.
    expect(primera.lecturas.length).toBeGreaterThan(50);
    const huella = await m.DB.prepare('SELECT valor FROM config WHERE clave = ?')
      .bind(CLAVE_HUELLA_ESQUEMA)
      .first<{ valor: string }>();
    expect(huella?.valor).toMatch(/:pruebas$/);
    // Otro servidor (otro aislado) con el mismo código: lee una fila y sigue.
    reiniciarEsquema();
    const otra = await medidor.medir(() => m.llamar('GET', '/datos/version'));
    expect(otra.lecturas.map((l) => l.sql)).toEqual(['SELECT valor FROM config WHERE clave = ?']);
    // Código nuevo (otra huella): la revisión completa vuelve a correr una vez.
    await m.DB.prepare('UPDATE config SET valor = ? WHERE clave = ?')
      .bind('de-otro-codigo', CLAVE_HUELLA_ESQUEMA)
      .run();
    reiniciarEsquema();
    const nueva = await medidor.medir(() => m.llamar('GET', '/datos/version'));
    expect(nueva.lecturas.length).toBeGreaterThan(50);
  });

  it('una base sin todas sus columnas no deja huella: el arranque siguiente vuelve a mirar', async () => {
    const DB = crearBasePruebas();
    await DB.prepare('DROP TABLE avisos_pedido').run();
    await DB.prepare(
      'CREATE TABLE avisos_pedido (pedido_id TEXT NOT NULL, aviso TEXT NOT NULL)',
    ).run();
    reiniciarEsquema();
    const salud = await app.request('/datos/salud', {}, { DB });
    expect(((await salud.json()) as { piezas: { esquema: string } }).piezas.esquema).toBe('error');
    const huella = await DB.prepare('SELECT valor FROM config WHERE clave = ?')
      .bind(CLAVE_HUELLA_ESQUEMA)
      .first();
    expect(huella).toBeNull();
    reiniciarEsquema();
  });

  it('registro, menú, ubicación, ofertas, panel y la limpieza del recorrido leen pocas filas con volumen', async () => {
    const { m, medidor } = await escenario();
    await m.llamar('GET', '/datos/version'); // la migración, fuera de la cuenta
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin', 'Soporte Lecturas');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const rep = await m.cuenta('repartidor', 'Repartidor Lecturas');
    await m.DB.prepare(
      "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, 25.77, -80.19, datetime('now'), 'US-FL-MIAMI')",
    )
      .bind(rep.id)
      .run();
    // La limpieza del recorrido, tal como la manda la prueba (se lee de su archivo).
    const limpieza = /"(UPDATE pedidos SET estado = 'cancelado'[^"]+@recorrido\.test[^"]+)"/.exec(
      leer('e2e', 'recorrido', 'recorrido.spec.ts'),
    )?.[1];
    expect(limpieza, 'la limpieza del recorrido.spec.ts').toBeTruthy();

    const casos: [string, number, () => Promise<{ estado: number }>][] = [
      [
        'registro (correo y teléfono únicos)',
        50,
        () =>
          m.llamar('POST', '/datos/cuentas/registro', {
            nombre: 'Cliente Nuevo',
            correo: 'nuevo.lecturas@ejemplo.com',
            telefono: '+17865550199',
            clave: 'clave-segura-1',
            rol: 'cliente',
          }),
      ],
      [
        'crear un plato (el restaurante de la persona)',
        50,
        () =>
          m.llamar(
            'POST',
            '/datos/mi-restaurante/platos',
            { nombreEs: 'Cubano', precioCentavos: 1500 },
            dueno.token,
          ),
      ],
      [
        'la ubicación del repartidor',
        200,
        () => m.ubicar(rep.token, { lat: 25.771, lng: -80.191 }),
      ],
      [
        'las ofertas del repartidor',
        200,
        () => m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token),
      ],
      [
        'la limpieza del recorrido',
        200,
        () =>
          m.llamar('POST', '/datos/interno/diagnostico/sql', { sql: limpieza }, undefined, {
            'x-reloj-secreto': SEC,
          }),
      ],
    ];
    for (const [nombre, tope, fn] of casos) {
      const r = await medidor.medir(fn);
      expect(r.resultado.estado, nombre).toBeLessThan(300);
      expect(
        r.total,
        `${nombre} leyó ${r.total} filas (tope ${tope}):\n${culpables(r.lecturas)}`,
      ).toBeLessThanOrEqual(tope);
    }
    // Lo mismo de antes: el teléfono escrito a mano de una cuenta vieja (sin teléfono único) sigue
    // sin abrir otra cuenta del mismo tipo, y lo encuentra por su índice.
    const vieja = await medidor.medir(() =>
      m.llamar('POST', '/datos/cuentas/registro', {
        nombre: 'Otra Cuenta',
        correo: 'otra.lecturas@ejemplo.com',
        telefono: '+1 (305) 555-0199',
        clave: 'clave-segura-1',
        rol: 'cliente',
      }),
    );
    expect(vieja.resultado.estado).toBe(409);
    expect(vieja.total).toBeLessThanOrEqual(50);
  });
});

describe('C-LECTURAS-POR-PETICION · la conciliación de diagnóstico va una vez al final', () => {
  it('el simulador junta los pedidos y concilia al final, no en cada escenario', () => {
    const dinero = leer('simulador', 'divoox', 'dinero.ts');
    const cuerpo = dinero.slice(
      dinero.indexOf('export async function comprobarDinero'),
      dinero.indexOf('export const pedidosDelLibro'),
    );
    expect(cuerpo).not.toMatch(/libroCuadra\(/);
    expect(cuerpo).toMatch(/pedidosDelLibro\.add\(id\)/);
    const correr = leer('simulador', 'divoox', 'correr.ts');
    expect(correr).toMatch(/escenarios\.push\(libroFinal\)/);
    expect(correr).toMatch(/libroCuadra\(ctx, \[\.\.\.pedidosDelLibro\]\)/);
  });
});

describe('C-LECTURAS-CONCILIACION · la conciliación de diagnóstico no suma el día entero', () => {
  const llamar = (m: Awaited<ReturnType<typeof escenario>>['m'], cuerpo: unknown) =>
    m.llamar('POST', '/datos/interno/diagnostico/conciliacion', cuerpo, undefined, {
      'x-reloj-secreto': SEC,
    });

  it('con volumen: con los pedidos de la corrida lee unas pocas filas; sin ellos, los de hoy por índice', async () => {
    const { m, medidor } = await escenario();
    await m.llamar('GET', '/datos/version');
    // Antes (medido el 13 nov con esta misma base): 20.610 filas con pedidos y 26.609 sin ellos.
    const con = await medidor.medir(() => llamar(m, { pedidos: ['vol-p-30', 'vol-p-60'] }));
    expect(con.resultado.estado).toBe(200);
    expect(
      con.total,
      `con pedidos leyó ${con.total}:\n${culpables(con.lecturas)}`,
    ).toBeLessThanOrEqual(50);
    const sin = await medidor.medir(() => llamar(m, {}));
    expect(sin.resultado.estado).toBe(200);
    expect(
      sin.total,
      `sin pedidos leyó ${sin.total}:\n${culpables(sin.lecturas)}`,
    ).toBeLessThanOrEqual(800);
    // Ya no escribe ni borra la fila del día (la del día entero la hace el reloj).
    expect(sin.lecturas.some((l) => /conciliaciones/.test(l.sql))).toBe(false);
  });

  it('pedido por pedido aplica las tres reglas del día: restaurante, repartidor y Stripe', async () => {
    const db = crearBasePruebas();
    const ins = (sql: string, ...v: unknown[]) =>
      db
        .prepare(sql)
        .bind(...v)
        .run();
    await ins(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('c1','c1@ejemplo.com','C','cliente','x'), ('d1','d1@ejemplo.com','D','restaurante','x'), ('r1','r1@ejemplo.com','R','repartidor','x')",
    );
    await ins("INSERT INTO restaurantes (id, dueno_id, nombre) VALUES ('rest1', 'd1', 'Local')");
    const pedido = (id: string, estado: string) =>
      ins(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio,
           cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng)
         VALUES (?, 'c1', 'rest1', 'r1', ?, '[]', 2000, 300, 200, 0, 300, 2800, 400, 1600, 900, 0, 200, 'basico', 'Calle 1', 25.7, -80.2)`,
        id,
        estado,
      );
    const mov = (pid: string, usuario: string, concepto: string, monto: number) =>
      ins(
        'INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, ?)',
        `m-${pid}-${concepto}`,
        usuario,
        pid,
        monto,
        concepto,
      );
    await pedido('bien', 'entregado');
    await ins(
      "INSERT INTO cobros (pedido_id, capturado_en, capturado) VALUES ('bien', datetime('now'), 2800)",
    );
    await mov('bien', 'd1', 'venta', 1600);
    await mov('bien', 'r1', 'entrega', 600);
    await mov('bien', 'r1', 'propina', 300);
    expect((await conciliarPedidos(db, ['bien'])).cuadra).toBe(true);
    // Al restaurante se le abonó de menos.
    await pedido('corto', 'entregado');
    await mov('corto', 'd1', 'venta', 1500);
    await mov('corto', 'r1', 'entrega', 900);
    const corto = await conciliarPedidos(db, ['bien', 'corto']);
    expect(corto.cuadra).toBe(false);
    expect(String(corto.detalle.diferencias)).toMatch(/corto: restaurante 1600/);
    // Un pedido cancelado con un abono al repartidor (en el día tampoco cuadraría).
    await pedido('cancelado', 'cancelado');
    await mov('cancelado', 'r1', 'entrega', 900);
    expect((await conciliarPedidos(db, ['cancelado'])).cuadra).toBe(false);
    // Capturado distinto del total.
    await pedido('captura', 'entregado');
    await ins(
      "INSERT INTO cobros (pedido_id, capturado_en, capturado) VALUES ('captura', datetime('now'), 2000)",
    );
    await mov('captura', 'd1', 'venta', 1600);
    await mov('captura', 'r1', 'entrega', 900);
    expect((await conciliarPedidos(db, ['captura'])).detalle.diferencias).toMatch(
      /Stripe esperado 2800/,
    );
  });
});

describe('C-LECTURAS-CIUDAD · la pantalla en vivo de la ciudad de pruebas lee solo la sesión', () => {
  it('cada refresco busca los pedidos por zona, estado y fecha de la sesión, no toda la historia de los robots', async () => {
    const consultas: { sql: string; v: unknown[] }[] = [];
    const anotar = (db: D1Database): D1Database => {
      const env = (sql: string, st: D1PreparedStatement, v: unknown[] = []): D1PreparedStatement =>
        new Proxy(st, {
          get(t, p) {
            if (p === 'bind') return (...a: unknown[]) => env(sql, t.bind(...a), a);
            if (p === 'all' || p === 'first' || p === 'run') consultas.push({ sql, v });
            const x = Reflect.get(t, p, t) as unknown;
            return typeof x === 'function' ? (x as (...y: unknown[]) => unknown).bind(t) : x;
          },
        });
      return new Proxy(db, {
        get(t, p) {
          if (p === 'prepare') return (sql: string) => env(sql, t.prepare(sql));
          const x = Reflect.get(t, p, t) as unknown;
          return typeof x === 'function' ? (x as (...y: unknown[]) => unknown).bind(t) : x;
        },
      });
    };
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo({ RELOJ_SECRETO: SEC }, { host: 'staging.tumbite.com', envolver: anotar });
    await sembrarVolumen(m.DB);
    await m.llamar('GET', '/datos/version');
    const admin = await m.cuenta('admin', 'Soporte Ciudad');
    // Los restaurantes robot se reutilizan: 300 pedidos de sesiones anteriores.
    await m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300)
       INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno,
         propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, creado_en)
       SELECT 'viejo-' || i, 'vol-u-1', 'vol-r-' || (1 + i % 3), 'entregado', '[]', 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
         'basico', 'x', 0, 0, datetime('now', '-3 days') FROM n`,
    ).run();
    await m.DB.prepare(
      `INSERT INTO simulador_sesiones (id, destino, restaurantes, repartidores, inicio)
       VALUES ('s1', 'juego', '["vol-r-1","vol-r-2","vol-r-3"]', '["vol-u-4001"]', datetime('now', '-1 hours'))`,
    ).run();
    consultas.length = 0;
    const r = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    expect(r.estado).toBe(200);
    const dePedidos = consultas.filter((q) => /FROM pedidos p/.test(q.sql));
    expect(dePedidos.length).toBe(3); // la lista, los jugadores y los pedidos en curso
    for (const q of dePedidos) {
      const plan = await m.DB.prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .bind(...q.v)
        .all<{ detail: string }>();
      expect(
        plan.results.map((x) => x.detail).join(' | '),
        'los pedidos de la sesión van por zona, estado y el rango de la fecha',
      ).toMatch(
        /SEARCH p USING INDEX pedidos_zona_estado \(zona_id=\? AND estado=\? AND creado_en>\?\)/,
      );
    }
    // Lo que eso lee de verdad: los pedidos de la zona desde el inicio (aquí ninguno) frente a la
    // historia entera de los tres robots (330) que leía cada consulta antes, cada 4 a 5 segundos.
    const historia = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE restaurante_id IN ('vol-r-1','vol-r-2','vol-r-3')",
    ).first<{ n: number }>();
    const ventana = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE zona_id = 'US-FL-MIAMI' AND creado_en >= datetime('now', '-1 hours')",
    ).first<{ n: number }>();
    expect(Number(historia?.n)).toBe(330);
    expect(Number(ventana?.n)).toBeLessThan(10);
  });
});

/** Una base que informa filas leídas como D1 (la de pruebas no lo hace). */
function baseQueInforma(db: D1Database, porConsulta: number): D1Database {
  const envolver = (s: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(s, {
      get(t, p) {
        if (p === 'bind') return (...a: unknown[]) => envolver(t.bind(...a));
        if (p === 'all')
          return async () => {
            const r = await t.all();
            return { ...r, meta: { ...r.meta, rows_read: porConsulta } };
          };
        const v = Reflect.get(t, p, t) as unknown;
        return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
      },
    });
  return new Proxy(db, {
    get(t, p) {
      if (p === 'prepare') return (sql: string) => envolver(t.prepare(sql));
      const v = Reflect.get(t, p, t) as unknown;
      return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
    },
  });
}

describe('C-LECTURAS-POR-PETICION · el contador de la vuelta ve también lo que solo lee', () => {
  it('con conFirst, las lecturas con first cuentan; sin él (el reloj), no', async () => {
    const db = baseQueInforma(crearBasePruebas(), 700);
    const con = contarFilas(db, { conFirst: true });
    expect(await con.db.prepare("SELECT 'a' AS x").first('x')).toBe('a');
    expect(await con.db.prepare('SELECT 1 AS x WHERE 0').first()).toBeNull();
    await expect(con.db.prepare('SELECT 1 AS x').first('y')).rejects.toThrow(/COLUMN_NOTFOUND/);
    expect(con.cuenta.leidas).toBe(2100);
    const sin = contarFilas(db);
    await sin.db.prepare('SELECT 1').first();
    expect(sin.cuenta.leidas).toBe(0);
  });

  it('una petición que solo lee y lee mucho queda anotada con su ruta; una liviana, no', async () => {
    reiniciarEsquema();
    const cruda = crearBasePruebas();
    const pedir = (DB: D1Database, vuelta: string) =>
      app.request(
        'https://staging.tumbite.com/datos/salud',
        { headers: { 'x-vuelta-pruebas': vuelta } },
        { DB },
      );
    await pedir(cruda, 'continuas-sin-cuenta'); // la migración, aparte
    await pedir(baseQueInforma(cruda, 0), 'continuas-liviana-1');
    expect(await cuentaVuelta(cruda, 'continuas-liviana-1')).toMatchObject({
      vuelta: null,
      pesadas: [],
    });
    await pedir(baseQueInforma(cruda, LECTURAS_PESADAS), 'continuas-pesada-1');
    const c = await cuentaVuelta(cruda, 'continuas-pesada-1');
    expect(c.vuelta).toMatchObject({ escritas: 0, peticiones: 1 });
    expect(Number((c.vuelta as { leidas: number }).leidas)).toBeGreaterThanOrEqual(
      LECTURAS_PESADAS,
    );
    expect(c.pesadas).toEqual([expect.objectContaining({ ruta: 'GET /datos/salud', escritas: 0 })]);
  });
});
