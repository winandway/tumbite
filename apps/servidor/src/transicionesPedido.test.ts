import { describe, expect, it } from 'vitest';
import { app } from './app';
import { crearBasePruebas } from './pruebas/d1';
import { asegurarEsquema } from './esquema';
import { ESQUEMA_PEDIDOS } from './esquemaPedidos';

/**
 * C-TRANSICIONES-PEDIDO (16 oct 2026, Entrega 1 del plan v2): la base rechaza cualquier cambio de
 * estado de un pedido que no esté en la tabla transiciones_pedido. Ficha:
 * docs/investigaciones-rea/2026-10-16-transiciones-pedido.md.
 */
const ESTADOS = [
  'pago_pendiente',
  'pagado',
  'aceptado',
  'listo',
  'en_camino',
  'entregado',
  'cancelado',
] as const;
type Estado = (typeof ESTADOS)[number];

const PERMITIDAS: [Estado, Estado][] = [
  ['pago_pendiente', 'pagado'],
  ['pago_pendiente', 'cancelado'],
  ['pagado', 'aceptado'],
  ['pagado', 'cancelado'],
  ['aceptado', 'listo'],
  ['aceptado', 'cancelado'],
  ['listo', 'en_camino'],
  ['listo', 'entregado'],
  ['en_camino', 'entregado'],
];
const REVERSIONES: Estado[] = ['pago_pendiente', 'pagado', 'aceptado'];

let n = 0;
async function base() {
  const db = crearBasePruebas();
  await asegurarEsquema(db);
  const id = (p: string) => `${p}-${++n}`;
  const cliente = id('c');
  const dueno = id('d');
  const rest = id('r');
  await db.batch([
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'C', 'cliente', 'x')",
      )
      .bind(cliente, `${cliente}@ejemplo.com`),
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'D', 'restaurante', 'x')",
      )
      .bind(dueno, `${dueno}@ejemplo.com`),
    db
      .prepare(
        "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES (?, ?, 'R', 'aprobado')",
      )
      .bind(rest, dueno),
  ]);
  async function pedido(estado: Estado, canceladoHace?: string) {
    const p = id('p');
    await db
      .prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, cancelado_en)
         VALUES (?, ?, ?, ?, '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Calle', 25.7, -80.2, ${canceladoHace ? `datetime('now', '${canceladoHace}')` : 'NULL'})`,
      )
      .bind(p, cliente, rest, estado)
      .run();
    return p;
  }
  async function mover(
    p: string,
    hacia: Estado,
    sql = 'UPDATE pedidos SET estado = ? WHERE id = ?',
  ) {
    try {
      await db.prepare(sql).bind(hacia, p).run();
      return 'ok';
    } catch (e) {
      return String((e as Error).message ?? e);
    }
  }
  return { db, pedido, mover };
}

describe('transiciones del pedido forzadas por la base (C-TRANSICIONES-PEDIDO)', () => {
  it('cada transición permitida pasa', async () => {
    const { pedido, mover } = await base();
    for (const [desde, hacia] of PERMITIDAS) {
      const p = await pedido(desde);
      expect(await mover(p, hacia), `${desde} → ${hacia}`).toBe('ok');
    }
  });

  it('las 49 parejas: todo lo que no está en la tabla falla con el error tipado', async () => {
    const { pedido, mover } = await base();
    let probadas = 0;
    for (const desde of ESTADOS)
      for (const hacia of ESTADOS) {
        if (desde === hacia) continue;
        const permitida = PERMITIDAS.some(([a, b]) => a === desde && b === hacia);
        if (permitida) continue;
        // Las reversiones desde «cancelado» se prueban aparte: aquí, sin borrar cancelado_en.
        const p = await pedido(desde, desde === 'cancelado' ? '-10 seconds' : undefined);
        const r = await mover(p, hacia);
        expect(r, `${desde} → ${hacia} debía fallar`).toMatch(/transicion_de_pedido_no_permitida/);
        probadas++;
      }
    expect(probadas).toBe(42 - PERMITIDAS.length);
  });

  it('la vuelta atrás del Manager vale solo si borra cancelado_en y la cancelación tiene 2 minutos o menos', async () => {
    const { pedido, mover } = await base();
    const revertir = 'UPDATE pedidos SET estado = ?, cancelado_en = NULL WHERE id = ?';
    for (const hacia of REVERSIONES) {
      // Reciente: vale (es lo que hace manager.ts cuando Stripe falla).
      expect(await mover(await pedido('cancelado', '-30 seconds'), hacia, revertir)).toBe('ok');
      // Vieja: no se revive un pedido cancelado hace rato.
      expect(await mover(await pedido('cancelado', '-10 minutes'), hacia, revertir)).toMatch(
        /transicion_de_pedido_no_permitida/,
      );
      // Sin borrar cancelado_en: no es una reversión.
      expect(await mover(await pedido('cancelado', '-30 seconds'), hacia)).toMatch(
        /transicion_de_pedido_no_permitida/,
      );
    }
    // Nunca se revive como listo, en camino o entregado.
    for (const hacia of ['listo', 'en_camino', 'entregado'] as const)
      expect(await mover(await pedido('cancelado', '-30 seconds'), hacia, revertir)).toMatch(
        /transicion_de_pedido_no_permitida/,
      );
  });

  it('2.000 cambios al azar: la base nunca deja un pedido en un estado inalcanzable', async () => {
    const { db, pedido, mover } = await base();
    const alcanzable = (desde: Estado, hacia: Estado) =>
      PERMITIDAS.some(([a, b]) => a === desde && b === hacia);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(await pedido('pago_pendiente'));
    let semilla = 7;
    const azar = (k: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla % k;
    };
    for (let i = 0; i < 2000; i++) {
      const p = ids[azar(ids.length)]!;
      const antes = (await db.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(p).first<{
        estado: Estado;
      }>())!.estado;
      const hacia = ESTADOS[azar(ESTADOS.length)]!;
      const r = await mover(p, hacia);
      const despues = (await db.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(p).first<{
        estado: Estado;
      }>())!.estado;
      if (r === 'ok') expect(antes === hacia || alcanzable(antes, hacia)).toBe(true);
      else expect(despues).toBe(antes);
    }
  });

  it('la salud dice transiciones: ok, y error si falta el disparador', async () => {
    const db = crearBasePruebas();
    await asegurarEsquema(db);
    const salud = async () =>
      (
        (await (await app.request('/datos/salud', {}, { DB: db })).json()) as {
          piezas: Record<string, string>;
        }
      ).piezas.transiciones;
    expect(await salud()).toBe('ok');
    await db.prepare('DROP TRIGGER pedidos_transicion_valida').run();
    expect(await salud()).toBe('error');
  });

  it('el disparador no va en schema.sql (C-EXCLUSIVIDAD: la plataforma parte mal los disparadores)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
    expect(schema).not.toMatch(/pedidos_transicion_valida/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS transiciones_pedido/);
    expect(ESQUEMA_PEDIDOS.join('\n')).toMatch(
      /CREATE TRIGGER IF NOT EXISTS pedidos_transicion_valida/,
    );
  });
});
