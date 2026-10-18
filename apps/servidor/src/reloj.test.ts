import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { correrRelojUnaVez, TAREAS_RELOJ } from './rutas/operacion';
import { type TareaReloj, correrTareas, saludReloj } from './reloj';

/**
 * C-RELOJ-AISLADO (docs/EVALUACION-RELOJ-CLOUDFLARE.md): cada tarea del reloj corre aunque otra
 * falle, el resultado de cada una queda guardado, la salud lo vigila, y nada que mueva dinero se
 * hace dos veces aunque se crucen relojes o se repita una llamada.
 */
afterEach(() => vi.unstubAllGlobals());

type Mundo = ReturnType<typeof mundo>;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Una tarea de prueba que cuenta cuántas veces corrió (en memoria). */
function contadora(nombre: string, cuenta: Map<string, number>, ms = 0): TareaReloj {
  return {
    nombre,
    critica: false,
    correr: async () => {
      if (ms) await espera(ms);
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
      return cuenta.get(nombre);
    },
  };
}
const fallona = (nombre: string, critica = true): TareaReloj => ({
  nombre,
  critica,
  correr: async () => {
    throw new Error(`falla de prueba en ${nombre}`);
  },
});

async function vueltaReal(m: Mundo, ventana: string, tareas: readonly TareaReloj[]) {
  return correrRelojUnaVez(m.extra as never, m.DB, ventana, 'externo', { tareas, tarea: 'reloj' });
}

describe('reloj · cada tarea aislada', () => {
  it('una tarea que falla no frena a las demás y cada resultado queda guardado', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    const cuenta = new Map<string, number>();
    const r = await vueltaReal(m, '2026-10-16T10:00', [
      contadora('primera', cuenta),
      fallona('manager'),
      contadora('ultima', cuenta),
    ]);
    expect(cuenta.get('primera')).toBe(1);
    expect(cuenta.get('ultima')).toBe(1);
    expect('fallidas' in r && r.fallidas).toEqual(['manager']);
    const { results } = await m.DB.prepare(
      "SELECT tarea, ok, error FROM reloj_tareas WHERE clave = 'reloj:2026-10-16T10:00' ORDER BY tarea",
    ).all<{ tarea: string; ok: number; error: string }>();
    expect(results.map((x) => [x.tarea, x.ok])).toEqual([
      ['manager', 0],
      ['primera', 1],
      ['ultima', 1],
    ]);
    expect(results.find((x) => x.tarea === 'manager')?.error).toMatch(/falla de prueba/);
    const fila = await m.DB.prepare(
      "SELECT terminada_en, resultado FROM tareas_programadas WHERE clave = 'reloj:2026-10-16T10:00'",
    ).first<{ terminada_en: string | null; resultado: string }>();
    expect(fila?.terminada_en).not.toBeNull();
    expect(fila?.resultado).toMatch(/^origen:externo parcial /);
  });

  it('las tareas reales de producción tienen nombre y las de dinero son críticas', () => {
    const criticas = TAREAS_RELOJ.filter((t) => t.critica).map((t) => t.nombre);
    expect(criticas).toEqual(
      expect.arrayContaining(['ofertas', 'manager', 'conciliacion', 'retiros']),
    );
    expect(new Set(TAREAS_RELOJ.map((t) => t.nombre)).size).toBe(TAREAS_RELOJ.length);
  });

  it('correrTareas nunca lanza, aunque fallen todas', async () => {
    const m = mundo();
    const r = await correrTareas(m.extra as never, m.DB, [fallona('a'), fallona('b', false)]);
    expect(r.estado).toBe('parcial');
    expect(r.fallidas).toEqual(['a', 'b']);
  });
});

describe('reloj · concurrencia y reintentos', () => {
  it('GitHub y Cloudflare en el mismo minuto: corre una sola vez', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    const cuenta = new Map<string, number>();
    const tareas = [contadora('t', cuenta, 20)];
    const [a, b] = await Promise.all([
      correrRelojUnaVez(m.extra as never, m.DB, '2026-10-16T10:01', 'github', {
        tareas,
        tarea: 'reloj',
      }),
      correrRelojUnaVez(m.extra as never, m.DB, '2026-10-16T10:01', 'externo', {
        tareas,
        tarea: 'reloj',
      }),
    ]);
    expect([a, b].filter((x) => 'yaHecho' in x)).toHaveLength(1);
    expect(cuenta.get('t')).toBe(1);
  });

  it('reintento tras una respuesta perdida (misma ventana): no repite nada', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    const cuenta = new Map<string, number>();
    const tareas = [contadora('t', cuenta)];
    await vueltaReal(m, '2026-10-16T10:02', tareas);
    const otra = await vueltaReal(m, '2026-10-16T10:02', tareas);
    expect('yaHecho' in otra).toBe(true);
    expect(cuenta.get('t')).toBe(1);
  });

  it('una vuelta que tarda más de un minuto se cruza con la siguiente y el dinero se mueve UNA vez', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    await m.DB.exec(
      'CREATE TABLE zz_cobro (id INTEGER PRIMARY KEY, hecho INTEGER NOT NULL DEFAULT 0)',
    );
    await m.DB.exec('INSERT INTO zz_cobro (id) VALUES (1)');
    let movimientos = 0;
    // Como las tareas de dinero de verdad: una sentencia condicionada decide quién lo hace.
    const dinero = (ms: number): TareaReloj => ({
      nombre: 'dinero',
      critica: true,
      correr: async (_e, db) => {
        await espera(ms);
        const r = await db
          .prepare('UPDATE zz_cobro SET hecho = 1 WHERE id = 1 AND hecho = 0')
          .run();
        if (r.meta.changes) movimientos++;
      },
    });
    const [lenta, siguiente] = await Promise.all([
      vueltaReal(m, '2026-10-16T10:03', [dinero(60)]),
      vueltaReal(m, '2026-10-16T10:04', [dinero(0)]),
    ]);
    expect('yaHecho' in lenta || 'yaHecho' in siguiente).toBe(false); // las dos vueltas corrieron
    expect(movimientos).toBe(1);
  });

  it('dos vueltas cruzadas con el Manager real: un solo pedido cancelado y UNA anulación en Stripe', async () => {
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push(`${init?.method ?? 'GET'} ${url}`);
      return new Response(JSON.stringify({ id: 'pi_reloj', status: 'canceled' }), { status: 200 });
    });
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_reloj' });
    const cliente = await m.cuenta('cliente', 'Cliente Reloj');
    const dueno = await m.cuenta('restaurante', 'Dueño Reloj');
    await m.DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES ('r-reloj', ?, 'Restaurante Reloj', 'aprobado')",
    )
      .bind(dueno.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, stripe_pago, pagado_en)
       VALUES ('p-reloj', ?, 'r-reloj', 'pagado', '[]', 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 'basico', 'Dirección de prueba', 'pi_reloj', datetime('now', '-30 minutes'))`,
    )
      .bind(cliente.id)
      .run();
    await m.DB.prepare("INSERT INTO cobros (pedido_id) VALUES ('p-reloj')").run();
    const manager = TAREAS_RELOJ.filter((t) => t.nombre === 'manager');
    await Promise.all([
      vueltaReal(m, '2026-10-16T10:05', manager),
      vueltaReal(m, '2026-10-16T10:06', manager),
    ]);
    // Y un reintento más tarde, por si acaso.
    await vueltaReal(m, '2026-10-16T10:07', manager);
    const anulaciones = llamadas.filter((l) => l.includes('/payment_intents/pi_reloj/cancel'));
    expect(anulaciones).toHaveLength(1);
    expect(llamadas.some((l) => l.includes('/refunds'))).toBe(false);
    const p = await m.DB.prepare("SELECT estado FROM pedidos WHERE id = 'p-reloj'").first<{
      estado: string;
    }>();
    expect(p?.estado).toBe('cancelado');
    const h = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM historial_estados WHERE pedido_id = 'p-reloj' AND estado = 'cancelado'",
    ).first<{ n: number }>();
    expect(h?.n).toBe(1);
  });
});

describe('reloj · pieza de la salud', () => {
  const EXTERNO = { INTERNO_LLAVE_ID: 'int-1', INTERNO_SECRETO_ACTUAL: 'x'.repeat(40) };
  const hace = (min: number) =>
    new Date(Date.now() - min * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  async function vuelta(
    m: Mundo,
    clave: string,
    minutos: number,
    falla?: { tarea: string; critica: boolean },
  ) {
    await m.DB.prepare(
      "INSERT INTO tareas_programadas (clave, tarea, empezada_en, terminada_en, resultado) VALUES (?, 'reloj', ?, ?, 'origen:externo ok')",
    )
      .bind(clave, hace(minutos), hace(minutos))
      .run();
    await m.DB.prepare(
      'INSERT INTO reloj_tareas (clave, tarea, critica, ok, creado_en) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(clave, falla?.tarea ?? 'manager', falla?.critica ? 1 : 0, falla ? 0 : 1, hace(minutos))
      .run();
  }

  it('sin vueltas todavía: pendiente', async () => {
    const m = mundo();
    expect(await saludReloj(EXTERNO as never, m.DB)).toBe('pendiente');
  });

  it('con el reloj externo: ok con una vuelta buena reciente; error si pasan más de 5 minutos', async () => {
    const m = mundo();
    await vuelta(m, 'reloj:a', 1);
    expect(await saludReloj(EXTERNO as never, m.DB)).toBe('ok');
    const n = mundo();
    await vuelta(n, 'reloj:b', 7);
    expect(await saludReloj(EXTERNO as never, n.DB)).toBe('error');
  });

  it('error con 3 vueltas fallidas en 15 minutos, aunque la última haya salido bien', async () => {
    const m = mundo();
    for (const [k, min] of [
      ['f1', 10],
      ['f2', 9],
      ['f3', 8],
    ] as const)
      await vuelta(m, `reloj:${k}`, min, { tarea: 'fotos', critica: false });
    await vuelta(m, 'reloj:buena', 1);
    expect(await saludReloj(EXTERNO as never, m.DB)).toBe('error');
  });

  it('error si la última vuelta tuvo una tarea crítica fallida (fallo parcial)', async () => {
    const m = mundo();
    await vuelta(m, 'reloj:vieja', 2);
    await vuelta(m, 'reloj:ultima', 1, { tarea: 'manager', critica: true });
    expect(await saludReloj(EXTERNO as never, m.DB)).toBe('error');
  });

  it('se recupera sola: una vuelta buena después de un fallo crítico vuelve a ok', async () => {
    const m = mundo();
    await vuelta(m, 'reloj:mala', 2, { tarea: 'manager', critica: true });
    await vuelta(m, 'reloj:buena', 1);
    expect(await saludReloj(EXTERNO as never, m.DB)).toBe('ok');
  });

  it('solo con GitHub (impuntual): ok con horas de espera, «atrasado» pasadas 6 horas y ERROR pasado un día sin vuelta buena (F11)', async () => {
    const m = mundo();
    await vuelta(m, 'reloj:a', 180);
    expect(await saludReloj({} as never, m.DB)).toBe('ok');
    const n = mundo();
    await vuelta(n, 'reloj:b', 7 * 60);
    expect(await saludReloj({} as never, n.DB)).toBe('atrasado');
    const o = mundo();
    await vuelta(o, 'reloj:c', 25 * 60);
    expect(await saludReloj({} as never, o.DB)).toBe('error');
  });

  it('la salud completa muestra la pieza y un fallo crítico la pone en 503', async () => {
    const m = mundo(EXTERNO);
    await m.cuenta('cliente');
    await vuelta(m, 'reloj:mala', 1, { tarea: 'conciliacion', critica: true });
    const r = await m.llamar('GET', '/datos/salud');
    expect(r.datos.piezas.reloj).toBe('error');
    expect(r.estado).toBe(503);
  });
});

describe('reloj · integración con la Fase 3', () => {
  it('la tarea «operaciones» de la Fase 3 está en la lista y es crítica', () => {
    const op = TAREAS_RELOJ.find((t) => t.nombre === 'operaciones');
    expect(op?.critica).toBe(true);
    const nombres = TAREAS_RELOJ.map((t) => t.nombre);
    expect(nombres.indexOf('operaciones')).toBe(nombres.indexOf('ofertas') + 1);
  });

  it('si «operaciones» falla (por ejemplo, faltan sus tablas), las demás corren, queda registrado y la salud marca error', async () => {
    const m = mundo({ INTERNO_LLAVE_ID: 'int-1', INTERNO_SECRETO_ACTUAL: 'x'.repeat(40) });
    await m.cuenta('cliente');
    // Como pasó en el sitio de pruebas el 16 oct: la tabla de ofertas de viajes no está.
    await m.DB.exec('DROP TABLE ofertas_operacion');
    const cuenta = new Map<string, number>();
    const tareas = [
      ...TAREAS_RELOJ.filter((t) => t.nombre === 'operaciones'),
      contadora('despues', cuenta),
    ];
    const r = await vueltaReal(m, '2026-10-16T11:00', tareas);
    expect('fallidas' in r && r.fallidas).toEqual(['operaciones']);
    expect(cuenta.get('despues')).toBe(1);
    expect(await saludReloj(m.extra as never, m.DB)).toBe('error');
  });

  it('la vuelta del reloj ya no traga el error de ninguna tarea con un catch propio', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fuente = readFileSync(join(__dirname, 'rutas', 'operacion.ts'), 'utf8');
    const lista = fuente.slice(
      fuente.indexOf('export const TAREAS_RELOJ'),
      fuente.indexOf('export async function correrReloj'),
    );
    expect(lista).not.toMatch(/\.catch\(/);
    expect(fuente).not.toMatch(/repartirOperaciones\(env, db\)\.catch/);
  });
});
