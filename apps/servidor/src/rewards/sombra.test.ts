import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HITOS_FASE2 } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import {
  type EnvRewards,
  borrarRewardsDe,
  calcularYGuardar,
  correrSombra,
  modoRewards,
  registrarHito,
} from './sombra';

/**
 * C-REWARDS-SOMBRA (30 oct 2026): Divoox Rewards · Fase 2 en modo sombra. Calcula y guarda la
 * reputación sin tocar el despacho, los puntos, el destacado, la billetera ni el prepago, y sin pagar.
 */
const PRUEBAS = { ENTORNO_RELOJ: 'pruebas' } as EnvRewards;

type M = ReturnType<typeof mundo>;
/** Datos sintéticos sin armar toda la cadena de claves (restaurantes, empresas, vehículos). */
function mundoSombra() {
  const m = mundo();
  m.DB.prepare('PRAGMA foreign_keys = OFF').run();
  return m;
}
let n = 0;
const sql = (m: M, q: string, ...v: unknown[]) =>
  m.DB.prepare(q)
    .bind(...v)
    .run();

async function pedidoEntregado(
  m: M,
  rep: string,
  o: { cliente?: string; estrellas?: number; tarde?: boolean; dia?: number } = {},
) {
  const id = `p${n++}`;
  const dia = String(1 + ((o.dia ?? n) % 28)).padStart(2, '0');
  await sql(
    m,
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, tiempo_prep_min, distancia_km, aceptado_en, entregado_en, pagado_en)
     VALUES (?, ?, 'r1', ?, 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', 'D', 25.78, -80.2, 15, 3, ?, ?, ?)`,
    id,
    o.cliente ?? `c${n % 70}`,
    rep,
    `2026-10-${dia} 10:00:00`,
    o.tarde ? `2026-10-${dia} 12:00:00` : `2026-10-${dia} 10:25:00`,
    `2026-10-${dia} 09:59:00`,
  );
  if (o.estrellas)
    await sql(
      m,
      'INSERT INTO calificaciones (pedido_id, estrellas_repartidor, culpa_restaurante) VALUES (?, ?, 0)',
      id,
      o.estrellas,
    );
  await sql(
    m,
    "INSERT INTO ofertas (pedido_id, repartidor_id, estado, creada_en) VALUES (?, ?, 'aceptada', ?)",
    id,
    rep,
    `2026-10-${dia} 09:58:00`,
  );
  return id;
}

async function viaje(
  m: M,
  rep: string,
  estado: 'terminado' | 'cancelado',
  actor = 'conductor',
  estrellas?: number,
) {
  const id = `o${n++}`;
  await sql(
    m,
    `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id, estado_general, actualizado_en)
     VALUES (?, 'moto', 'viaje_pasajero', ?, ?, 'v1', 'US-FL-MIAMI', ?, '2026-10-20 10:00:00')`,
    id,
    `cl${n % 40}`,
    rep,
    estado === 'terminado' ? 'terminada' : 'cancelada',
  );
  await sql(
    m,
    `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida, distancia_m_real, terminado_en)
     VALUES (?, ?, ?, 'k', 25.7, -80.2, 'A', 25.8, -80.1, 'B', '1234', 4200, '2026-10-20 10:30:00')`,
    id,
    estado,
    actor,
  );
  if (estrellas)
    await sql(
      m,
      "INSERT INTO calificaciones_viaje (operacion_id, de, autor_id, estrellas) VALUES (?, 'pasajero', 'x', ?)",
      id,
      estrellas,
    );
  await sql(
    m,
    "INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en, creada_en) VALUES (?, ?, 'v1', 'aceptada', '2026-10-20 10:01:00', '2026-10-20 09:59:00')",
    id,
    rep,
  );
}

/** Una ruta Flex cerrada con `entregados` de `total`, `ausentes` con prueba y `danados`. */
async function ruta(
  m: M,
  rep: string,
  o: { total: number; entregados: number; ausentes?: number; danados?: number; dia: number },
) {
  const rid = `ruta${n++}`;
  const dia = String(o.dia).padStart(2, '0');
  await sql(
    m,
    `INSERT INTO rutas_flex (id, empresa_id, conductor_id, vehiculo_id, estado, modalidad, asignada_en, aceptada_en, cerrada_en)
     VALUES (?, 'e1', ?, 'v1', 'con_incidencias', 'oferta', ?, ?, ?)`,
    rid,
    rep,
    `2026-10-${dia} 08:00:00`,
    `2026-10-${dia} 08:01:00`,
    `2026-10-${dia} 18:00:00`,
  );
  for (let i = 0; i < o.total; i++) {
    const q = `${rid}-q${i}`;
    const estado = i < o.entregados ? 'entregado' : 'entrega_fallida';
    await sql(
      m,
      "INSERT INTO paquetes (id, envio_id, empresa_id, codigo_seguimiento, codigo_etiqueta, estado) VALUES (?, 'env', 'e1', ?, ?, ?)",
      q,
      `S-${q}`,
      `L-${q}`,
      estado,
    );
    await sql(
      m,
      "INSERT INTO ruta_paquetes (ruta_id, paquete_id, parada_id, empresa_id) VALUES (?, ?, 'pa', 'e1')",
      rid,
      q,
    );
    const ausente = i >= o.entregados && i < o.entregados + (o.ausentes ?? 0);
    if (ausente)
      await sql(
        m,
        `INSERT INTO flex_incidencias (id, empresa_id, ruta_id, paquete_id, conductor_id, motivo, prueba_id, proxima_accion, idempotencia)
         VALUES (?, 'e1', ?, ?, ?, 'ausente', 'prueba1', 'devolver', ?)`,
        `i-${q}`,
        rid,
        q,
        rep,
        `i-${q}`,
      );
  }
  for (let i = 0; i < (o.danados ?? 0); i++)
    await sql(
      m,
      `INSERT INTO flex_incidencias (id, empresa_id, ruta_id, paquete_id, conductor_id, motivo, proxima_accion, idempotencia)
       VALUES (?, 'e1', ?, ?, ?, 'danado', 'devolver', ?)`,
      `d-${rid}-${i}`,
      rid,
      `${rid}-q${i}`,
      rep,
      `d-${rid}-${i}`,
    );
  return rid;
}

/** Lo que el modo sombra NO debe tocar nunca. */
async function fotoOperativa(m: M) {
  const t = async (q: string) => JSON.stringify((await m.DB.prepare(q).all()).results);
  return {
    repartidores: await t(
      'SELECT usuario_id, puntos, destacado FROM repartidores ORDER BY usuario_id',
    ),
    movimientos: await t('SELECT * FROM movimientos ORDER BY id'),
    libro: await t('SELECT * FROM libro ORDER BY rowid'),
    ofertas: await t('SELECT * FROM ofertas ORDER BY pedido_id'),
    pedidos: await t('SELECT id, estado, repartidor_id FROM pedidos ORDER BY id'),
    rutas: await t('SELECT id, estado, conductor_id FROM rutas_flex ORDER BY id'),
  };
}

describe('C-REWARDS-SOMBRA: el interruptor', () => {
  it('solo corre en pruebas; en producción, en local o sin entorno, nunca', () => {
    expect(modoRewards({ ENTORNO_RELOJ: 'pruebas' } as EnvRewards)).toBe('sombra');
    expect(modoRewards({ ENTORNO_RELOJ: 'pruebas', REWARDS_MODO: 'apagado' } as EnvRewards)).toBe(
      'apagado',
    );
    expect(modoRewards({ ENTORNO_RELOJ: 'produccion', REWARDS_MODO: 'sombra' } as EnvRewards)).toBe(
      'apagado',
    );
    expect(modoRewards({ ENTORNO_RELOJ: 'local' } as EnvRewards)).toBe('apagado');
    expect(modoRewards({} as EnvRewards)).toBe('apagado');
  });

  it('en producción no escribe nada aunque REWARDS_MODO diga «sombra»', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    await pedidoEntregado(m, rep.id, { estrellas: 5 });
    const r = await correrSombra(
      { ENTORNO_RELOJ: 'produccion', REWARDS_MODO: 'sombra' } as EnvRewards,
      m.DB,
    );
    expect(r).toEqual({ modo: 'apagado', calculados: 0 });
    const filas = await m.DB.prepare('SELECT COUNT(*) AS n FROM reputacion_diaria').first<{
      n: number;
    }>();
    expect(filas?.n).toBe(0);
  });
});

describe('C-REWARDS-SOMBRA: ejemplos por servicio', () => {
  it('comida: 100 pedidos, 4 tarde, estrellas 5 y 4 → puntaje y nivel', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 100; i++)
      await pedidoEntregado(m, rep.id, { estrellas: i % 5 ? 5 : 4, tarde: i % 25 === 0, dia: i });
    const r = await calcularYGuardar(m.DB, rep.id, '2026-10-30');
    expect(r.reputacion.porServicio).toEqual({ comida: 100 });
    expect(r.reputacion.componentes.puntualidad.valor).toBe(0.96);
    expect(r.reputacion.componentes.satisfaccion.valor).toBeCloseTo(4.8, 2);
    expect(r.reputacion.provisional).toBe(false);
    expect(r.experiencia.comida).toBe(100);
    console.warn(
      'EJEMPLO comida',
      r.reputacion.puntaje,
      r.nivel.nivel,
      JSON.stringify(r.reputacion.componentes),
    );
  });

  it('express: 40 viajes terminados, 2 cancelados por el conductor y 3 por el cliente (estos no cuentan)', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 40; i++) await viaje(m, rep.id, 'terminado', 'conductor', 5);
    for (let i = 0; i < 2; i++) await viaje(m, rep.id, 'cancelado', 'conductor');
    for (let i = 0; i < 3; i++) await viaje(m, rep.id, 'cancelado', 'cliente');
    const r = await calcularYGuardar(m.DB, rep.id, '2026-10-30');
    // 40 / 42 = 95,2 %: las 3 del cliente no cuentan.
    expect(r.reputacion.componentes.finalizacion.valor).toBeCloseTo(0.9524, 3);
    expect(r.reputacion.porServicio).toEqual({ express: 45 });
    expect(r.reputacion.provisional).toBe(true);
    console.warn(
      'EJEMPLO express',
      r.reputacion.puntaje,
      r.nivel.nivel,
      JSON.stringify(r.reputacion.componentes),
    );
  });

  it('flex: una ruta de 30 con 2 ausentes con prueba y 1 falla propia pesa 10, no 30', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 90; i++) await pedidoEntregado(m, rep.id, { estrellas: 5, dia: i % 20 });
    await ruta(m, rep.id, { total: 30, entregados: 27, ausentes: 2, danados: 1, dia: 25 });
    const r = await calcularYGuardar(m.DB, rep.id, '2026-10-30');
    expect(r.reputacion.porServicio).toEqual({ flex: 10, comida: 90 });
    // (90·1 + 10·27/28) / 100
    expect(r.reputacion.componentes.finalizacion.valor).toBeCloseTo(0.9964, 3);
    expect(r.experiencia.flexPaquetes).toBe(27);
    console.warn(
      'EJEMPLO flex+comida',
      r.reputacion.puntaje,
      r.nivel.nivel,
      JSON.stringify(r.reputacion.componentes),
    );
  });

  it('flex: ruta con todo ausente y con prueba (denominador cero) no rompe ni castiga', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    await ruta(m, rep.id, { total: 6, entregados: 0, ausentes: 6, dia: 10 });
    const r = await calcularYGuardar(m.DB, rep.id, '2026-10-30');
    expect(r.reputacion.componentes.finalizacion.peso).toBe(0);
    expect(Number.isFinite(r.reputacion.puntaje)).toBe(true);
  });
});

describe('C-REWARDS-SOMBRA: no toca las operaciones', () => {
  it('después de correr, puntos, destacado, billetera, prepago, ofertas, pedidos y rutas quedan idénticos', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 120; i++) await pedidoEntregado(m, rep.id, { estrellas: 5, dia: i });
    await ruta(m, rep.id, { total: 12, entregados: 12, dia: 5 });
    const antes = await fotoOperativa(m);
    await sql(
      m,
      "INSERT INTO rewards_presupuesto (zona_id, mes, programa, tope_centavos) VALUES ('US-FL-MIAMI', '2026-10', 'primer-hito-2026', 60000)",
    );
    const r = await correrSombra(PRUEBAS, m.DB, new Date('2026-10-30T12:00:00Z'));
    expect(r.calculados).toBeGreaterThanOrEqual(1);
    expect(await fotoOperativa(m)).toEqual(antes);
    // Nada de dinero: ningún movimiento y ningún hito pagado.
    const pagados = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM rewards_hitos WHERE estado = 'pagado'",
    ).first<{ n: number }>();
    expect(pagados?.n).toBe(0);
  });

  it('una sola foto por repartidor y día aunque el reloj corra muchas veces', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    await pedidoEntregado(m, rep.id, { estrellas: 5 });
    const hoy = new Date('2026-10-30T12:00:00Z');
    await correrSombra(PRUEBAS, m.DB, hoy);
    const segunda = await correrSombra(PRUEBAS, m.DB, hoy);
    expect(segunda.calculados).toBe(0);
    const f = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM reputacion_diaria WHERE repartidor_id = ?',
    )
      .bind(rep.id)
      .first<{ n: number }>();
    expect(f?.n).toBe(1);
  });
});

// C-REWARDS-LIMPIEZA (30 oct 2026): el reloj guardó la foto de un repartidor de prueba sin entregas y
// esa fila impidió borrarlo (la limpieza de tiempo real del sitio de pruebas daba 500).
describe('C-REWARDS-LIMPIEZA: Rewards no traba el borrado de usuarios de prueba', () => {
  it('un repartidor sin ninguna entrega, viaje ni ruta no recibe foto diaria', async () => {
    const m = mundoSombra();
    const vacio = await m.cuenta('repartidor');
    const r = await correrSombra(PRUEBAS, m.DB, new Date('2026-10-30T12:00:00Z'));
    expect(r.calculados).toBe(0);
    const f = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM reputacion_diaria WHERE repartidor_id = ?',
    )
      .bind(vacio.id)
      .first<{ n: number }>();
    expect(f?.n).toBe(0);
  });

  it('borrarRewardsDe vacía las cinco tablas de Rewards de esos usuarios y no toca a los demás', async () => {
    const m = mundoSombra();
    const [a, b] = [await m.cuenta('repartidor'), await m.cuenta('repartidor')];
    for (const r of [a, b]) {
      await pedidoEntregado(m, r.id, { estrellas: 5 });
      await calcularYGuardar(m.DB, r.id, '2026-10-30');
      await registrarHito(m.DB, r.id, HITOS_FASE2[0]!, {
        unidades: 120,
        nivel: 'oro',
        zona: 'US-FL-MIAMI',
        mes: '2026-10',
      });
    }
    await m.DB.batch(borrarRewardsDe(m.DB, [a.id]));
    for (const t of ['reputacion_diaria', 'rewards_reservas', 'rewards_hitos', 'rewards_eventos']) {
      const cuenta = async (id: string) =>
        (
          await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE repartidor_id = ?`)
            .bind(id)
            .first<{ n: number }>()
        )?.n;
      expect(await cuenta(a.id), t).toBe(0);
      if (t === 'reputacion_diaria' || t === 'rewards_hitos')
        expect(await cuenta(b.id), t).toBeGreaterThan(0);
    }
  });

  it('toda limpieza de prueba borra lo de Rewards antes de borrar usuarios', () => {
    const fuente = readFileSync(join(__dirname, '..', 'rutas', 'diagnostico.ts'), 'utf8');
    const borrados = fuente.match(/DELETE FROM usuarios/g)?.length ?? 0;
    const limpiezas = fuente.match(/borrarRewardsDe\(db/g)?.length ?? 0;
    expect(borrados).toBeGreaterThan(0);
    expect(limpiezas).toBe(borrados);
  });
});

describe('C-REWARDS-SOMBRA: hitos sin pagos, idempotentes y con presupuesto', () => {
  const hito = HITOS_FASE2[0]!;
  const base = { unidades: 120, zona: 'US-FL-MIAMI', mes: '2026-10' };

  it('sin presupuesto reservado el hito queda «sin_presupuesto»: no es una obligación', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    expect(await registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'oro' })).toBe(
      'sin_presupuesto',
    );
    const res = await m.DB.prepare('SELECT COUNT(*) AS n FROM rewards_reservas').first<{
      n: number;
    }>();
    expect(res?.n).toBe(0);
  });

  it('diez llamadas a la vez: una fila, una reserva, un evento por cambio de estado', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    await sql(
      m,
      "INSERT INTO rewards_presupuesto (zona_id, mes, programa, tope_centavos) VALUES ('US-FL-MIAMI', '2026-10', ?, 60000)",
      hito.programa,
    );
    const r = await Promise.all(
      Array.from({ length: 10 }, () =>
        registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'oro' }),
      ),
    );
    expect(new Set(r)).toEqual(new Set(['ganado']));
    const cuenta = async (t: string) =>
      (await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())?.n;
    expect(await cuenta('rewards_hitos')).toBe(1);
    expect(await cuenta('rewards_reservas')).toBe(1);
    expect(await cuenta('rewards_eventos')).toBe(1);
  });

  it('el tope del mes no se pasa: con 30 USD de tope, el segundo repartidor queda sin presupuesto', async () => {
    const m = mundoSombra();
    const a = await m.cuenta('repartidor');
    const b = await m.cuenta('repartidor');
    await sql(
      m,
      "INSERT INTO rewards_presupuesto (zona_id, mes, programa, tope_centavos) VALUES ('US-FL-MIAMI', '2026-10', ?, 3000)",
      hito.programa,
    );
    const [ra, rb] = await Promise.all([
      registrarHito(m.DB, a.id, hito, { ...base, nivel: 'oro' }),
      registrarHito(m.DB, b.id, hito, { ...base, nivel: 'oro' }),
    ]);
    expect([ra, rb].sort()).toEqual(['ganado', 'sin_presupuesto']);
    const total = await m.DB.prepare(
      'SELECT SUM(monto_centavos) AS s FROM rewards_reservas',
    ).first<{ s: number }>();
    expect(total?.s).toBe(3000);
  });

  it('sin el nivel queda «condicionado» (no vence); al alcanzarlo pasa a «ganado»; nunca a «pagado»', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    await sql(
      m,
      "INSERT INTO rewards_presupuesto (zona_id, mes, programa, tope_centavos) VALUES ('US-FL-MIAMI', '2026-10', ?, 60000)",
      hito.programa,
    );
    expect(await registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'inicial' })).toBe(
      'condicionado',
    );
    expect(await registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'inicial' })).toBe(
      'condicionado',
    );
    expect(await registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'plata' })).toBe('ganado');
    expect(await registrarHito(m.DB, rep.id, hito, { ...base, nivel: 'inicial' })).toBe('ganado');
    const ev = await m.DB.prepare('SELECT de, a FROM rewards_eventos ORDER BY id').all();
    expect(ev.results).toEqual([
      { de: 'progreso', a: 'condicionado' },
      { de: 'condicionado', a: 'ganado' },
    ]);
  });

  it('con menos unidades que el hito no registra nada', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    expect(
      await registrarHito(m.DB, rep.id, hito, { ...base, unidades: 99, nivel: 'oro' }),
    ).toBeNull();
  });
});

describe('C-REWARDS-SOMBRA: reversión', () => {
  it('apagar el interruptor detiene todo; vaciar las tablas nuevas no cambia nada de lo operativo', async () => {
    const m = mundoSombra();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 10; i++) await pedidoEntregado(m, rep.id, { estrellas: 5, dia: i });
    await correrSombra(PRUEBAS, m.DB, new Date('2026-10-29T12:00:00Z'));
    // Primero lo que hace la app (crea la ficha del repartidor), después la foto de lo operativo.
    const estadoAntes = (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token))
      .datos;
    const antes = await fotoOperativa(m);
    // 1) Apagar: el día siguiente no se calcula.
    const r = await correrSombra(
      { ENTORNO_RELOJ: 'pruebas', REWARDS_MODO: 'apagado' } as EnvRewards,
      m.DB,
      new Date('2026-10-30T12:00:00Z'),
    );
    expect(r).toEqual({ modo: 'apagado', calculados: 0 });
    // 2) Vaciar las tablas nuevas: lo operativo sigue igual.
    for (const t of [
      'reputacion_diaria',
      'rewards_hitos',
      'rewards_reservas',
      'rewards_eventos',
      'rewards_presupuesto',
    ])
      await sql(m, `DELETE FROM ${t}`);
    expect(await fotoOperativa(m)).toEqual(antes);
    const estadoDespues = (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token))
      .datos;
    expect(estadoDespues.nivel).toEqual(estadoAntes.nivel);
    expect(estadoDespues.puntos).toEqual(estadoAntes.puntos);
  });
});

describe('C-REWARDS-SOMBRA: la lectura del equipo', () => {
  it('en producción la dirección no existe; en pruebas la ve solo un admin', async () => {
    const prod = mundo({}, { host: 'divoox.com' });
    const adminProd = await prod.cuenta('admin');
    const r1 = await prod.llamar(
      'GET',
      '/datos/admin/rewards/sombra/x',
      undefined,
      adminProd.token,
    );
    expect(r1.estado).toBe(404);
    const pruebas = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await pruebas.cuenta('admin');
    const rep = await pruebas.cuenta('repartidor');
    const r2 = await pruebas.llamar(
      'GET',
      `/datos/admin/rewards/sombra/${rep.id}`,
      undefined,
      admin.token,
    );
    expect(r2.estado).toBe(200);
    expect(r2.datos.modo).toBe('sombra');
    const r3 = await pruebas.llamar(
      'GET',
      `/datos/admin/rewards/sombra/${rep.id}`,
      undefined,
      rep.token,
    );
    expect(r3.estado).toBe(403);
  });
});

// C-REWARDS-PILOTO (30 oct 2026, R1): en producción el nivel de reputación se ve solo en el piloto.
describe('C-REWARDS-PILOTO: el repartidor del piloto ve su nivel de reputación', () => {
  it('fuera del piloto no aparece; dentro, con el modo piloto, ve nivel, puntaje y lo que le falta', async () => {
    const m = mundoSombra();
    const admin = await m.cuenta('admin');
    const rep = await m.cuenta('repartidor');
    await pedidoEntregado(m, rep.id, { estrellas: 5 });
    await calcularYGuardar(m.DB, rep.id, new Date().toISOString().slice(0, 10));
    const sin = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(sin.datos.reputacion).toBeUndefined();

    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(rep.id)
        .first<{ correo: string }>()
    )?.correo;
    await m.llamar('POST', '/datos/admin/piloto', { correo }, admin.token);
    const sinModo = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(sinModo.datos.reputacion).toBeUndefined();
  });

  it('con REWARDS_MODO=piloto y en la lista, el estado trae la reputación', async () => {
    const m = mundo({ REWARDS_MODO: 'piloto' });
    m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    const admin = await m.cuenta('admin');
    const rep = await m.cuenta('repartidor');
    await pedidoEntregado(m, rep.id, { estrellas: 5 });
    await calcularYGuardar(m.DB, rep.id, new Date().toISOString().slice(0, 10));
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(rep.id)
        .first<{ correo: string }>()
    )?.correo;
    await m.llamar('POST', '/datos/admin/piloto', { correo }, admin.token);
    const r = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(r.datos.reputacion).toMatchObject({
      nivel: expect.stringMatching(/inicial|plata|oro|diamante/),
      puntaje: expect.any(Number),
      provisional: true,
    });
  });

  it('en producción con el modo piloto, el reloj calcula solo a los participantes', async () => {
    const m = mundoSombra();
    const dentro = await m.cuenta('repartidor');
    const fuera = await m.cuenta('repartidor');
    await pedidoEntregado(m, dentro.id, { estrellas: 5 });
    await pedidoEntregado(m, fuera.id, { estrellas: 5 });
    await m.DB.prepare('INSERT INTO piloto_participantes (usuario_id) VALUES (?)')
      .bind(dentro.id)
      .run();
    const r = await correrSombra(
      { ENTORNO_RELOJ: 'produccion', REWARDS_MODO: 'piloto' } as EnvRewards,
      m.DB,
      new Date('2026-10-30T12:00:00Z'),
    );
    expect(r).toMatchObject({ modo: 'piloto', calculados: 1 });
  });
});
