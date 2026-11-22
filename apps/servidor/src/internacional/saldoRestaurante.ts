import { ErrorDatos } from '../validar';
import { topesSaldoDe } from '../saldoConductores';
import { comisionRestauranteDe, cuentaRestaurante, saldoRestaurante } from './pagoComida';
import { SALDO_RESTAURANTE_DE_FABRICA, leerConfigPais, paisDeZona } from './paises';

/**
 * C-SALDO-RESTAURANTE (22 nov 2026) — Venezuela y todo país con pago directo al restaurante.
 *
 * El restaurante tiene su saldo prepago desde el día cero, con las MISMAS piezas del conductor: el
 * libro (cuenta `restaurante:<id>`, bolsillo `prepago`), la recarga declarada con referencia y
 * comprobante que el equipo acredita UNA vez (como la recarga local de Flex) y la carga manual del
 * equipo, las dos con la doble firma del dinero (control dual `recarga_restaurante` y
 * `saldo_restaurante`). La comisión sale de una política del restaurante y arranca en 0 % («gratis
 * para empezar»): con 0 % el saldo no se toca. La publicidad por saldo NO está construida (la define
 * Richard).
 */

export async function datosRestaurante(db: D1Database, rid: string) {
  const r = await db
    .prepare('SELECT id, zona_id, dueno_id, nombre FROM restaurantes WHERE id = ?')
    .bind(rid)
    .first<{ id: string; zona_id: string | null; dueno_id: string; nombre: string }>();
  if (!r) throw new ErrorDatos('Ese restaurante no existe.', undefined, 404);
  const { pais, moneda } = await paisDeZona(db, r.zona_id ?? '');
  return { ...r, pais, moneda };
}

type FilaRecarga = {
  id: string;
  restaurante_id: string;
  pais: string;
  moneda: string;
  monto: number;
  metodo: string;
  referencia: string;
  banco: string;
  comprobante_clave: string;
  estado: 'pendiente' | 'acreditada' | 'rechazada';
  motivo: string;
  revisado_en: string | null;
  creado_en: string;
  restaurante?: string;
};

export const recargaPublica = (r: FilaRecarga) => ({
  id: r.id,
  restauranteId: r.restaurante_id,
  restaurante: r.restaurante ?? null,
  monto: Number(r.monto),
  moneda: r.moneda,
  metodo: r.metodo,
  referencia: r.referencia,
  banco: r.banco,
  estado: r.estado,
  motivo: r.motivo,
  creadoEn: r.creado_en,
  revisadoEn: r.revisado_en,
});

export const carpetaComprobantesRestaurante = (rid: string) => `restaurantes/${rid}/recargas/`;

/** Lo que ve el restaurante: saldo, comisión vigente, si se quedó sin saldo, recargas y cargas. */
export async function resumenSaldoRestaurante(db: D1Database, rid: string, idioma: 'es' | 'en') {
  const r = await datosRestaurante(db, rid);
  const cfg = await leerConfigPais(db, r.pais);
  const saldo = cfg.saldoRestaurante ?? SALDO_RESTAURANTE_DE_FABRICA;
  const disponible = await saldoRestaurante(db, rid, r.pais, r.moneda);
  // La comisión de un pedido típico de 10 (unidad mayor) para decir si alcanza.
  const comisionTipica = await comisionRestauranteDe(db, {
    pais: r.pais,
    moneda: r.moneda,
    comida: 1000,
  });
  const [{ results: recargas }, { results: cargas }] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM recargas_restaurante WHERE restaurante_id = ? ORDER BY creado_en DESC LIMIT 30',
      )
      .bind(rid)
      .all<FilaRecarga>(),
    db
      .prepare(
        'SELECT id, monto, moneda, motivo, creado_en FROM cargas_saldo_restaurante WHERE restaurante_id = ? ORDER BY creado_en DESC LIMIT 30',
      )
      .bind(rid)
      .all<{ id: string; monto: number; moneda: string; motivo: string; creado_en: string }>(),
  ]);
  return {
    pais: r.pais,
    moneda: r.moneda,
    disponible,
    comision: { activa: comisionTipica > 0, deUnPedidoDe10: comisionTipica },
    sinSaldo: comisionTipica > 0 && disponible < comisionTipica,
    recargas: {
      activas: saldo.recargasActivas,
      minimo: saldo.minimo,
      maximo: saldo.maximo,
      instrucciones: idioma === 'en' ? saldo.instruccionesEn : saldo.instruccionesEs,
      lista: recargas.map(recargaPublica),
    },
    cargas: cargas.map((c) => ({
      id: c.id,
      monto: Number(c.monto),
      moneda: c.moneda,
      motivo: c.motivo,
      creadoEn: c.creado_en,
    })),
  };
}

/** El restaurante declara una recarga que pagó por fuera (referencia y foto del comprobante). */
export async function declararRecargaRestaurante(
  db: D1Database,
  p: {
    rid: string;
    monto: number;
    referencia: string;
    banco: string;
    comprobanteClave: string;
    autorId: string;
  },
) {
  const r = await datosRestaurante(db, p.rid);
  const cfg = (await leerConfigPais(db, r.pais)).saldoRestaurante ?? SALDO_RESTAURANTE_DE_FABRICA;
  if (!cfg.recargasActivas)
    throw new ErrorDatos('Las recargas de saldo no están activas en tu país.', undefined, 409);
  if (p.monto < cfg.minimo || p.monto > cfg.maximo)
    throw new ErrorDatos('El monto está fuera de los límites de tu país.', 'monto', 422);
  const usada = await db
    .prepare('SELECT 1 FROM recargas_restaurante WHERE comprobante_clave = ?')
    .bind(p.comprobanteClave)
    .first();
  if (usada)
    throw new ErrorDatos(
      'Esa foto de comprobante ya se usó en otra recarga. Sube la foto de este pago.',
      'comprobanteId',
      409,
    );
  const id = crypto.randomUUID();
  const ins = await db
    .prepare(
      `INSERT OR IGNORE INTO recargas_restaurante (id, restaurante_id, pais, moneda, monto, metodo, referencia, banco, comprobante_clave, creado_por)
       VALUES (?, ?, ?, ?, ?, 'pago_movil', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      p.rid,
      r.pais,
      r.moneda,
      p.monto,
      p.referencia,
      p.banco,
      p.comprobanteClave,
      p.autorId,
    )
    .run();
  if (!ins.meta.changes)
    throw new ErrorDatos(
      'Esa referencia de pago ya se declaró. Si es otro pago, escribe su referencia.',
      'referencia',
      409,
    );
  return recargaPublica(await recargaRestaurante(db, id));
}

export async function recargaRestaurante(db: D1Database, id: string) {
  const r = await db
    .prepare('SELECT * FROM recargas_restaurante WHERE id = ?')
    .bind(id)
    .first<FilaRecarga>();
  if (!r) throw new ErrorDatos('Esa recarga no existe.', undefined, 404);
  return r;
}

export async function recargasRestaurantePorRevisar(db: D1Database, estado: string) {
  const { results } = await db
    .prepare(
      `SELECT rr.*, r.nombre AS restaurante FROM recargas_restaurante rr JOIN restaurantes r ON r.id = rr.restaurante_id
        WHERE rr.estado = ? ORDER BY rr.creado_en DESC LIMIT 100`,
    )
    .bind(estado)
    .all<FilaRecarga>();
  return results.map(recargaPublica);
}

/**
 * Acredita UNA vez: el UPDATE que gana deja un token y el libro solo se escribe si ese token quedó
 * (misma transacción). Dos toques, dos revisores o un rechazo cruzado no acreditan dos veces.
 * La usa la ruta (bajo el umbral) y la aprobación del control dual (por encima).
 */
export async function acreditarRecargaRestaurante(db: D1Database, id: string, autorId: string) {
  const r = await recargaRestaurante(db, id);
  if (r.estado !== 'pendiente')
    throw new ErrorDatos(
      r.estado === 'acreditada' ? 'Esa recarga ya se acreditó.' : 'Esa recarga se rechazó.',
      undefined,
      409,
    );
  const token = crypto.randomUUID();
  const res = await db.batch([
    db
      .prepare(
        `UPDATE recargas_restaurante SET estado = 'acreditada', revisado_por = ?, revisado_en = datetime('now'), revision_token = ?
          WHERE id = ? AND estado = 'pendiente'`,
      )
      .bind(autorId, token, id),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'prepago', ?, ?, ?, 'recarga_restaurante', ?, ?
          WHERE EXISTS (SELECT 1 FROM recargas_restaurante WHERE id = ? AND revision_token = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        cuentaRestaurante(r.restaurante_id),
        r.pais,
        r.moneda,
        r.monto,
        `recarga-restaurante:${id}`,
        autorId,
        id,
        token,
      ),
  ]);
  if (!res[0]?.meta.changes)
    throw new ErrorDatos('Esa recarga ya no está pendiente.', undefined, 409);
  return {
    recarga: recargaPublica(await recargaRestaurante(db, id)),
    saldo: await saldoRestaurante(db, r.restaurante_id, r.pais, r.moneda),
  };
}

export async function rechazarRecargaRestaurante(
  db: D1Database,
  id: string,
  motivo: string,
  autorId: string,
) {
  const res = await db
    .prepare(
      `UPDATE recargas_restaurante SET estado = 'rechazada', motivo = ?, revisado_por = ?, revisado_en = datetime('now')
        WHERE id = ? AND estado = 'pendiente'`,
    )
    .bind(motivo, autorId, id)
    .run();
  if (!res.meta.changes) throw new ErrorDatos('Esa recarga ya no está pendiente.', undefined, 409);
  return recargaPublica(await recargaRestaurante(db, id));
}

/** La carga manual del equipo (la ejecuta el control dual). Nunca pasa el tope del código. */
export async function cargarSaldoRestaurante(
  db: D1Database,
  p: { rid: string; monto: number; motivo: string; comprobante: string; autorId: string },
) {
  if (!Number.isSafeInteger(p.monto) || p.monto <= 0)
    throw new ErrorDatos('El monto no es válido.', 'monto', 400);
  const r = await datosRestaurante(db, p.rid);
  if (p.monto > topesSaldoDe(r.moneda).cargaMaxima)
    throw new ErrorDatos('Esa carga pasa el máximo permitido de Divoox por carga.', 'monto', 400);
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO cargas_saldo_restaurante (id, restaurante_id, pais, moneda, monto, motivo, comprobante, autor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        p.rid,
        r.pais,
        r.moneda,
        p.monto,
        p.motivo.slice(0, 120),
        p.comprobante.slice(0, 80),
        p.autorId,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
         SELECT ?, ?, 'prepago', ?, ?, ?, 'carga_manual_restaurante', ?, ?
          WHERE EXISTS (SELECT 1 FROM cargas_saldo_restaurante WHERE id = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        cuentaRestaurante(p.rid),
        r.pais,
        r.moneda,
        p.monto,
        `carga-saldo-restaurante:${id}`,
        p.autorId,
        id,
      ),
  ]);
  return { cargaId: id, saldo: await saldoRestaurante(db, p.rid, r.pais, r.moneda) };
}
