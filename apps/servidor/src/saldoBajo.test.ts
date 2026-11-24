import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { abrirCaracas, conductorListoVe, escenarioVe, pedirMotoVe } from './pruebas/motoVe';
import { AVISOS_SALDO, nivelSaldo, operacionesQueQuedan, revisarSaldoBajo } from './saldoBajo';

/**
 * C-SALDO-BAJO (24 nov 2026) — todos los países donde rige el prepago. El conductor sabe a tiempo que
 * se le acaba el saldo para la comisión («te queda saldo para N carreras» y «te quedaste sin saldo»), y
 * el restaurante, antes de quedarse en cero. Una vez por cruce (hasta que recargue), sin montos.
 */
const avisosDe = async (db: D1Database, usuario: string) =>
  (
    await db
      .prepare(
        `SELECT titulo_es, cuerpo_es, titulo_en, json_extract(datos_json, '$.nivel') AS nivel
           FROM avisos_enviados WHERE usuario_id = ? AND tipo = 'saldo_bajo' ORDER BY id`,
      )
      .bind(usuario)
      .all<{ titulo_es: string; cuerpo_es: string; titulo_en: string; nivel: string }>()
  ).results;

describe('C-SALDO-BAJO · la cuenta', () => {
  it('cuenta carreras enteras y decide el nivel', () => {
    expect(operacionesQueQuedan(350, 100)).toBe(3);
    expect(operacionesQueQuedan(99, 100)).toBe(0);
    expect(nivelSaldo(3, 3, 'conductor')).toBe('bajo');
    expect(nivelSaldo(4, 3, 'conductor')).toBeNull();
    expect(nivelSaldo(0, 3, 'conductor')).toBe('cero');
    expect(nivelSaldo(0, 0, 'conductor')).toBe('cero');
    expect(nivelSaldo(2, 0, 'conductor')).toBeNull();
    // El restaurante ya tiene su «te quedaste sin saldo» al pedir: aquí solo «por acabarse».
    expect(nivelSaldo(0, 3, 'restaurante')).toBe('bajo');
    expect(nivelSaldo(0, 0, 'restaurante')).toBeNull();
  });

  it('los textos dicen cómo recargar y a quién acudir, sin montos, en los dos idiomas', () => {
    for (const i of ['es', 'en'] as const)
      for (const a of [
        AVISOS_SALDO.conductor(i, 'bajo', 1),
        AVISOS_SALDO.conductor(i, 'bajo', 3),
        AVISOS_SALDO.conductor(i, 'cero', 0),
        AVISOS_SALDO.restaurante(i, 0),
        AVISOS_SALDO.restaurante(i, 1),
        AVISOS_SALDO.restaurante(i, 3),
      ]) {
        expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\$|\d+[.,]\d{2}|repartidor/);
        expect(a.canal).toBe('dinero');
      }
    expect(AVISOS_SALDO.conductor('es', 'bajo', 2).cuerpo).toContain('agente de tu zona');
    expect(AVISOS_SALDO.conductor('es', 'bajo', 1).titulo).toBe('Te queda saldo para 1 carrera');
    expect(AVISOS_SALDO.restaurante('es', 1).cuerpo).toContain('Alcanza para 1 pedido más');
  });
});

describe('C-SALDO-BAJO · una vez por cruce', () => {
  async function conductor() {
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Saldo');
    const env = { DB: m.DB } as unknown as Env;
    let n = 0;
    const mover = async (monto: number, concepto: string) =>
      m.DB.prepare(
        `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, creado_en)
         VALUES (?, ?, 'prepago', 'VE', 'USD', ?, ?, ?, datetime('now', ?))`,
      )
        .bind(crypto.randomUUID(), c.id, monto, concepto, `prueba:${n}`, `+${n++} seconds`)
        .run();
    const revisar = () =>
      revisarSaldoBajo(env, m.DB, {
        quien: 'conductor',
        cuentaId: c.id,
        usuarioId: c.id,
        pais: 'VE',
        moneda: 'USD',
        porOperacion: 100,
      });
    return { m, c, mover, revisar };
  }

  it('avisa al cruzar el umbral, no repite sin recargar, avisa en cero y vuelve tras recargar', async () => {
    const { m, c, mover, revisar } = await conductor();
    await mover(600, 'recarga_codigo');
    await mover(-100, 'reserva_viaje:ride');
    expect(await revisar()).toBeNull(); // 5 carreras: nada
    await mover(-200, 'reserva_viaje:ride');
    expect(await revisar()).toBe('bajo'); // 3 carreras
    await mover(-100, 'reserva_viaje:ride');
    expect(await revisar()).toBeNull(); // 2: ya se avisó en este cruce
    await mover(-200, 'reserva_viaje:ride');
    expect(await revisar()).toBe('cero');
    expect(await revisar()).toBeNull();
    const antes = await avisosDe(m.DB, c.id);
    expect(antes.map((a) => a.nivel)).toEqual(['bajo', 'cero']);
    expect(antes[0]!.titulo_es).toBe('Te queda saldo para 3 carreras');
    expect(antes[1]!.titulo_es).toBe('Te quedaste sin saldo');
    // Una devolución de una reserva no abre un cruce nuevo; una recarga sí.
    await mover(100, 'devolucion_reserva_viaje');
    expect(await revisar()).toBeNull();
    await mover(200, 'recarga_agente');
    expect(await revisar()).toBe('bajo');
    expect((await avisosDe(m.DB, c.id)).length).toBe(3);
  });

  it('con el umbral en 0 solo avisa al quedar sin saldo', async () => {
    const { m, mover, revisar } = await conductor();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    expect(
      (await m.llamar('PUT', '/datos/admin/paises/VE', { avisoSaldoBajo: 0 }, admin.token)).estado,
    ).toBe(200);
    await mover(300, 'recarga_codigo');
    expect(await revisar()).toBeNull();
    await mover(-300, 'reserva_viaje:ride');
    expect(await revisar()).toBe('cero');
  });
});

describe('C-SALDO-BAJO · de punta a punta: aceptar un viaje con poco saldo', () => {
  it('el conductor acepta y, con el saldo que queda, le llega «te queda saldo para N carreras»', async () => {
    const e = await escenarioVe();
    expect((await abrirCaracas(e)).estado).toBe(201);
    // Con 1 dólar y la comisión de Caracas de pruebas (31 centavos), quedan 2 carreras.
    const c = await conductorListoVe(e, 100);
    const v = await pedirMotoVe(e, 'efectivo');
    const r = await c.paso(v.id, 'aceptar');
    expect(r.estado).toBe(200);
    const reserva = await e.m.DB.prepare(
      "SELECT -SUM(monto) AS m FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago' AND monto < 0",
    )
      .bind(c.rep.id)
      .first<{ m: number }>();
    expect(Number(reserva?.m)).toBeGreaterThan(0);
    const avisos = await avisosDe(e.m.DB, c.rep.id);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.titulo_es).toBe('Te queda saldo para 2 carreras');
  });
});

describe('C-SALDO-BAJO · el restaurante', () => {
  it('«Tu saldo está por acabarse» una vez, a su dueño, al cobrarse la comisión', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante', 'Dueña Local');
    const env = { DB: m.DB } as unknown as Env;
    await m.DB.prepare(
      `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
       VALUES (?, 'restaurante:r1', 'prepago', 'VE', 'USD', 250, 'carga_manual_restaurante', 'p:1')`,
    )
      .bind(crypto.randomUUID())
      .run();
    const revisar = () =>
      revisarSaldoBajo(env, m.DB, {
        quien: 'restaurante',
        cuentaId: 'restaurante:r1',
        usuarioId: dueno.id,
        pais: 'VE',
        moneda: 'USD',
        porOperacion: 100,
      });
    expect(await revisar()).toBe('bajo');
    expect(await revisar()).toBeNull();
    const a = await avisosDe(m.DB, dueno.id);
    expect(a).toHaveLength(1);
    expect(a[0]!.titulo_es).toBe('Tu saldo está por acabarse');
    expect(a[0]!.cuerpo_es).toContain('Alcanza para unos 2 pedidos más');
  });

  it('el pago directo lo revisa justo después de cobrar la comisión', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const s = readFileSync(join(import.meta.dirname, 'internacional', 'pagoComida.ts'), 'utf8');
    const i = s.indexOf('const cobrada = await cobrarComisionRestaurante(');
    expect(i).toBeGreaterThan(0);
    expect(s.slice(i, i + 500)).toContain("quien: 'restaurante'");
  });
});
