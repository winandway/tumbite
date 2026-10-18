import { abrirPedidoDirecto } from '../internacional/cobroDirecto';
import { acreditarRecargaStripe } from '../internacional/recargas';
import { registrarDisputa } from '../disputas';
import { avisoDeTransferencia } from '../retiros';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  type OpcionElegida,
  type Plan,
  type Turno,
  abiertoPorHorario,
  calcularPedido,
  distanciaKm,
  conSenal,
} from '@tumbite/compartido';
import { liquidarDesdeAviso } from '../liquidaciones';
import { minutosPausa } from '../pausa';
import { conHorarios, gruposDe } from './catalogo';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { formatearDolares } from '@tumbite/compartido';
import { type Variables, base, exigir } from '../sesion';
import { crearStripe, firmaValida } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { leerConfigDinero } from './dinero';
import { regalosDisponibles } from './regalos';
import { ZONA_INICIAL } from './zonas';
import { exigirCobertura } from '../territorio';
import { anotar } from '../historial';
import { anotarEvento, cancelarConReembolso } from '../manager';
import { avisoPedidoAlRestaurante, reciboDePedido } from '../avisos';
import { AVISOS, notificar } from '../notificaciones';
import { enviarCorreo } from '../correo';

export const pedidos = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaNuevoPedido = z.object({
  restauranteId: z.string().min(1),
  lineas: z
    .array(
      z.object({
        platoId: z.string().min(1),
        cantidad: z.number().int().min(1).max(99),
        // Opciones elegidas (ids): el servidor valida mínimos, máximos y precios.
        opciones: z.array(z.string().min(1)).max(40).default([]),
      }),
    )
    .min(1, { error: 'Tu carrito está vacío.' })
    .max(50),
  /** Lo que la app le mostró al cliente: si no coincide con el cálculo del servidor, no se cobra (F6). */
  totalEsperado: z.number().int().min(0).optional(),
  propinaCentavos: z.number().int().min(0).max(50_000),
  direccion: z.string().trim().max(200).default(''),
  notas: z.string().trim().max(300).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  regalo: z.enum(['cumpleanos', 'sellos', 'vuelve']).nullable().default(null),
  // Cómo quiere recibir: en la puerta (foto obligatoria) o en mano (foto opcional).
  entrega: z.enum(['puerta', 'mano', 'recoger']).default('puerta'),
  // Si es en mano: PIN de 4 dígitos que da quien recibe (se apaga si va a recibir otra persona).
  pin: z.boolean().default(true),
  /** Fase 2: cobro directo (el cliente paga al repartidor al recibir). Solo con el interruptor del país. */
  metodoPago: z.enum(['tarjeta', 'efectivo', 'transferencia_repartidor']).default('tarjeta'),
});

export type FilaPedido = Record<string, unknown>;

/** Para sumar a un SELECT con el pedido como «p»: si hay foto de recogida y de entrega. */
export const CON_EVIDENCIAS = `(SELECT creada_en FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'recogida') AS ev_recogida,
  (SELECT confirmada_en FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'recogida') AS ev_recogida_ok,
  (SELECT creada_en FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'entrega' AND e.clave <> '') AS ev_entrega,
  (SELECT modo FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'entrega') AS ev_entrega_modo,
  (SELECT nota FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'entrega') AS ev_entrega_nota,
  (SELECT modo FROM preferencias_entrega pe WHERE pe.pedido_id = p.id) AS entrega,
  (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id) AS recogida,
  (SELECT centavos FROM propinas_extra px WHERE px.pedido_id = p.id) AS propina_extra,
  (SELECT grupo_id FROM grupos_pedido gp WHERE gp.pedido_id = p.id) AS grupo_id,
  (SELECT 1 FROM pines_entrega pe WHERE pe.pedido_id = p.id) AS pin_requerido,
  (SELECT capturado_en FROM cobros co WHERE co.pedido_id = p.id) AS cobro_capturado_en`;

/** Para sumar a un SELECT con el pedido como «p»: el plato agotado pendiente de decisión. */
export const CON_AJUSTE = `(SELECT plato_id FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_plato,
  (SELECT nombre_es FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_es,
  (SELECT nombre_en FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_en,
  (SELECT estado FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_estado,
  (SELECT devolucion FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_devolucion,
  (SELECT creado_en FROM ajustes_pedido a WHERE a.pedido_id = p.id) AS aj_en_fecha`;

type Linea = {
  platoId: string;
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
  cantidad: number;
};

/** Lo que se le devolvería al cliente si se quita ese plato (el resto del pedido se recalcula). */
export async function calcularSinPlato(db: D1Database, f: FilaPedido, platoId: string) {
  const lineas = JSON.parse(String(f.lineas_json)) as Linea[];
  const nuevas = lineas.filter((l) => l.platoId !== platoId);
  const config = await leerConfigDinero(db);
  if (!nuevas.length) return { nuevas, desglose: null, devolucion: Number(f.total) };
  const subtotal = nuevas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
  // C-FALLOS-DINERO (F8): un pedido para recoger se cobró sin envío; se recalcula igual.
  const recogida =
    f.recogida != null
      ? Boolean(f.recogida)
      : Boolean(
          await db
            .prepare('SELECT 1 AS r FROM recogidas WHERE pedido_id = ?')
            .bind(String(f.id))
            .first(),
        );
  const desglose = calcularPedido({
    lineas: nuevas,
    plan: String(f.plan) as Plan,
    propina: Number(f.propina),
    distanciaKm: f.distancia_km == null ? null : Number(f.distancia_km),
    config,
    regalo: Math.min(Number(f.regalo ?? 0), subtotal),
    recogida,
  });
  return { nuevas, desglose, devolucion: Math.max(0, Number(f.total) - desglose.totalCliente) };
}

/**
 * El cliente decidió (o pasaron 5 minutos): quitar el plato agotado y devolverle esa parte, o
 * cancelar todo. La devolución parcial se hace en Stripe ANTES de tocar el pedido; si Stripe
 * falla, el pedido queda como estaba y se avisa.
 */
export async function aplicarAjuste(
  env: Env,
  db: D1Database,
  pedidoId: string,
  decision: 'quitar' | 'cancelar',
  actorId: string,
) {
  const f = await db
    .prepare(`SELECT p.*, ${CON_AJUSTE} FROM pedidos p WHERE p.id = ?`)
    .bind(pedidoId)
    .first<FilaPedido>();
  if (!f || f.aj_estado !== 'pendiente')
    throw new ErrorDatos('Este pedido ya no tiene nada que decidir.', undefined, 409);
  if (!['pagado', 'aceptado'].includes(String(f.estado)))
    throw new ErrorDatos('Este pedido ya cambió de estado.', undefined, 409);
  const { nuevas, desglose, devolucion } = await calcularSinPlato(db, f, String(f.aj_plato));
  if (decision === 'cancelar' || !desglose) {
    const ok = await cancelarConReembolso(env, db, pedidoId, {
      desde: ['pagado', 'aceptado'],
      actorId,
    });
    if (!ok) throw new ErrorDatos('Este pedido ya no se puede cancelar.', undefined, 409);
    await db
      .prepare(
        "UPDATE ajustes_pedido SET estado = 'cancelado', devolucion = ?, resuelto_en = datetime('now') WHERE pedido_id = ?",
      )
      .bind(Number(f.total), pedidoId)
      .run();
    await anotarEvento(db, pedidoId, 'cancelado_por_plato_agotado');
    return { devolucion: Number(f.total), cancelado: true };
  }
  const capturado = await db
    .prepare('SELECT capturado_en FROM cobros WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ capturado_en: string | null }>();
  // Con el cobro solo autorizado, no hay nada que devolver: al entregar se captura el total nuevo.
  if (devolucion > 0 && f.stripe_pago && capturado?.capturado_en) {
    const stripe = crearStripe(env.STRIPE_SECRET_KEY);
    if (!stripe)
      throw new ErrorDatos('No pudimos hacer la devolución en este momento.', undefined, 503);
    await stripe.post(
      '/refunds',
      {
        payment_intent: String(f.stripe_pago),
        amount: devolucion,
        metadata: { pedido_id: pedidoId, motivo: 'plato_agotado' },
      },
      `ajuste-${pedidoId}`,
    );
  }
  await db.batch([
    db
      .prepare(
        'UPDATE pedidos SET lineas_json = ?, subtotal = ?, envio = ?, servicio = ?, cargo_pequeno = ?, propina = ?, total = ?, comision = ?, pago_restaurante = ?, pago_repartidor = ?, complemento = ?, ganancia = ? WHERE id = ?',
      )
      .bind(
        JSON.stringify(nuevas),
        desglose.subtotal,
        desglose.envio,
        desglose.servicio,
        desglose.cargoPedidoPequeno,
        desglose.propina,
        desglose.totalCliente,
        desglose.comisionRestaurante,
        desglose.pagoRestaurante,
        desglose.pagoRepartidor,
        desglose.complementoRepartidor,
        desglose.gananciaPlataforma,
        pedidoId,
      ),
    db
      .prepare(
        "UPDATE ajustes_pedido SET estado = 'quitado', devolucion = ?, resuelto_en = datetime('now') WHERE pedido_id = ?",
      )
      .bind(devolucion, pedidoId),
  ]);
  await anotarEvento(db, pedidoId, 'plato_quitado', `${devolucion} centavos`);
  const cli = await db
    .prepare('SELECT idioma FROM usuarios WHERE id = ?')
    .bind(String(f.cliente_id))
    .first<{ idioma: string }>();
  const i = cli?.idioma === 'en' ? 'en' : 'es';
  await notificar(env, db, String(f.cliente_id), {
    ...AVISOS.platoQuitado(
      i,
      i === 'en' ? String(f.aj_en || f.aj_es) : String(f.aj_es),
      devolucion,
    ),
    datos: { pedidoId },
  });
  return { devolucion, cancelado: false };
}

/** Las líneas del pedido tal como se congelaron al pedir (nombres, precios, opciones, edad). */
export function lineasDe(f: FilaPedido): {
  platoId: string;
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
  cantidad: number;
  opciones?: OpcionElegida[];
  requiereEdad?: boolean;
}[] {
  try {
    const v = JSON.parse(String(f.lineas_json ?? '[]')) as unknown;
    return Array.isArray(v) ? (v as ReturnType<typeof lineasDe>) : [];
  } catch {
    return [];
  }
}

export function aPedido(f: FilaPedido) {
  return {
    id: String(f.id),
    estado: String(f.estado),
    restauranteId: String(f.restaurante_id),
    restauranteNombre: f.restaurante_nombre == null ? undefined : String(f.restaurante_nombre),
    lineas: JSON.parse(String(f.lineas_json)) as {
      platoId: string;
      nombreEs: string;
      nombreEn: string;
      precioCentavos: number;
      cantidad: number;
      opciones?: OpcionElegida[];
    }[],
    subtotal: Number(f.subtotal),
    envio: Number(f.envio),
    servicio: Number(f.servicio),
    impuesto: Number(f.impuesto ?? 0),
    metodoPago: String(f.metodo_pago ?? 'tarjeta'),
    cobroEstado: String(f.cobro_estado ?? 'no_aplica'),
    montoRecibido: f.monto_recibido == null ? null : Number(f.monto_recibido),
    conciliacionEstado: String(f.conciliacion_estado ?? 'no_aplica'),
    cobroConfirmadoPor: f.cobro_confirmado_por ? String(f.cobro_confirmado_por) : null,
    cargoPedidoPequeno: Number(f.cargo_pequeno),
    propina: Number(f.propina),
    regalo: Number(f.regalo),
    total: Number(f.total),
    direccion: String(f.direccion),
    notas: String(f.notas ?? ''),
    lat: f.lat == null ? null : Number(f.lat),
    lng: f.lng == null ? null : Number(f.lng),
    tiempoPrepMin: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
    creadoEn: String(f.creado_en),
    pagadoEn: (f.pagado_en as string | null) ?? null,
    aceptadoEn: (f.aceptado_en as string | null) ?? null,
    listoEn: (f.listo_en as string | null) ?? null,
    recogidoEn: (f.recogido_en as string | null) ?? null,
    entregadoEn: (f.entregado_en as string | null) ?? null,
    repartidorId: (f.repartidor_id as string | null) ?? null,
    // Las fotos se piden aparte, con sesión (GET /datos/pedidos/:id/evidencia/:tipo).
    fotoRecogida: f.ev_recogida
      ? {
          tomadaEn: String(f.ev_recogida),
          confirmadaEn: (f.ev_recogida_ok as string | null) ?? null,
        }
      : null,
    fotoEntrega: f.ev_entrega ? { tomadaEn: String(f.ev_entrega) } : null,
    // Cómo pidió recibirlo y cómo se entregó de verdad (en mano, en la puerta, en lugar seguro).
    entrega: f.recogida ? 'recoger' : (f.entrega as string | null) === 'mano' ? 'mano' : 'puerta',
    propinaExtra: f.propina_extra == null ? null : Number(f.propina_extra),
    grupoId: (f.grupo_id as string | null) ?? null,
    requiereEdad: lineasDe(f).some((l) => l.requiereEdad),
    entregadoComo: (f.ev_entrega_modo as string | null) ?? null,
    notaEntrega: String(f.ev_entrega_nota ?? ''),
    // El PIN mismo solo lo ve el cliente (va aparte, en el seguimiento).
    pinRequerido: f.pin_requerido != null,
    // Plato agotado: qué falta, qué se devolvería y si el cliente ya decidió.
    ajuste: f.aj_plato
      ? {
          platoId: String(f.aj_plato),
          nombreEs: String(f.aj_es ?? ''),
          nombreEn: String(f.aj_en ?? ''),
          estado: String(f.aj_estado) as 'pendiente' | 'quitado' | 'cancelado',
          devolucion: f.aj_devolucion == null ? null : Number(f.aj_devolucion),
          creadoEn: String(f.aj_en_fecha ?? ''),
        }
      : null,
  };
}

/**
 * Crear un pedido. El precio SIEMPRE lo calcula el servidor con los precios de la base:
 * lo que mande el teléfono solo dice qué platos y cuántos.
 */
pedidos.post('/pedidos', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(c, esquemaNuevoPedido);
  const db = base(c);
  const rest = await db
    .prepare("SELECT * FROM restaurantes WHERE id = ? AND estado = 'aprobado'")
    .bind(d.restauranteId)
    .first<Record<string, unknown>>();
  if (!rest) throw new ErrorDatos('Este restaurante no está disponible.', undefined, 404);
  if (Number(rest.abierto) !== 1)
    throw new ErrorDatos('El restaurante acaba de cerrar. Intenta más tarde.', undefined, 409);
  const [restConHorario] = await conHorarios(db, [rest]);
  if (!abiertoPorHorario(restConHorario!.horarios as Turno[], String(restConHorario!.zona_horaria)))
    throw new ErrorDatos(
      'El restaurante está cerrado a esta hora. Mira a qué hora abre.',
      undefined,
      409,
    );
  // C-PAUSA-SIN-SENAL: si su app o su panel no están escuchando, el pedido no le llegaría a nadie.
  if (!conSenal(rest.senal_en as string | null, new Date(), await minutosPausa(db)))
    throw new ErrorDatos(
      'El restaurante no está recibiendo pedidos en este momento. Intenta en unos minutos.',
      undefined,
      409,
    );

  const ids = [...new Set(d.lineas.map((l) => l.platoId))];
  const { results: platos } = await db
    .prepare(
      `SELECT * FROM platos WHERE restaurante_id = ? AND eliminado = 0 AND id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(rest.id, ...ids)
    .all<Record<string, unknown>>();
  const porId = new Map(platos.map((p) => [String(p.id), p]));
  const grupos = await gruposDe(db, ids);
  const lineas = d.lineas.map((l) => {
    const p = porId.get(l.platoId);
    if (!p || Number(p.disponible) !== 1)
      throw new ErrorDatos(
        'Uno de los platos ya no está disponible. Revisa tu carrito.',
        'lineas',
        409,
      );
    // Opciones: cada grupo dentro de su mínimo y máximo, solo opciones disponibles, precio sumado.
    const elegidas: OpcionElegida[] = [];
    for (const g of grupos.get(l.platoId) ?? []) {
      const delGrupo = g.opciones.filter((o) => l.opciones.includes(o.id));
      if (delGrupo.length < g.minimo || delGrupo.length > g.maximo)
        throw new ErrorDatos(
          `Elige entre ${g.minimo} y ${g.maximo} en «${g.nombreEs}».`,
          'lineas',
          409,
        );
      for (const o of delGrupo) {
        if (!o.disponible)
          throw new ErrorDatos('Una de las opciones ya no está disponible.', 'lineas', 409);
        elegidas.push({
          id: o.id,
          nombreEs: o.nombreEs,
          nombreEn: o.nombreEn,
          precioCentavos: o.precioCentavos,
        });
      }
    }
    const conocidas = new Set(elegidas.map((o) => o.id));
    if (l.opciones.some((id) => !conocidas.has(id)))
      throw new ErrorDatos('Una de las opciones no es de este plato.', 'lineas', 409);
    return {
      platoId: l.platoId,
      nombreEs: String(p.nombre_es),
      nombreEn: String(p.nombre_en),
      precioCentavos:
        Number(p.precio_centavos) + elegidas.reduce((s, o) => s + o.precioCentavos, 0),
      cantidad: l.cantidad,
      opciones: elegidas,
      // Congelado al pedir: si el plato es para mayores de 21, la entrega lo exige en mano.
      requiereEdad: Number(p.requiere_edad ?? 0) === 1,
    };
  });

  const recogida = d.entrega === 'recoger';
  if (recogida) {
    // Recogida en el local: la «dirección de entrega» es el propio restaurante.
    d.direccion = String(rest.direccion ?? '');
    d.lat = rest.lat == null ? null : Number(rest.lat);
    d.lng = rest.lng == null ? null : Number(rest.lng);
  } else if (d.direccion.length < 5)
    throw new ErrorDatos('Escribe la dirección de entrega.', 'direccion', 422);
  const km =
    d.lat != null && d.lng != null && rest.lat != null && rest.lng != null
      ? distanciaKm({ lat: d.lat, lng: d.lng }, { lat: Number(rest.lat), lng: Number(rest.lng) })
      : null;
  if (km != null && km > 25)
    throw new ErrorDatos(
      'Esa dirección está fuera del área de entrega de este restaurante.',
      'direccion',
      409,
    );
  await exigirCobertura(db, String(rest.zona_id ?? ZONA_INICIAL), d.lat, d.lng, recogida);
  const plan = rest.plan as Plan;
  const config = await leerConfigDinero(db);
  let regalo = 0;
  if (d.regalo) {
    const subtotal = lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
    const precios = new Map(lineas.map((l) => [l.platoId, l.precioCentavos]));
    const disponible = (
      await regalosDisponibles(db, String(rest.id), u.id, subtotal, precios)
    ).find((r) => r.tipo === d.regalo);
    if (!disponible) throw new ErrorDatos('Ese regalo ya no está disponible.', 'regalo', 409);
    regalo = disponible.valorCentavos;
  }
  const desglose = calcularPedido({
    lineas,
    plan,
    propina: d.propinaCentavos,
    distanciaKm: km,
    config,
    regalo,
    recogida,
  });
  // C-FALLOS-DINERO (F6): el cliente paga exactamente lo que vio. Si la app calculó otra cosa
  // (envío en una recogida, configuración vieja), se le devuelve el total correcto y no se cobra.
  if (d.totalEsperado != null && d.totalEsperado !== desglose.totalCliente)
    return c.json(
      {
        error: 'El total cambió. Revisa tu carrito y vuelve a intentar.',
        campo: 'total',
        totalActual: d.totalEsperado,
        nuevoTotal: desglose.totalCliente,
        desglose,
      },
      409,
    );

  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
        pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, lat, lng, distancia_km, tiempo_prep_min, regalo, regalo_tipo, zona_id, area_id, impuesto)
       VALUES (?, ?, ?, 'pago_pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      u.id,
      rest.id,
      JSON.stringify(lineas),
      desglose.subtotal,
      desglose.envio,
      desglose.servicio,
      desglose.cargoPedidoPequeno,
      desglose.propina,
      desglose.totalCliente,
      desglose.comisionRestaurante,
      desglose.pagoRestaurante,
      desglose.pagoRepartidor,
      desglose.complementoRepartidor,
      desglose.gananciaPlataforma,
      plan,
      d.direccion,
      d.notas,
      d.lat,
      d.lng,
      km,
      Number(rest.tiempo_prep_min),
      regalo,
      d.regalo,
      String(rest.zona_id ?? ZONA_INICIAL),
      (rest.area_id as string | null) ?? null,
      desglose.impuesto,
    )
    .run();
  await db
    .prepare('INSERT OR REPLACE INTO preferencias_entrega (pedido_id, modo) VALUES (?, ?)')
    .bind(id, recogida ? 'mano' : d.entrega)
    .run();
  if (recogida)
    await db.prepare('INSERT OR IGNORE INTO recogidas (pedido_id) VALUES (?)').bind(id).run();
  // PIN también en la recogida en el local: el cliente lo muestra en el mostrador.
  if ((d.entrega === 'mano' || recogida) && d.pin) {
    const pin = String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 9000));
    await db
      .prepare('INSERT OR REPLACE INTO pines_entrega (pedido_id, pin) VALUES (?, ?)')
      .bind(id, pin)
      .run();
  }
  await anotar(db, id, 'pago_pendiente', u.id);

  // Fase 2 · cobro directo: sin Stripe. El pedido queda confirmado para el restaurante y el
  // cliente paga al repartidor al recibir (efectivo o transferencia a su cuenta).
  if (d.metodoPago !== 'tarjeta') {
    const { pais, moneda } = await abrirPedidoDirecto(db, {
      pedidoId: id,
      zonaId: String(rest.zona_id ?? ZONA_INICIAL),
      clienteId: u.id,
      metodo: d.metodoPago,
    });
    await anotar(db, id, 'pagado', u.id);
    await correosDePedidoPagado(c.env, db, id).catch((e: unknown) =>
      console.error('cobro directo: avisos', e),
    );
    return c.json(
      { pedidoId: id, directo: true, metodoPago: d.metodoPago, pais, moneda, desglose },
      201,
    );
  }

  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) {
    // Honesto: sin llaves de Stripe no se cobra. El pedido queda sin pagar y no le llega a nadie.
    throw new ErrorDatos(
      'Los pagos todavía no están activados. Te avisamos muy pronto.',
      undefined,
      422,
    );
  }
  // Pago dentro de la app (sin salto): un PaymentIntent del cliente de Stripe de esta persona,
  // y una sesión de cliente para que la hoja de pago muestre y guarde sus tarjetas.
  const fila = await db
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  let clienteStripe = fila?.stripe_cliente ?? null;
  if (!clienteStripe) {
    const cliente = await stripe.post<{ id: string }>(
      '/customers',
      { email: u.correo, name: u.nombre, metadata: { usuario_id: u.id } },
      `cliente-${u.id}`,
    );
    clienteStripe = cliente.id;
    await db
      .prepare('UPDATE usuarios SET stripe_cliente = ? WHERE id = ?')
      .bind(clienteStripe, u.id)
      .run();
  }
  const intento = await stripe.post<{ id: string; client_secret: string }>(
    '/payment_intents',
    {
      amount: desglose.totalCliente,
      currency: 'usd',
      customer: clienteStripe,
      automatic_payment_methods: { enabled: true },
      // Se AUTORIZA al pedir y se CAPTURA al entregar: si el restaurante no acepta, se anula la
      // autorización sin reembolso (Stripe no devuelve su comisión en un reembolso).
      capture_method: 'manual',
      // Obligatorio cuando la sesión del cliente permite guardar la tarjeta: sin esto, Stripe
      // se niega a pintar el formulario (y lo hace en silencio). Candado C-PAGO-FORMULARIO.
      setup_future_usage: 'off_session',
      description: `Tumbite · ${String(rest.nombre)}`,
      metadata: { pedido_id: id },
    },
    `pedido-${id}`,
  );
  const funciones = {
    payment_method_save: 'enabled',
    payment_method_redisplay: 'enabled',
    payment_method_remove: 'enabled',
  };
  const sesionCliente = await stripe.post<{ client_secret: string }>('/customer_sessions', {
    customer: clienteStripe,
    components: {
      payment_element: { enabled: true, features: funciones },
      mobile_payment_element: { enabled: true, features: funciones },
    },
  });
  await db.prepare('UPDATE pedidos SET stripe_sesion = ? WHERE id = ?').bind(intento.id, id).run();
  return c.json(
    {
      pedidoId: id,
      clientSecret: intento.client_secret,
      sesionCliente: sesionCliente.client_secret,
      clienteStripe,
      // La clave pública viaja con el cobro: la app no depende de otra consulta (que puede venir
      // vieja de la caché) para pintar el formulario de tarjeta.
      clavePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
      desglose,
    },
    201,
  );
});

/**
 * Aviso de Stripe. Sin firma válida no se toca nada. Cada aviso se procesa una sola vez.
 */
pedidos.post('/stripe/aviso', async (c) => {
  const cuerpo = await c.req.text();
  // Stripe firma con un secreto distinto los avisos de la cuenta propia y los de las cuentas
  // conectadas (son dos endpoints en su panel). C-FALLOS-DINERO (F10): se aceptan los dos.
  const secretos = [c.env.STRIPE_WEBHOOK_SECRET, c.env.STRIPE_WEBHOOK_SECRET_CONECTADAS].filter(
    (s): s is string => Boolean(s),
  );
  let firmada = false;
  for (const secreto of secretos)
    if (await firmaValida(cuerpo, c.req.header('stripe-signature'), secreto)) {
      firmada = true;
      break;
    }
  if (!firmada) {
    console.error('aviso de stripe con firma inválida o sin secreto configurado');
    return c.json({ error: 'firma inválida' }, 400);
  }
  const evento = JSON.parse(cuerpo) as {
    id: string;
    type: string;
    /** En los avisos de cuentas conectadas, la cuenta a la que pertenece. */
    account?: string;
    data: { object: Record<string, unknown> };
  };
  const db = base(c);
  // C-FALLOS-CRITICOS 1 (idempotencia persistente): la marca del aviso tiene estado. Solo quien
  // la crea («procesando») procesa; «hecho» responde repetido sin tocar nada; una marca a medias
  // ajena responde 409 para que Stripe reintente más tarde; una marca a medias abandonada (el
  // servidor murió hace más de 5 minutos) se reclama y se vuelve a procesar.
  const nuevo = await db
    .prepare("INSERT OR IGNORE INTO avisos_stripe (id, tipo, estado) VALUES (?, ?, 'procesando')")
    .bind(evento.id, evento.type)
    .run();
  if (!nuevo.meta.changes) {
    const reclamada = await db
      .prepare(
        "UPDATE avisos_stripe SET recibido_en = datetime('now') WHERE id = ? AND estado = 'procesando' AND recibido_en < datetime('now', '-5 minutes')",
      )
      .bind(evento.id)
      .run();
    if (!reclamada.meta.changes) {
      const marca = await db
        .prepare('SELECT estado FROM avisos_stripe WHERE id = ?')
        .bind(evento.id)
        .first<{ estado: string }>();
      if (marca?.estado === 'procesando') return c.json({ ok: false, enCurso: true }, 409);
      return c.json({ ok: true, repetido: true });
    }
    console.error('aviso de Stripe a medias abandonado; se vuelve a procesar', evento.id);
  }

  // Si el aviso falla a medias, se suelta SU marca (solo si sigue «procesando») para que el
  // reintento de Stripe (mismo id de evento) sí lo aplique. Un aviso perdido es dinero sin acreditar.
  try {
    const obj = evento.data.object;
    if (evento.type === 'checkout.session.completed' && obj.payment_status === 'paid') {
      const pedidoId = (obj.metadata as Record<string, string> | undefined)?.pedido_id;
      const pedido = pedidoId
        ? await db
            .prepare('SELECT total, stripe_sesion, estado FROM pedidos WHERE id = ?')
            .bind(pedidoId)
            .first<{ total: number; stripe_sesion: string; estado: string }>()
        : null;
      if (!pedido) {
        console.error('aviso de pago sin pedido conocido', pedidoId);
      } else if (
        pedido.stripe_sesion !== obj.id ||
        Number(obj.amount_total) !== Number(pedido.total)
      ) {
        console.error(
          'aviso de pago que no cuadra con el pedido',
          pedidoId,
          obj.amount_total,
          pedido.total,
        );
      } else if (pedido.estado === 'pago_pendiente') {
        await db
          .prepare(
            "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = ? WHERE id = ?",
          )
          .bind(String(obj.payment_intent ?? ''), pedidoId)
          .run();
        await anotar(db, pedidoId as string, 'pagado', null);
        await correosDePedidoPagado(c.env, db, pedidoId as string);
      }
    }
    if (evento.type === 'payment_intent.amount_capturable_updated') {
      // La tarjeta quedó AUTORIZADA por el total: el pedido pasa a pagado y se cobra al entregar.
      const pedidoId = (obj.metadata as Record<string, string> | undefined)?.pedido_id;
      const pedido = pedidoId
        ? await db
            .prepare('SELECT total, stripe_sesion, estado FROM pedidos WHERE id = ?')
            .bind(pedidoId)
            .first<{ total: number; stripe_sesion: string; estado: string }>()
        : null;
      if (!pedido) {
        if (pedidoId) console.error('aviso de autorización sin pedido conocido', pedidoId);
      } else if (
        pedido.stripe_sesion !== obj.id ||
        Number(obj.amount_capturable) !== Number(pedido.total)
      ) {
        console.error(
          'aviso de autorización que no cuadra con el pedido',
          pedidoId,
          obj.amount_capturable,
          pedido.total,
        );
      } else if (pedido.estado === 'pago_pendiente') {
        await db.batch([
          db
            .prepare(
              "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = ? WHERE id = ?",
            )
            .bind(String(obj.id), pedidoId),
          db.prepare('INSERT OR IGNORE INTO cobros (pedido_id) VALUES (?)').bind(pedidoId),
        ]);
        await anotar(db, pedidoId as string, 'pagado', null);
        await correosDePedidoPagado(c.env, db, pedidoId as string);
      }
    }
    if (evento.type === 'payment_intent.succeeded') {
      // Fase 2: recarga del saldo prepago de un repartidor (nunca es un pedido).
      if ((obj.metadata as Record<string, string> | undefined)?.recarga_id)
        await acreditarRecargaStripe(db, obj);
      const pedidoId = (obj.metadata as Record<string, string> | undefined)?.pedido_id;
      const pedido = pedidoId
        ? await db
            .prepare('SELECT total, stripe_sesion, estado FROM pedidos WHERE id = ?')
            .bind(pedidoId)
            .first<{ total: number; stripe_sesion: string; estado: string }>()
        : null;
      if (!pedido) {
        if (pedidoId) console.error('aviso de pago sin pedido conocido', pedidoId);
      } else if (
        pedido.stripe_sesion !== obj.id ||
        Number(obj.amount_received) !== Number(pedido.total)
      ) {
        console.error(
          'aviso de pago que no cuadra con el pedido',
          pedidoId,
          obj.amount_received,
          pedido.total,
        );
      } else if (pedido.estado === 'pago_pendiente') {
        // Cobro inmediato (sin autorización previa): se guarda ya capturado.
        await db.batch([
          db
            .prepare(
              "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = ? WHERE id = ?",
            )
            .bind(String(obj.id), pedidoId),
          db
            .prepare(
              "INSERT OR REPLACE INTO cobros (pedido_id, capturado_en, capturado) VALUES (?, datetime('now'), ?)",
            )
            .bind(pedidoId, Number(obj.amount_received)),
        ]);
        await anotar(db, pedidoId as string, 'pagado', null);
        await correosDePedidoPagado(c.env, db, pedidoId as string);
      } else {
        // Captura confirmada por Stripe (al entregar): queda anotada aunque el servidor ya lo supiera,
        // y cierra la liquidación si quedó a medias (C-COBRO-AL-ENTREGAR).
        await liquidarDesdeAviso(db, pedidoId as string, Number(obj.amount_received));
      }
    }
    if (evento.type === 'account.updated') {
      const activo = obj.payouts_enabled === true && obj.charges_enabled !== false ? 1 : 0;
      await db
        .prepare('UPDATE cuentas_stripe SET pagos_activos = ? WHERE stripe_cuenta = ?')
        .bind(activo, String(obj.id))
        .run();
    }
    // Fase 0: el aviso de transferencia confirma el retiro; si Stripe transfirió un retiro marcado
    // «fallido» (saldo ya devuelto) o revirtió una transferencia, se avisa al equipo.
    if (evento.type === 'transfer.created' || evento.type === 'transfer.reversed') {
      const r = await avisoDeTransferencia(db, evento.type, obj);
      if (r === 'alerta')
        for (const para of (c.env.ADMIN_CORREOS ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean))
          await enviarCorreo(c.env, {
            de: 'avisos',
            para,
            asunto: `Revisar retiro: ${evento.type} ${String(obj.id ?? '')}`,
            texto: `Stripe envió ${evento.type} para la transferencia ${String(obj.id ?? '')} (${String(obj.transfer_group ?? '')}). El retiro quedó en revisión: compruébalo en Stripe antes de tocar el saldo.`,
          }).catch((e: unknown) => console.error('retiro: correo equipo', e));
    }
    // Abono fallido (el banco rechazó el depósito): se avisa a quien es el dinero y al equipo.
    if (evento.type === 'payout.failed') {
      const cuentaStripe = String(evento.account ?? '');
      const duenio = await db
        .prepare(
          'SELECT s.usuario_id, u.nombre, u.correo, u.idioma FROM cuentas_stripe s JOIN usuarios u ON u.id = s.usuario_id WHERE s.stripe_cuenta = ?',
        )
        .bind(cuentaStripe)
        .first<{ usuario_id: string; nombre: string; correo: string; idioma: string }>();
      const motivo = String(obj.failure_message ?? obj.failure_code ?? '');
      await db
        .prepare(
          'INSERT INTO abonos_fallidos (id, usuario_id, stripe_cuenta, motivo) VALUES (?, ?, ?, ?)',
        )
        .bind(nuevoId(), duenio?.usuario_id ?? null, cuentaStripe, motivo)
        .run();
      const monto = formatearDolares(
        Number(obj.amount ?? 0),
        duenio?.idioma === 'en' ? 'en' : 'es',
      );
      if (duenio) {
        await notificar(
          c.env,
          db,
          duenio.usuario_id,
          AVISOS.abonoFallido(duenio.idioma, monto),
        ).catch((e: unknown) => console.error('abono fallido: aviso', e));
        await enviarCorreo(c.env, {
          de: 'avisos',
          para: duenio.correo,
          asunto:
            duenio.idioma === 'en'
              ? `Your ${monto} payout didn’t go through`
              : `Tu abono de ${monto} no llegó al banco`,
          texto:
            duenio.idioma === 'en'
              ? `The bank rejected your ${monto} payout${motivo ? ` (${motivo})` : ''}. Open “Wallet” in your app and check your bank details; the money is still in your Tumbite balance.`
              : `El banco rechazó tu abono de ${monto}${motivo ? ` (${motivo})` : ''}. Entra a «Billetera» en tu app y revisa los datos de tu cuenta bancaria; el dinero sigue en tu saldo de Tumbite.`,
        }).catch((e: unknown) => console.error('abono fallido: correo', e));
      }
      for (const para of (c.env.ADMIN_CORREOS ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean))
        await enviarCorreo(c.env, {
          de: 'avisos',
          para,
          asunto: `Abono fallido: ${duenio?.nombre ?? cuentaStripe} (${monto})`,
          texto: `Stripe no pudo depositar ${monto} a ${duenio?.nombre ?? 'una cuenta sin dueño en la base'} (${cuentaStripe}). Motivo: ${motivo || 'sin detalle'}. Queda en abonos_fallidos.`,
        }).catch((e: unknown) => console.error('abono fallido: correo equipo', e));
    }
    // Disputas (contracargos): se anotan con su plazo y se avisa al equipo; la evidencia se manda
    // desde el panel de Stripe (auditoría final, A.12). Nunca se tocan saldos desde aquí.
    if (evento.type.startsWith('charge.dispute.')) {
      const r = await registrarDisputa(db, evento.type, obj);
      if (r?.nueva)
        for (const para of (c.env.ADMIN_CORREOS ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean))
          await enviarCorreo(c.env, {
            de: 'avisos',
            para,
            asunto: `Disputa abierta: ${formatearDolares(r.monto, 'es')} (${r.motivo || 'sin motivo'})`,
            texto: `Un cliente disputó un cobro de ${formatearDolares(r.monto, 'es')}${r.pedidoId ? ` del pedido ${r.pedidoId}` : ''}. Motivo: ${r.motivo || 'sin detalle'}. Responder en Stripe antes de ${r.venceEn ?? 'la fecha que indique Stripe'} con la foto de entrega y la bitácora del pedido.`,
          }).catch((e: unknown) => console.error('disputa: correo equipo', e));
    }
  } catch (e) {
    await db
      .prepare("DELETE FROM avisos_stripe WHERE id = ? AND estado = 'procesando'")
      .bind(evento.id)
      .run();
    console.error('aviso de Stripe sin terminar; se deja reintentar', evento.id, evento.type, e);
    throw e;
  }
  await db.prepare("UPDATE avisos_stripe SET estado = 'hecho' WHERE id = ?").bind(evento.id).run();
  return c.json({ ok: true });
});

/** Recibo al cliente y aviso al restaurante. Si el correo falla, el pedido sigue igual. */
async function correosDePedidoPagado(env: Env, db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      `SELECT p.id, p.lineas_json, p.subtotal, p.envio, p.servicio, p.propina, p.regalo, p.total, p.direccion, p.notas, p.pago_restaurante,
        c.correo AS cliente_correo, c.nombre AS cliente_nombre, c.idioma AS cliente_idioma,
        r.nombre AS restaurante, d.id AS dueno_id, d.correo AS dueno_correo, d.idioma AS dueno_idioma
       FROM pedidos p JOIN usuarios c ON c.id = p.cliente_id
       JOIN restaurantes r ON r.id = p.restaurante_id JOIN usuarios d ON d.id = r.dueno_id WHERE p.id = ?`,
    )
    .bind(pedidoId)
    .first<Record<string, unknown>>();
  if (!f) return;
  const lineas = JSON.parse(String(f.lineas_json)) as {
    nombreEs: string;
    nombreEn: string;
    precioCentavos: number;
    cantidad: number;
  }[];
  await reciboDePedido(env, {
    correo: String(f.cliente_correo),
    nombre: String(f.cliente_nombre),
    idioma: f.cliente_idioma === 'en' ? 'en' : 'es',
    pedidoId,
    restaurante: String(f.restaurante),
    lineas,
    subtotal: Number(f.subtotal),
    envio: Number(f.envio),
    servicio: Number(f.servicio),
    impuesto: Number(f.impuesto ?? 0),
    propina: Number(f.propina),
    regalo: Number(f.regalo),
    total: Number(f.total),
    direccion: String(f.direccion),
  });
  await avisoPedidoAlRestaurante(env, {
    correo: String(f.dueno_correo),
    idioma: f.dueno_idioma === 'en' ? 'en' : 'es',
    pedidoId,
    restaurante: String(f.restaurante),
    lineas,
    pagoRestaurante: Number(f.pago_restaurante),
    notas: String(f.notas ?? ''),
  });
  await notificar(env, db, String(f.dueno_id), {
    ...AVISOS.pedidoNuevo(
      f.dueno_idioma === 'en' ? 'en' : 'es',
      pedidoId.slice(0, 8).toUpperCase(),
    ),
    datos: { pedidoId },
  });
}

pedidos.get('/mis-pedidos', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare(
      `SELECT p.*, r.nombre AS restaurante_nombre FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.cliente_id = ? AND p.estado != 'pago_pendiente' ORDER BY p.creado_en DESC LIMIT 50`,
    )
    .bind(u.id)
    .all<FilaPedido>();
  return c.json({ pedidos: results.map(aPedido) });
});

pedidos.get('/pedidos/:id', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      `SELECT p.*, ${CON_EVIDENCIAS}, ${CON_AJUSTE}, r.nombre AS restaurante_nombre, r.dueno_id, r.lat AS rest_lat, r.lng AS rest_lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?`,
    )
    .bind(c.req.param('id'))
    .first<FilaPedido>();
  const puede =
    f &&
    (u.rol === 'admin' || f.cliente_id === u.id || f.dueno_id === u.id || f.repartidor_id === u.id);
  if (!f || !puede) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  return c.json({ pedido: aPedido(f) });
});

/** El cliente decide qué hacer con el plato agotado. */
pedidos.post('/pedidos/:id/ajuste', async (c) => {
  const u = exigir(c, 'cliente');
  const { decision } = await leerCuerpo(c, z.object({ decision: z.enum(['quitar', 'cancelar']) }));
  const f = await base(c)
    .prepare('SELECT cliente_id FROM pedidos WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ cliente_id: string }>();
  if (!f || f.cliente_id !== u.id) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const r = await aplicarAjuste(c.env, base(c), c.req.param('id'), decision, u.id);
  return c.json({ ok: true, ...r });
});

// ======================= Tarjetas guardadas (Mi cuenta) =======================

type MetodoStripe = {
  id: string;
  customer: string | null;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
};

/** Las tarjetas que la persona guardó en Stripe (Tumbite nunca ve el número completo). */
pedidos.get('/mis-tarjetas', async (c) => {
  const u = exigir(c, 'cliente');
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  const fila = await base(c)
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  if (!stripe || !fila?.stripe_cliente) return c.json({ tarjetas: [] });
  const r = await stripe.get<{ data: MetodoStripe[] }>(
    `/customers/${fila.stripe_cliente}/payment_methods`,
    { type: 'card', limit: 20 },
  );
  return c.json({
    tarjetas: r.data
      .filter((m) => m.card)
      .map((m) => ({
        id: m.id,
        marca: m.card?.brand ?? '',
        ultimos4: m.card?.last4 ?? '',
        vence: `${String(m.card?.exp_month ?? '').padStart(2, '0')}/${String(m.card?.exp_year ?? '').slice(-2)}`,
      })),
  });
});

/** Quitar una tarjeta guardada: solo si es de esta persona. */
pedidos.post('/mis-tarjetas/:id/quitar', async (c) => {
  const u = exigir(c, 'cliente');
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe) throw new ErrorDatos('Los pagos no están disponibles ahora.', undefined, 503);
  const id = c.req.param('id');
  if (!/^pm_[A-Za-z0-9]+$/.test(id)) throw new ErrorDatos('Esa tarjeta no existe.', undefined, 404);
  const fila = await base(c)
    .prepare('SELECT stripe_cliente FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ stripe_cliente: string | null }>();
  const metodo = await stripe.get<MetodoStripe>(`/payment_methods/${id}`).catch(() => null);
  if (!metodo || !fila?.stripe_cliente || metodo.customer !== fila.stripe_cliente)
    throw new ErrorDatos('Esa tarjeta no existe.', undefined, 404);
  await stripe.post(`/payment_methods/${id}/detach`, {});
  return c.json({ ok: true });
});

/**
 * Cambio de dirección por el cliente (como permiten los grandes): se recalcula la cobertura, el
 * envío y el total; si el total cambia, el cliente tiene que aceptar el nuevo antes de aplicarlo.
 * Solo antes de que el repartidor salga del restaurante y nunca en una recogida en el local.
 */
pedidos.patch('/pedidos/:id/direccion', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      direccion: z.string().trim().min(5, { error: 'Escribe la dirección de entrega.' }).max(200),
      lat: z.number().min(-90).max(90).nullable().default(null),
      lng: z.number().min(-180).max(180).nullable().default(null),
      aceptarTotal: z.boolean().default(false),
    }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare(
      `SELECT p.*, r.lat AS rest_lat, r.lng AS rest_lng, (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id) AS recogida FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.cliente_id = ?`,
    )
    .bind(id, u.id)
    .first<FilaPedido>();
  if (!f) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (f.recogida)
    throw new ErrorDatos('Este pedido se recoge en el local: no lleva dirección.', undefined, 409);
  if (!['pago_pendiente', 'pagado', 'aceptado', 'listo'].includes(String(f.estado)))
    throw new ErrorDatos(
      'El repartidor ya salió con tu pedido: ya no se puede cambiar la dirección. Escríbele por el chat.',
      undefined,
      409,
    );
  const km =
    d.lat != null && d.lng != null && f.rest_lat != null && f.rest_lng != null
      ? distanciaKm(
          { lat: d.lat, lng: d.lng },
          { lat: Number(f.rest_lat), lng: Number(f.rest_lng) },
        )
      : null;
  if (km != null && km > 25)
    throw new ErrorDatos(
      'Esa dirección está fuera del área de entrega de este restaurante.',
      'direccion',
      409,
    );
  await exigirCobertura(db, String(f.zona_id ?? ZONA_INICIAL), d.lat, d.lng);
  const config = await leerConfigDinero(db);
  const lineas = lineasDe(f);
  const desglose = calcularPedido({
    lineas,
    plan: String(f.plan) as Plan,
    propina: Number(f.propina),
    distanciaKm: km,
    config,
    regalo: Number(f.regalo ?? 0),
  });
  const nuevoTotal = desglose.totalCliente;
  if (nuevoTotal !== Number(f.total) && !d.aceptarTotal)
    return c.json(
      {
        error: 'El envío cambia con la nueva dirección. Acepta el nuevo total para aplicarla.',
        campo: 'total',
        totalActual: Number(f.total),
        nuevoTotal,
        envio: desglose.envio,
      },
      409,
    );
  // El cobro (autorizado y no capturado, o todavía sin confirmar) se actualiza en Stripe ANTES de
  // tocar nada. C-FALLOS-DINERO (F7): antes del pago el intento vive en stripe_sesion; si Stripe
  // rechaza el nuevo monto, la dirección no cambia y se responde 409, nunca 500.
  const intento = String(f.stripe_pago ?? f.stripe_sesion ?? '');
  if (nuevoTotal !== Number(f.total) && intento.startsWith('pi_')) {
    const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
    if (stripe) {
      try {
        await stripe.post(`/payment_intents/${intento}`, { amount: nuevoTotal });
      } catch (e) {
        console.error('cambio de dirección: Stripe no aceptó el nuevo monto', id, e);
        throw new ErrorDatos(
          'No pudimos actualizar el cobro con el nuevo total. La dirección no cambió; intenta de nuevo.',
          'total',
          409,
        );
      }
    }
  }
  await db
    .prepare(
      'UPDATE pedidos SET direccion = ?, lat = ?, lng = ?, distancia_km = ?, envio = ?, servicio = ?, total = ?, pago_repartidor = ?, complemento = ?, ganancia = ? WHERE id = ?',
    )
    .bind(
      d.direccion,
      d.lat,
      d.lng,
      km,
      desglose.envio,
      desglose.servicio,
      nuevoTotal,
      desglose.pagoRepartidor,
      desglose.complementoRepartidor,
      desglose.gananciaPlataforma,
      id,
    )
    .run();
  await anotarEvento(db, id, 'direccion_cambiada', d.direccion);
  // El repartidor asignado se entera en el momento (C-REPARTIDOR-GRANDES).
  const asignado = await db
    .prepare(
      'SELECT p.repartidor_id, u.idioma FROM pedidos p JOIN usuarios u ON u.id = p.repartidor_id WHERE p.id = ?',
    )
    .bind(id)
    .first<{ repartidor_id: string; idioma: string }>();
  if (asignado)
    await notificar(c.env, db, asignado.repartidor_id, {
      ...AVISOS.repDireccion(asignado.idioma, d.direccion),
      datos: { pedidoId: id },
    }).catch((e: unknown) => console.error('aviso dirección al repartidor', e));
  return c.json({ ok: true, total: nuevoTotal, envio: desglose.envio });
});

/**
 * Propina después de entregar: se cobra aparte con la tarjeta guardada (sin que el cliente la
 * vuelva a escribir) y va entera al repartidor. Una sola vez por pedido, hasta 7 días después.
 */
pedidos.post('/pedidos/:id/propina', async (c) => {
  const u = exigir(c, 'cliente');
  const { centavos } = await leerCuerpo(
    c,
    z.object({ centavos: z.number().int().min(100).max(10_000) }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare(
      `SELECT p.*, (SELECT centavos FROM propinas_extra px WHERE px.pedido_id = p.id) AS propina_extra, u.stripe_cliente
       FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.id = ? AND p.cliente_id = ?`,
    )
    .bind(id, u.id)
    .first<FilaPedido>();
  if (!f) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (String(f.estado) !== 'entregado' || !f.repartidor_id)
    throw new ErrorDatos(
      'La propina extra se agrega cuando el pedido ya fue entregado.',
      undefined,
      409,
    );
  if (f.propina_extra != null)
    throw new ErrorDatos('Ya agregaste una propina a este pedido.', undefined, 409);
  const entregado = Date.parse(`${String(f.entregado_en).replace(' ', 'T')}Z`);
  if (Date.now() - entregado > 7 * 86_400_000)
    throw new ErrorDatos(
      'La propina extra se puede agregar hasta 7 días después de la entrega.',
      undefined,
      409,
    );
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe)
    throw new ErrorDatos(
      'Los pagos todavía no están activados. Te avisamos muy pronto.',
      undefined,
      422,
    );
  // La tarjeta con la que pagó, guardada en su cliente de Stripe.
  const original = await stripe.get<{ payment_method?: string | null }>(
    `/payment_intents/${String(f.stripe_pago)}`,
  );
  if (!original.payment_method || !f.stripe_cliente)
    throw new ErrorDatos(
      'No encontramos una tarjeta guardada para cobrar la propina.',
      undefined,
      409,
    );
  let cobro: { id: string; status?: string };
  try {
    cobro = await stripe.post<{ id: string; status?: string }>(
      '/payment_intents',
      {
        amount: centavos,
        currency: 'usd',
        customer: String(f.stripe_cliente),
        payment_method: original.payment_method,
        off_session: true,
        confirm: true,
        description: `Tumbite · propina extra`,
        metadata: { pedido_id: id, propina_extra: '1' },
      },
      `propina-${id}`,
    );
  } catch (e) {
    console.error('propina extra', e);
    throw new ErrorDatos(
      'No pudimos cobrar la propina con tu tarjeta guardada. Intenta más tarde.',
      undefined,
      409,
    );
  }
  // C-FALLOS-CRITICOS 3: el movimiento al repartidor solo existe si Stripe confirmó el cobro.
  if (cobro.status !== 'succeeded') {
    console.error('propina extra: Stripe no confirmó el cobro', id, cobro.id, cobro.status);
    throw new ErrorDatos(
      'No pudimos cobrar la propina con tu tarjeta guardada. Intenta más tarde.',
      undefined,
      409,
    );
  }
  await db.batch([
    db
      .prepare('INSERT INTO propinas_extra (pedido_id, centavos, stripe_pago) VALUES (?, ?, ?)')
      .bind(id, centavos, cobro.id),
    db
      .prepare(
        "INSERT INTO movimientos (id, usuario_id, pedido_id, monto, concepto, referencia) VALUES (?, ?, ?, ?, 'ajuste', 'propina-extra')",
      )
      .bind(nuevoId(), String(f.repartidor_id), id, centavos),
  ]);
  await notificar(
    c.env,
    db,
    String(f.repartidor_id),
    AVISOS.propinaExtra(
      (
        await db
          .prepare('SELECT idioma FROM usuarios WHERE id = ?')
          .bind(String(f.repartidor_id))
          .first<{ idioma: string }>()
      )?.idioma ?? 'es',
      formatearDolares(centavos, 'es'),
    ),
  ).catch((e: unknown) => console.error('propina extra: aviso', e));
  return c.json({ ok: true, centavos });
});
