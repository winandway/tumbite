import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { type Variables, base } from '../sesion';
import { crearStripe, type Stripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { conciliarRetiros, pedirRetiro, procesarRetiro, retirosActivos } from '../retiros';
import { conciliar } from '../conciliacion';
import { MIGRACIONES_FASE1 } from '../migraciones/fase1';
import { sentencias } from '../migraciones/sentencias';
import { aplicarLote } from './interno';
import { correrRelojUnaVez } from './operacion';
import { DISPARADORES_SERVICIOS, saludServicios } from './servicios';

/**
 * Diagnóstico del SITIO DE PRUEBAS (Fase 0, 15 oct 2026): las pruebas S2–S5, S7 y S11 de
 * ARQUITECTURA-MULTISERVICIO-V1.2 corren DENTRO del worker, contra la base D1 real de pruebas.
 * Doble cerrojo: (1) solo responde en el dominio de pruebas (o localhost en las pruebas
 * automáticas); en tumbite.com siempre es «No encontrado»; (2) exige el secreto del reloj, que
 * GitHub ya guarda como secreto (nadie lo ve ni lo comparte). S11 además exige llaves de Stripe
 * de MODO PRUEBA (sk_test_…): con llaves reales se niega.
 */
export const diagnostico = new Hono<{ Bindings: Env; Variables: Variables }>();

const HOSTS_PRUEBAS = new Set([
  'staging.tumbite.com',
  'tumbite-pruebas.sitios.dev',
  'localhost',
  '127.0.0.1',
]);
const TABLA_S5 = /^zz_s5_[a-z0-9]{8,24}$/;

async function iguales(a: string, b: string): Promise<boolean> {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return a.length === b.length && ha.every((v, i) => v === hb.at(i));
}

diagnostico.use('/interno/diagnostico/*', async (c, next) => {
  const host = new URL(c.req.url).hostname;
  const secreto = c.env.RELOJ_SECRETO;
  if (
    !HOSTS_PRUEBAS.has(host) ||
    !secreto ||
    !(await iguales(c.req.header('x-reloj-secreto') ?? '', secreto))
  )
    throw new ErrorDatos('No encontrado.', undefined, 404);
  await next();
});

type Caso = { nombre: string; ok: boolean; detalle?: string };
const sufijo = () =>
  nuevoId()
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12)
    .toLowerCase();
async function falla(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

/** S2 (Fase 0): los disparadores y las llaves foráneas de los retiros en el motor real. */
diagnostico.post('/interno/diagnostico/s2', async (c) => {
  const db = base(c);
  const u = `zz-s2-${sufijo()}`;
  const casos: Caso[] = [];
  const saldo = async () =>
    Number(
      (
        await db
          .prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ?')
          .bind(u)
          .first<{ s: number }>()
      )?.s ?? 0,
    );
  await db
    .prepare(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba S2', 'repartidor', 'x')",
    )
    .bind(u, `${u}@prueba.invalid`)
    .run();
  try {
    await db
      .prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES (?, ?, 1000, 'ajuste')",
      )
      .bind(`m-${u}`, u)
      .run();
    await db
      .prepare(
        "INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos) VALUES (?, ?, 'acct_prueba', 1000)",
      )
      .bind(`r-${u}`, u)
      .run();
    casos.push({
      nombre: 'pedir el retiro descuenta el saldo en la misma sentencia',
      ok: (await saldo()) === 0,
    });
    casos.push({
      nombre: 'RAISE(ABORT) bloquea una transición no permitida (pendiente → confirmado)',
      ok: await falla(
        db
          .prepare(
            "UPDATE retiros SET estado = 'confirmado', stripe_transferencia = 'tr_x' WHERE id = ?",
          )
          .bind(`r-${u}`)
          .run(),
      ),
    });
    await db.prepare("UPDATE retiros SET estado = 'enviando' WHERE id = ?").bind(`r-${u}`).run();
    await db.prepare("UPDATE retiros SET estado = 'fallido' WHERE id = ?").bind(`r-${u}`).run();
    casos.push({ nombre: 'un rechazo devuelve el saldo', ok: (await saldo()) === 1000 });
    casos.push({
      nombre: 'la devolución no se puede repetir (índice único)',
      ok: await falla(
        db
          .prepare(
            "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES (?, ?, 1000, 'ajuste', ?)",
          )
          .bind(`m2-${u}`, u, `retiro-revertido:r-${u}`)
          .run(),
      ),
    });
    casos.push({
      nombre: 'las llaves foráneas están activas',
      ok: await falla(
        db
          .prepare(
            "INSERT INTO retiros (id, usuario_id, stripe_cuenta, monto_centavos) VALUES (?, 'no-existe', 'acct', 100)",
          )
          .bind(`r2-${u}`)
          .run(),
      ),
    });
    const ca = await db
      .prepare('SELECT COUNT(*) AS n FROM retiros r1 JOIN retiros r2 ON r1.id = r2.id')
      .first<{ n: number }>();
    casos.push({
      nombre: 'UPDATE … RETURNING disponible',
      ok:
        Boolean(
          await db
            .prepare("UPDATE retiros SET ultimo_error = 'x' WHERE id = ? RETURNING id")
            .bind(`r-${u}`)
            .first(),
        ) && ca !== null,
    });
  } finally {
    await db.batch([
      db.prepare('DELETE FROM retiros WHERE usuario_id = ?').bind(u),
      db.prepare('DELETE FROM movimientos WHERE usuario_id = ?').bind(u),
      db.prepare('DELETE FROM usuarios WHERE id = ?').bind(u),
    ]);
  }
  return c.json({ prueba: 'S2', ok: casos.every((x) => x.ok), casos });
});

/** S3: UPDATE … FROM json_each con 10.000 muestras (lote de ubicaciones del diseño V1.2). */
diagnostico.post('/interno/diagnostico/s3', async (c) => {
  const db = base(c);
  const t = `zz_s3_${sufijo()}`;
  await db.prepare(`CREATE TABLE ${t} (id TEXT PRIMARY KEY, lat REAL, t TEXT)`).run();
  try {
    await db
      .prepare(
        `INSERT INTO ${t} WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 9999) SELECT 'c' || i, 0, '2026-01-01' FROM n`,
      )
      .run();
    const muestras = JSON.stringify(
      Array.from({ length: 10000 }, (_, i) => ({
        c: `c${i}`,
        lat: 25.7,
        t: '2026-10-15 10:00:00',
      })),
    );
    const t0 = Date.now();
    const res = await db
      .prepare(
        `UPDATE ${t} SET lat = m.lat, t = m.t FROM (SELECT json_extract(value, '$.c') AS c, json_extract(value, '$.lat') AS lat, json_extract(value, '$.t') AS t FROM json_each(?)) AS m WHERE ${t}.id = m.c AND m.t > ${t}.t`,
      )
      .bind(muestras)
      .run();
    const viajeMs = Date.now() - t0;
    const baseMs =
      Math.round(Number((res.meta as { duration?: number } | undefined)?.duration ?? 0) * 10) / 10;
    const n = await db
      .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE lat = 25.7`)
      .first<{ n: number }>();
    return c.json({
      prueba: 'S3',
      ok: n?.n === 10000 && baseMs < 100,
      filas: n?.n ?? 0,
      baseMs,
      viajeMs,
      criterio:
        'las 10.000 filas actualizadas y menos de 100 ms de ejecución en la base (el viaje se informa aparte)',
    });
  } finally {
    await db.prepare(`DROP TABLE ${t}`).run();
  }
});

/**
 * S4: tiempo de consultas típicas. Se separan DOS números: lo que tarda la base en ejecutar la
 * consulta (meta.duration que devuelve D1; el criterio de la V1.2, ≤ 2 ms) y el viaje completo
 * desde el worker (incluye la red hasta la base; se informa para la capacidad, no es criterio).
 */
diagnostico.post('/interno/diagnostico/s4', async (c) => {
  const db = base(c);
  const consultas: [string, string][] = [
    [
      'despacho',
      "SELECT id FROM pedidos WHERE estado IN ('aceptado','listo') AND repartidor_id IS NULL LIMIT 20",
    ],
    ['saldo', "SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = 'nadie'"],
    ['restaurantes', "SELECT id FROM restaurantes WHERE estado = 'aprobado' LIMIT 50"],
    ['retiros', "SELECT id FROM retiros WHERE estado IN ('pendiente','reintentar') LIMIT 20"],
  ];
  const mediana = (t: number[]) =>
    Math.round(([...t].sort((a, b) => a - b)[Math.floor(t.length / 2)] ?? 0) * 100) / 100;
  const maximo = (t: number[]) => Math.round(Math.max(...t) * 100) / 100;
  const r = new Map<
    string,
    { baseMediana: number; baseMax: number; viajeMediana: number; viajeMax: number }
  >();
  for (const [nombre, q] of consultas) {
    const enBase: number[] = [];
    const viaje: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const res = await db.prepare(q).all();
      viaje.push(performance.now() - t0);
      enBase.push(Number((res.meta as { duration?: number } | undefined)?.duration ?? 0));
    }
    r.set(nombre, {
      baseMediana: mediana(enBase),
      baseMax: maximo(enBase),
      viajeMediana: mediana(viaje),
      viajeMax: maximo(viaje),
    });
  }
  const peor = Math.max(...[...r.values()].map((x) => x.baseMediana));
  return c.json({
    prueba: 'S4',
    ok: peor <= 2,
    criterio:
      'ejecución en la base: mediana de 2 ms o menos (el viaje desde el worker se informa aparte)',
    tiempos: Object.fromEntries(r),
  });
});

/** S5: preparar → 50 aceptaciones simultáneas (desde afuera) → cerrar. Gana una sola. */
diagnostico.post('/interno/diagnostico/s5/preparar', async (c) => {
  const db = base(c);
  const tabla = `zz_s5_${sufijo()}`;
  await db.prepare(`CREATE TABLE ${tabla} (id INTEGER PRIMARY KEY, conductor TEXT)`).run();
  await db.prepare(`INSERT INTO ${tabla} (id) VALUES (1)`).run();
  return c.json({ tabla });
});
diagnostico.post('/interno/diagnostico/s5/aceptar', async (c) => {
  const { tabla, conductor } = await leerCuerpo(
    c,
    z.object({ tabla: z.string().regex(TABLA_S5), conductor: z.string().max(40) }),
  );
  const r = await base(c)
    .prepare(
      `UPDATE ${tabla} SET conductor = ? WHERE id = 1 AND conductor IS NULL RETURNING conductor`,
    )
    .bind(conductor)
    .first<{ conductor: string }>();
  return c.json({ gano: Boolean(r) });
});
diagnostico.post('/interno/diagnostico/s5/cerrar', async (c) => {
  const { tabla } = await leerCuerpo(c, z.object({ tabla: z.string().regex(TABLA_S5) }));
  const db = base(c);
  const f = await db
    .prepare(`SELECT conductor FROM ${tabla} WHERE id = 1`)
    .first<{ conductor: string | null }>();
  await db.prepare(`DROP TABLE ${tabla}`).run();
  return c.json({ prueba: 'S5', ganador: f?.conductor ?? null });
});

/** S7: un batch que falla a la mitad se deshace entero. */
diagnostico.post('/interno/diagnostico/s7', async (c) => {
  const db = base(c);
  const t = `zz_s7_${sufijo()}`;
  await db.prepare(`CREATE TABLE ${t} (id INTEGER PRIMARY KEY, v TEXT NOT NULL)`).run();
  let loteFallo = false;
  try {
    await db.batch([
      db.prepare(`INSERT INTO ${t} (id, v) VALUES (1, 'primera')`),
      db.prepare(`INSERT INTO ${t} (id, v) VALUES (1, 'repetida')`),
    ]);
  } catch {
    loteFallo = true;
  }
  const n = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>();
  await db.prepare(`DROP TABLE ${t}`).run();
  return c.json({
    prueba: 'S7',
    ok: loteFallo && n?.n === 0,
    loteFallo,
    filasQuedaron: n?.n ?? -1,
  });
});

/**
 * S11: retiro REAL en MODO PRUEBA de Stripe (sk_test_…). Con llaves reales se niega.
 * Fondea el saldo de prueba (pm_card_bypassPending), crea una cuenta conectada de prueba con los
 * datos de prueba oficiales de Stripe, y prueba: retiro normal; respuesta perdida a propósito
 * (Stripe transfiere y el servidor no recibe la respuesta); repetición con la misma clave; y bandera.
 */
diagnostico.post('/interno/diagnostico/s11', async (c) => {
  const llave = c.env.STRIPE_SECRET_KEY ?? '';
  if (!llave.startsWith('sk_test_'))
    return c.json({
      prueba: 'S11',
      ok: false,
      omitido: 'el sitio de pruebas no tiene llaves de Stripe de modo prueba',
    });
  const stripe = crearStripe(llave)!;
  const db = base(c);
  const corrida = sufijo();
  const u = `zz-s11-${corrida}`;
  const casos: Caso[] = [];
  try {
    await stripe.post(
      '/payment_intents',
      {
        amount: 5000,
        currency: 'usd',
        payment_method: 'pm_card_bypassPending',
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      },
      `s11-fondos-${corrida}`,
    );
    const a = await stripe.post<{ id: string }>(
      '/accounts',
      {
        country: 'US',
        email: `s11-${corrida}@prueba.invalid`,
        business_type: 'individual',
        controller: {
          stripe_dashboard: { type: 'none' },
          requirement_collection: 'application',
          fees: { payer: 'application' },
          losses: { payments: 'application' },
        },
        capabilities: { transfers: { requested: true } },
        business_profile: { mcc: '4215', url: 'https://tumbite.com' },
        individual: {
          first_name: 'Prueba',
          last_name: 'Tumbite',
          dob: { day: 1, month: 1, year: 1901 },
          id_number: '000000000',
          ssn_last_4: '0000',
          address: {
            line1: 'address_full_match',
            city: 'Miami',
            state: 'FL',
            postal_code: '33131',
          },
          phone: '0000000000',
          email: `s11-${corrida}@prueba.invalid`,
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: c.req.header('cf-connecting-ip') ?? '8.8.8.8',
        },
        external_account: {
          object: 'bank_account',
          country: 'US',
          currency: 'usd',
          routing_number: '110000000',
          account_number: '000123456789',
        },
      },
      `s11-cuenta-${corrida}`,
    );
    const cuenta = a.id;
    const estado = await stripe.get<{
      capabilities?: { transfers?: string };
      requirements?: { currently_due?: string[] };
    }>(`/accounts/${cuenta}`);
    casos.push({
      nombre: 'cuenta conectada de prueba con transferencias activas',
      ok: estado.capabilities?.transfers === 'active',
      detalle: JSON.stringify(estado.requirements?.currently_due ?? []),
    });
    if (estado.capabilities?.transfers !== 'active')
      return c.json({ prueba: 'S11', ok: false, casos, cuenta });

    await db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba S11', 'repartidor', 'x')",
      )
      .bind(u, `${u}@prueba.invalid`)
      .run();
    await db
      .prepare(
        'INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES (?, ?, 1)',
      )
      .bind(u, cuenta)
      .run();
    await db
      .prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES (?, ?, 1500, 'ajuste')",
      )
      .bind(`m-${u}`, u)
      .run();
    const contar = async (id: string) =>
      (
        await stripe.get<{ data?: { id: string }[] }>('/transfers', {
          transfer_group: `retiro:${id}`,
          limit: 10,
        })
      ).data?.length ?? 0;

    // 1) normal
    const r1 = (await pedirRetiro(db, u, cuenta, 500))!;
    casos.push({
      nombre: 'retiro normal confirmado con una transferencia',
      ok: (await procesarRetiro(db, stripe, r1)) === 'confirmado' && (await contar(r1)) === 1,
    });
    // 2) respuesta perdida a propósito
    let perder = true;
    const conCorte: Stripe = {
      get: stripe.get,
      post: async <T>(ruta: string, datos: Parameters<Stripe['post']>[1], clave?: string) => {
        const r = await stripe.post<T>(ruta, datos, clave);
        if (ruta === '/transfers' && perder) {
          perder = false;
          throw new TypeError('fetch failed (respuesta perdida a propósito)');
        }
        return r;
      },
    };
    const r2 = (await pedirRetiro(db, u, cuenta, 500))!;
    const res2 = await procesarRetiro(db, conCorte, r2);
    const s2 = await db
      .prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ?')
      .bind(u)
      .first<{ s: number }>();
    casos.push({
      nombre:
        'respuesta perdida: se verifica en Stripe, se confirma, una sola transferencia, el saldo NO vuelve',
      ok: res2 === 'confirmado' && (await contar(r2)) === 1 && Number(s2?.s) === 500,
    });
    // 3) repetir con la misma clave: Stripe devuelve la misma transferencia
    const t1 = await db
      .prepare('SELECT stripe_transferencia AS t FROM retiros WHERE id = ?')
      .bind(r1)
      .first<{ t: string }>();
    const rep = await stripe.post<{ id: string }>(
      '/transfers',
      {
        amount: 500,
        currency: 'usd',
        destination: cuenta,
        transfer_group: `retiro:${r1}`,
        metadata: { retiro_id: r1, usuario_id: u },
      },
      `retiro:${r1}`,
    );
    casos.push({
      nombre: 'repetir con la misma clave devuelve la misma transferencia (idempotencia real)',
      ok: rep.id === t1?.t && (await contar(r1)) === 1,
    });
    // 3b) dos procesos a la vez sobre el mismo retiro: una sola transferencia
    const r3 = (await pedirRetiro(db, u, cuenta, 300))!;
    const [p1, p2] = await Promise.all([
      procesarRetiro(db, stripe, r3),
      procesarRetiro(db, stripe, r3),
    ]);
    casos.push({
      nombre: 'dos procesos a la vez sobre el mismo retiro: una sola transferencia',
      ok: [p1, p2].includes('confirmado') && (await contar(r3)) === 1,
      detalle: `${p1}/${p2}`,
    });
    // 4) bandera
    const antes = await db
      .prepare("SELECT valor FROM config WHERE clave = 'retiros_activos'")
      .first<{ valor: string }>();
    await db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('retiros_activos', '0') ON CONFLICT(clave) DO UPDATE SET valor = '0'",
      )
      .run();
    casos.push({
      nombre: 'con la bandera apagada no se puede retirar',
      ok: !(await retirosActivos(c.env, db)),
    });
    if (antes)
      await db
        .prepare("UPDATE config SET valor = ? WHERE clave = 'retiros_activos'")
        .bind(antes.valor)
        .run();
    else await db.prepare("DELETE FROM config WHERE clave = 'retiros_activos'").run();
    return c.json({
      prueba: 'S11',
      ok: casos.length > 0 && casos.every((x) => x.ok),
      casos,
      cuenta,
    });
  } finally {
    await db.batch([
      db.prepare('DELETE FROM retiros WHERE usuario_id = ?').bind(u),
      db.prepare('DELETE FROM movimientos WHERE usuario_id = ?').bind(u),
      db.prepare('DELETE FROM cuentas_stripe WHERE usuario_id = ?').bind(u),
      db.prepare('DELETE FROM usuarios WHERE id = ?').bind(u),
    ]);
  }
});

// =====================================================================================
// Validación en staging de las fases 1 y 2 (15 oct 2026). Mismo doble cerrojo de arriba.
// Todo lo que crean estas pruebas lleva «zz» y se borra al terminar.
// =====================================================================================

/** F1: disparadores del catálogo, vehículos, habilitaciones e identidad, en la base real. */
diagnostico.post('/interno/diagnostico/f1', async (c) => {
  const db = base(c);
  const z1 = `zz-f1a-${sufijo()}`;
  const z2 = `zz-f1b-${sufijo()}`;
  const zona = `ZZ-DIAG-${sufijo().toUpperCase().slice(0, 8)}`;
  const casos: Caso[] = [];
  const fallaCon = async (p: Promise<unknown>, motivo: string) => {
    try {
      await p;
      return false;
    } catch (e) {
      return String(e instanceof Error ? e.message : e).includes(motivo);
    }
  };
  const disparadores = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (${[...DISPARADORES_SERVICIOS, 'cumplimientos_identidad_exige_kyc', 'cumplimientos_identidad_exige_kyc_cambio', 'zonas_catalogo_alta', 'zonas_catalogo_activa', 'vehiculos_historial', 'vehiculo_documentos_reemplaza', 'habilitaciones_historial_alta', 'habilitaciones_historial_cambio'].map(() => '?').join(',')})`,
    )
    .bind(
      ...DISPARADORES_SERVICIOS,
      'cumplimientos_identidad_exige_kyc',
      'cumplimientos_identidad_exige_kyc_cambio',
      'zonas_catalogo_alta',
      'zonas_catalogo_activa',
      'vehiculos_historial',
      'vehiculo_documentos_reemplaza',
      'habilitaciones_historial_alta',
      'habilitaciones_historial_cambio',
    )
    .first<{ n: number }>();
  casos.push({
    nombre: 'los 17 disparadores de las fases 1 y 2 existen en la base real',
    ok: Number(disparadores?.n) === DISPARADORES_SERVICIOS.length + 8,
    detalle: String(disparadores?.n),
  });
  const impl = await db
    .prepare('SELECT servicio_id FROM servicios_implementados ORDER BY servicio_id')
    .all<{ servicio_id: string }>();
  casos.push({
    nombre: 'solo Comida está implementada',
    ok: impl.results.map((r) => r.servicio_id).join(',') === 'comida',
  });
  casos.push({ nombre: 'la salud del catálogo dice ok', ok: (await saludServicios(db)) === 'ok' });
  for (const id of ['moto', 'carro'])
    casos.push({
      nombre: `la base no deja encender ${id} (ni en una ciudad)`,
      ok:
        (await fallaCon(
          db.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = ?").bind(id).run(),
          'servicio_no_implementado',
        )) &&
        (await fallaCon(
          db
            .prepare("UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = ?")
            .bind(id)
            .run(),
          'servicio_no_implementado',
        )),
    });
  const estadoMoto = await db
    .prepare("SELECT estado FROM servicios WHERE id = 'moto'")
    .first<{ estado: string }>();
  casos.push({ nombre: 'Moto sigue «próximamente»', ok: estadoMoto?.estado === 'proximamente' });
  await db.batch([
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba F1', 'repartidor', 'x')",
      )
      .bind(z1, `${z1}@prueba.invalid`),
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba F1', 'repartidor', 'x')",
      )
      .bind(z2, `${z2}@prueba.invalid`),
  ]);
  try {
    casos.push({
      nombre: 'habilitar Moto sin requisitos: la base lo rechaza',
      ok: await fallaCon(
        db
          .prepare(
            "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por) VALUES (?, 'moto', 'aprobada', ?)",
          )
          .bind(z1, z1)
          .run(),
        'habilitacion_con_requisitos_faltantes',
      ),
    });
    casos.push({
      nombre: 'identidad sin verificación real: la base lo rechaza',
      ok:
        (await fallaCon(
          db
            .prepare(
              "INSERT INTO cumplimientos (conductor_id, requisito, estado, fuente) VALUES (?, 'identidad', 'aprobado', 'kyc')",
            )
            .bind(z1)
            .run(),
          'identidad_sin_verificacion',
        )) &&
        (await fallaCon(
          db
            .prepare(
              "INSERT INTO cumplimientos (conductor_id, requisito, estado, fuente) VALUES (?, 'identidad', 'aprobado', 'sistema')",
            )
            .bind(z1)
            .run(),
          'identidad_sin_verificacion',
        )),
    });
    await db
      .prepare(
        "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, motivo) VALUES (?, 'comida', 'aprobada', 'diagnóstico')",
      )
      .bind(z1)
      .run();
    const hist = await db
      .prepare('SELECT COUNT(*) AS n FROM habilitaciones_historial WHERE conductor_id = ?')
      .bind(z1)
      .first<{ n: number }>();
    casos.push({ nombre: 'habilitar Comida funciona y deja historial', ok: Number(hist?.n) === 1 });
    await db
      .prepare(
        "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado) VALUES (?, ?, 'carro', 'ZZ1234', 'FL')",
      )
      .bind(`${z1}-v`, z1)
      .run();
    casos.push({
      nombre: 'una placa no vive en dos cuentas',
      ok: await fallaCon(
        db
          .prepare(
            "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado) VALUES (?, ?, 'carro', 'zz1234', 'FL')",
          )
          .bind(`${z2}-v`, z2)
          .run(),
        'UNIQUE',
      ),
    });
    casos.push({
      nombre: 'un vehículo no salta de registrado a aprobado',
      ok: await fallaCon(
        db.prepare("UPDATE vehiculos SET estado = 'aprobado' WHERE id = ?").bind(`${z1}-v`).run(),
        'vehiculo_transicion_invalida',
      ),
    });
    await db
      .prepare("UPDATE vehiculos SET estado = 'en_revision' WHERE id = ?")
      .bind(`${z1}-v`)
      .run();
    casos.push({
      nombre: 'un carro no se aprueba sin registro y seguro aprobados',
      ok: await fallaCon(
        db.prepare("UPDATE vehiculos SET estado = 'aprobado' WHERE id = ?").bind(`${z1}-v`).run(),
        'vehiculo_sin_documentos_aprobados',
      ),
    });
    await db
      .prepare(
        "INSERT INTO zonas (id, nombre, pais, lat, lng, activa) VALUES (?, 'Diagnóstico', 'US', 0, 0, 0)",
      )
      .bind(zona)
      .run();
    const antes = await db
      .prepare("SELECT estado FROM servicios_zona WHERE servicio_id = 'comida' AND zona_id = ?")
      .bind(zona)
      .first<{ estado: string }>();
    await db.prepare('UPDATE zonas SET activa = 1 WHERE id = ?').bind(zona).run();
    const despues = await db
      .prepare(
        'SELECT servicio_id, estado FROM servicios_zona WHERE zona_id = ? ORDER BY servicio_id',
      )
      .bind(zona)
      .all<{ servicio_id: string; estado: string }>();
    casos.push({
      nombre: 'una ciudad nueva nace con el catálogo y al prenderla abre solo Comida',
      ok:
        antes?.estado === 'proximamente' &&
        despues.results.length >= 6 &&
        despues.results.every(
          (r) => r.estado === (r.servicio_id === 'comida' ? 'disponible' : 'proximamente'),
        ),
    });
  } finally {
    await db.batch([
      db.prepare('DELETE FROM servicios_zona WHERE zona_id = ?').bind(zona),
      db.prepare('DELETE FROM zonas WHERE id = ?').bind(zona),
      db
        .prepare('DELETE FROM vehiculo_revisiones WHERE vehiculo_id IN (?, ?)')
        .bind(`${z1}-v`, `${z2}-v`),
      db.prepare('DELETE FROM vehiculos WHERE conductor_id IN (?, ?)').bind(z1, z2),
      db.prepare('DELETE FROM habilitaciones_historial WHERE conductor_id IN (?, ?)').bind(z1, z2),
      db.prepare('DELETE FROM habilitaciones WHERE conductor_id IN (?, ?)').bind(z1, z2),
      db.prepare('DELETE FROM cumplimientos WHERE conductor_id IN (?, ?)').bind(z1, z2),
      db.prepare('DELETE FROM usuarios WHERE id IN (?, ?)').bind(z1, z2),
    ]);
  }
  return c.json({ prueba: 'F1', ok: casos.every((x) => x.ok), casos });
});

/** Migraciones preparadas de la Fase 1, SOLO sobre la base del sitio de pruebas. */
diagnostico.post('/interno/diagnostico/migraciones', async (c) => {
  const { paso } = await leerCuerpo(c, z.object({ paso: z.enum(['verificar', 'm4', 'm5']) }));
  const db = base(c);
  const archivos = new Map<string, string>([
    ['verificar', MIGRACIONES_FASE1.verificar],
    ['m4', MIGRACIONES_FASE1.m4],
    ['m5', MIGRACIONES_FASE1.m5],
  ]);
  const lista = sentencias(archivos.get(paso) ?? '');
  if (paso === 'verificar') {
    const resultados = [];
    for (const s of lista) resultados.push((await db.prepare(s).all()).results);
    return c.json({ paso, resultados });
  }
  const cambios = [];
  for (const s of lista) cambios.push(Number((await db.prepare(s).run()).meta.changes ?? 0));
  return c.json({ paso, cambios });
});

/** F2: lote de ubicaciones y candado del reloj por minuto, contra la base real. */
diagnostico.post('/interno/diagnostico/f2', async (c) => {
  const db = base(c);
  const libre = `zz-f2a-${sufijo()}`;
  const ocupado = `zz-f2b-${sufijo()}`;
  const casos: Caso[] = [];
  const ahora = Date.now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba F2', 'repartidor', 'x')",
      )
      .bind(libre, `${libre}@prueba.invalid`),
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba F2', 'repartidor', 'x')",
      )
      .bind(ocupado, `${ocupado}@prueba.invalid`),
    db
      .prepare(
        "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, 25.7, -80.2, datetime('now', '-1 minute'), 'US-FL-MIAMI')",
      )
      .bind(libre),
    db
      .prepare(
        "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, 25.7, -80.2, datetime('now', '-1 minute'), 'US-FL-MIAMI')",
      )
      .bind(ocupado),
  ]);
  // «Ocupado» con un pedido en curso sintético (sin dinero: no hay cobro ni movimientos).
  // Restaurante y dueño temporales (el sitio de pruebas puede no tener ninguno).
  const dueno = `zz-f2d-${sufijo()}`;
  const rest = { id: `zz-f2r-${sufijo()}` };
  await db.batch([
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba F2', 'restaurante', 'x')",
      )
      .bind(dueno, `${dueno}@prueba.invalid`),
    db
      .prepare(
        "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES (?, ?, 'Prueba F2', 'pendiente')",
      )
      .bind(rest.id, dueno),
  ]);
  const pedido = `zz-f2p-${sufijo()}`;
  const loteId = `zz-lote-${sufijo()}`;
  try {
    await db
      .prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno,
             propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
           VALUES (?, ?, ?, ?, 'en_camino', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Diagnóstico')`,
      )
      .bind(pedido, libre, rest.id, ocupado)
      .run();
    const dineroAntes = await db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM movimientos')
      .first<{ n: number; s: number }>();
    const muestras = [libre, ocupado].map((id) => ({ c: id, lat: 25.81, lng: -80.13, t: ahora }));
    const r1 = await aplicarLote(db, { loteId, zona: 'US-FL-MIAMI', muestras });
    const r2 = await aplicarLote(db, { loteId, zona: 'US-FL-MIAMI', muestras });
    const vieja = await aplicarLote(db, {
      loteId: `${loteId}-v`,
      zona: 'US-FL-MIAMI',
      muestras: [{ c: libre, lat: 10, lng: -80, t: ahora - 30_000 }],
    });
    const pos = await db
      .prepare('SELECT usuario_id, lat, geohash FROM repartidores WHERE usuario_id IN (?, ?)')
      .bind(libre, ocupado)
      .all<{ usuario_id: string; lat: number; geohash: string | null }>();
    const p = new Map(pos.results.map((x) => [x.usuario_id, x]));
    casos.push({
      nombre: 'el lote mueve al repartidor libre (con su celda del mapa)',
      ok: r1.loteNuevo && p.get(libre)?.lat === 25.81 && Boolean(p.get(libre)?.geohash),
    });
    casos.push({
      nombre: 'no mueve al repartidor con un pedido en curso',
      ok: !rest || p.get(ocupado)?.lat === 25.7,
      detalle: rest ? '' : 'sin restaurantes en pruebas: no se pudo armar el pedido',
    });
    casos.push({
      nombre: 'el mismo lote otra vez no cambia nada',
      ok: !r2.loteNuevo && r2.aplicadas === 0,
    });
    casos.push({ nombre: 'una muestra más vieja no hace retroceder', ok: vieja.aplicadas === 0 });
    const dineroDespues = await db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM movimientos')
      .first<{ n: number; s: number }>();
    casos.push({
      nombre: 'el dinero no se movió',
      ok: dineroAntes?.n === dineroDespues?.n && dineroAntes?.s === dineroDespues?.s,
    });
    // Candado del reloj: dos llamadas a la vez con la misma ventana corren las tareas UNA vez.
    const ventana = `diag-${sufijo()}`;
    const [a, b] = await Promise.all([
      correrRelojUnaVez(c.env, db, ventana, 'github'),
      correrRelojUnaVez(c.env, db, ventana, 'externo'),
    ]);
    const yaHecho = [a, b].filter((x) => 'yaHecho' in x).length;
    const filas = await db
      .prepare('SELECT COUNT(*) AS n FROM tareas_programadas WHERE clave = ?')
      .bind(`reloj:${ventana}`)
      .first<{ n: number }>();
    casos.push({
      nombre: 'el reloj actual y el nuevo en el mismo minuto corren las tareas una sola vez',
      ok: yaHecho === 1 && Number(filas?.n) === 1,
    });
    await db
      .prepare('DELETE FROM tareas_programadas WHERE clave = ?')
      .bind(`reloj:${ventana}`)
      .run();
  } finally {
    await db.batch([
      db.prepare('DELETE FROM pedidos WHERE id = ?').bind(pedido),
      db.prepare('DELETE FROM restaurantes WHERE id = ?').bind(rest.id),
      db.prepare('DELETE FROM lotes_ubicacion WHERE lote_id IN (?, ?)').bind(loteId, `${loteId}-v`),
      db.prepare('DELETE FROM repartidores WHERE usuario_id IN (?, ?)').bind(libre, ocupado),
      db.prepare('DELETE FROM usuarios WHERE id IN (?, ?, ?)').bind(libre, ocupado, dueno),
    ]);
  }
  return c.json({ prueba: 'F2', ok: casos.every((x) => x.ok), casos });
});

/**
 * M4 y M5 sobre repartidores TEMPORALES del sitio de pruebas (que no tiene repartidores reales):
 * carro con placa, bicicleta, moto sin placa, dos con la misma placa, uno con identidad verificada
 * de verdad y otro «aprobado» sin evidencia. Corre las migraciones dos veces y borra todo al final.
 */
diagnostico.post('/interno/diagnostico/migraciones-prueba', async (c) => {
  const db = base(c);
  const k = sufijo();
  const ids = ['carro', 'bici', 'moto', 'dupa', 'dupb', 'nada'].map((x) => `zz-mig-${x}-${k}`);
  const [carro, bici, moto, dupa, dupb] = ids as [string, string, string, string, string];
  const revisor = `zz-mig-admin-${k}`;
  const placaDup = `ZZD${k.slice(0, 5).toUpperCase()}`;
  const casos: Caso[] = [];
  await db.batch([
    ...ids.map((id) =>
      db
        .prepare(
          "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba M', 'repartidor', 'x')",
        )
        .bind(id, `${id}@prueba.invalid`),
    ),
    db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Soporte Prueba', 'admin', 'x')",
      )
      .bind(revisor, `${revisor}@prueba.invalid`),
    db
      .prepare(
        "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, 'carro', ?)",
      )
      .bind(carro, `ZZC${k.slice(0, 5).toUpperCase()}`),
    db
      .prepare(
        "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, 'bicicleta', '')",
      )
      .bind(bici),
    db
      .prepare(
        "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, 'moto', '')",
      )
      .bind(moto),
    db
      .prepare(
        "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, 'carro', ?)",
      )
      .bind(dupa, placaDup),
    db
      .prepare(
        "INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, 'moto', ?)",
      )
      .bind(dupb, placaDup.toLowerCase()),
    db
      .prepare(
        "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, revisado_en, revisado_por) VALUES (?, 'aprobado', 'kyc/d.jpg', 'kyc/s.jpg', datetime('now'), ?)",
      )
      .bind(carro, revisor),
    db.prepare("INSERT INTO kyc (usuario_id, estado) VALUES (?, 'aprobado')").bind(bici),
  ]);
  try {
    for (let vez = 0; vez < 2; vez++)
      for (const sql of [...sentencias(MIGRACIONES_FASE1.m4), ...sentencias(MIGRACIONES_FASE1.m5)])
        await db.prepare(sql).run();
    const marcas = ids.map(() => '?').join(',');
    const veh = await db
      .prepare(
        `SELECT conductor_id, estado FROM vehiculos WHERE origen = 'migracion' AND conductor_id IN (${marcas})`,
      )
      .bind(...ids)
      .all<{ conductor_id: string; estado: string }>();
    const v = new Map(veh.results.map((x) => [x.conductor_id, x.estado]));
    casos.push({
      nombre: 'M4 copia 3 vehículos y no copia las placas repetidas',
      ok: veh.results.length === 3 && !v.has(dupa) && !v.has(dupb),
    });
    casos.push({
      nombre: 'carro con placa y bicicleta quedan aprobados; moto sin placa, registrada',
      ok: v.get(carro) === 'aprobado' && v.get(bici) === 'aprobado' && v.get(moto) === 'registrado',
    });
    const hab = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM habilitaciones WHERE servicio_id = 'comida' AND estado = 'aprobada' AND conductor_id IN (${marcas})`,
      )
      .bind(...ids)
      .first<{ n: number }>();
    casos.push({
      nombre: 'M5 habilita Comida a los 6, sin duplicar al repetir',
      ok: Number(hab?.n) === 6,
    });
    const idt = await db
      .prepare(
        `SELECT conductor_id FROM cumplimientos WHERE requisito = 'identidad' AND conductor_id IN (${marcas})`,
      )
      .bind(...ids)
      .all<{ conductor_id: string }>();
    casos.push({
      nombre:
        'identidad solo para quien tiene verificación real (no para el «aprobado» sin evidencia)',
      ok: idt.results.length === 1 && idt.results[0]?.conductor_id === carro,
    });
    const act = await db
      .prepare('SELECT vehiculo_activo_id AS v FROM repartidores WHERE usuario_id = ?')
      .bind(carro)
      .first<{ v: string }>();
    casos.push({ nombre: 'el vehículo copiado queda como activo', ok: act?.v === `mig-${carro}` });
  } finally {
    const marcas = ids.map(() => '?').join(',');
    await db.batch([
      db
        .prepare(
          `UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id IN (${marcas})`,
        )
        .bind(...ids),
      db
        .prepare(
          `DELETE FROM vehiculo_revisiones WHERE vehiculo_id IN (SELECT id FROM vehiculos WHERE conductor_id IN (${marcas}))`,
        )
        .bind(...ids),
      db.prepare(`DELETE FROM vehiculos WHERE conductor_id IN (${marcas})`).bind(...ids),
      db
        .prepare(`DELETE FROM habilitaciones_historial WHERE conductor_id IN (${marcas})`)
        .bind(...ids),
      db.prepare(`DELETE FROM habilitaciones WHERE conductor_id IN (${marcas})`).bind(...ids),
      db
        .prepare(`DELETE FROM preferencias_servicio WHERE conductor_id IN (${marcas})`)
        .bind(...ids),
      db.prepare(`DELETE FROM cumplimientos WHERE conductor_id IN (${marcas})`).bind(...ids),
      db.prepare(`DELETE FROM kyc WHERE usuario_id IN (${marcas})`).bind(...ids),
      db.prepare(`DELETE FROM repartidor_datos WHERE usuario_id IN (${marcas})`).bind(...ids),
      db.prepare(`DELETE FROM repartidores WHERE usuario_id IN (${marcas})`).bind(...ids),
      db.prepare(`DELETE FROM usuarios WHERE id IN (${marcas}, ?)`).bind(...ids, revisor),
    ]);
  }
  return c.json({
    prueba: 'M4/M5 con repartidores temporales',
    ok: casos.every((x) => x.ok),
    casos,
  });
});

/**
 * Prueba EN VIVO del tiempo real (con los Workers desplegados para pruebas). Arma, solo en el
 * sitio de pruebas, dos repartidores y un cliente temporales con sesión de 30 minutos y un pedido
 * en curso sintético; «leer» devuelve posiciones y vueltas del reloj; «borrar» limpia todo.
 */
diagnostico.post('/interno/diagnostico/vivo', async (c) => {
  const { accion, k } = await leerCuerpo(
    c,
    z.object({
      accion: z.enum(['armar', 'leer', 'borrar']),
      k: z.string().regex(/^[a-z0-9]{6,24}$/),
    }),
  );
  const db = base(c);
  const ids = {
    repLibre: `zz-vivo-a-${k}`,
    repPedido: `zz-vivo-b-${k}`,
    cliente: `zz-vivo-c-${k}`,
    dueno: `zz-vivo-d-${k}`,
  };
  const rest = `zz-vivo-r-${k}`;
  const pedido = `zz-vivo-p-${k}`;
  if (accion === 'armar') {
    const tokens = new Map<string, string>();
    const sentenciasArmar = [];
    for (const [rol, id] of Object.entries(ids)) {
      const tipo = rol === 'cliente' ? 'cliente' : rol === 'dueno' ? 'restaurante' : 'repartidor';
      sentenciasArmar.push(
        db
          .prepare(
            "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, 'Prueba en vivo', ?, 'x')",
          )
          .bind(id, `${id}@prueba.invalid`, tipo),
      );
      if (tipo !== 'restaurante') {
        const token = nuevoToken();
        tokens.set(rol, token);
        sentenciasArmar.push(
          db
            .prepare(
              "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+30 minutes'))",
            )
            .bind(await sha256(token), id),
        );
      }
    }
    sentenciasArmar.push(
      db
        .prepare(
          "INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 1, 'US-FL-MIAMI'), (?, 1, 'US-FL-MIAMI')",
        )
        .bind(ids.repLibre, ids.repPedido),
      db
        .prepare(
          "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES (?, ?, 'Prueba en vivo', 'pendiente')",
        )
        .bind(rest, ids.dueno),
      db
        .prepare(
          `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno,
             propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
           VALUES (?, ?, ?, ?, 'en_camino', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Prueba en vivo')`,
        )
        .bind(pedido, ids.cliente, rest, ids.repPedido),
    );
    await db.batch(sentenciasArmar);
    return c.json({ ids, pedido, tokens: Object.fromEntries(tokens) });
  }
  if (accion === 'leer') {
    const pos = await db
      .prepare(
        'SELECT usuario_id, lat, lng, ubicacion_en FROM repartidores WHERE usuario_id IN (?, ?)',
      )
      .bind(ids.repLibre, ids.repPedido)
      .all();
    const reloj = await db
      .prepare(
        "SELECT clave, resultado FROM tareas_programadas WHERE tarea = 'reloj' ORDER BY empezada_en DESC LIMIT 10",
      )
      .all<{ clave: string; resultado: string }>();
    return c.json({
      posiciones: pos.results,
      reloj: reloj.results.map((r) => ({ clave: r.clave, origen: r.resultado.split(' ')[0] })),
    });
  }
  const todos = Object.values(ids);
  const marcas = todos.map(() => '?').join(',');
  await db.batch([
    db.prepare('DELETE FROM pedidos WHERE id = ?').bind(pedido),
    db.prepare('DELETE FROM restaurantes WHERE id = ?').bind(rest),
    db.prepare(`DELETE FROM sesiones WHERE usuario_id IN (${marcas})`).bind(...todos),
    db.prepare(`DELETE FROM repartidores WHERE usuario_id IN (${marcas})`).bind(...todos),
    db.prepare(`DELETE FROM usuarios WHERE id IN (${marcas})`).bind(...todos),
  ]);
  return c.json({ borrado: true });
});

// =====================================================================================
// Recorrido de Comida y conciliación EN EL SITIO DE PRUEBAS con Stripe en MODO PRUEBA.
// =====================================================================================

/** Consulta a la base del sitio de pruebas (el recorrido la usa como en local). */
diagnostico.post('/interno/diagnostico/sql', async (c) => {
  const { sql } = await leerCuerpo(c, z.object({ sql: z.string().min(1).max(4000) }));
  const r = await base(c).prepare(sql).all();
  return c.json({ results: r.results });
});

/** Paga un pedido con la tarjeta de prueba de Stripe (solo con llaves sk_test_). El aviso real
 * de Stripe llega después al sitio de pruebas y deja el pedido «pagado». */
diagnostico.post('/interno/diagnostico/confirmar-pago', async (c) => {
  const llave = c.env.STRIPE_SECRET_KEY ?? '';
  if (!llave.startsWith('sk_test_'))
    throw new ErrorDatos('Solo con Stripe en modo prueba.', undefined, 409);
  const { pedidoId } = await leerCuerpo(c, z.object({ pedidoId: z.string().min(1).max(64) }));
  const p = await base(c)
    .prepare('SELECT stripe_sesion FROM pedidos WHERE id = ?')
    .bind(pedidoId)
    .first<{ stripe_sesion: string | null }>();
  if (!p?.stripe_sesion?.startsWith('pi_')) throw new ErrorDatos('No encontrado.', undefined, 404);
  const stripe = crearStripe(llave)!;
  const r = await stripe.post<{ status: string; amount_capturable?: number }>(
    `/payment_intents/${p.stripe_sesion}/confirm`,
    {
      payment_method: 'pm_card_visa',
      return_url: c.env.SITIO_URL ?? 'https://staging.tumbite.com',
    },
    `diag-confirmar-${pedidoId}`,
  );
  return c.json({ estado: r.status, autorizado: r.amount_capturable ?? 0 });
});

/** Conciliación de saldos en pruebas: el libro del día cuadra por dentro, y cada cobro, captura y
 * devolución coincide con lo que Stripe (modo prueba) tiene registrado. También los retiros. */
diagnostico.post('/interno/diagnostico/conciliacion', async (c) => {
  const llave = c.env.STRIPE_SECRET_KEY ?? '';
  if (!llave.startsWith('sk_test_'))
    throw new ErrorDatos('Solo con Stripe en modo prueba.', undefined, 409);
  const db = base(c);
  const stripe = crearStripe(llave)!;
  const casos: Caso[] = [];
  const hoy = new Date().toISOString().slice(0, 10);
  const libro = await conciliar(db, hoy);
  // No queda guardada: la del día la hace el reloj mañana, completa.
  await db.prepare('DELETE FROM conciliaciones WHERE dia = ?').bind(hoy).run();
  casos.push({
    nombre: 'el libro del día cuadra por dentro (restaurantes, repartidores y plataforma)',
    ok: libro.cuadra,
    detalle: JSON.stringify(libro.detalle),
  });
  const { results } = await db
    .prepare(
      `SELECT p.id, p.stripe_sesion AS pi, p.estado, c.capturado, c.capturado_en, c.cancelado_en
         FROM pedidos p JOIN cobros c ON c.pedido_id = p.id
        WHERE p.creado_en >= ? AND p.stripe_sesion LIKE 'pi_%' ORDER BY p.creado_en LIMIT 40`,
    )
    .bind(`${hoy} 00:00:00`)
    .all<{
      id: string;
      pi: string;
      estado: string;
      capturado: number | null;
      capturado_en: string | null;
      cancelado_en: string | null;
    }>();
  const difs: string[] = [];
  for (const f of results) {
    const pi = await stripe.get<{
      status: string;
      amount_received: number;
      latest_charge?: string;
    }>(`/payment_intents/${f.pi}`);
    if (f.capturado_en && (pi.status !== 'succeeded' || pi.amount_received !== Number(f.capturado)))
      difs.push(`${f.id}: base capturó ${f.capturado}, Stripe ${pi.status} ${pi.amount_received}`);
    if (f.cancelado_en && pi.status !== 'canceled')
      difs.push(`${f.id}: base anuló, Stripe ${pi.status}`);
    if (f.estado === 'cancelado' && !f.cancelado_en && f.capturado_en) {
      const rf = await stripe.get<{ data?: { amount: number; status: string }[] }>('/refunds', {
        payment_intent: f.pi,
        limit: 10,
      });
      if (!(rf.data ?? []).some((x) => x.status === 'succeeded' || x.status === 'pending'))
        difs.push(`${f.id}: cancelado y capturado sin reembolso en Stripe`);
    }
    if (f.estado === 'entregado' && !f.capturado_en) difs.push(`${f.id}: entregado sin captura`);
  }
  casos.push({
    nombre: `cada cobro de hoy coincide con Stripe (${results.length} pedidos)`,
    ok: difs.length === 0,
    detalle: difs.join(' | '),
  });
  const retiros = await conciliarRetiros(db, stripe);
  casos.push({
    nombre: 'los retiros cuadran con las transferencias de Stripe',
    ok: retiros.cuadra,
    detalle: JSON.stringify(retiros).slice(0, 300),
  });
  return c.json({ prueba: 'CONCILIACION', ok: casos.every((x) => x.ok), casos });
});
