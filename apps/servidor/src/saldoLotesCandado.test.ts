import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import {
  ESQUEMA_SALDO_CLIENTE,
  movimientosViejos,
  rehacerSaldoClienteMovimientos,
} from './esquemaSaldoCliente';

/**
 * C-SALDO-LOTES (26 nov 2026) — todos los países. Dos candados de la base del Saldo Divoox:
 * 1. Solo las piezas del saldo escriben en el libro, los lotes y sus consumos (si otra pieza lo hiciera,
 *    el libro y los lotes dejarían de decir lo mismo).
 * 2. Una base de antes (el libro sin «vencimiento» entre sus conceptos) se rehace sin perder una fila,
 *    con sus disparadores de vuelta.
 */
const RAIZ = __dirname;
const PERMITIDOS = new Set([
  'saldoCliente.ts',
  'saldoLotes.ts',
  'saldoRegalos.ts',
  'esquemaSaldoCliente.ts',
  // La guarda del borrado (un movimiento de 0 que frena el lote si el saldo cambió).
  'borrarCuenta.ts',
]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : archivos(p);
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

describe('C-SALDO-LOTES: los candados de la base', () => {
  it('solo las piezas del saldo escriben en el libro, los lotes y los consumos', () => {
    const tablas = ['saldo_cliente_movimientos', 'saldo_cliente_lotes', 'saldo_cliente_consumos'];
    const escribe = (texto: string) =>
      tablas.some((t) =>
        [`INTO ${t}`, `UPDATE ${t}`, `DELETE FROM ${t}`].some((x) => texto.includes(x)),
      );
    const malos = archivos(RAIZ)
      .filter((p) => escribe(readFileSync(p, 'utf8')))
      .map((p) => p.slice(RAIZ.length + 1))
      .filter((p) => !PERMITIDOS.has(p));
    expect(malos).toEqual([]);
  });

  it('una base de antes rehace el libro con «vencimiento» sin perder filas, y los disparadores vuelven', async () => {
    const m = mundo();
    await m.llamar('GET', '/datos/salud');
    const db = m.DB;
    const viejo = `CREATE TABLE saldo_cliente_movimientos (
      id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, monto INTEGER NOT NULL CHECK (monto <> 0),
      moneda TEXT NOT NULL DEFAULT 'USD',
      concepto TEXT NOT NULL CHECK (concepto IN ('regalo', 'recarga', 'uso_viaje', 'devolucion', 'ajuste', 'cierre_cuenta')),
      referencia TEXT NOT NULL UNIQUE, operacion_id TEXT, autor_id TEXT, motivo TEXT NOT NULL DEFAULT '',
      comprobante TEXT NOT NULL DEFAULT '', creado_en TEXT NOT NULL DEFAULT (datetime('now')))`;
    await db.batch([
      db.prepare('DROP TABLE saldo_cliente_movimientos'),
      db.prepare(viejo),
      db.prepare(
        "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('a', 'c1', 500, 'recarga', 'a'), ('b', 'c1', -200, 'uso_viaje', 'b')",
      ),
    ]);
    const sql = async () =>
      (
        await db
          .prepare("SELECT sql FROM sqlite_master WHERE name = 'saldo_cliente_movimientos'")
          .first<{ sql: string }>()
      )?.sql ?? null;
    expect(movimientosViejos(await sql())).toBe(true);
    // Con la tabla vieja, un vencimiento no entra.
    await expect(
      db
        .prepare(
          "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('v', 'c1', -1, 'vencimiento', 'v')",
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    expect(await rehacerSaldoClienteMovimientos(db)).toBe(true);
    expect(await rehacerSaldoClienteMovimientos(db)).toBe(false);
    expect(movimientosViejos(await sql())).toBe(false);
    const filas = await db
      .prepare('SELECT id, monto FROM saldo_cliente_movimientos ORDER BY id')
      .all<{ id: string; monto: number }>();
    expect(filas.results).toEqual([
      { id: 'a', monto: 500 },
      { id: 'b', monto: -200 },
    ]);
    // Los disparadores vuelven (los pone el arranque justo después): inmutable y nunca negativo.
    await db.batch(ESQUEMA_SALDO_CLIENTE.map((s) => db.prepare(s)));
    await db
      .prepare(
        "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('v', 'c1', -100, 'vencimiento', 'v')",
      )
      .run();
    await expect(
      db.prepare("UPDATE saldo_cliente_movimientos SET monto = 1 WHERE id = 'a'").run(),
    ).rejects.toThrow(/no se cambia/);
    await expect(
      db
        .prepare(
          "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('w', 'c1', -999, 'ajuste', 'w')",
        )
        .run(),
    ).rejects.toThrow(/saldo_insuficiente/);
  });
});
