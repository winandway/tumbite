import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base } from '../sesion';
import { crearStripe, type Stripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { pedirRetiro, procesarRetiro, retirosActivos } from '../retiros';

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
    await db
      .prepare(
        `UPDATE ${t} SET lat = m.lat, t = m.t FROM (SELECT json_extract(value, '$.c') AS c, json_extract(value, '$.lat') AS lat, json_extract(value, '$.t') AS t FROM json_each(?)) AS m WHERE ${t}.id = m.c AND m.t > ${t}.t`,
      )
      .bind(muestras)
      .run();
    const ms = Date.now() - t0;
    const n = await db
      .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE lat = 25.7`)
      .first<{ n: number }>();
    return c.json({ prueba: 'S3', ok: n?.n === 10000, ms, criterio: 'menos de 100 ms' });
  } finally {
    await db.prepare(`DROP TABLE ${t}`).run();
  }
});

/** S4: tiempo de consultas típicas medido dentro del worker (sin la red de la API). */
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
  const r = new Map<string, { mediana: number; max: number }>();
  for (const [nombre, q] of consultas) {
    const t: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await db.prepare(q).all();
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    r.set(nombre, {
      mediana: Math.round((t[10] ?? 0) * 10) / 10,
      max: Math.round((t.at(-1) ?? 0) * 10) / 10,
    });
  }
  const peor = Math.max(...[...r.values()].map((x) => x.mediana));
  return c.json({
    prueba: 'S4',
    ok: peor <= 2,
    criterio: 'mediana de 2 ms o menos',
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
