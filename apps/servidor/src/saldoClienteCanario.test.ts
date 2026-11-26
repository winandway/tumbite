import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { medidorDeLecturas } from './pruebas/lecturas';
import { saludSaldoClientes } from './saldoCliente';

/**
 * C-SALDO-CLIENTE (canario, revisión del 25 nov 2026): `saludSaldoClientes` corre en cada `/datos/salud`
 * y no puede recorrer las tablas del saldo enteras. Con 50.000 movimientos de saldo, 50.000 usos y
 * 50.000 movimientos de ganancias de hace semanas, lee por índices y poco.
 */
const N = 50_000;
const serie = `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${N})`;
/** Las tablas que no se pueden recorrer enteras. */
const GRANDES = /saldo_cliente_movimientos|usos_saldo_divoox|movimientos|libro/;

async function conVolumen() {
  let medidor: ReturnType<typeof medidorDeLecturas> | null = null;
  const m = mundo({}, { envolver: (db) => (medidor = medidorDeLecturas(db)).db });
  // Una petición para que el esquema (tablas, índices y disparadores) quede puesto.
  await m.llamar('GET', '/datos/salud');
  await m.DB.batch([
    m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 4999)
       INSERT INTO usuarios (id, correo, nombre, rol, clave_hash)
       SELECT 'vol-c-' || i, 'volc' || i || '@ejemplo.com', 'Cliente ' || i, 'cliente', 'x' FROM n`,
    ),
    m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 799)
       INSERT INTO usuarios (id, correo, nombre, rol, clave_hash)
       SELECT 'vol-k-' || i, 'volk' || i || '@ejemplo.com', 'Conductor ' || i, 'repartidor', 'x' FROM n`,
    ),
    m.DB.prepare(
      `${serie} INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, moneda, concepto, referencia, creado_en)
       SELECT 'vol-m-' || i, 'vol-c-' || (i % 5000), 100, 'USD',
              CASE i % 5 WHEN 0 THEN 'recarga' WHEN 1 THEN 'regalo' WHEN 2 THEN 'devolucion' ELSE 'ajuste' END,
              'vol-m-' || i, datetime('now', '-' || (20 + i % 200) || ' days') FROM n`,
    ),
    m.DB.prepare(
      `${serie} INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, conductor_id, monto, apartado, pais, estado, creado_en, cerrado_en)
       SELECT 'vol-o-' || i, 'vol-c-' || (i % 5000), 'vol-k-' || (i % 800), 100, 100, 'VE',
              CASE i % 4 WHEN 0 THEN 'liberado' ELSE 'cobrado' END,
              datetime('now', '-' || (20 + i % 200) || ' days'), datetime('now', '-' || (20 + i % 200) || ' days') FROM n`,
    ),
    m.DB.prepare(
      `${serie} INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia, creado_en)
       SELECT 'vol-g-' || i, 'vol-k-' || (i % 800), 100, 'regalo', 'saldo-divoox:vol-o-' || i,
              datetime('now', '-' || (20 + i % 200) || ' days') FROM n`,
    ),
  ]);
  return { m, medidor: () => medidor! };
}

describe('C-SALDO-CLIENTE: el canario del saldo lee poco aunque haya mucho', () => {
  it('con 50.000 movimientos no recorre ninguna tabla del saldo entera', async () => {
    const { m, medidor } = await conVolumen();
    const r = await medidor().medir(() => saludSaldoClientes(medidor().db));
    expect(r.resultado).toBe('ok');
    // Un recorrido entero sale como «tabla (n)»; una búsqueda por índice, «tabla por índice (n)».
    const escaneos = r.lecturas
      .flatMap((l) => l.escaneos)
      .filter((t) => GRANDES.test(t) && !/ por /.test(t));
    expect(escaneos, r.lecturas.map((l) => `${l.filas} ${l.escaneos} ${l.sql}`).join('\n')).toEqual(
      [],
    );
    // El medidor cuenta cada rango por índice como un cuarto del índice (pesimista: de verdad lee las
    // filas de la ventana, aquí ninguna). Antes del arreglo estimaba ~125.000 (un recorrido entero de
    // los 50.000 movimientos más los usos, 125.006); medido después: 50.006. El tope es la mitad de
    // lo de antes, y ninguna tabla entera (arriba).
    expect(r.total, r.lecturas.map((l) => `${l.filas} ${l.sql}`).join('\n')).toBeLessThan(62_500);
    // Y sigue viendo un descuadre reciente: un prepago de hoy sin su entrada en el libro.
    await m.DB.prepare(
      "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('hoy-1', 'vol-c-1', 100, 'recarga', 'hoy-1')",
    ).run();
    expect(await saludSaldoClientes(m.DB)).toBe('error');
  });

  it('los planes usan los índices del canario (EXPLAIN QUERY PLAN)', async () => {
    const { m } = await conVolumen();
    const plan = async (sql: string) =>
      (await m.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).all<{ detail: string }>()).results
        .map((x) => x.detail)
        .join(' | ');
    expect(
      await plan(
        "SELECT COUNT(*) FROM saldo_cliente_movimientos m WHERE m.concepto = 'recarga' AND m.creado_en > datetime('now', '-7 days')",
      ),
    ).toMatch(/saldo_cliente_movimientos_concepto/);
    expect(
      await plan(
        "SELECT DISTINCT cliente_id, moneda FROM saldo_cliente_movimientos INDEXED BY saldo_cliente_movimientos_fecha WHERE creado_en > datetime('now', '-1 day')",
      ),
    ).toMatch(/saldo_cliente_movimientos_fecha/);
    expect(
      await plan(
        "SELECT COUNT(*) FROM usos_saldo_divoox u WHERE u.estado = 'cobrado' AND u.cerrado_en > datetime('now', '-7 days')",
      ),
    ).toMatch(/usos_saldo_divoox_cerrado/);
    expect(await plan("SELECT 1 FROM movimientos WHERE referencia = 'saldo-divoox:x'")).toMatch(
      /movimientos_referencia/,
    );
  });
});
