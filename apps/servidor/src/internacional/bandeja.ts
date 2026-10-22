import { ErrorDatos } from '../validar';
import { anotarEvento } from '../manager';
import { libroDePedido, sentenciaLibro } from './libro';
import { confirmarPagoLocalRestaurante } from './pagoLocal';

/**
 * C-BANDEJA-DINERO (19 oct 2026): la bandeja de soporte del cobro en mano. Requisito antes de
 * encender el efectivo o la transferencia en cualquier país.
 *
 * Los casos SALEN de lo que ya existe (estados del pedido, pagos en el local, libro, recargas,
 * disputas e incidencias): no hay una contabilidad aparte. Lo único propio es el seguimiento
 * (estado, responsable e historial). Las acciones de soporte quedan escritas con su autor y no se
 * repiten (clave de idempotencia única). Ninguna acción borra movimientos ni aplica plazos,
 * tolerancias o compensaciones que Richard no aprobó: esos casos quedan abiertos para decidir.
 */
export type TipoCaso =
  | 'transferencia'
  | 'diferencia'
  | 'excedente'
  | 'comida'
  | 'local'
  | 'incidencia'
  | 'recarga_disputada'
  | 'recarga_pendiente';

export const TIPOS_CASO: readonly TipoCaso[] = [
  'transferencia',
  'diferencia',
  'excedente',
  'comida',
  'local',
  'incidencia',
  'recarga_disputada',
  'recarga_pendiente',
];

/** Qué puede hacer soporte en cada tipo. «tomar», «nota» y «resolver» valen para todos. */
export const ACCIONES_POR_TIPO: Record<TipoCaso, readonly string[]> = {
  transferencia: ['tomar', 'nota', 'resolver'],
  diferencia: ['tomar', 'nota', 'resolver'],
  // El repartidor le devolvió al cliente lo que pagó de más: queda escrito en el libro.
  excedente: ['tomar', 'nota', 'excedente_devuelto', 'resolver'],
  // Quién absorbe la comida es la decisión 20 de Richard: solo se revisa y se documenta.
  comida: ['tomar', 'nota', 'resolver'],
  // El restaurante confirma por otra vía (teléfono) que recibió el pago en el mostrador.
  local: ['tomar', 'nota', 'confirmar_restaurante', 'resolver'],
  incidencia: ['tomar', 'nota', 'resolver'],
  // Qué hacer con el saldo de una recarga disputada es decisión de Richard.
  recarga_disputada: ['tomar', 'nota', 'resolver'],
  recarga_pendiente: ['tomar', 'nota', 'resolver'],
};

export type Caso = {
  clave: string;
  tipo: TipoCaso;
  estado: 'abierto' | 'en_revision' | 'resuelto';
  responsable: { id: string; nombre: string } | null;
  pedidoId: string | null;
  pais: string | null;
  moneda: string;
  montos: Record<string, number>;
  participantes: {
    cliente: string | null;
    repartidor: string | null;
    restaurante: string | null;
  };
  detalle: string;
  /** El mismo texto en inglés (la pantalla elige según el idioma). */
  detalleEn: string;
  creadoEn: string;
  acciones: readonly string[];
  /** La resolución económica la decide Richard (decisiones 20 y 22): el caso espera su regla. */
  esperaDecision: string | null;
};

const ESPERA_DECISION = new Map<string, string>([
  ['comida', 'decision-20'],
  ['recarga_disputada', 'recarga-disputada'],
  ['transferencia', 'decision-22'],
]);

const DETALLE_EN: Record<string, string> = {
  ['El repartidor todavía no ve la transferencia en su banco. La confirmación es manual: la hace el repartidor mirando su banco.']:
    'The driver doesn’t see the transfer in their bank yet. Confirmation is manual: the driver does it by checking their bank.',
  ['El cliente no pagó.']: 'The customer didn’t pay.',
  ['El cobro, el pago en el local o el ticket no cuadran.']:
    'The payment, the store payment or the receipt don’t match.',
  ['El repartidor pagó la comida y el pedido no se entregó. Quién la absorbe está pendiente de decisión (decisión 20).']:
    'The driver paid for the food and the order wasn’t delivered. Who covers it is pending a decision (decision 20).',
  ['El cliente pagó de más al repartidor. El repartidor se lo debe devolver; ese dinero nunca pasó por Divoox.']:
    'The customer overpaid the driver. The driver owes it back; that money never went through Divoox.',
  ['El restaurante no confirmó en la app que recibió el pago en el mostrador.']:
    'The restaurant didn’t confirm in the app that it received the payment at the counter.',
  ['Stripe no confirmó esta recarga en un día. No se acreditó nada.']:
    'Stripe didn’t confirm this top-up within a day. Nothing was credited.',
};

type Fila = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v == null ? null : String(v));

const CON_PEDIDO = `p.id AS pedido_id, p.moneda, p.total, p.propina, p.subtotal, p.pago_restaurante,
  p.monto_recibido, p.estado AS pedido_estado, p.cobro_estado, p.conciliacion_estado, p.creado_en AS pedido_creado,
  (SELECT z.pais FROM zonas z WHERE z.id = p.zona_id) AS pais,
  (SELECT nombre FROM usuarios WHERE id = p.cliente_id) AS cliente,
  (SELECT nombre FROM usuarios WHERE id = p.repartidor_id) AS repartidor,
  (SELECT nombre FROM restaurantes WHERE id = p.restaurante_id) AS restaurante`;

function base(
  tipo: TipoCaso,
  clave: string,
  f: Fila,
  montos: Record<string, number>,
  detalle: string,
) {
  return {
    clave,
    tipo,
    pedidoId: s(f.pedido_id),
    pais: s(f.pais),
    moneda: String(f.moneda ?? 'USD'),
    montos,
    participantes: {
      cliente: s(f.cliente),
      repartidor: s(f.repartidor),
      restaurante: s(f.restaurante),
    },
    detalle,
    detalleEn: new Map(Object.entries(DETALLE_EN)).get(detalle) ?? detalle,
    creadoEn: String(f.creado ?? f.pedido_creado ?? ''),
    acciones: new Map(Object.entries(ACCIONES_POR_TIPO)).get(tipo) ?? [],
    esperaDecision: ESPERA_DECISION.get(tipo) ?? null,
  };
}

type Crudo = Omit<Caso, 'estado' | 'responsable'>;

/**
 * De dónde sale cada tipo de caso. Cada fuente es una consulta sobre lo que ya existe (pedidos,
 * pagos en el local, libro, incidencias, disputas, recargas) con su clave estable. La bandeja
 * pagina por tipo y filtra los resueltos EN la consulta (antes se cortaba en 500 y se filtraba
 * después: un caso podía quedar fuera de la vista).
 */
type Fuente = {
  tipo: TipoCaso;
  /** SELECT … FROM … WHERE … (sin ORDER BY ni LIMIT); debe dar las columnas `clave` y `creado`. */
  sql: string;
  mapear: (f: Fila) => Crudo;
};

const FUENTES: readonly Fuente[] = [
  {
    // Transferencias que el repartidor marcó «aún no me llega» y siguen sin confirmar.
    tipo: 'transferencia',
    sql: `SELECT ${CON_PEDIDO}, b.creado_en AS creado, 'transferencia:' || p.id AS clave
            FROM pedidos p JOIN bitacora_pedidos b ON b.pedido_id = p.id AND b.evento = 'transferencia_por_verificar'
           WHERE p.metodo_pago = 'transferencia_repartidor' AND p.cobro_estado = 'pendiente'`,
    mapear: (f) =>
      base(
        'transferencia',
        String(f.clave),
        f,
        { esperado: n(f.total) - n(f.propina) },
        'El repartidor todavía no ve la transferencia en su banco. La confirmación es manual: la hace el repartidor mirando su banco.',
      ),
  },
  {
    // Pedidos en mano conciliados con diferencia (cobro, pago en el local o ticket).
    tipo: 'diferencia',
    sql: `SELECT ${CON_PEDIDO}, l.monto_pagado, l.monto_esperado AS local_esperado, l.importe_ticket, l.diferencia_pago,
                 l.diferencia_ticket, COALESCE(p.cobro_confirmado_en, p.creado_en) AS creado, 'diferencia:' || p.id AS clave
            FROM pedidos p LEFT JOIN pagos_local l ON l.pedido_id = p.id
           WHERE p.metodo_pago != 'tarjeta' AND p.conciliacion_estado = 'con_diferencia'`,
    mapear: (f) => {
      const esperado = n(f.total) - n(f.propina);
      return base(
        'diferencia',
        String(f.clave),
        f,
        {
          cobroEsperado: esperado,
          cobroRecibido: n(f.monto_recibido),
          faltante: Math.max(0, esperado - n(f.monto_recibido)),
          pagoLocalEsperado: n(f.local_esperado),
          pagoLocalPagado: n(f.monto_pagado),
          ticket: n(f.importe_ticket),
          comida: n(f.subtotal),
          diferenciaPago: n(f.diferencia_pago),
          diferenciaTicket: n(f.diferencia_ticket),
        },
        f.cobro_estado === 'no_pagado'
          ? 'El cliente no pagó.'
          : 'El cobro, el pago en el local o el ticket no cuadran.',
      );
    },
  },
  {
    // Excedentes por devolver (saldo neto del libro todavía negativo).
    tipo: 'excedente',
    sql: `SELECT ${CON_PEDIDO}, SUM(l.monto) AS neto, MIN(l.creado_en) AS creado, 'excedente:' || p.id AS clave
            FROM libro l JOIN pedidos p ON p.id = l.pedido_id
           WHERE l.bolsillo = 'directo' AND l.concepto IN ('excedente_cliente_por_devolver', 'excedente_devuelto_al_cliente')
           GROUP BY p.id HAVING SUM(l.monto) < 0`,
    mapear: (f) =>
      base(
        'excedente',
        String(f.clave),
        f,
        { porDevolver: -n(f.neto) },
        'El cliente pagó de más al repartidor. El repartidor se lo debe devolver; ese dinero nunca pasó por Divoox.',
      ),
  },
  {
    // Comida comprada por el repartidor y no entregada.
    tipo: 'comida',
    sql: `SELECT ${CON_PEDIDO}, SUM(l.monto) AS neto, MIN(l.creado_en) AS creado, 'comida:' || p.id AS clave
            FROM libro l JOIN pedidos p ON p.id = l.pedido_id
           WHERE l.bolsillo = 'directo' AND l.concepto = 'comida_comprada_sin_entregar'
           GROUP BY p.id`,
    mapear: (f) =>
      base(
        'comida',
        String(f.clave),
        f,
        { pagadoPorRepartidor: -n(f.neto) },
        'El repartidor pagó la comida y el pedido no se entregó. Quién la absorbe está pendiente de decisión (decisión 20).',
      ),
  },
  {
    // Pago en el local que el restaurante no confirmó y el pedido ya salió.
    tipo: 'local',
    sql: `SELECT ${CON_PEDIDO}, l.monto_pagado, l.importe_ticket, l.creado_en AS creado, 'local:' || p.id AS clave
            FROM pagos_local l JOIN pedidos p ON p.id = l.pedido_id
           WHERE l.confirmado_restaurante_en IS NULL AND p.estado IN ('en_camino', 'entregado')`,
    mapear: (f) =>
      base(
        'local',
        String(f.clave),
        f,
        { pagado: n(f.monto_pagado), ticket: n(f.importe_ticket) },
        'El restaurante no confirmó en la app que recibió el pago en el mostrador.',
      ),
  },
  {
    // Incidencias de dinero abiertas. El texto se arma desde los datos, en los dos idiomas (el
    // detalle guardado queda como registro original).
    tipo: 'incidencia',
    sql: `SELECT i.id, i.tipo AS incidencia_tipo, i.pedido_id, i.pais, i.moneda, i.monto_esperado, i.monto_recibido, i.detalle,
                 i.creado_en AS creado, (SELECT nombre FROM usuarios WHERE id = i.cuenta_id) AS repartidor, 'incidencia:' || i.id AS clave
            FROM incidencias_dinero i WHERE i.estado = 'abierta'`,
    mapear: (f) => {
      const conocido = f.incidencia_tipo === 'recarga_monto_distinto';
      return {
        ...base(
          'incidencia',
          String(f.clave),
          f,
          { esperado: n(f.monto_esperado), recibido: n(f.monto_recibido) },
          conocido
            ? 'Stripe confirmó un monto o una moneda distintos de la recarga pedida. No se acreditó nada.'
            : String(f.detalle ?? ''),
        ),
        detalleEn: conocido
          ? 'Stripe confirmed an amount or currency different from the requested top-up. Nothing was credited.'
          : String(f.detalle ?? ''),
      };
    },
  },
  {
    // Recargas con tarjeta disputadas (el saldo NO se toca: decisión de Richard).
    tipo: 'recarga_disputada',
    sql: `SELECT d.id AS disputa, d.monto, d.estado AS disputa_estado, d.creado_en AS creado, r.moneda, r.pais,
                 r.monto AS recarga_monto, (SELECT nombre FROM usuarios WHERE id = r.usuario_id) AS repartidor,
                 'recarga_disputada:' || d.id AS clave
            FROM disputas d JOIN recargas r ON r.id = d.recarga_id`,
    mapear: (f) => ({
      ...base(
        'recarga_disputada',
        String(f.clave),
        f,
        { disputado: n(f.monto), recarga: n(f.recarga_monto) },
        `Disputa ${String(f.disputa_estado)}. El saldo de la recarga no se tocó: qué hacer con él lo decide Richard.`,
      ),
      detalleEn: `Dispute ${String(f.disputa_estado)}. The top-up balance wasn’t touched: Richard decides what to do with it.`,
    }),
  },
  {
    // Recargas con tarjeta pendientes desde hace más de un día (Stripe no confirmó).
    tipo: 'recarga_pendiente',
    sql: `SELECT r.id, r.moneda, r.pais, r.monto, r.creado_en AS creado,
                 (SELECT nombre FROM usuarios WHERE id = r.usuario_id) AS repartidor, 'recarga_pendiente:' || r.id AS clave
            FROM recargas r WHERE r.canal = 'stripe' AND r.estado = 'pendiente' AND r.creado_en < datetime('now', '-1 day')`,
    mapear: (f) =>
      base(
        'recarga_pendiente',
        String(f.clave),
        f,
        { monto: n(f.monto) },
        'Stripe no confirmó esta recarga en un día. No se acreditó nada.',
      ),
  },
];

/** Casos por página dentro de un tipo. */
export const POR_PAGINA = 50;

const sinResueltos = (incluir: boolean) =>
  incluir
    ? ''
    : `WHERE NOT EXISTS (SELECT 1 FROM casos_dinero cd WHERE cd.clave = x.clave AND cd.estado = 'resuelto')`;

async function conSeguimiento(db: D1Database, crudos: Crudo[]): Promise<Caso[]> {
  if (!crudos.length) return [];
  const seg = new Map<
    string,
    { clave: string; estado: Caso['estado']; responsable_id: string | null; nombre: string | null }
  >();
  for (const c of crudos) {
    const x = await db
      .prepare(
        'SELECT c.clave, c.estado, c.responsable_id, u.nombre FROM casos_dinero c LEFT JOIN usuarios u ON u.id = c.responsable_id WHERE c.clave = ?',
      )
      .bind(c.clave)
      .first<{
        clave: string;
        estado: Caso['estado'];
        responsable_id: string | null;
        nombre: string | null;
      }>();
    if (x) seg.set(c.clave, x);
  }
  return crudos.map((c) => {
    const x = seg.get(c.clave);
    return {
      ...c,
      estado: x?.estado ?? 'abierto',
      responsable: x?.responsable_id ? { id: x.responsable_id, nombre: x.nombre ?? '' } : null,
    };
  });
}

/**
 * Los casos de la bandeja. Con `tipo`, una página de ese tipo (los más viejos primero). Sin
 * `tipo`, la primera página de cada tipo. Siempre con el total por tipo, para que nada quede
 * escondido: si hay más, `hayMas` lo dice y se pide la página siguiente.
 */
export async function listarCasos(
  db: D1Database,
  filtro: { tipo?: TipoCaso; incluirResueltos?: boolean; pagina?: number } = {},
): Promise<{ casos: Caso[]; totales: Record<string, number>; hayMas: Record<string, boolean> }> {
  const incluir = Boolean(filtro.incluirResueltos);
  const pagina = Math.max(0, filtro.pagina ?? 0);
  const totales: Record<string, number> = {};
  const hayMas: Record<string, boolean> = {};
  const crudos: Crudo[] = [];
  for (const f of FUENTES) {
    const total = await db
      .prepare(`SELECT COUNT(*) AS n FROM (${f.sql}) x ${sinResueltos(incluir)}`)
      .first<{ n: number }>();
    totales[f.tipo] = Number(total?.n ?? 0);
    if (filtro.tipo && filtro.tipo !== f.tipo) continue;
    const desde = filtro.tipo ? pagina * POR_PAGINA : 0;
    const { results } = await db
      .prepare(
        `SELECT * FROM (${f.sql}) x ${sinResueltos(incluir)} ORDER BY x.creado, x.clave LIMIT ? OFFSET ?`,
      )
      .bind(POR_PAGINA, desde)
      .all<Fila>();
    hayMas[f.tipo] = desde + results.length < Number(total?.n ?? 0);
    crudos.push(...results.map(f.mapear));
  }
  const casos = (await conSeguimiento(db, crudos)).sort((a, b) =>
    a.creadoEn.localeCompare(b.creadoEn),
  );
  return { casos, totales, hayMas };
}

/** Un caso por su clave (cualquier estado), sin recorrer la bandeja entera. */
async function casoPorClave(db: D1Database, clave: string): Promise<Caso | null> {
  const tipo = clave.slice(0, clave.indexOf(':'));
  const f = FUENTES.find((x) => x.tipo === tipo);
  if (!f) return null;
  const fila = await db
    .prepare(`SELECT * FROM (${f.sql}) x WHERE x.clave = ?`)
    .bind(clave)
    .first<Fila>();
  if (!fila) return null;
  return (await conSeguimiento(db, [f.mapear(fila)]))[0] ?? null;
}

export async function detalleCaso(db: D1Database, clave: string) {
  const caso = await casoPorClave(db, clave);
  if (!caso) throw new ErrorDatos('Ese caso no existe.', undefined, 404);
  const { results: historial } = await db
    .prepare(
      'SELECT h.accion, h.nota, h.creado_en, u.nombre AS autor FROM casos_dinero_historial h LEFT JOIN usuarios u ON u.id = h.autor_id WHERE h.clave = ? ORDER BY h.id',
    )
    .bind(clave)
    .all<Fila>();
  let bitacora: Fila[] = [];
  let libro: unknown[] = [];
  const evidencias: string[] = [];
  if (caso.pedidoId) {
    bitacora = (
      await db
        .prepare(
          'SELECT evento, detalle, creado_en FROM bitacora_pedidos WHERE pedido_id = ? ORDER BY id',
        )
        .bind(caso.pedidoId)
        .all<Fila>()
    ).results;
    libro = await libroDePedido(db, caso.pedidoId);
    const fotos = await db
      .prepare(
        `SELECT tipo FROM evidencias WHERE pedido_id = ?1 AND clave != ''
         UNION ALL SELECT 'ticket' FROM pagos_local WHERE pedido_id = ?1 AND ticket_clave IS NOT NULL`,
      )
      .bind(caso.pedidoId)
      .all<{ tipo: string }>();
    for (const f of fotos.results)
      evidencias.push(`/datos/pedidos/${caso.pedidoId}/evidencia/${f.tipo}`);
  }
  return {
    caso,
    historial: historial.map((h) => ({
      accion: String(h.accion),
      nota: String(h.nota ?? ''),
      autor: s(h.autor),
      en: String(h.creado_en),
    })),
    bitacora: bitacora.map((b) => ({
      evento: String(b.evento),
      detalle: String(b.detalle ?? ''),
      en: String(b.creado_en),
    })),
    libro,
    evidencias,
  };
}

/**
 * Una acción de soporte sobre un caso. Idempotente: la misma `idempotencia` dos veces no hace nada
 * la segunda vez. Las acciones con dinero solo escriben un hecho (con referencia única) y nunca
 * borran ni compensan.
 */
export async function accionCaso(
  db: D1Database,
  p: { clave: string; accion: string; nota: string; idempotencia: string; autorId: string },
) {
  // Reintento de una acción ya hecha (aunque el caso ya se haya cerrado): no se repite nada.
  const ya = await db
    .prepare('SELECT 1 FROM casos_dinero_historial WHERE idempotencia = ?')
    .bind(`${p.clave}:${p.idempotencia}`)
    .first();
  if (ya) return { repetida: true, caso: null };
  const { caso } = await detalleCaso(db, p.clave);
  if (!caso.acciones.includes(p.accion))
    throw new ErrorDatos('Esa acción no está permitida en este caso.', 'accion', 409);
  if (caso.estado === 'resuelto' && p.accion !== 'nota')
    throw new ErrorDatos('Ese caso ya está resuelto.', undefined, 409);
  const nota = p.nota.trim().slice(0, 1000);
  if (
    ['resolver', 'excedente_devuelto', 'confirmar_restaurante', 'nota'].includes(p.accion) &&
    nota.length < 5
  )
    throw new ErrorDatos('Escribe qué pasó y con qué evidencia.', 'nota', 422);
  // Primero el historial con su clave única: si ya existe, la acción ya se hizo.
  const h = await db
    .prepare(
      'INSERT OR IGNORE INTO casos_dinero_historial (clave, accion, nota, autor_id, idempotencia) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(p.clave, p.accion, nota, p.autorId, `${p.clave}:${p.idempotencia}`)
    .run();
  if (!h.meta.changes) return { repetida: true, caso };
  const estado =
    p.accion === 'resolver' ? 'resuelto' : p.accion === 'nota' ? caso.estado : 'en_revision';
  await db
    .prepare(
      `INSERT INTO casos_dinero (clave, estado, responsable_id) VALUES (?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET estado = excluded.estado,
         responsable_id = CASE WHEN ?4 = 'tomar' OR casos_dinero.responsable_id IS NULL THEN excluded.responsable_id ELSE casos_dinero.responsable_id END,
         actualizado_en = datetime('now')`,
    )
    .bind(p.clave, estado, p.autorId, p.accion)
    .run();
  if (p.accion === 'excedente_devuelto' && caso.pedidoId) {
    // El hecho: el repartidor devolvió lo que el cliente pagó de más. Cierra el bolsillo «directo».
    const por = caso.montos.porDevolver ?? 0;
    const f = await db
      .prepare('SELECT repartidor_id FROM pedidos WHERE id = ?')
      .bind(caso.pedidoId)
      .first<{ repartidor_id: string }>();
    if (por > 0 && f?.repartidor_id)
      await sentenciaLibro(db, {
        cuentaId: f.repartidor_id,
        bolsillo: 'directo',
        pais: caso.pais ?? 'US',
        moneda: caso.moneda,
        monto: por,
        concepto: 'excedente_devuelto_al_cliente',
        pedidoId: caso.pedidoId,
        referencia: `excedente-devuelto:${caso.pedidoId}`,
        autorId: p.autorId,
      }).run();
  }
  if (p.accion === 'confirmar_restaurante' && caso.pedidoId)
    await confirmarPagoLocalRestaurante(db, caso.pedidoId, `soporte:${p.autorId}`);
  if (caso.pedidoId)
    await anotarEvento(db, caso.pedidoId, `soporte_${p.accion}`, nota.slice(0, 200));
  if (caso.tipo === 'incidencia' && p.accion === 'resolver')
    await db
      .prepare(
        "UPDATE incidencias_dinero SET estado = 'resuelta', resuelta_en = datetime('now') WHERE id = ?",
      )
      .bind(p.clave.slice('incidencia:'.length))
      .run();
  // Si la acción cerró el hecho (excedente devuelto, incidencia resuelta), el caso ya no sale.
  const despues = await casoPorClave(db, p.clave);
  return { repetida: false, caso: despues ?? { ...caso, estado: 'resuelto' as const } };
}

/** Pieza «bandeja» de la salud: «pendiente» si hay casos abiertos (no es un error del sistema). */
export async function saludBandeja(db: D1Database): Promise<'ok' | 'pendiente'> {
  const { totales } = await listarCasos(db);
  return Object.values(totales).some((x) => x > 0) ? 'pendiente' : 'ok';
}

/** Anota una incidencia de dinero una sola vez por referencia. */
export async function abrirIncidencia(
  db: D1Database,
  i: {
    tipo: string;
    referencia: string;
    pedidoId?: string | null;
    recargaId?: string | null;
    cuentaId?: string | null;
    pais?: string | null;
    moneda?: string | null;
    esperado?: number | null;
    recibido?: number | null;
    detalle: string;
  },
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO incidencias_dinero (id, tipo, referencia, pedido_id, recarga_id, cuenta_id, pais, moneda, monto_esperado, monto_recibido, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      i.tipo,
      i.referencia,
      i.pedidoId ?? null,
      i.recargaId ?? null,
      i.cuentaId ?? null,
      i.pais ?? null,
      i.moneda ?? null,
      i.esperado ?? null,
      i.recibido ?? null,
      i.detalle,
    )
    .run();
}
