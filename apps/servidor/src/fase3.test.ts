import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { llevarA, mundo } from './pruebas/ayuda';
import { soltarPedido, tomarPedidoComida } from './rutas/operacion';
import {
  aceptarOperacion,
  candidatosParaOperacion,
  cambiarEstadoViaje,
  liberarViaje,
  repartirOperaciones,
  saludExclusividad,
  DISPARADORES_EXCLUSIVIDAD,
} from './operaciones';
import { ESQUEMA_FASE3 } from './esquemaFase3';
import { asegurarEsquema, reiniciarEsquema } from './esquema';

/**
 * Fase 3 · Exclusividad y asignación (docs/FASE-3-EXCLUSIVIDAD-ASIGNACION.md). Candado
 * C-EXCLUSIVIDAD: un conductor nunca tiene dos operaciones incompatibles, dos conductores nunca
 * se llevan la misma, y Comida sigue igual. Moto se «enciende» SOLO dentro de estas bases de
 * prueba en memoria para poder ejercitar el circuito; el código desplegado no la declara.
 */

type Mundo = ReturnType<typeof mundo>;
const ZONA = 'US-FL-MIAMI';
const PUNTO = { lat: 25.77, lng: -80.19 };
let seq = 0;
const id = (p: string) => `${p}-${++seq}-${Math.random().toString(36).slice(2, 8)}`;

async function q(m: Mundo, sql: string, ...v: unknown[]) {
  return m.DB.prepare(sql)
    .bind(...v)
    .run();
}
async function uno<T>(m: Mundo, sql: string, ...v: unknown[]) {
  return m.DB.prepare(sql)
    .bind(...v)
    .first<T>();
}
async function inconsistencias(m: Mundo) {
  const { results } = await m.DB.prepare(
    'SELECT problema, referencia FROM inconsistencias_operaciones',
  ).all();
  return results;
}

/** Solo en esta base de prueba: Moto implementada y disponible en Miami, sin requisitos. */
async function encenderMotoDePrueba(m: Mundo, conRequisitos = false) {
  await q(
    m,
    "INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('moto', 1)",
  );
  await q(m, "UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'");
  await q(
    m,
    "INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', ?, 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'",
    ZONA,
  );
  if (!conRequisitos) await q(m, "DELETE FROM servicio_requisitos WHERE servicio_id = 'moto'");
}

/** Un conductor de Moto con todo en regla: vehículo aprobado, documentos vigentes, habilitado. */
async function conductor(m: Mundo, nombre = 'Conductor') {
  const c = await m.cuenta('repartidor', nombre);
  const admin = await m.cuenta('admin', 'Soporte Revisión');
  const v = id('veh');
  await q(
    m,
    "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, ?, ?, datetime('now'), ?) ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en",
    c.id,
    PUNTO.lat,
    PUNTO.lng,
    ZONA,
  );
  await q(
    m,
    "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado, anio, estado) VALUES (?, ?, 'moto', ?, 'FL', 2022, 'aprobado')",
    v,
    c.id,
    `P${seq}${Math.floor(Math.random() * 1e6)}`,
  );
  for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
    await q(
      m,
      "INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES (?, ?, ?, 'doc', 'aprobado', datetime('now', '+1 year'))",
      id('doc'),
      v,
      t,
    );
  await q(m, 'UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?', v, c.id);
  await q(
    m,
    "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES (?, 'moto', 'aprobada', ?, datetime('now'))",
    c.id,
    admin.id,
  );
  await q(
    m,
    "INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'moto', 1)",
    c.id,
  );
  return { ...c, vehiculo: v };
}

/** Una operación de Moto buscando conductor. */
async function operacion(m: Mundo, clienteId: string) {
  const o = id('op');
  await q(
    m,
    "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general) VALUES (?, 'moto', 'viaje_pasajero', ?, ?, 'buscando')",
    o,
    clienteId,
    ZONA,
  );
  await q(
    m,
    "INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida) VALUES (?, 'buscando', 'sistema', ?, ?, ?, 'Origen de prueba', 25.78, -80.2, 'Destino de prueba', '4321')",
    o,
    `alta:${o}`,
    PUNTO.lat,
    PUNTO.lng,
  );
  return o;
}

async function ofrecer(m: Mundo, op: string, c: { id: string; vehiculo: string }) {
  await q(
    m,
    "INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en) VALUES (?, ?, ?, 'ofrecida', datetime('now', '+30 seconds')) ON CONFLICT DO UPDATE SET estado = 'ofrecida', expira_en = excluded.expira_en",
    op,
    c.id,
    c.vehiculo,
  );
}

/** Un pedido de comida listo para repartir (aceptado por el restaurante, sin repartidor). */
async function pedidoComida(m: Mundo, clienteId: string, restauranteId: string) {
  const p = id('ped');
  await q(
    m,
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en)
     VALUES (?, ?, ?, 'aceptado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', 'Dirección de prueba', ?, ?, datetime('now'), datetime('now'))`,
    p,
    clienteId,
    restauranteId,
    PUNTO.lat,
    PUNTO.lng,
  );
  return p;
}

async function escenario() {
  const m = mundo();
  const cliente = await m.cuenta('cliente', 'Cliente');
  const dueno = await m.cuenta('restaurante', 'Dueño');
  const rest = id('rest');
  await q(
    m,
    "INSERT INTO restaurantes (id, dueno_id, nombre, lat, lng, zona_id) VALUES (?, ?, 'Restaurante de prueba', ?, ?, ?)",
    rest,
    dueno.id,
    PUNTO.lat,
    PUNTO.lng,
    ZONA,
  );
  await encenderMotoDePrueba(m);
  return { m, cliente, rest };
}

/** Comida toma un pedido con la MISMA sentencia que usa la app (operacion.ts). */
const tomarComida = (m: Mundo, pedido: string, repartidor: string, esperados = 0) =>
  tomarPedidoComida(m.DB, pedido, repartidor, esperados);

describe('Fase 3 · asignación atómica de operaciones', () => {
  it('dos conductores aceptan la misma operación a la vez: uno solo se la lleva', async () => {
    const { m, cliente } = await escenario();
    const conductores = await Promise.all(
      Array.from({ length: 6 }, (_, i) => conductor(m, `Conductor ${i}`)),
    );
    const op = await operacion(m, cliente.id);
    for (const c of conductores) await ofrecer(m, op, c);
    const r = await Promise.all(
      conductores.map((c, i) =>
        aceptarOperacion(m.DB, {
          operacionId: op,
          conductorId: c.id,
          vehiculoId: c.vehiculo,
          clave: `k-${i}`,
        }),
      ),
    );
    expect(r.filter((x) => x.resultado === 'tomada')).toHaveLength(1);
    expect(r.filter((x) => x.resultado === 'otro_conductor')).toHaveLength(5);
    const asign = await uno<{ n: number }>(
      m,
      'SELECT COUNT(*) AS n FROM asignaciones_operacion WHERE operacion_id = ?',
      op,
    );
    expect(asign?.n).toBe(1);
    const ofertas = await m.DB.prepare(
      'SELECT estado, COUNT(*) AS n FROM ofertas_operacion WHERE operacion_id = ? GROUP BY estado ORDER BY estado',
    )
      .bind(op)
      .all();
    expect(ofertas.results).toEqual([
      { estado: 'aceptada', n: 1 },
      { estado: 'retirada', n: 5 },
    ]);
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('un conductor no puede tener dos operaciones a la vez', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const a = await operacion(m, cliente.id);
    const b = await operacion(m, cliente.id);
    await ofrecer(m, a, c);
    await ofrecer(m, b, c);
    const [ra, rb] = await Promise.all([
      aceptarOperacion(m.DB, {
        operacionId: a,
        conductorId: c.id,
        vehiculoId: c.vehiculo,
        clave: 'a1',
      }),
      aceptarOperacion(m.DB, {
        operacionId: b,
        conductorId: c.id,
        vehiculoId: c.vehiculo,
        clave: 'b1',
      }),
    ]);
    expect([ra.resultado, rb.resultado].sort()).toEqual(['ocupado', 'tomada']);
    const segunda = await uno<{ estado_general: string; conductor_id: string | null }>(
      m,
      'SELECT estado_general, conductor_id FROM operaciones WHERE id = ?',
      ra.resultado === 'tomada' ? b : a,
    );
    expect(segunda).toEqual({ estado_general: 'buscando', conductor_id: null });
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('la misma solicitud repetida (doble toque o respuesta perdida) no repite nada', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    const datos = { operacionId: op, conductorId: c.id, vehiculoId: c.vehiculo, clave: 'misma' };
    const r1 = await aceptarOperacion(m.DB, datos);
    const r2 = await aceptarOperacion(m.DB, datos);
    const r3 = await aceptarOperacion(m.DB, { ...datos, clave: 'otra' });
    expect(r1.resultado).toBe('tomada');
    expect(r2.resultado).toBe('ya_es_tuya');
    expect(r3.resultado).toBe('ya_es_tuya');
    const n = await uno<{ a: number; e: number }>(
      m,
      "SELECT (SELECT COUNT(*) FROM asignaciones_operacion WHERE operacion_id = ?1) AS a, (SELECT COUNT(*) FROM eventos_operacion WHERE operacion_id = ?1 AND estado_nuevo = 'asignado') AS e",
      op,
    );
    expect(n).toEqual({ a: 1, e: 1 });
  });

  it('sin oferta vigente, o sin ser elegible, no se acepta', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    const sin = await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'x',
    });
    expect(sin.resultado).toBe('no_disponible');
    await ofrecer(m, op, c);
    await q(m, "UPDATE habilitaciones SET estado = 'suspendida' WHERE conductor_id = ?", c.id);
    const susp = await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'y',
    });
    expect(susp.resultado).toBe('no_disponible');
  });
});

describe('Fase 3 · exclusividad entre Comida y operaciones', () => {
  it('con un pedido de comida en curso no se acepta un viaje (y no queda nada a medias)', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    const ped = await pedidoComida(m, cliente.id, rest);
    expect((await tomarComida(m, ped, c.id)).meta.changes).toBe(1);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    const r = await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'z',
    });
    expect(r.resultado).toBe('ocupado');
    // Recuperación después del fallo: la operación sigue buscando, sin asignación ni evento.
    const estado = await uno(
      m,
      'SELECT o.estado_general, o.conductor_id, v.estado, (SELECT COUNT(*) FROM asignaciones_operacion a WHERE a.operacion_id = o.id) AS asign FROM operaciones o JOIN viajes v ON v.operacion_id = o.id WHERE o.id = ?',
      op,
    );
    expect(estado).toEqual({
      estado_general: 'buscando',
      conductor_id: null,
      estado: 'buscando',
      asign: 0,
    });
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('en un viaje no se toma un pedido de comida, ni con la sentencia vieja de Comida', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'v',
    });
    const ped = await pedidoComida(m, cliente.id, rest);
    expect((await tomarComida(m, ped, c.id)).meta.changes).toBe(0);
    // Aunque alguien use la sentencia de antes (sin la condición nueva), la base lo impide.
    await expect(
      q(
        m,
        'UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL',
        c.id,
        ped,
      ),
    ).rejects.toThrow(/conductor_ocupado_en_otra_operacion/);
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('pedidos agrupados: cuentan juntos y el conductor queda libre al entregar el último', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    const p1 = await pedidoComida(m, cliente.id, rest);
    const p2 = await pedidoComida(m, cliente.id, rest);
    expect((await tomarComida(m, p1, c.id, 0)).meta.changes).toBe(1);
    expect((await tomarComida(m, p2, c.id, 1)).meta.changes).toBe(1);
    expect(
      await uno(m, 'SELECT tipo, pedidos FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toEqual({ tipo: 'comida', pedidos: 2 });
    await llevarA(m.DB, p1, 'entregado');
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toEqual({ pedidos: 1 });
    await llevarA(m.DB, p2, 'entregado');
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('dos pedidos sueltos a la vez: la sentencia de Comida deja tomar solo uno', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    const p1 = await pedidoComida(m, cliente.id, rest);
    const p2 = await pedidoComida(m, cliente.id, rest);
    // Los dos vieron al repartidor libre (esperados = 0): solo el primero entra.
    const [a, b] = await Promise.all([tomarComida(m, p1, c.id, 0), tomarComida(m, p2, c.id, 0)]);
    expect(a.meta.changes + b.meta.changes).toBe(1);
  });

  it('cancelar, soltar y reasignar liberan la ocupación como corresponde', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m, 'Uno');
    const d = await conductor(m, 'Dos');
    const ped = await pedidoComida(m, cliente.id, rest);
    await tomarComida(m, ped, c.id);
    await soltarPedido(m.DB, ped, c.id);
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    await tomarComida(m, ped, d.id);
    // Reasignación directa (soporte): la ocupación pasa de uno a otro.
    await q(m, 'UPDATE pedidos SET repartidor_id = ? WHERE id = ?', c.id, ped);
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toEqual({ pedidos: 1 });
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', d.id),
    ).toBeNull();
    await llevarA(m.DB, ped, 'cancelado');
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    // Reversa del Manager (Stripe no devolvió): el pedido vuelve a su estado anterior, borrando
    // cancelado_en, como manager.ts, y el repartidor vuelve a contar.
    await q(m, "UPDATE pedidos SET estado = 'aceptado', cancelado_en = NULL WHERE id = ?", ped);
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toEqual({ pedidos: 1 });
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('un viaje: soltar, cancelar y terminar liberan al conductor; otro puede tomarlo', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m, 'Uno');
    const d = await conductor(m, 'Dos');
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'c1',
    });
    expect(
      await liberarViaje(m.DB, {
        operacionId: op,
        conductorId: c.id,
        motivo: 'llanta',
        clave: 'c-libera',
      }),
    ).toBe(true);
    expect(
      await uno(m, 'SELECT estado_general, conductor_id FROM operaciones WHERE id = ?', op),
    ).toEqual({ estado_general: 'buscando', conductor_id: null });
    expect(
      await uno(
        m,
        'SELECT resultado FROM asignaciones_operacion WHERE operacion_id = ? AND conductor_id = ?',
        op,
        c.id,
      ),
    ).toEqual({ resultado: 'liberada_conductor' });
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    await ofrecer(m, op, d);
    expect(
      (
        await aceptarOperacion(m.DB, {
          operacionId: op,
          conductorId: d.id,
          vehiculoId: d.vehiculo,
          clave: 'd1',
        })
      ).resultado,
    ).toBe('tomada');
    const paso = (desde: string, hacia: string, clave: string) =>
      cambiarEstadoViaje(m.DB, {
        operacionId: op,
        desde,
        hacia,
        actor: 'conductor',
        actorId: d.id,
        clave,
      });
    expect(await paso('asignado', 'conductor_llego', 'd-llego')).toBe(true);
    expect(await paso('conductor_llego', 'en_curso', 'd-inicia')).toBe(true);
    expect(
      await uno(m, 'SELECT tipo FROM conductor_ocupacion WHERE conductor_id = ?', d.id),
    ).toEqual({ tipo: 'operacion' });
    expect(await paso('en_curso', 'terminado', 'd-termina')).toBe(true);
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', d.id),
    ).toBeNull();
    // El cliente no puede «terminar» un viaje, ni se salta pasos.
    await expect(
      cambiarEstadoViaje(m.DB, {
        operacionId: op,
        desde: 'terminado',
        hacia: 'en_curso',
        actor: 'conductor',
        actorId: d.id,
        clave: 'otra',
      }),
    ).rejects.toThrow(/transicion_de_viaje_no_permitida/);
    expect(await inconsistencias(m)).toEqual([]);
    expect(await saludExclusividad(m.DB)).toBe('ok');
  });

  it('el vehículo activo no cambia con un viaje en curso', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 'k',
    });
    const r = await m.llamar(
      'PUT',
      '/datos/conductor/vehiculo-activo',
      { vehiculoId: null },
      c.token,
    );
    expect(r.estado).toBe(409);
    await expect(
      q(m, 'UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ?', c.id),
    ).rejects.toThrow(/no_se_cambia_vehiculo_en_operacion/);
  });
});

describe('Fase 3 · elegibilidad', () => {
  it('cada requisito que falta deja al conductor fuera de la lista', async () => {
    const { m } = await escenario();
    const casos: [string, (cid: string, vid: string) => Promise<unknown>][] = [
      [
        'habilitación suspendida',
        (cid) =>
          q(m, "UPDATE habilitaciones SET estado = 'suspendida' WHERE conductor_id = ?", cid),
      ],
      [
        'vehículo suspendido',
        (_c, vid) => q(m, "UPDATE vehiculos SET estado = 'suspendido' WHERE id = ?", vid),
      ],
      [
        'seguro vencido',
        (_c, vid) =>
          q(
            m,
            "UPDATE vehiculo_documentos SET vence_en = datetime('now', '-1 day') WHERE vehiculo_id = ? AND tipo = 'seguro'",
            vid,
          ),
      ],
      [
        'sin seguro de pasajeros',
        (_c, vid) =>
          q(
            m,
            "UPDATE vehiculo_documentos SET estado = 'vencido' WHERE vehiculo_id = ? AND tipo = 'seguro_pasajeros'",
            vid,
          ),
      ],
      [
        'preferencia apagada',
        (cid) => q(m, 'UPDATE preferencias_servicio SET activa = 0 WHERE conductor_id = ?', cid),
      ],
      [
        'bloqueado',
        async (cid) =>
          q(
            m,
            "INSERT INTO conductor_bloqueos (id, conductor_id, motivo, creado_por) VALUES (?, ?, 'prueba', ?)",
            id('b'),
            cid,
            cid,
          ),
      ],
      [
        'desconectado',
        (cid) => q(m, 'UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?', cid),
      ],
    ];
    for (const [nombre, romper] of casos) {
      const c = await conductor(m, nombre);
      const antes = await uno(
        m,
        "SELECT 1 FROM conductores_elegibles WHERE conductor_id = ? AND servicio_id = 'moto'",
        c.id,
      );
      expect(antes, nombre).not.toBeNull();
      await romper(c.id, c.vehiculo);
      const despues = await uno(
        m,
        "SELECT 1 FROM conductores_elegibles WHERE conductor_id = ? AND servicio_id = 'moto'",
        c.id,
      );
      expect(despues, nombre).toBeNull();
    }
  });

  it('con los requisitos reales de Moto, la base no deja habilitar a quien no los cumple', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    await encenderMotoDePrueba(m, true);
    await expect(conductor(m)).rejects.toThrow(/habilitacion_con_requisitos_faltantes/);
  });

  it('el código desplegado NO declara Moto ni Carro: en una base normal nadie es elegible', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    const n = await uno<{ n: number }>(m, 'SELECT COUNT(*) AS n FROM conductores_elegibles');
    expect(n?.n).toBe(0);
    const imp = await m.DB.prepare('SELECT servicio_id FROM servicios_implementados').all<{
      servicio_id: string;
    }>();
    expect(imp.results.map((r) => r.servicio_id)).toEqual(['comida']);
  });
});

describe('Fase 3 · despacho con tiempo real y recuperación', () => {
  const envTR = {
    TIEMPO_REAL_URL: 'https://tiempo-real.ejemplo.com',
    AVISOS_LLAVE_ID: 'llave-prueba',
    AVISOS_SECRETO: 'secreto-de-prueba-con-largo-suficiente-123',
  } as never;

  it('pregunta al tiempo real por los más cercanos y, si falla, usa la base', async () => {
    const { m, cliente } = await escenario();
    const lejos = await conductor(m, 'Lejos');
    const cerca = await conductor(m, 'Cerca');
    const op = await operacion(m, cliente.id);
    const datos = { id: op, servicioId: 'moto', zonaId: ZONA, ...PUNTO };
    const conTR = await candidatosParaOperacion(envTR, m.DB, datos, (async () =>
      Response.json({
        ok: true,
        candidatos: [
          { c: cerca.id, km: 0.3 },
          { c: lejos.id, km: 4 },
          { c: 'otro', km: 1 },
        ],
      })) as never);
    expect(conTR.fuente).toBe('tiempo_real');
    expect(conTR.candidatos.map((c) => c.conductorId)).toEqual([cerca.id, lejos.id]);
    const caido = await candidatosParaOperacion(envTR, m.DB, datos, (async () => {
      throw new Error('caído');
    }) as never);
    expect(caido.fuente).toBe('base');
    expect(caido.candidatos).toHaveLength(2);
  });

  it('el reloj ofrece a un solo conductor libre y vence las ofertas viejas', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    const r = await repartirOperaciones(undefined, m.DB);
    expect(r.ofrecidas).toBe(1);
    expect(
      await uno(m, 'SELECT conductor_id, estado FROM ofertas_operacion WHERE operacion_id = ?', op),
    ).toEqual({ conductor_id: c.id, estado: 'ofrecida' });
    await q(m, "UPDATE ofertas_operacion SET expira_en = datetime('now', '-1 second')");
    await repartirOperaciones(undefined, m.DB);
    expect(
      await uno(
        m,
        'SELECT estado FROM ofertas_operacion WHERE operacion_id = ? AND conductor_id = ?',
        op,
        c.id,
      ),
    ).toEqual({ estado: 'vencida' });
  });

  it('un conductor que pierde la señal no deja el viaje secuestrado', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    await aceptarOperacion(m.DB, {
      operacionId: op,
      conductorId: c.id,
      vehiculoId: c.vehiculo,
      clave: 's',
    });
    await q(
      m,
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-10 minutes') WHERE usuario_id = ?",
      c.id,
    );
    await q(
      m,
      "UPDATE viajes SET asignado_en = datetime('now', '-10 minutes') WHERE operacion_id = ?",
      op,
    );
    const r = await repartirOperaciones(undefined, m.DB);
    expect(r.liberados).toBe(1);
    expect(
      await uno(m, 'SELECT estado_general, conductor_id FROM operaciones WHERE id = ?', op),
    ).toEqual({ estado_general: 'buscando', conductor_id: null });
    expect(
      await uno(m, 'SELECT resultado FROM asignaciones_operacion WHERE operacion_id = ?', op),
    ).toEqual({ resultado: 'liberada_sistema' });
    expect(await inconsistencias(m)).toEqual([]);
  });
});

describe('Fase 3 · rutas del conductor', () => {
  it('aceptar exige la clave, responde igual al reintento e iniciar exige el código', async () => {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    const llamar = (ruta: string, cuerpo: unknown, clave?: string) =>
      m.crudo(ruta, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${c.token}`,
          'content-type': 'application/json',
          ...(clave ? { 'idempotency-key': clave } : {}),
        },
        body: JSON.stringify(cuerpo),
      });
    expect((await llamar(`/datos/conductor/operaciones/${op}/aceptar`, {})).status).toBe(400);
    expect(
      (await llamar(`/datos/conductor/operaciones/${op}/aceptar`, {}, 'clave-aceptar-1')).status,
    ).toBe(200);
    expect(
      (await llamar(`/datos/conductor/operaciones/${op}/aceptar`, {}, 'clave-aceptar-1')).status,
    ).toBe(200);
    expect(
      (await llamar(`/datos/conductor/operaciones/${op}/llegue`, {}, 'clave-llegue-1')).status,
    ).toBe(200);
    expect(
      (
        await llamar(
          `/datos/conductor/operaciones/${op}/iniciar`,
          { pin: '0000' },
          'clave-iniciar-1',
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await llamar(
          `/datos/conductor/operaciones/${op}/iniciar`,
          { pin: '4321' },
          'clave-iniciar-2',
        )
      ).status,
    ).toBe(200);
    expect(
      (await llamar(`/datos/conductor/operaciones/${op}/terminar`, {}, 'clave-terminar-1')).status,
    ).toBe(200);
    expect(
      (await llamar(`/datos/conductor/operaciones/${op}/terminar`, {}, 'clave-terminar-1')).status,
    ).toBe(200);
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.exclusividad).toBe('ok');
  });
});

describe('C-VIAJE-PASOS-REALES: el conductor no cobra sin haber ido', () => {
  async function asignado() {
    const { m, cliente } = await escenario();
    const c = await conductor(m);
    const op = await operacion(m, cliente.id);
    await ofrecer(m, op, c);
    let n = 0;
    const paso = async (nombre: string, cuerpo: unknown = {}) => {
      n++;
      const r = await m.crudo(`/datos/conductor/operaciones/${op}/${nombre}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${c.token}`,
          'content-type': 'application/json',
          'idempotency-key': `clave-${nombre}-${n}-xyz`,
        },
        body: JSON.stringify(cuerpo),
      });
      return r.status;
    };
    expect(await paso('aceptar')).toBe(200);
    return { m, c, op, paso };
  }

  it('«Llegué» exige estar cerca del punto de recogida con la ubicación reciente', async () => {
    const { m, c, paso } = await asignado();
    await q(m, 'UPDATE repartidores SET lat = 25.9, lng = -80.3 WHERE usuario_id = ?', c.id);
    expect(await paso('llegue')).toBe(409);
    await q(
      m,
      "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now', '-10 minutes') WHERE usuario_id = ?",
      PUNTO.lat,
      PUNTO.lng,
      c.id,
    );
    expect(await paso('llegue')).toBe(409);
    await q(m, "UPDATE repartidores SET ubicacion_en = datetime('now') WHERE usuario_id = ?", c.id);
    expect(await paso('llegue')).toBe(200);
  });

  it('«No se presentó» solo después de la espera gratis', async () => {
    const { m, op, paso } = await asignado();
    expect(await paso('llegue')).toBe(200);
    expect(await paso('no-se-presento')).toBe(409);
    await q(
      m,
      "UPDATE viajes SET llego_en = datetime('now', '-301 seconds') WHERE operacion_id = ?",
      op,
    );
    expect(await paso('no-se-presento')).toBe(200);
  });

  it('el código de inicio tiene tope de intentos, aunque después acierte', async () => {
    const { op, m, paso } = await asignado();
    expect(await paso('llegue')).toBe(200);
    for (let i = 0; i < 5; i++) expect(await paso('iniciar', { pin: '0000' })).toBe(409);
    expect(await paso('iniciar', { pin: '4321' })).toBe(429);
    expect(await uno(m, 'SELECT estado FROM viajes WHERE operacion_id = ?', op)).toMatchObject({
      estado: 'conductor_llego',
    });
  });
});

describe('Fase 3 · migración y vuelta atrás', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const publicar = async (m: Mundo) => {
    for (const sql of ESQUEMA_FASE3) await m.DB.prepare(sql).run();
  };

  it('con pedidos activos de antes, publicar deja el conteo exacto (y repetirlo no cambia nada)', async () => {
    const { m, cliente, rest } = await escenario();
    const a = await conductor(m, 'Conductor A');
    const b = await conductor(m, 'Conductor B');
    // La base «de antes»: sin la tabla ni los disparadores de la Fase 3.
    for (const t of [
      'pedidos_ocupa_conductor',
      'pedidos_libera_por_estado',
      'pedidos_libera_al_soltar',
      'pedidos_reactiva_ocupa',
      'pedidos_reasigna_ocupa',
      'repartidores_vehiculo_fijo_en_operacion',
    ])
      await m.DB.exec(`DROP TRIGGER IF EXISTS ${t}`);
    await m.DB.exec('DELETE FROM conductor_ocupacion');
    const p1 = await pedidoComida(m, cliente.id, rest);
    const p2 = await pedidoComida(m, cliente.id, rest);
    const p3 = await pedidoComida(m, cliente.id, rest);
    await q(m, 'UPDATE pedidos SET repartidor_id = ? WHERE id IN (?, ?)', a.id, p1, p2);
    await q(m, 'UPDATE pedidos SET repartidor_id = ? WHERE id = ?', b.id, p3);
    await llevarA(m.DB, p3, 'en_camino');
    expect((await inconsistencias(m)).length).toBeGreaterThan(0);
    for (let vez = 0; vez < 2; vez++) await publicar(m);
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', a.id),
    ).toEqual({ pedidos: 2 });
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', b.id),
    ).toEqual({ pedidos: 1 });
    expect(await inconsistencias(m)).toEqual([]);
  });

  it('la vuelta atrás quita los disparadores y Comida sigue funcionando', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    await m.DB.exec(readFileSync(join(raiz, 'docs', 'fase-3', 'revertir.sql'), 'utf8'));
    expect(await saludExclusividad(m.DB)).toBe('error'); // la salud avisa que faltan
    const quedan = await uno<{ n: number }>(
      m,
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${DISPARADORES_EXCLUSIVIDAD.map(() => '?').join(',')})`,
      ...DISPARADORES_EXCLUSIVIDAD,
    );
    expect(quedan?.n).toBe(0);
    const ped = await pedidoComida(m, cliente.id, rest);
    expect((await tomarComida(m, ped, c.id)).meta.changes).toBe(1);
    await llevarA(m.DB, ped, 'entregado');
  });
});

describe('Fase 3 · miles de acciones al azar', () => {
  it('2.000 acciones mezcladas de Comida y viajes: nunca dos cosas a la vez, cero inconsistencias', async () => {
    const { m, cliente, rest } = await escenario();
    const cs = await Promise.all(Array.from({ length: 5 }, (_, i) => conductor(m, `Azar ${i}`)));
    const ops = await Promise.all(Array.from({ length: 6 }, () => operacion(m, cliente.id)));
    const peds = await Promise.all(
      Array.from({ length: 8 }, () => pedidoComida(m, cliente.id, rest)),
    );
    let semilla = 7;
    const azar = (n: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla % n;
    };
    for (let i = 0; i < 2000; i++) {
      const c = cs[azar(cs.length)]!;
      const op = ops[azar(ops.length)]!;
      const ped = peds[azar(peds.length)]!;
      const k = `r${i}`;
      try {
        switch (azar(9)) {
          case 0:
            await ofrecer(m, op, c);
            await aceptarOperacion(m.DB, {
              operacionId: op,
              conductorId: c.id,
              vehiculoId: c.vehiculo,
              clave: k,
            });
            break;
          case 1:
            await liberarViaje(m.DB, { operacionId: op, conductorId: c.id, motivo: '', clave: k });
            break;
          case 2: {
            const v = await uno<{ estado: string }>(
              m,
              'SELECT estado FROM viajes WHERE operacion_id = ?',
              op,
            );
            const sig: Record<string, string> = {
              asignado: 'conductor_llego',
              conductor_llego: 'en_curso',
              en_curso: 'terminado',
            };
            if (v && sig[v.estado])
              await cambiarEstadoViaje(m.DB, {
                operacionId: op,
                desde: v.estado,
                hacia: sig[v.estado]!,
                actor: 'conductor',
                actorId: null,
                clave: k,
              });
            break;
          }
          case 3: {
            const n = await uno<{ n: number }>(
              m,
              "SELECT COUNT(*) AS n FROM pedidos WHERE repartidor_id = ? AND estado IN ('aceptado','listo','en_camino')",
              c.id,
            );
            await tomarComida(m, ped, c.id, Number(n?.n ?? 0));
            break;
          }
          case 4: {
            const p = await uno<{ repartidor_id: string | null }>(
              m,
              'SELECT repartidor_id FROM pedidos WHERE id = ?',
              ped,
            );
            if (p?.repartidor_id) await soltarPedido(m.DB, ped, p.repartidor_id);
            break;
          }
          case 5:
            await q(
              m,
              "UPDATE pedidos SET estado = 'entregado' WHERE id = ? AND estado IN ('aceptado','listo','en_camino') AND repartidor_id IS NOT NULL",
              ped,
            );
            break;
          case 6:
            await q(
              m,
              "UPDATE pedidos SET estado = 'aceptado', repartidor_id = NULL WHERE id = ? AND estado IN ('entregado','cancelado')",
              ped,
            );
            break;
          case 7: {
            const v = await uno<{ estado: string }>(
              m,
              'SELECT estado FROM viajes WHERE operacion_id = ?',
              op,
            );
            if (v && ['buscando', 'asignado', 'conductor_llego'].includes(v.estado))
              await cambiarEstadoViaje(m.DB, {
                operacionId: op,
                desde: v.estado,
                hacia: 'cancelado',
                actor: 'soporte',
                actorId: null,
                clave: k,
              });
            break;
          }
          default: {
            // Vuelve a abrir un viaje terminado o cancelado como uno nuevo (para seguir jugando).
            const nueva = await operacion(m, cliente.id);
            ops[azar(ops.length)] = nueva;
          }
        }
      } catch (e) {
        // Lo único que puede fallar es lo que la base rechaza a propósito.
        expect(String(e)).toMatch(
          /conductor_ocupado|conductor_ocupacion|operaciones_una_activa|transicion|clave/,
        );
      }
      if (i % 100 === 0) expect(await inconsistencias(m)).toEqual([]);
    }
    expect(await inconsistencias(m)).toEqual([]);
    const dobles = await uno<{ n: number }>(
      m,
      "SELECT COUNT(*) AS n FROM conductor_ocupacion c WHERE c.tipo = 'operacion' AND EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = c.conductor_id AND p.estado IN ('aceptado','listo','en_camino'))",
    );
    expect(dobles?.n).toBe(0);
  });
});

describe('Fase 3 · el esquema se publica entero', () => {
  it('el bloque de la Fase 3 en schema.sql solo trae tablas, índices y datos (ni disparadores ni vistas)', () => {
    const s = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
    const bloque = s.slice(s.indexOf('-- FASE 3 · EXCLUSIVIDAD'));
    const sinComentarios = bloque
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(sinComentarios).not.toMatch(/CREATE\s+(TRIGGER|VIEW)|\bBEGIN\b|\bCASE\b/i);
  });

  it('el servidor crea los disparadores y la salud los cuenta', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    expect(await saludExclusividad(m.DB)).toBe('ok');
    const n = await uno<{ n: number }>(
      m,
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${DISPARADORES_EXCLUSIVIDAD.map(() => '?').join(',')})`,
      ...DISPARADORES_EXCLUSIVIDAD,
    );
    expect(n?.n).toBe(DISPARADORES_EXCLUSIVIDAD.length);
  });
});

describe('Fase 3 · límites de D1', () => {
  it('ninguna sentencia de la Fase 3 une más de 5 consultas (D1 rechaza más)', () => {
    for (const sql of ESQUEMA_FASE3) {
      const partes = sql.split(/\bUNION\s+ALL\b|\bUNION\b/i).length;
      expect(partes, sql.slice(0, 60)).toBeLessThanOrEqual(5);
    }
  });
});

describe('Fase 3 · pedidos que nacen con repartidor o se borran', () => {
  it('cuentan al crearse y liberan al borrarse (soporte y pruebas)', async () => {
    const { m, cliente, rest } = await escenario();
    const c = await conductor(m);
    const p = id('ped');
    await q(
      m,
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
       VALUES (?, ?, ?, ?, 'en_camino', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Prueba')`,
      p,
      cliente.id,
      rest,
      c.id,
    );
    expect(
      await uno(m, 'SELECT pedidos FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toEqual({ pedidos: 1 });
    expect(await inconsistencias(m)).toEqual([]);
    await q(m, 'DELETE FROM pedidos WHERE id = ?', p);
    expect(
      await uno(m, 'SELECT 1 FROM conductor_ocupacion WHERE conductor_id = ?', c.id),
    ).toBeNull();
    expect(await inconsistencias(m)).toEqual([]);
  });
});

describe('Fase 3 · arranque rápido', () => {
  it('si los disparadores ya existen, el arranque no vuelve a crearlos (una sola consulta)', async () => {
    const m = mundo();
    await m.cuenta('cliente'); // primer arranque: los crea
    const creados: string[] = [];
    const original = m.DB.prepare.bind(m.DB);
    (m.DB as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
      if (/^\s*CREATE (TRIGGER|VIEW)/.test(sql)) creados.push(sql.slice(0, 40));
      return original(sql);
    };
    reiniciarEsquema();
    await asegurarEsquema(m.DB);
    expect(creados).toEqual([]);
    expect(await saludExclusividad(m.DB)).toBe('ok');
  });
});
