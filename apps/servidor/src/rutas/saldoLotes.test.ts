import { describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { conductorListoEn, escenarioVe } from '../pruebas/motoVe';
import { sha256 } from '../cripto';
import {
  apartarSaldoViaje,
  cerrarSaldoAlBorrar,
  cerrarSaldoDeViaje,
  liberarSaldoViaje,
  saldoDeCliente,
  saldoLibroCliente,
  saludSaldoClientes,
} from '../saldoCliente';
import {
  PRORROGA_DIAS,
  avisarVencimientos,
  migrarSaldosALotes,
  planDeConsumo,
  vencerLotes,
} from '../saldoLotes';
import { acreditarBienvenida, contarViajeFidelidad } from '../saldoRegalos';
import { sembrarTabuladorVigia } from '../semillaTabuladorVigia';
import { TABULADOR_EL_VIGIA } from '../tabuladorElVigia';
import { CUENTA_TUMBITE } from '../internacional/libro';
import type { Env } from '../env';

/**
 * C-SALDO-LOTES, C-SALDO-BIENVENIDA, C-SALDO-MASIVO y C-SALDO-FIDELIDAD (26 nov 2026) — todos los
 * países; las pruebas corren en El Vigía (Venezuela), donde el saldo está encendido. El saldo por lotes
 * (origen y vencimiento), el orden de uso, el libro de Divoox con regalo y prepago aparte, el
 * vencimiento con su aviso, y los regalos automáticos sin cargar a mano.
 */
const CENTRO = { lat: EVG.lat, lng: EVG.lng, direccion: 'Plaza Bolívar de El Vigía' };
const destino = (nombre: string) => {
  const d = TABULADOR_EL_VIGIA.find((x) => x.nombre === nombre);
  if (!d) throw new Error(nombre);
  return { lat: d.lat, lng: d.lng, direccion: nombre };
};

async function preparar() {
  const e = await escenarioVe();
  const r = await e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    e.admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  expect(await sembrarTabuladorVigia(e.m.DB)).not.toBeNull();
  expect(
    (await e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 236.4567 }, e.admin.token))
      .estado,
  ).toBe(200);
  // El día entero de día (la prueba no depende de la hora en que corre).
  await e.m.DB.prepare(
    "UPDATE tarifas_viaje SET noche_desde_h = 3, noche_hasta_h = 3 WHERE zona_id = ? AND servicio_id = 'moto'",
  )
    .bind(EVG.id)
    .run();
  const db = e.m.DB;
  const admin = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.admin.token);
  const cargar = async (clienteId: string, monto: number, extra: Record<string, unknown> = {}) => {
    const c = await admin('POST', `/datos/admin/saldo-clientes/${clienteId}/cargas`, {
      monto,
      motivo: 'carrera_regalo',
      idempotencia: `carga-${Math.random().toString(36).slice(2, 12)}`,
      ...extra,
    });
    expect(c.estado, JSON.stringify(c.datos)).toBe(201);
    return c.datos as { id: string };
  };
  const lotes = async (clienteId: string) =>
    (
      await db
        .prepare(
          'SELECT id, tipo, origen, regla_id, monto_inicial, restante, vencido, vence_en, prorrogado_en FROM saldo_cliente_lotes WHERE cliente_id = ? AND monto_inicial > 0 ORDER BY creado_en, rowid',
        )
        .bind(clienteId)
        .all<{
          id: string;
          tipo: string;
          origen: string;
          regla_id: string | null;
          monto_inicial: number;
          restante: number;
          vencido: number;
          vence_en: string | null;
          prorrogado_en: string | null;
        }>()
    ).results;
  const cuadra = async (clienteId: string) => {
    const lt = await db
      .prepare(
        'SELECT COALESCE(SUM(restante), 0) AS s FROM saldo_cliente_lotes WHERE cliente_id = ?',
      )
      .bind(clienteId)
      .first<{ s: number }>();
    expect(Number(lt?.s)).toBe(await saldoLibroCliente(db, clienteId));
    expect(await saludSaldoClientes(db)).toBe('ok');
  };
  /** Un cliente nuevo (cuenta real por la API), con su celular escrito y, si se da, su ciudad. */
  let n = 0;
  const cliente = async (p: { zona?: string | null; telefono?: string } = {}) => {
    const c = await e.m.cuenta('cliente', `Cliente ${++n}`);
    const tel = p.telefono ?? `58414${String(1_000_000 + n * 7919).slice(-7)}`;
    await db
      .prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ?, zona_id = ? WHERE id = ?')
      .bind(`+${tel}`, tel, p.zona ?? null, c.id)
      .run();
    return c;
  };
  /** Confirma el celular como lo hace la app: el código del SMS y la huella del aparato. */
  const confirmar = async (c: { id: string; token: string }, aparato: string) => {
    await db
      .prepare(
        "INSERT OR REPLACE INTO codigos_telefono (usuario_id, telefono, codigo_hash) VALUES (?, 'x', ?)",
      )
      .bind(c.id, await sha256(`${c.id}:123456`))
      .run();
    const r = await e.m.llamar(
      'POST',
      '/datos/cuentas/telefono/verificar',
      { codigo: '123456' },
      c.token,
      { 'x-aparato': aparato },
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
  };
  const regla = async (d: Record<string, unknown>) => {
    const r = await admin('PUT', '/datos/admin/saldo-regalos/reglas', {
      zonaId: EVG.id,
      vigenciaDias: 30,
      ...d,
    });
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    return r.datos.regla as { id: string; gastado: number; disponible: number };
  };
  const env = { DB: db, ...e.m.extra } as unknown as Env;
  return { e, db, env, admin, cargar, lotes, cuadra, cliente, confirmar, regla };
}
type P = Awaited<ReturnType<typeof preparar>>;

/** Un conductor de El Vigía listo (para cobrar un uso del saldo). */
const conductor = (p: P) =>
  conductorListoEn(p.e, { zonaId: EVG.id, origen: CENTRO, saldo: 1000, nombre: 'Conductor Vigía' });

const libroDe = async (p: P, op: string) =>
  (
    await p.db
      .prepare(
        "SELECT bolsillo, concepto, monto FROM libro WHERE referencia IN ('saldo-divoox:' || ?1 || ':divoox', 'saldo-divoox:' || ?1 || ':prepago') ORDER BY bolsillo",
      )
      .bind(op)
      .all<{ bolsillo: string; concepto: string; monto: number }>()
  ).results;

describe('C-SALDO-LOTES: el orden de uso', () => {
  it('el plan gasta primero el regalo que vence antes, después el regalo sin fecha y al final el prepago', () => {
    const l = (
      id: string,
      tipo: 'regalo' | 'prepago',
      restante: number,
      venceEn: string | null,
    ) => ({
      id,
      tipo,
      origen: 'masiva' as const,
      restante,
      venceEn,
      creadoEn: '2026-11-01 00:00:00',
    });
    const lotes = [
      l('prepago', 'prepago', 300, null),
      l('sin-fecha', 'regalo', 100, null),
      l('vence-tarde', 'regalo', 100, '2026-12-20 00:00:00'),
      l('vence-pronto', 'regalo', 100, '2026-12-01 00:00:00'),
    ];
    expect(planDeConsumo(lotes, 450)).toEqual([
      { loteId: 'vence-pronto', monto: 100 },
      { loteId: 'vence-tarde', monto: 100 },
      { loteId: 'sin-fecha', monto: 100 },
      { loteId: 'prepago', monto: 150 },
    ]);
    expect(planDeConsumo(lotes, 601)).toBeNull();
  });

  it('en la base: aparta por lotes, devuelve a los mismos lotes y el sobrante vuelve primero al prepago', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.cargar(c.id, 300, { motivo: 'prepago', comprobante: 'REF-LOTES-1' });
    await p.cargar(c.id, 100); // regalo sin fecha
    await p.cargar(c.id, 100, { vigenciaDias: 20 });
    await p.cargar(c.id, 100, { vigenciaDias: 5 });
    expect(await saldoDeCliente(p.db, c.id)).toBe(600);
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-a',
        clienteId: c.id,
        monto: 450,
        pais: 'VE',
      }),
    ).toBe(true);
    // Repetir el mismo apartado no aparta otra vez ni toca otros lotes.
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-a',
        clienteId: c.id,
        monto: 450,
        pais: 'VE',
      }),
    ).toBe(false);
    const tras = await p.lotes(c.id);
    const por = (pred: (x: (typeof tras)[number]) => boolean) => tras.find(pred)!.restante;
    expect(por((x) => x.tipo === 'prepago')).toBe(150);
    expect(por((x) => x.tipo === 'regalo' && !x.vence_en)).toBe(0);
    expect(tras.filter((x) => x.vence_en).map((x) => x.restante)).toEqual([0, 0]);
    await p.cuadra(c.id);
    // El viaje no se hizo: TODO vuelve, cada centavo a su lote.
    expect(await liberarSaldoViaje(p.db, 'op-a', 'cancelada')).toBe(true);
    expect((await p.lotes(c.id)).map((x) => x.restante)).toEqual([300, 100, 100, 100]);
    await p.cuadra(c.id);
    // Total final menor: apartado 450, se cobran 300; los 150 que sobran vuelven al PREPAGO.
    const k = await conductor(p);
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-b',
        clienteId: c.id,
        monto: 450,
        pais: 'VE',
      }),
    ).toBe(true);
    expect(
      await cerrarSaldoDeViaje(p.db, {
        operacionId: 'op-b',
        conductorId: k.rep.id,
        maximo: 300,
        alTerminar: true,
      }),
    ).toEqual({ monto: 300, enRevision: false });
    expect((await p.lotes(c.id)).map((x) => x.restante)).toEqual([300, 0, 0, 0]);
    // Todo lo cobrado salió de regalos: el libro de Divoox lo paga como regalo, sin tocar el prepago.
    expect(await libroDe(p, 'op-b')).toEqual([
      { bolsillo: 'comisiones', concepto: 'saldo_divoox_pagado', monto: -300 },
    ]);
    await p.cuadra(c.id);
  });
});

describe('C-SALDO-LOTES: el libro de Divoox separa el regalo del prepago', () => {
  it('uso: la parte de regalo es gasto de Divoox y la de prepago sale del dinero recibido del cliente', async () => {
    const p = await preparar();
    const c = await p.cliente();
    const k = await conductor(p);
    await p.cargar(c.id, 300, { motivo: 'prepago', comprobante: 'REF-LOTES-2' });
    await p.cargar(c.id, 200, { vigenciaDias: 10 });
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-c',
        clienteId: c.id,
        monto: 450,
        pais: 'VE',
      }),
    ).toBe(true);
    await cerrarSaldoDeViaje(p.db, {
      operacionId: 'op-c',
      conductorId: k.rep.id,
      maximo: 400,
      alTerminar: true,
    });
    // 200 de regalo + 200 de prepago (los 50 que sobraron volvieron al prepago).
    expect(await libroDe(p, 'op-c')).toEqual([
      { bolsillo: 'comisiones', concepto: 'saldo_divoox_pagado', monto: -200 },
      { bolsillo: 'directo', concepto: 'saldo_cliente_prepago_usado', monto: -200 },
    ]);
    // Al conductor se le acredita lo cubierto entero (como siempre).
    const mov = await p.db
      .prepare("SELECT monto FROM movimientos WHERE referencia = 'saldo-divoox:op-c'")
      .first<{ monto: number }>();
    expect(mov?.monto).toBe(400);
    expect(await saldoDeCliente(p.db, c.id)).toBe(100);
    await p.cuadra(c.id);
  });

  it('vencimiento: lo que quedaba del regalo deja su movimiento «vencimiento», sin asiento de Divoox ni tocar el prepago', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.cargar(c.id, 300, { motivo: 'prepago', comprobante: 'REF-LOTES-3' });
    await p.cargar(c.id, 200, { vigenciaDias: 3 });
    const regalo = (await p.lotes(c.id)).find((x) => x.tipo === 'regalo')!;
    // Aviso 3 días antes (y uno solo aunque el reloj pase otra vez).
    await p.db
      .prepare("UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '+2 days') WHERE id = ?")
      .bind(regalo.id)
      .run();
    expect(await avisarVencimientos(p.env, p.db)).toBe(1);
    expect(await avisarVencimientos(p.env, p.db)).toBe(0);
    // Y otro el día que vence.
    await p.db
      .prepare("UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '+3 hours') WHERE id = ?")
      .bind(regalo.id)
      .run();
    expect(await avisarVencimientos(p.env, p.db)).toBe(1);
    const avisos = await p.db
      .prepare(
        "SELECT titulo_es, cuerpo_en FROM avisos_enviados WHERE usuario_id = ? AND tipo = 'saldo_divoox' ORDER BY id",
      )
      .bind(c.id)
      .all<{ titulo_es: string; cuerpo_en: string }>();
    expect(avisos.results.map((a) => a.titulo_es)).toEqual(
      expect.arrayContaining([
        'Tu regalo de Saldo Divoox vence pronto',
        'Tu regalo de Saldo Divoox vence hoy',
      ]),
    );
    // Ya vencido: no cuenta en lo disponible aunque el reloj todavía no lo barrió.
    await p.db
      .prepare(
        "UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '-1 minute') WHERE id = ?",
      )
      .bind(regalo.id)
      .run();
    expect(await saldoDeCliente(p.db, c.id)).toBe(300);
    expect(await vencerLotes(p.db)).toBe(1);
    expect(await vencerLotes(p.db)).toBe(0);
    const v = await p.db
      .prepare(
        "SELECT monto, concepto FROM saldo_cliente_movimientos WHERE cliente_id = ? AND concepto = 'vencimiento'",
      )
      .bind(c.id)
      .first<{ monto: number }>();
    expect(v?.monto).toBe(-200);
    expect((await p.lotes(c.id)).find((x) => x.tipo === 'regalo')).toMatchObject({
      restante: 0,
      vencido: 200,
    });
    expect(
      (
        await p.db
          .prepare(
            "SELECT COUNT(*) AS n FROM libro WHERE referencia LIKE 'vencimiento:%' OR concepto LIKE '%venc%'",
          )
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    expect(await saldoLibroCliente(p.db, c.id)).toBe(300);
    await p.cuadra(c.id);
  });

  it('cierre de cuenta: los lotes quedan en cero y solo el prepago que queda se devuelve', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.cargar(c.id, 300, { motivo: 'prepago', comprobante: 'REF-LOTES-4' });
    await p.cargar(c.id, 200, { vigenciaDias: 10 });
    // Usa 250: 200 de regalo y 50 del prepago.
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-d',
        clienteId: c.id,
        monto: 250,
        pais: 'VE',
      }),
    ).toBe(true);
    await p.db
      .prepare(
        "UPDATE usos_saldo_divoox SET estado = 'cobrado', monto = 250 WHERE operacion_id = 'op-d'",
      )
      .run();
    expect(await cerrarSaldoAlBorrar(p.db, c.id)).toEqual({ cerrado: 250, porDevolver: 250 });
    expect((await p.lotes(c.id)).every((x) => x.restante === 0)).toBe(true);
    expect(await saldoLibroCliente(p.db, c.id)).toBe(0);
    const caso = await p.db
      .prepare(
        "SELECT monto_esperado FROM incidencias_dinero WHERE referencia = 'saldo-cliente-devolver:' || ?",
      )
      .bind(c.id)
      .first<{ monto_esperado: number }>();
    expect(caso?.monto_esperado).toBe(250);
  });

  it('un regalo que venció mientras estaba apartado vuelve con su prórroga si el viaje no se hizo', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.cargar(c.id, 300, { vigenciaDias: 2 });
    expect(
      await apartarSaldoViaje(p.db, {
        operacionId: 'op-e',
        clienteId: c.id,
        monto: 200,
        pais: 'VE',
      }),
    ).toBe(true);
    const [l] = await p.lotes(c.id);
    await p.db
      .prepare("UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '-1 hour') WHERE id = ?")
      .bind(l!.id)
      .run();
    // Usar un regalo vencido: la base lo frena aunque alguien se saltara el plan.
    await expect(
      p.db
        .prepare(
          "INSERT INTO saldo_cliente_consumos (id, lote_id, cliente_id, referencia, tipo, monto) VALUES ('x1', ?, ?, 'x1', 'uso', 1)",
        )
        .bind(l!.id, c.id)
        .run(),
    ).rejects.toThrow(/lote_vencido|lote_insuficiente/);
    expect(await vencerLotes(p.db)).toBe(1); // los 100 que no estaban apartados
    expect(await liberarSaldoViaje(p.db, 'op-e', 'cancelada')).toBe(true);
    const [tras] = await p.lotes(c.id);
    expect(tras).toMatchObject({ restante: 200, vencido: 100 });
    expect(tras!.prorrogado_en).not.toBeNull();
    const dias = await p.db
      .prepare(
        "SELECT julianday(vence_en) - julianday('now') AS d FROM saldo_cliente_lotes WHERE id = ?",
      )
      .bind(l!.id)
      .first<{ d: number }>();
    expect(Math.round(Number(dias?.d))).toBe(PRORROGA_DIAS);
    expect(await saldoDeCliente(p.db, c.id)).toBe(200);
    await p.cuadra(c.id);
  });
});

describe('C-SALDO-LOTES: los saldos de antes pasan a lotes sin perder un centavo', () => {
  it('lo prepagado queda prepago hasta donde alcance; el resto, regalo sin fecha; lo apartado de antes vuelve como lote propio', async () => {
    const p = await preparar();
    const a = await p.cliente();
    const b = await p.cliente();
    // El libro de antes, sin lotes (como quedó en el sitio de pruebas).
    await p.db.batch([
      ...(
        [
          [a.id, 500, 'recarga', 'v1'],
          [a.id, 300, 'regalo', 'v2'],
          [a.id, -600, 'uso_viaje', 'v3'],
          [a.id, -100, 'uso_viaje', 'viaje:op-viejo:uso'],
          [b.id, 400, 'regalo', 'v5'],
        ] as const
      ).map(([cli, monto, concepto, ref]) =>
        p.db
          .prepare(
            "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia, operacion_id, creado_en) VALUES (?, ?, ?, ?, ?, CASE WHEN ? LIKE 'viaje:%' THEN 'op-viejo' END, datetime('now', '-30 days'))",
          )
          .bind(ref, cli, monto, concepto, ref, ref),
      ),
      p.db
        .prepare(
          "INSERT INTO usos_saldo_divoox (operacion_id, cliente_id, monto, apartado, pais) VALUES ('op-viejo', ?, 100, 100, 'VE')",
        )
        .bind(a.id),
    ]);
    expect(await migrarSaldosALotes(p.db)).toBeGreaterThan(0);
    expect(await migrarSaldosALotes(p.db)).toBe(0); // una sola vez
    expect((await p.lotes(a.id)).map((x) => [x.tipo, x.restante])).toEqual([['prepago', 100]]);
    expect((await p.lotes(b.id)).map((x) => [x.tipo, x.restante])).toEqual([['regalo', 400]]);
    expect(await saldoDeCliente(p.db, a.id)).toBe(100);
    // El apartado de antes (sin lotes) vuelve como su propio lote de regalo sin fecha.
    expect(await liberarSaldoViaje(p.db, 'op-viejo', 'cancelada')).toBe(true);
    expect(await saldoDeCliente(p.db, a.id)).toBe(200);
    await p.cuadra(a.id);
    await p.cuadra(b.id);
  });

  it('red de seguridad: un saldo de antes sin migrar pasa a lotes antes de que nazca un lote nuevo', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.db
      .prepare(
        "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('w1', ?, 250, 'regalo', 'w1')",
      )
      .bind(c.id)
      .run();
    await p.cargar(c.id, 100);
    expect(await saldoDeCliente(p.db, c.id)).toBe(350);
    await p.cuadra(c.id);
  });
});

describe('C-SALDO-LOTES: el canario', () => {
  it('rojo si los lotes no cuadran con el libro o si un regalo vencido se queda sin barrer', async () => {
    const p = await preparar();
    const c = await p.cliente();
    await p.cargar(c.id, 300, { vigenciaDias: 5 });
    expect(await saludSaldoClientes(p.db)).toBe('ok');
    await p.db
      .prepare(
        "UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '-3 hours') WHERE cliente_id = ?",
      )
      .bind(c.id)
      .run();
    expect(await saludSaldoClientes(p.db)).toBe('error');
    await vencerLotes(p.db);
    expect(await saludSaldoClientes(p.db)).toBe('ok');
    // Un movimiento que no pasó por los lotes (nadie debería poder): el canario lo ve.
    await p.db
      .prepare(
        "INSERT INTO saldo_cliente_movimientos (id, cliente_id, monto, concepto, referencia) VALUES ('z1', ?, 50, 'ajuste', 'z1')",
      )
      .bind(c.id)
      .run();
    expect(await saludSaldoClientes(p.db)).toBe('error');
  });
});

describe('C-SALDO-BIENVENIDA: el regalo de bienvenida por ciudad', () => {
  it('nace apagada: sin encender, confirmar el celular no regala nada', async () => {
    const p = await preparar();
    const r = await p.admin('GET', '/datos/admin/saldo-regalos/reglas');
    expect(r.datos.reglas).toEqual([]);
    await p.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: false,
      presupuesto: 3000,
      topeDiario: 3000,
    });
    const c = await p.cliente({ zona: EVG.id });
    await p.confirmar(c, 'aparato-bienvenida-0');
    expect(await p.lotes(c.id)).toEqual([]);
  });

  it('encendida: una sola vez al confirmar el celular, con su vencimiento y su aviso; ni el mismo número ni el mismo aparato la repiten', async () => {
    const p = await preparar();
    const regla = await p.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: true,
      presupuesto: 3000,
      topeDiario: 3000,
    });
    const c = await p.cliente({ zona: EVG.id, telefono: '584141110001' });
    // Sin celular confirmado no hay bienvenida.
    expect(
      await acreditarBienvenida(undefined, p.db, {
        clienteId: c.id,
        zonaId: EVG.id,
        aparato: 'a:x',
      }),
    ).toBe('no_aplica');
    await p.confirmar(c, 'aparato-bienvenida-1');
    const [l] = await p.lotes(c.id);
    expect(l).toMatchObject({
      tipo: 'regalo',
      origen: 'bienvenida',
      regla_id: regla.id,
      monto_inicial: 300,
    });
    const dias = await p.db
      .prepare(
        "SELECT julianday(vence_en) - julianday('now') AS d FROM saldo_cliente_lotes WHERE id = ?",
      )
      .bind(l!.id)
      .first<{ d: number }>();
    expect(Math.round(Number(dias?.d))).toBe(30);
    const aviso = await p.db
      .prepare(
        "SELECT titulo_es, cuerpo_es FROM avisos_enviados WHERE usuario_id = ? AND tipo = 'saldo_divoox'",
      )
      .bind(c.id)
      .first<{ titulo_es: string; cuerpo_es: string }>();
    expect(aviso?.titulo_es).toBe('Bienvenido a Divoox: tienes un regalo');
    expect(aviso?.cuerpo_es).toMatch(/^Te regalamos \S*3[.,]00\S* de Saldo Divoox.*Vence el /);
    // Confirmar otra vez no la repite.
    await p.confirmar(c, 'aparato-bienvenida-1');
    expect(await p.lotes(c.id)).toHaveLength(1);
    // Otra cuenta desde el mismo aparato: no, y queda la alerta.
    const otra = await p.cliente({ zona: EVG.id, telefono: '584141110002' });
    await p.confirmar(otra, 'aparato-bienvenida-1');
    expect(await p.lotes(otra.id)).toEqual([]);
    // Otra cuenta con el mismo número (el teléfono único se saltó a mano): tampoco.
    const tercera = await p.cliente({ zona: EVG.id, telefono: '584141110001' });
    await p.confirmar(tercera, 'aparato-bienvenida-3');
    expect(await p.lotes(tercera.id)).toEqual([]);
    const alertas = await p.db
      .prepare("SELECT COUNT(*) AS n FROM alertas_regalo WHERE tipo = 'saldo_bienvenida_repetida'")
      .first<{ n: number }>();
    expect(alertas?.n).toBe(2);
    // El panel lo ve en el presupuesto de la regla: gastado / disponible.
    const panel = (await p.admin('GET', '/datos/admin/saldo-regalos/reglas')).datos.reglas[0];
    expect(panel).toMatchObject({ gastado: 300, disponible: 2700, personas: 1, encendida: true });
    await p.cuadra(c.id);
  });

  it('sin ciudad al confirmar: queda pendiente y se acredita en su primera cotización, con la ciudad del viaje', async () => {
    const p = await preparar();
    await p.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: true,
      presupuesto: 3000,
      topeDiario: 3000,
    });
    const c = await p.cliente();
    await p.confirmar(c, 'aparato-bienvenida-pend');
    expect(await p.lotes(c.id)).toEqual([]);
    const q = await p.e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: CENTRO,
        destino: destino('Alcabala Vera Agua'),
        tarifaServicio: true,
      },
      c.token,
      { 'x-aparato': 'aparato-bienvenida-pend' },
    );
    expect(q.estado, JSON.stringify(q.datos)).toBe(201);
    expect(q.datos.cotizacion.saldoDivoox).toMatchObject({
      disponible: 300,
      regalo: 300,
      prepago: 0,
      vencePronto: null,
    });
    expect((await p.lotes(c.id))[0]).toMatchObject({ origen: 'bienvenida' });
    const pend = await p.db
      .prepare('SELECT COUNT(*) AS n FROM saldo_bienvenida_pendiente')
      .first<{ n: number }>();
    expect(pend?.n).toBe(0);
  });

  it('presupuesto y tope de 24 horas atómicos: dos confirmaciones a la vez no pasan el presupuesto', async () => {
    const p = await preparar();
    await p.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: true,
      presupuesto: 300,
      topeDiario: 3000,
    });
    const a = await p.cliente({ zona: EVG.id });
    const b = await p.cliente({ zona: EVG.id });
    await Promise.all([p.confirmar(a, 'aparato-presu-a'), p.confirmar(b, 'aparato-presu-b')]);
    const n = await p.db
      .prepare(
        "SELECT COUNT(*) AS n, SUM(monto_inicial) AS s FROM saldo_cliente_lotes WHERE origen = 'bienvenida'",
      )
      .first<{ n: number; s: number }>();
    expect(n).toEqual({ n: 1, s: 300 });
    // El tope de 24 horas igual: con presupuesto de sobra, el segundo del día no entra.
    const q = await preparar();
    await q.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: true,
      presupuesto: 30_000,
      topeDiario: 300,
    });
    const x = await q.cliente({ zona: EVG.id });
    const y = await q.cliente({ zona: EVG.id });
    await q.confirmar(x, 'aparato-tope-x');
    await q.confirmar(y, 'aparato-tope-y');
    expect(await q.lotes(x.id)).toHaveLength(1);
    expect(await q.lotes(y.id)).toEqual([]);
    const al = await q.db
      .prepare(
        "SELECT COUNT(*) AS n FROM alertas_regalo WHERE tipo = 'saldo_bienvenida_sin_presupuesto'",
      )
      .first<{ n: number }>();
    expect(al?.n).toBe(1);
  });

  it('la regla se valida: no se enciende sin presupuesto para un regalo, ni pasa el máximo del código', async () => {
    const p = await preparar();
    const mal = await p.admin('PUT', '/datos/admin/saldo-regalos/reglas', {
      tipo: 'bienvenida',
      zonaId: EVG.id,
      monto: 300,
      vigenciaDias: 30,
      encendida: true,
      presupuesto: 100,
      topeDiario: 3000,
    });
    expect(mal.estado).toBe(422);
    const caro = await p.admin('PUT', '/datos/admin/saldo-regalos/reglas', {
      tipo: 'bienvenida',
      zonaId: EVG.id,
      monto: 1_000_000,
      vigenciaDias: 30,
      encendida: false,
      presupuesto: 100,
      topeDiario: 3000,
    });
    expect(caro.estado).toBe(422);
    const c = await p.cliente();
    expect(
      (await p.e.m.llamar('GET', '/datos/admin/saldo-regalos/reglas', undefined, c.token)).estado,
    ).toBe(403);
  });
});

describe('C-SALDO-MASIVO: la carga masiva desde el panel', () => {
  it('vista previa, total escrito, tandas reanudables, idempotente y con tope', async () => {
    const p = await preparar();
    // 60 clientes de El Vigía con el celular confirmado y uno de otra ciudad (cuentas por la base).
    await p.db.batch([
      p.db
        .prepare(
          `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
         INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id, telefono_verificado_en, creado_en)
         SELECT 'masivo-' || printf('%03d', i), 'masivo' || i || '@ejemplo.com', 'Cliente ' || i, 'cliente', 'x', ?, datetime('now'),
                datetime('now', '-' || i || ' minutes') FROM n`,
        )
        .bind(EVG.id),
      p.db.prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id) VALUES ('masivo-fuera', 'fuera@ejemplo.com', 'Otro', 'cliente', 'x', 'US-FL-MIAMI')",
      ),
    ]);
    const filtros = { zonaId: EVG.id, celularVerificado: true };
    const previa = await p.admin('POST', '/datos/admin/saldo-regalos/masiva/vista-previa', {
      filtros,
      monto: 100,
    });
    expect(previa.estado, JSON.stringify(previa.datos)).toBe(200);
    expect(previa.datos).toMatchObject({ clientes: 60, total: 6000 });
    expect(previa.datos.lista).toHaveLength(50);
    expect(previa.datos.siguiente).toBeTruthy();
    const pag2 = await p.admin('POST', '/datos/admin/saldo-regalos/masiva/vista-previa', {
      filtros,
      monto: 100,
      pagina: previa.datos.siguiente,
    });
    expect(pag2.datos.lista).toHaveLength(10);
    const cuerpo = {
      filtros,
      monto: 100,
      vigenciaDias: 15,
      motivo: 'Lanzamiento en El Vigía',
      idempotencia: 'masiva-vigia-001',
    };
    // El total escrito tiene que ser el de la lista; el motivo es obligatorio; el tope por cliente manda.
    expect(
      (
        await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
          ...cuerpo,
          totalEscrito: 5900,
        })
      ).estado,
    ).toBe(409);
    expect(
      (
        await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
          ...cuerpo,
          motivo: 'x',
          totalEscrito: 6000,
        })
      ).estado,
    ).toBe(422);
    expect(
      (
        await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
          ...cuerpo,
          monto: 5000,
          totalEscrito: 300_000,
        })
      ).estado,
    ).toBe(422);
    const ok = await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
      ...cuerpo,
      totalEscrito: 6000,
    });
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(201);
    expect(ok.datos.carga).toMatchObject({ estado: 'en_curso', acreditados: 50, clientes: 60 });
    // Un cliente que nace después de confirmar no entra (la lista se cerró al confirmar).
    await p.db
      .prepare(
        `INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id, telefono_verificado_en, creado_en) VALUES ('masivo-tarde', 'tarde@ejemplo.com', 'Tarde', 'cliente', 'x', ?, datetime('now'), datetime('now', '+1 minute'))`,
      )
      .bind(EVG.id)
      .run();
    const id = ok.datos.carga.id as string;
    // Una tanda que se cortó antes de guardar su avance (el cursor quedó atrás): reanudar no le
    // acredita otra vez a los mismos clientes; sigue con los que faltan.
    await p.db.prepare("UPDATE saldo_cargas_masivas SET cursor = '' WHERE id = ?").bind(id).run();
    const t1b = await p.admin('POST', `/datos/admin/saldo-regalos/masiva/${id}/tanda`);
    expect(t1b.datos.carga).toMatchObject({ acreditados: 50, estado: 'en_curso' });
    const t2 = await p.admin('POST', `/datos/admin/saldo-regalos/masiva/${id}/tanda`);
    expect(t2.datos.carga).toMatchObject({ estado: 'terminada', acreditados: 60, entregado: 6000 });
    // Repetir la misma carga, o una tanda más, no acredita dos veces.
    expect(
      (
        await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
          ...cuerpo,
          totalEscrito: 6000,
        })
      ).estado,
    ).toBe(200);
    await p.admin('POST', `/datos/admin/saldo-regalos/masiva/${id}/tanda`);
    const n = await p.db
      .prepare(
        "SELECT COUNT(*) AS n, SUM(monto_inicial) AS s FROM saldo_cliente_lotes WHERE origen = 'masiva'",
      )
      .first<{ n: number; s: number }>();
    expect(n).toEqual({ n: 60, s: 6000 });
    // Uno por cliente, ni uno más: los 60 de la lista, cada uno con su regalo.
    const distintos = await p.db
      .prepare(
        "SELECT COUNT(DISTINCT cliente_id) AS n, MAX(c) AS max FROM (SELECT cliente_id, COUNT(*) AS c FROM saldo_cliente_lotes WHERE origen = 'masiva' GROUP BY cliente_id)",
      )
      .first<{ n: number; max: number }>();
    expect(distintos).toEqual({ n: 60, max: 1 });
    expect(await saldoDeCliente(p.db, 'masivo-001')).toBe(100);
    expect(await saldoDeCliente(p.db, 'masivo-060')).toBe(100);
    expect(await saldoDeCliente(p.db, 'masivo-fuera')).toBe(0);
    expect(await saldoDeCliente(p.db, 'masivo-tarde')).toBe(0);
    // Auditoría (quién y por qué) y un aviso a cada cliente.
    const aud = await p.db
      .prepare(
        "SELECT actor_id, despues_json FROM auditoria_admin WHERE accion = 'saldo_carga_masiva'",
      )
      .first<{ actor_id: string; despues_json: string }>();
    expect(aud?.actor_id).toBe(p.e.admin.id);
    expect(JSON.parse(aud!.despues_json)).toMatchObject({
      motivo: 'Lanzamiento en El Vigía',
      total: 6000,
    });
    const avisos = await p.db
      .prepare(
        "SELECT COUNT(*) AS n FROM avisos_enviados WHERE usuario_id LIKE 'masivo-%' AND tipo = 'saldo_divoox'",
      )
      .first<{ n: number }>();
    expect(avisos?.n).toBe(60);
    expect(await saludSaldoClientes(p.db)).toBe('ok');
  });

  it('el tope por carga masiva manda (configurable dentro del máximo del código)', async () => {
    const p = await preparar();
    await p.db
      .prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5)
       INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, zona_id) SELECT 'tope-' || i, 'tope' || i || '@ejemplo.com', 'C', 'cliente', 'x', ? FROM n`,
      )
      .bind(EVG.id)
      .run();
    expect(
      (
        await p.admin('PUT', '/datos/admin/saldo-regalos/masiva-topes', {
          porCliente: 500,
          porCarga: 1000,
        })
      ).estado,
    ).toBe(200);
    expect(
      (
        await p.admin('PUT', '/datos/admin/saldo-regalos/masiva-topes', {
          porCliente: 999_999,
          porCarga: 1000,
        })
      ).estado,
    ).toBe(422);
    const r = await p.admin('POST', '/datos/admin/saldo-regalos/masiva', {
      filtros: { zonaId: EVG.id },
      monto: 300,
      vigenciaDias: 15,
      motivo: 'Prueba del tope',
      totalEscrito: 1500,
      idempotencia: 'masiva-tope-01',
    });
    expect(r.estado).toBe(422);
  });
});

/** Un viaje de Moto en El Vigía de punta a punta, real (recorrido completo) o no. */
async function viaje(
  p: P,
  pasajero: { id: string; token: string },
  k: Awaited<ReturnType<typeof conductor>>,
  o: { destino: string; usarSaldo?: boolean; real?: boolean; aparato: string },
) {
  let n = 0;
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    p.e.m.llamar(metodo, ruta, cuerpo, pasajero.token, {
      'idempotency-key': `lotes-${Math.random().toString(36).slice(2)}-${++n}`,
      'x-aparato': o.aparato,
    });
  const q = await yo('POST', '/datos/viajes/cotizar', {
    servicio: 'moto',
    origen: CENTRO,
    destino: destino(o.destino),
    tarifaServicio: true,
  });
  expect(q.estado, JSON.stringify(q.datos)).toBe(201);
  const v = await yo('POST', '/datos/viajes', {
    cotizacionId: q.datos.cotizacion.id,
    metodoPago: 'efectivo',
    usarSaldo: o.usarSaldo ?? false,
  });
  expect(v.estado, JSON.stringify(v.datos)).toBe(201);
  const id = v.datos.viaje.id as string;
  expect((await k.paso(id, 'aceptar')).estado).toBe(200);
  expect((await k.paso(id, 'llegue')).estado).toBe(200);
  const pin = (await yo('GET', `/datos/viajes/${id}`)).datos.viaje.pin;
  expect((await k.paso(id, 'iniciar', { pin })).estado).toBe(200);
  const d = destino(o.destino);
  if (o.real !== false)
    await p.db.batch([
      p.db
        .prepare(
          `UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes'),
                distancia_m_real = (SELECT distancia_m FROM cotizaciones_viaje WHERE operacion_id = ?1) WHERE operacion_id = ?1`,
        )
        .bind(id),
      p.db
        .prepare(
          "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
        )
        .bind(d.lat, d.lng, k.rep.id),
    ]);
  const fin = await k.paso(id, 'terminar');
  expect(fin.estado, JSON.stringify(fin.datos)).toBe(200);
  // De vuelta al centro para el próximo viaje.
  await p.db
    .prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(CENTRO.lat, CENTRO.lng, k.rep.id)
    .run();
  return {
    id,
    total: Number(q.datos.cotizacion.total),
    fin: fin.datos,
    desglose: q.datos.cotizacion.desglose as unknown,
  };
}

describe('C-SALDO-FIDELIDAD: cada N viajes reales, M de Saldo Divoox (apagada por defecto)', () => {
  it('cuenta solo viajes reales, regala cada N y no pasa el tope por persona al mes', async () => {
    const p = await preparar();
    const k = await conductor(p);
    const c = await p.cliente();
    const ap = 'aparato-fidelidad-1';
    // Apagada: un viaje real no cuenta.
    await p.regla({
      tipo: 'fidelidad',
      monto: 100,
      encendida: false,
      presupuesto: 5000,
      cadaViajes: 2,
      topePersonaMes: 1,
    });
    await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap });
    expect(
      (
        await p.db
          .prepare('SELECT COUNT(*) AS n FROM saldo_fidelidad_viajes')
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    await p.regla({
      tipo: 'fidelidad',
      monto: 100,
      encendida: true,
      presupuesto: 5000,
      cadaViajes: 2,
      topePersonaMes: 1,
    });
    const v1 = await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap });
    // Uno que no parece real no cuenta.
    await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap, real: false });
    expect(await p.lotes(c.id)).toEqual([]);
    await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap });
    const [premio] = await p.lotes(c.id);
    expect(premio).toMatchObject({ origen: 'fidelidad', monto_inicial: 100 });
    // Contar el mismo viaje otra vez no cuenta dos veces.
    expect(
      await contarViajeFidelidad(undefined, p.db, { operacionId: v1.id, conductorId: k.rep.id }),
    ).toBeNull();
    // El 4.º viaje real llega al siguiente múltiplo, pero el tope por persona al mes (1) lo frena.
    await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap });
    await viaje(p, c, k, { destino: 'Alcabala Vera Agua', aparato: ap });
    expect(await p.lotes(c.id)).toHaveLength(1);
    await p.cuadra(c.id);
  });
});

describe('C-SALDO-BIENVENIDA: el circuito de punta a punta en El Vigía', () => {
  it('confirma el celular → 3 $ de bienvenida → viaje de 5 $ con saldo + efectivo → conductor 3 $ como regalo, Divoox 3 $ de gasto de regalo → el regalo que queda vence y todo cuadra', async () => {
    const p = await preparar();
    await p.regla({
      tipo: 'bienvenida',
      monto: 300,
      encendida: true,
      presupuesto: 30_000,
      topeDiario: 30_000,
    });
    const k = await conductor(p);
    const c = await p.cliente({ zona: EVG.id });
    const ap = 'aparato-circuito-1';
    await p.confirmar(c, ap);
    expect(await saldoDeCliente(p.db, c.id)).toBe(300);
    const v = await viaje(p, c, k, { destino: 'Alcabala Vera Agua', usarSaldo: true, aparato: ap });
    expect(v.total, JSON.stringify(v.desglose)).toBe(500);
    expect(v.fin).toMatchObject({ cobrarEnMano: 200, saldoDivoox: 300 });
    // Al conductor: 3 $ por el mismo camino del regalo; en el libro de Divoox, 3 $ de gasto de regalo.
    const mov = await p.db
      .prepare(
        "SELECT usuario_id, monto, concepto FROM movimientos WHERE referencia = 'saldo-divoox:' || ?",
      )
      .bind(v.id)
      .first<{ usuario_id: string; monto: number; concepto: string }>();
    expect(mov).toEqual({ usuario_id: k.rep.id, monto: 300, concepto: 'regalo' });
    expect(await libroDe(p, v.id)).toEqual([
      { bolsillo: 'comisiones', concepto: 'saldo_divoox_pagado', monto: -300 },
    ]);
    const asiento = await p.db
      .prepare("SELECT cuenta_id FROM libro WHERE referencia = 'saldo-divoox:' || ? || ':divoox'")
      .bind(v.id)
      .first<{ cuenta_id: string }>();
    expect(asiento?.cuenta_id).toBe(CUENTA_TUMBITE);
    // Después le llega otro regalo (carga del equipo con vigencia) que no usa: vence.
    await p.cargar(c.id, 100, { vigenciaDias: 7 });
    await p.db
      .prepare(
        "UPDATE saldo_cliente_lotes SET vence_en = datetime('now', '-1 minute') WHERE cliente_id = ? AND origen = 'regalo_manual'",
      )
      .bind(c.id)
      .run();
    expect(await vencerLotes(p.db)).toBe(1);
    // Movimientos del cliente: +3 bienvenida, −3 viaje, +1 regalo, −1 vencimiento = 0. Lotes en cero.
    const movs = (
      await p.db
        .prepare(
          'SELECT concepto, monto FROM saldo_cliente_movimientos WHERE cliente_id = ? ORDER BY rowid',
        )
        .bind(c.id)
        .all<{ concepto: string; monto: number }>()
    ).results;
    expect(movs).toEqual([
      { concepto: 'regalo', monto: 300 },
      { concepto: 'uso_viaje', monto: -300 },
      { concepto: 'regalo', monto: 100 },
      { concepto: 'vencimiento', monto: -100 },
    ]);
    expect(await saldoLibroCliente(p.db, c.id)).toBe(0);
    // El presupuesto de la bienvenida: 3 $ entregados, todos usados en viajes.
    const regla = (await p.admin('GET', '/datos/admin/saldo-regalos/reglas')).datos.reglas[0];
    expect(regla).toMatchObject({ gastado: 300, usadoEnViajes: 300, vencido: 0 });
    // Ni un asiento de Divoox por el regalo vencido (nunca se pagó) y ningún prepago mezclado.
    const prepagos = await p.db
      .prepare("SELECT COUNT(*) AS n FROM libro WHERE concepto LIKE 'saldo_cliente_prepago%'")
      .first<{ n: number }>();
    expect(prepagos?.n).toBe(0);
    await p.cuadra(c.id);
  });
});
