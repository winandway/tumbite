import { Hono, type Context } from 'hono';
import { paisDelCodigoZona } from '@tumbite/compartido';
import type { Env } from './env';
import { esPedidoPrueba } from './pedidoPrueba';
import { aPedido } from './rutas/pedidos';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos } from './validar';

/**
 * C-ENTREGA-PRACTICA (3 nov 2026, ordenado por Gerencia para el video de Apple): el pedido de prueba
 * de una cuenta de revisión del restaurante («Send a test order», C-PEDIDO-PRUEBA) le llega como
 * oferta de práctica SOLO a las cuentas de revisión del repartidor, cuando el restaurante lo acepta.
 * El repartidor la acepta, llega, recoge y entrega con las mismas pantallas de una de verdad, porque
 * el servidor la presenta con la forma de un pedido. Vive en su propia tabla (`entregas_practica`):
 * nunca en `pedidos`, `ofertas` ni el libro, así que no hay cobro, pago al repartidor, conciliación
 * ni avisos a nadie. Todos los países.
 */
type Ctx = Context<{ Bindings: Env; Variables: Variables }>;
type EsRevisor = (c: Ctx, correo: string) => Promise<boolean>;

/** Adónde «se entrega» la práctica: una dirección pública cerca del restaurante de revisión. */
const DESTINO = { direccion: '200 S Biscayne Blvd, Miami, FL 33131', lat: 25.7726, lng: -80.1873 };
const NOTA = {
  es: 'Entrega de práctica: no se cobra ni se paga nada.',
  en: 'Practice delivery: nothing is charged or paid.',
};

type Fila = Record<string, unknown> & {
  id: string;
  estado: string;
  restaurante_id: string;
  dueno_correo: string | null;
  e_estado: string | null;
  e_repartidor: string | null;
  e_llego: number | null;
  e_verificado: number | null;
};

const CAMPOS = `pp.*, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat,
  r.lng AS rest_lng, r.telefono AS restaurante_telefono, r.zona_id, u.correo AS dueno_correo`;

/** El pedido de práctica con la forma que la app del repartidor ya sabe pintar. */
function comoPedido(f: Fila) {
  const enCamino = f.e_estado === 'en_camino';
  const estado = enCamino ? 'en_camino' : f.estado === 'aceptado' ? 'aceptado' : 'listo';
  const restLat = f.rest_lat == null ? null : Number(f.rest_lat);
  const restLng = f.rest_lng == null ? null : Number(f.rest_lng);
  const base = aPedido({
    ...f,
    estado,
    envio: 0,
    servicio: 0,
    impuesto: 0,
    cargo_pequeno: 0,
    propina: 0,
    regalo: 0,
    total: f.subtotal,
    direccion: DESTINO.direccion,
    lat: DESTINO.lat,
    lng: DESTINO.lng,
    notas: `${NOTA.en} / ${NOTA.es}`,
    pagado_en: f.creado_en,
    recogido_en: f.e_recogido ?? null,
    repartidor_id: f.e_repartidor,
    metodo_pago: 'tarjeta',
  });
  return {
    ...base,
    practica: true as const,
    restaurante: {
      nombre: String(f.restaurante_nombre ?? ''),
      direccion: String(f.restaurante_direccion ?? ''),
      telefono: '',
      lat: restLat,
      lng: restLng,
    },
    pagoRepartidor: 0,
    bono: 0,
    bonoMotivo: null,
    distanciaKm: null,
    pais: paisDelCodigoZona(f.zona_id as string | null),
    verificado: Number(f.e_verificado ?? 0) === 1,
    llegoRestaurante: Number(f.e_llego ?? 0) === 1,
    llegoCliente: enCamino,
    noApareceEn: null,
    excepcionUbicacion: null,
    minutosParaListo: 0,
  };
}

/** ¿El restaurante del pedido de prueba es de una cuenta de revisión? */
async function deRevision(c: Ctx, esRevisor: EsRevisor, f: Fila) {
  return f.dueno_correo != null && (await esRevisor(c, String(f.dueno_correo)));
}

/** Las ofertas de práctica para este repartidor (solo si es una cuenta de revisión). */
export async function ofertasPractica(c: Ctx, esRevisor: EsRevisor, segundos: number) {
  const u = exigir(c, 'repartidor');
  if (!(await esRevisor(c, u.correo))) return [];
  const db = base(c);
  if (await practicaActivaFila(db, u.id)) return [];
  const { results } = await db
    .prepare(
      `SELECT ${CAMPOS}, NULL AS e_estado, NULL AS e_repartidor, NULL AS e_llego, NULL AS e_verificado
        FROM pedidos_prueba pp JOIN restaurantes r ON r.id = pp.restaurante_id JOIN usuarios u ON u.id = r.dueno_id
        WHERE pp.estado IN ('aceptado','listo') AND pp.creado_en > datetime('now','-2 hours')
          AND NOT EXISTS (SELECT 1 FROM entregas_practica e WHERE e.pedido_prueba_id = pp.id
            AND (e.estado IN ('aceptado','en_camino','entregado') OR e.repartidor_id = ?))
        ORDER BY pp.creado_en DESC LIMIT 3`,
    )
    .bind(u.id)
    .all<Fila>();
  const ofertas = [];
  for (const f of results)
    if (await deRevision(c, esRevisor, f))
      ofertas.push({
        ...comoPedido(f),
        distanciaAlLocalKm: null,
        distanciaTotalKm: null,
        minutosEstimados: null,
        articulos: aPedido({
          ...f,
          envio: 0,
          servicio: 0,
          cargo_pequeno: 0,
          propina: 0,
          regalo: 0,
          total: 0,
          direccion: '',
        }).lineas.reduce((n, l) => n + Number(l.cantidad ?? 1), 0),
        ofertaEn: new Date().toISOString().replace('T', ' ').slice(0, 19),
        segundos,
        adelantoLocal: 0,
      });
  return ofertas;
}

async function practicaActivaFila(db: D1Database, repartidorId: string) {
  return db
    .prepare(
      `SELECT ${CAMPOS}, e.estado AS e_estado, e.repartidor_id AS e_repartidor, e.llego_restaurante AS e_llego,
          e.verificado AS e_verificado, e.recogido_en AS e_recogido
        FROM entregas_practica e JOIN pedidos_prueba pp ON pp.id = e.pedido_prueba_id
        JOIN restaurantes r ON r.id = pp.restaurante_id JOIN usuarios u ON u.id = r.dueno_id
        WHERE e.repartidor_id = ? AND e.estado IN ('aceptado','en_camino') LIMIT 1`,
    )
    .bind(repartidorId)
    .first<Fila>();
}

/** La entrega de práctica en curso de este repartidor, con la forma de un pedido (o null). */
export async function practicaActiva(db: D1Database, repartidorId: string) {
  const f = await practicaActivaFila(db, repartidorId);
  return f ? comoPedido(f) : null;
}

/**
 * Las rutas de la práctica. Se montan ANTES que las de verdad: atienden solo los números de pedido
 * de prueba («prueba-…») y dejan pasar todo lo demás sin tocarlo.
 */
export function rutasPractica(esRevisor: EsRevisor) {
  const r = new Hono<{ Bindings: Env; Variables: Variables }>();

  async function revisor(c: Ctx) {
    const u = exigir(c, 'repartidor');
    if (!(await esRevisor(c, u.correo)))
      throw new ErrorDatos('Esta entrega no es para tu cuenta.', undefined, 403);
    return u;
  }
  async function mia(c: Ctx, id: string, repartidorId: string) {
    const f = await base(c)
      .prepare(
        "SELECT estado FROM entregas_practica WHERE pedido_prueba_id = ? AND repartidor_id = ? AND estado IN ('aceptado','en_camino')",
      )
      .bind(id, repartidorId)
      .first<{ estado: string }>();
    if (!f) throw new ErrorDatos('Esta entrega no está contigo.', undefined, 409);
    return f.estado;
  }

  r.post('/repartidor/ofertas/:id/:accion', async (c, next) => {
    const id = c.req.param('id');
    if (!esPedidoPrueba(id)) return next();
    const u = await revisor(c);
    const db = base(c);
    if (c.req.param('accion') === 'rechazar') {
      await db
        .prepare(
          "INSERT OR IGNORE INTO entregas_practica (pedido_prueba_id, repartidor_id, estado) VALUES (?, ?, 'rechazada')",
        )
        .bind(id, u.id)
        .run();
      return c.json({ ok: true });
    }
    if (c.req.param('accion') !== 'aceptar') return next();
    const f = await db
      .prepare(
        `SELECT ${CAMPOS} FROM pedidos_prueba pp JOIN restaurantes r ON r.id = pp.restaurante_id JOIN usuarios u ON u.id = r.dueno_id
          WHERE pp.id = ? AND pp.estado IN ('aceptado','listo')`,
      )
      .bind(id)
      .first<Fila>();
    if (!f || !(await deRevision(c, esRevisor, f)))
      throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
    const otra = await db
      .prepare(
        "SELECT repartidor_id FROM entregas_practica WHERE pedido_prueba_id = ? AND estado IN ('aceptado','en_camino','entregado')",
      )
      .bind(id)
      .first<{ repartidor_id: string }>();
    if (otra?.repartidor_id === u.id) return c.json({ ok: true });
    if (otra) throw new ErrorDatos('Otro repartidor ya tomó este pedido.', undefined, 409);
    await db
      .prepare(
        `INSERT INTO entregas_practica (pedido_prueba_id, repartidor_id, estado) VALUES (?, ?, 'aceptado')
          ON CONFLICT(pedido_prueba_id, repartidor_id) DO UPDATE SET estado = 'aceptado'`,
      )
      .bind(id, u.id)
      .run();
    return c.json({ ok: true });
  });

  r.post('/repartidor/pedidos/:id/:paso', async (c, next) => {
    const id = c.req.param('id');
    if (!esPedidoPrueba(id)) return next();
    const u = await revisor(c);
    const db = base(c);
    const estado = await mia(c, id, u.id);
    const fijar = (sql: string) =>
      db
        .prepare(
          `UPDATE entregas_practica SET ${sql} WHERE pedido_prueba_id = ? AND repartidor_id = ?`,
        )
        .bind(id, u.id)
        .run();
    switch (c.req.param('paso')) {
      case 'llegue':
        if (estado === 'aceptado') await fijar('llego_restaurante = 1');
        return c.json({ llegue: true, metros: 0, radio: 150 });
      case 'verificar':
      case 'no-puedo-confirmar':
        await fijar('verificado = 1');
        return c.json({ ok: true });
      case 'foto-recogida':
        await fijar(
          "estado = 'en_camino', llego_restaurante = 1, verificado = 1, recogido_en = datetime('now')",
        );
        return c.json({ ok: true, salio: true });
      case 'entregado':
        if (estado !== 'en_camino')
          throw new ErrorDatos('Primero recoge el pedido en el restaurante.', undefined, 409);
        await fijar("estado = 'entregado', entregado_en = datetime('now')");
        return c.json({ ok: true });
      case 'soltar':
        await fijar("estado = 'soltada'");
        return c.json({ ok: true });
      default:
        // El resto de botones (no aparece, no está listo, ticket…) no cambian nada en una práctica.
        return c.json({ ok: true });
    }
  });

  // El chat y la llamada no existen en una práctica: lista vacía y aviso claro.
  r.get('/pedidos/:id/mensajes', async (c, next) => {
    if (!esPedidoPrueba(c.req.param('id'))) return next();
    await revisor(c);
    return c.json({ abierto: false, mensajes: [] });
  });
  r.post('/pedidos/:id/llamar', async (c, next) => {
    if (!esPedidoPrueba(c.req.param('id'))) return next();
    await revisor(c);
    throw new ErrorDatos('En una entrega de práctica no hay a quién llamar.', undefined, 409);
  });
  return r;
}
