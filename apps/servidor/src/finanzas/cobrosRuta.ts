import { calcularComision, comisionEstimada, tarifaUnitaria } from '@tumbite/compartido';
import { CUENTA_TUMBITE, sentenciaLibro } from '../internacional/libro';
import { ErrorDatos } from '../validar';
import { cuentaEmpresa, empresaFinanciera, saldoEmpresa, sentenciasComprobante } from './billetera';
import { politicaVigente } from './politicas';

/**
 * Divoox · Fase 4: comisiones de Divoox en las rutas de Flex (C-FIN-RESERVAS, C-FIN-COMISION).
 *
 * 1. Al asignar u ofrecer una ruta se CONGELA la tarifa de la política vigente (`flex_cobros_ruta`)
 *    y se APARTA la comisión estimada: del disponible al reservado, en un solo lote atómico que solo
 *    entra si alcanza (dos rutas a la vez no pueden gastar el mismo saldo).
 * 2. Cada paquete entregado se cobra en la MISMA transacción que la entrega (del reservado a
 *    Divoox), con referencia única por paquete: ni reintentos, ni avisos repetidos, ni la cola sin
 *    conexión cobran dos veces.
 * 3. Al salir, lo apartado de más (faltantes) vuelve al disponible; al cerrar, se cobra la tarifa
 *    por ruta (si es esa la regla) y se libera el resto; al retirar, vencer o cancelar, se libera todo.
 * Sin política (o «sin cobro»), no se aparta ni se cobra nada.
 */

type FilaCobro = {
  id: string;
  ruta_id: string;
  empresa_id: string;
  politica_id: string | null;
  regla_json: string;
  tarifa_unitaria: number;
  descuento_pb: number;
  pais: string;
  moneda: string;
  paquetes_estimados: number;
  reservado: number;
  estado: string;
};

const conceptos = (cobroId: string) => ({
  reserva: `reserva_flex:${cobroId}`,
  comision: `comision_flex:${cobroId}`,
  liberacion: `liberacion_flex:${cobroId}`,
  ajuste: `ajuste_flex:${cobroId}`,
});

/** Paquetes facturados este mes por la empresa (para la regla por volumen). */
async function volumenDelMes(db: D1Database, empresaId: string) {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM libro WHERE cuenta_id = ? AND bolsillo = 'reservado' AND concepto LIKE 'comision_flex:%'
         AND referencia LIKE 'comision_flex_paquete:%' AND creado_en >= strftime('%Y-%m-01 00:00:00', 'now')`,
    )
    .bind(cuentaEmpresa(empresaId))
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

export async function cobroAbierto(db: D1Database, rutaId: string) {
  return db
    .prepare("SELECT * FROM flex_cobros_ruta WHERE ruta_id = ? AND estado = 'reservada'")
    .bind(rutaId)
    .first<FilaCobro>();
}

/** Lo que sigue apartado de un cobro (lo reservado menos lo cobrado y lo liberado). */
async function restanteDe(db: D1Database, c: FilaCobro) {
  const k = conceptos(c.id);
  const f = await db
    .prepare(
      `SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE cuenta_id = ? AND bolsillo = 'reservado'
         AND concepto IN (?, ?, ?, ?)`,
    )
    .bind(cuentaEmpresa(c.empresa_id), k.reserva, k.comision, k.liberacion, k.ajuste)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

async function cobradoDe(db: D1Database, c: FilaCobro) {
  const f = await db
    .prepare(
      "SELECT COALESCE(-SUM(monto), 0) AS s FROM libro WHERE cuenta_id = ? AND bolsillo = 'reservado' AND concepto = ?",
    )
    .bind(cuentaEmpresa(c.empresa_id), conceptos(c.id).comision)
    .first<{ s: number }>();
  return Number(f?.s ?? 0);
}

/**
 * Aparta la comisión de una ruta que sale del borrador. Devuelve el id del cobro (o null si no hay
 * política que cobre). Saldo insuficiente o deuda pendiente: 409 y NADA cambia.
 */
export async function reservarCobroRuta(
  db: D1Database,
  r: { id: string; empresa_id: string; centro_id: string | null },
  paquetes: number,
): Promise<{ id: string; nuevo: boolean } | null> {
  const ya = await cobroAbierto(db, r.id);
  if (ya) return { id: ya.id, nuevo: false };
  const e = await empresaFinanciera(db, r.empresa_id);
  const centro = r.centro_id
    ? await db
        .prepare('SELECT ciudad FROM empresa_centros WHERE id = ?')
        .bind(r.centro_id)
        .first<{ ciudad: string }>()
    : null;
  const pol = await politicaVigente(db, {
    servicio: 'flex',
    tipoCuenta: 'empresa',
    pais: e.pais,
    ciudad: centro?.ciudad ?? null,
    empresaId: e.id,
    moneda: e.moneda,
  });
  if (!pol || pol.modalidad !== 'prepago') return null;
  const s = await saldoEmpresa(db, e);
  if (s.deuda > 0)
    throw new ErrorDatos(
      'Tu billetera tiene un saldo pendiente de pago. Recarga para enviar rutas nuevas.',
      'billetera',
      409,
    );
  const volumen = await volumenDelMes(db, e.id);
  const unitaria =
    pol.regla.tipo === 'por_paquete' || pol.regla.tipo === 'volumen'
      ? tarifaUnitaria(pol.regla, { volumenPrevio: volumen, descuentoPb: pol.descuentoPb })
      : 0;
  const estimado =
    pol.regla.tipo === 'por_paquete' || pol.regla.tipo === 'volumen'
      ? unitaria * paquetes
      : comisionEstimada(pol.regla, { paquetes, descuentoPb: pol.descuentoPb });
  const id = crypto.randomUUID();
  const k = conceptos(id);
  const cuenta = cuentaEmpresa(e.id);
  const fila = db
    .prepare(
      `INSERT INTO flex_cobros_ruta (id, ruta_id, empresa_id, politica_id, regla_json, tarifa_unitaria, descuento_pb, pais, moneda, paquetes_estimados, reservado)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE ?11 = 0 OR EXISTS (SELECT 1 FROM libro WHERE referencia = ?12)`,
    )
    .bind(
      id,
      r.id,
      e.id,
      pol.id,
      JSON.stringify(pol.regla),
      unitaria,
      pol.descuentoPb,
      e.pais,
      e.moneda,
      paquetes,
      estimado,
      `cobro:${id}:reserva:prepago`,
    );
  if (estimado === 0) {
    await fila.run().catch(traducirCobro);
    return { id, nuevo: true };
  }
  // Las dos patas y la ficha en UN lote: sale del disponible solo si alcanza; entra al reservado solo
  // si salió; la ficha solo si se apartó. El índice único de la ficha impide dos reservas por ruta.
  await db
    .batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
           SELECT ?1, ?2, 'prepago', ?3, ?4, ?5, ?6, ?7
            WHERE (SELECT COALESCE(SUM(monto), 0) FROM libro WHERE cuenta_id = ?2 AND bolsillo = 'prepago' AND pais = ?3 AND moneda = ?4) >= ?8`,
        )
        .bind(
          crypto.randomUUID(),
          cuenta,
          e.pais,
          e.moneda,
          -estimado,
          k.reserva,
          `cobro:${id}:reserva:prepago`,
          estimado,
        ),
      db
        .prepare(
          `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
           SELECT ?1, ?2, 'reservado', ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM libro WHERE referencia = ?8)`,
        )
        .bind(
          crypto.randomUUID(),
          cuenta,
          e.pais,
          e.moneda,
          estimado,
          k.reserva,
          `cobro:${id}:reserva:reservado`,
          `cobro:${id}:reserva:prepago`,
        ),
      fila,
    ])
    .catch(traducirCobro);
  const ok = await db.prepare('SELECT 1 FROM flex_cobros_ruta WHERE id = ?').bind(id).first();
  if (!ok)
    throw new ErrorDatos(
      'Saldo insuficiente en la billetera para esta ruta. Recarga para continuar.',
      'billetera',
      409,
    );
  return { id, nuevo: true };
}

function traducirCobro(e: unknown): never {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('flex_cobros_ruta') || msg.includes('UNIQUE'))
    throw new ErrorDatos('La ruta cambió mientras tanto. Vuelve a cargarla.', undefined, 409);
  throw e;
}

/** Devuelve al disponible TODO lo que siga apartado (retirar, vencer, cancelar). Idempotente. */
export async function liberarCobroRuta(db: D1Database, rutaId: string, motivo: string) {
  const c = await cobroAbierto(db, rutaId);
  if (!c) return 0;
  const restante = await restanteDe(db, c);
  const k = conceptos(c.id);
  const cuenta = cuentaEmpresa(c.empresa_id);
  const lote: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE flex_cobros_ruta SET estado = 'liberada', liberado = ?, cerrado_en = datetime('now') WHERE id = ? AND estado = 'reservada'",
      )
      .bind(restante, c.id),
  ];
  if (restante > 0)
    lote.push(
      sentenciaLibro(db, {
        cuentaId: cuenta,
        bolsillo: 'reservado',
        pais: c.pais,
        moneda: c.moneda,
        monto: -restante,
        concepto: k.liberacion,
        referencia: `cobro:${c.id}:liberacion:reservado`,
      }),
      sentenciaLibro(db, {
        cuentaId: cuenta,
        bolsillo: 'prepago',
        pais: c.pais,
        moneda: c.moneda,
        monto: restante,
        concepto: `${k.liberacion}:${motivo}`,
        referencia: `cobro:${c.id}:liberacion:prepago`,
      }),
    );
  await db.batch(lote);
  return restante;
}

/** Al salir: lo apartado por paquetes que no se cargaron (faltantes) vuelve al disponible. */
export async function ajustarCobroAlSalir(db: D1Database, rutaId: string) {
  const c = await cobroAbierto(db, rutaId);
  if (!c || c.tarifa_unitaria <= 0) return 0;
  const f = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM ruta_paquetes WHERE ruta_id = ? AND activo = 1 AND excluido_en IS NULL',
    )
    .bind(rutaId)
    .first<{ n: number }>();
  const necesario = c.tarifa_unitaria * Number(f?.n ?? 0);
  const sobra = (await restanteDe(db, c)) - necesario;
  if (sobra <= 0) return 0;
  const k = conceptos(c.id);
  const cuenta = cuentaEmpresa(c.empresa_id);
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: cuenta,
      bolsillo: 'reservado',
      pais: c.pais,
      moneda: c.moneda,
      monto: -sobra,
      concepto: k.ajuste,
      referencia: `cobro:${c.id}:salida:reservado`,
    }),
    sentenciaLibro(db, {
      cuentaId: cuenta,
      bolsillo: 'prepago',
      pais: c.pais,
      moneda: c.moneda,
      monto: sobra,
      concepto: k.ajuste,
      referencia: `cobro:${c.id}:salida:prepago`,
    }),
  ]);
  return sobra;
}

/**
 * Sentencias del cobro por paquete ENTREGADO, para el MISMO lote que la entrega: solo cobra los
 * paquetes que quedaron «entregado», una sola vez por paquete (referencia por paquete) y nunca más
 * de lo apartado para esa ruta.
 */
export function sentenciasCobroEntrega(
  db: D1Database,
  rutaId: string,
  paqueteIds: string[],
): D1PreparedStatement[] {
  const lista = JSON.stringify(paqueteIds);
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT lower(hex(randomblob(16))), 'empresa:' || c.empresa_id, 'reservado', c.pais, c.moneda, -c.tarifa_unitaria,
                'comision_flex:' || c.id, 'comision_flex_paquete:' || p.id || ':reservado'
           FROM json_each(?1) j
           JOIN paquetes p ON p.id = j.value AND p.estado = 'entregado'
           JOIN flex_cobros_ruta c ON c.ruta_id = ?2 AND c.estado = 'reservada' AND c.tarifa_unitaria > 0`,
      )
      .bind(lista, rutaId),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT lower(hex(randomblob(16))), ?3, 'comisiones', l.pais, l.moneda, -l.monto, 'comision_flex_paquete',
                'comision_flex_paquete:' || j.value || ':divoox'
           FROM json_each(?1) j
           JOIN libro l ON l.referencia = 'comision_flex_paquete:' || j.value || ':reservado'
           JOIN flex_cobros_ruta c ON c.ruta_id = ?2 AND l.concepto = 'comision_flex:' || c.id`,
      )
      .bind(lista, rutaId, CUENTA_TUMBITE),
  ];
}

/**
 * Al cerrar: la regla por ruta se cobra aquí (si hubo entregas); el resto apartado vuelve al
 * disponible; queda el comprobante de comisiones de la ruta. Idempotente.
 */
export async function cerrarCobroRuta(db: D1Database, rutaId: string) {
  const c = await cobroAbierto(db, rutaId);
  if (!c) return null;
  const k = conceptos(c.id);
  const cuenta = cuentaEmpresa(c.empresa_id);
  const regla = JSON.parse(c.regla_json) as Parameters<typeof calcularComision>[0];
  const entregados = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ruta_paquetes rp JOIN paquetes p ON p.id = rp.paquete_id
        WHERE rp.ruta_id = ? AND rp.excluido_en IS NULL AND p.estado = 'entregado'`,
    )
    .bind(rutaId)
    .first<{ n: number }>();
  const n = Number(entregados?.n ?? 0);
  const lote: D1PreparedStatement[] = [];
  let restante = await restanteDe(db, c);
  if (regla.tipo === 'por_ruta' && n > 0) {
    const monto = Math.min(
      calcularComision(regla, { unidades: n, descuentoPb: c.descuento_pb }),
      restante,
    );
    if (monto > 0) {
      lote.push(
        sentenciaLibro(db, {
          cuentaId: cuenta,
          bolsillo: 'reservado',
          pais: c.pais,
          moneda: c.moneda,
          monto: -monto,
          concepto: k.comision,
          referencia: `cobro:${c.id}:ruta:reservado`,
        }),
        sentenciaLibro(db, {
          cuentaId: CUENTA_TUMBITE,
          bolsillo: 'comisiones',
          pais: c.pais,
          moneda: c.moneda,
          monto,
          concepto: 'comision_flex_ruta',
          referencia: `cobro:${c.id}:ruta:divoox`,
        }),
      );
      restante -= monto;
    }
  }
  if (restante > 0)
    lote.push(
      sentenciaLibro(db, {
        cuentaId: cuenta,
        bolsillo: 'reservado',
        pais: c.pais,
        moneda: c.moneda,
        monto: -restante,
        concepto: k.liberacion,
        referencia: `cobro:${c.id}:cierre:reservado`,
      }),
      sentenciaLibro(db, {
        cuentaId: cuenta,
        bolsillo: 'prepago',
        pais: c.pais,
        moneda: c.moneda,
        monto: restante,
        concepto: `${k.liberacion}:cierre`,
        referencia: `cobro:${c.id}:cierre:prepago`,
      }),
    );
  if (lote.length) await db.batch(lote);
  const cobrado = await cobradoDe(db, c);
  const ruta = await db
    .prepare('SELECT nombre FROM rutas_flex WHERE id = ?')
    .bind(rutaId)
    .first<{ nombre: string }>();
  await db.batch([
    db
      .prepare(
        "UPDATE flex_cobros_ruta SET estado = 'cerrada', cobrado = ?, liberado = liberado + ?, cerrado_en = datetime('now') WHERE id = ? AND estado = 'reservada'",
      )
      .bind(cobrado, Math.max(restante, 0), c.id),
    ...(cobrado > 0
      ? sentenciasComprobante(db, {
          empresaId: c.empresa_id,
          tipo: 'comisiones_ruta',
          monto: cobrado,
          pais: c.pais,
          moneda: c.moneda,
          referencia: `comisiones_ruta:${c.id}`,
          datos: {
            rutaId,
            ruta: ruta?.nombre ?? '',
            regla,
            tarifaUnitaria: c.tarifa_unitaria,
            paquetesFacturados:
              regla.tipo === 'por_ruta' ? n : Math.round(cobrado / Math.max(c.tarifa_unitaria, 1)),
          },
        })
      : []),
  ]);
  return { cobrado, liberado: Math.max(restante, 0), entregados: n };
}

/** Resumen de comisiones del periodo para la pantalla de la empresa (por ruta). */
export async function comisionesDelPeriodo(
  db: D1Database,
  empresaId: string,
  desde: string,
  hasta: string,
) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.ruta_id, r.nombre, c.regla_json, c.tarifa_unitaria, c.moneda, c.estado, c.reservado, c.creado_en, c.cerrado_en,
              (SELECT COALESCE(-SUM(l.monto), 0) FROM libro l WHERE l.cuenta_id = 'empresa:' || c.empresa_id AND l.bolsillo = 'reservado' AND l.concepto = 'comision_flex:' || c.id) AS cobrado,
              (SELECT COUNT(*) FROM libro l WHERE l.cuenta_id = 'empresa:' || c.empresa_id AND l.bolsillo = 'reservado' AND l.concepto = 'comision_flex:' || c.id AND l.referencia LIKE 'comision_flex_paquete:%') AS paquetes
         FROM flex_cobros_ruta c JOIN rutas_flex r ON r.id = c.ruta_id
        WHERE c.empresa_id = ? AND c.creado_en BETWEEN ? AND ?
        ORDER BY c.creado_en DESC LIMIT 300`,
    )
    .bind(empresaId, desde, `${hasta} 23:59:59`)
    .all<{
      id: string;
      ruta_id: string;
      nombre: string;
      regla_json: string;
      tarifa_unitaria: number;
      moneda: string;
      estado: string;
      reservado: number;
      creado_en: string;
      cerrado_en: string | null;
      cobrado: number;
      paquetes: number;
    }>();
  const rutas = results.map((x) => ({
    cobroId: x.id,
    rutaId: x.ruta_id,
    ruta: x.nombre,
    regla: JSON.parse(x.regla_json) as unknown,
    tarifaUnitaria: x.tarifa_unitaria,
    moneda: x.moneda,
    estado: x.estado,
    reservado: x.reservado,
    cobrado: Number(x.cobrado),
    paquetesFacturados: Number(x.paquetes),
    creadoEn: x.creado_en,
    cerradoEn: x.cerrado_en,
  }));
  return {
    rutas,
    totalCobrado: rutas.reduce((s, r) => s + r.cobrado, 0),
    paquetesFacturados: rutas.reduce((s, r) => s + r.paquetesFacturados, 0),
  };
}

/** Recuperación (reloj): reservas abiertas de rutas que ya no están activas se cierran o liberan. */
export async function recuperarCobrosHuerfanos(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT c.ruta_id, r.estado FROM flex_cobros_ruta c JOIN rutas_flex r ON r.id = c.ruta_id
        WHERE c.estado = 'reservada' AND r.estado IN ('borrador', 'cancelada', 'completada', 'con_incidencias')
          AND c.creado_en < datetime('now', '-2 minutes') LIMIT 50`,
    )
    .all<{ ruta_id: string; estado: string }>();
  let n = 0;
  for (const x of results) {
    if (x.estado === 'completada' || x.estado === 'con_incidencias')
      await cerrarCobroRuta(db, x.ruta_id);
    else await liberarCobroRuta(db, x.ruta_id, 'recuperacion');
    n++;
  }
  return n;
}
