import { Hono } from 'hono';
import {
  DISTANCIA_MAXIMA_KM,
  type DesgloseViaje,
  type ParadaViaje,
  type PuntoViaje,
  RADIO_LLEGADA_M,
  type ServicioViaje,
  cargoEsperaParadas,
  cotizarViaje,
  esquemaCambiarParadas,
  esquemaTarifaViaje,
  llego,
  perfilPasajeros,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { reajustarReservaViaje, servicioFinancieroViaje } from '../finanzas/conductor';
import { notificar } from '../notificaciones';
import { rutaParaCotizar } from '../rutaPorCalles';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { referenciaLocal } from './tasasReferencia';
import { exigirParadasValidas } from './viajesPasajero';

/**
 * C-VIAJE-PARADAS (14 nov 2026, todos los países): paradas intermedias de un viaje, como «Agregar
 * parada» de Uber y «Editar ruta» de DiDi (docs/investigaciones-rea/2026-11-14-carro-paradas-
 * categorias-dinamica.md).
 *
 * - Al pedir: las paradas van en la cotización (precio fijo de todo el recorrido) y nacen con el viaje.
 * - Con el viaje pedido: el pasajero puede agregar, cambiar o quitar las paradas que FALTAN. El
 *   servidor recalcula el precio con la MISMA tarifa y el MISMO multiplicador de su cotización (nunca
 *   acepta un precio de la app), se lo muestra y solo lo aplica cuando la persona lo confirma.
 * - El conductor marca «Llegué a la parada» (tiene que estar ahí) y «Seguir». La espera de más en cada
 *   parada se cobra por minuto, como la de la recogida. No puede terminar con paradas pendientes; si
 *   el pasajero ya no va a parar, toca «Saltar parada» (el precio solo puede bajar).
 * - Con tarjeta el precio no puede subir después de pedir: la autorización es por el precio exacto.
 */
export const paradasViaje = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Cambios de paradas que el pasajero puede APLICAR en un viaje. Acota las consultas de ruta (cada
 * cambio pide una) y los números de parada (cada cambio usa números nuevos; las quitadas se quedan
 * como historia). Mirar el precio sin aplicar va por el límite de intentos de la ruta (app.ts).
 */
export const CAMBIOS_PARADAS_MAXIMOS = 10;

/** Estados del viaje en que el pasajero puede cambiar sus paradas. */
const CAMBIABLE = new Set(['buscando', 'asignado', 'conductor_llego', 'en_curso']);
const MINUTOS_UBICACION_PARADA = 2;

type FilaParada = {
  orden: number;
  lat: number;
  lng: number;
  direccion: string;
  estado: ParadaViaje['estado'];
  espera_s: number | null;
  llego_en: string | null;
};

/** Las paradas de un viaje que siguen en pie (las quitadas no), en orden, con su espera. */
export async function paradasDe(db: D1Database, operacionId: string) {
  const { results } = await db
    .prepare(
      `SELECT orden, lat, lng, direccion, estado, llego_en,
              CASE WHEN llego_en IS NULL THEN NULL ELSE
                CAST((julianday(COALESCE(salio_en, datetime('now'))) - julianday(llego_en)) * 86400 AS INTEGER) END AS espera_s
         FROM paradas_viaje WHERE operacion_id = ? AND estado != 'quitada' ORDER BY orden`,
    )
    .bind(operacionId)
    .all<FilaParada>();
  return results.map((p) => ({
    orden: Number(p.orden),
    lat: Number(p.lat),
    lng: Number(p.lng),
    direccion: String(p.direccion),
    estado: p.estado,
    esperaS: p.espera_s == null ? null : Number(p.espera_s),
    llegoEn: p.llego_en,
  }));
}

/** Lo que se cobra por la espera de más en las paradas de un viaje (0 sin paradas). */
export async function cargoParadasDe(
  db: D1Database,
  operacionId: string,
  tarifa: Parameters<typeof cargoEsperaParadas>[0],
): Promise<number> {
  const paradas = await paradasDe(db, operacionId);
  return cargoEsperaParadas(
    tarifa,
    paradas.flatMap((p) => (p.esperaS == null ? [] : [p.esperaS])),
  );
}

/** ¿Le queda alguna parada por hacer (o está detenido en una)? Con eso el viaje no se termina. */
export async function paradaSinCerrar(db: D1Database, operacionId: string): Promise<boolean> {
  const f = await db
    .prepare(
      "SELECT 1 AS hay FROM paradas_viaje WHERE operacion_id = ? AND estado IN ('pendiente', 'en_parada') LIMIT 1",
    )
    .bind(operacionId)
    .first<{ hay: number }>();
  return Boolean(f);
}

type ViajeParaCambiar = {
  id: string;
  cliente_id: string;
  conductor_id: string | null;
  servicio_id: string;
  zona_id: string;
  pais: string;
  estado: string;
  metodo_pago: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  cot_id: string;
  total: number;
  moneda: string;
  tarifa_json: string;
  multiplicador_pb: number;
  autorizado: number | null;
};

async function viajeParaCambiar(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT o.id, o.cliente_id, o.conductor_id, o.servicio_id, o.zona_id, z.pais, v.estado, v.metodo_pago,
              v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng,
              q.id AS cot_id, q.total, q.moneda, q.tarifa_json, q.multiplicador_pb,
              (SELECT k.autorizado FROM cobros_viaje k WHERE k.operacion_id = o.id) AS autorizado
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         JOIN zonas z ON z.id = o.zona_id
        WHERE o.id = ?`,
    )
    .bind(id)
    .first<ViajeParaCambiar>();
}

export type CambioParadas = {
  totalActual: number;
  totalNuevo: number;
  diferencia: number;
  moneda: string;
  desglose: DesgloseViaje;
  distanciaM: number;
  duracionS: number;
  /** false: no se puede aplicar (con su motivo en palabras). */
  permitido: boolean;
  motivo: string | null;
  aplicado: boolean;
};

const MOTIVO_TARJETA =
  'Con tarjeta, el precio no puede subir después de pedir el viaje. Agrega tus paradas antes de pedirlo.';

/**
 * Calcula (y, si se confirma, aplica) el cambio de las paradas que faltan. El precio sale de la
 * tarifa y el multiplicador copiados en la cotización del viaje.
 */
export async function cambiarParadas(
  env: Env,
  db: D1Database,
  v: ViajeParaCambiar,
  actor: { tipo: 'cliente' | 'conductor' | 'soporte'; id: string },
  nuevas: readonly PuntoViaje[],
  opciones: { confirmar: boolean; totalVisto?: number; soloSiNoSube?: boolean },
): Promise<CambioParadas> {
  if (!CAMBIABLE.has(v.estado))
    throw new ErrorDatos('Este viaje ya no admite cambios de paradas.', undefined, 409);
  if (v.servicio_id === 'envios')
    throw new ErrorDatos('Un envío va de un punto a otro, sin paradas.', 'paradas', 422);
  const actuales = await paradasDe(db, v.id);
  const fijas = actuales.filter((p) => p.estado === 'visitada' || p.estado === 'en_parada');
  const maximo = perfilPasajeros(v.pais).carro.paradasMaximas;
  if (fijas.length + nuevas.length > maximo)
    throw new ErrorDatos(
      maximo === 1
        ? 'Un viaje puede llevar una parada como máximo.'
        : `Un viaje puede llevar hasta ${maximo} paradas.`,
      'paradas',
      422,
    );
  await exigirParadasValidas(db, v.servicio_id, { id: v.zona_id, pais: v.pais }, nuevas);
  let tarifa;
  try {
    tarifa = esquemaTarifaViaje.parse(JSON.parse(v.tarifa_json));
  } catch (e) {
    console.error('paradas: copia de tarifa dañada en la cotización', v.id, e);
    throw new ErrorDatos(
      'No pudimos recalcular este viaje. Escríbenos desde Ayuda.',
      undefined,
      409,
    );
  }
  const origen = { lat: Number(v.origen_lat), lng: Number(v.origen_lng) };
  const destino = { lat: Number(v.destino_lat), lng: Number(v.destino_lng) };
  const todas: PuntoViaje[] = [
    ...fijas.map((p) => ({ lat: p.lat, lng: p.lng, direccion: p.direccion })),
    ...nuevas,
  ];
  const ruta = await rutaParaCotizar(env, db, v.cliente_id, tarifa, origen, destino, todas);
  if (ruta.distanciaM > DISTANCIA_MAXIMA_KM[v.servicio_id as ServicioViaje] * 1000)
    throw new ErrorDatos('Con esas paradas el viaje queda demasiado largo.', 'paradas', 422);
  const desglose = cotizarViaje(tarifa, ruta, Number(v.multiplicador_pb));
  const totalActual = Number(v.total);
  const sube = desglose.total > totalActual;
  const conTarjeta = v.metodo_pago === 'tarjeta';
  const topeTarjeta = v.autorizado == null ? totalActual : Number(v.autorizado);
  const motivo =
    conTarjeta && desglose.total > topeTarjeta && !opciones.soloSiNoSube ? MOTIVO_TARJETA : null;
  const resultado: CambioParadas = {
    totalActual,
    totalNuevo: desglose.total,
    diferencia: desglose.total - totalActual,
    moneda: v.moneda,
    desglose,
    distanciaM: ruta.distanciaM,
    duracionS: ruta.duracionS,
    permitido: motivo == null,
    motivo,
    aplicado: false,
  };
  if (!opciones.confirmar) return resultado;
  if (motivo) throw new ErrorDatos(motivo, 'paradas', 409);
  if (actor.tipo === 'cliente') {
    const hechos = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM cambios_viaje WHERE operacion_id = ? AND actor = 'cliente' AND tipo = 'paradas'",
      )
      .bind(v.id)
      .first<{ n: number }>();
    if (Number(hechos?.n ?? 0) >= CAMBIOS_PARADAS_MAXIMOS)
      throw new ErrorDatos(
        'Ya cambiaste las paradas de este viaje muchas veces. Si necesitas otro cambio, díselo a tu conductor.',
        'paradas',
        409,
      );
  }
  if (opciones.totalVisto != null && opciones.totalVisto !== desglose.total)
    throw new ErrorDatos(
      'El precio con esas paradas cambió. Revísalo y confirma otra vez.',
      'totalVisto',
      409,
    );
  // «Saltar parada» del conductor: el precio solo puede bajar. Si por las calles subiera, se quita la
  // parada y el precio se queda como estaba.
  const mantenerPrecio = Boolean(opciones.soloSiNoSube) && sube;
  const cambioId = nuevoId();
  const ultimoOrden = await db
    .prepare('SELECT COALESCE(MAX(orden), 0) AS n FROM paradas_viaje WHERE operacion_id = ?')
    .bind(v.id)
    .first<{ n: number }>();
  const desde = Number(ultimoOrden?.n ?? 0);
  const hecho = 'EXISTS (SELECT 1 FROM cambios_viaje WHERE id = ?)';
  const totalFinal = mantenerPrecio ? totalActual : desglose.total;
  await db.batch([
    // El cambio nace solo si nada se movió entre el cálculo y aquí: mismo precio, mismas paradas
    // hechas, misma última parada y el viaje sigue activo. Todo lo demás cuelga de esta fila.
    db
      .prepare(
        `INSERT INTO cambios_viaje (id, operacion_id, actor, actor_id, total_antes, total_despues, paradas_json)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
          WHERE EXISTS (SELECT 1 FROM cotizaciones_viaje q JOIN viajes w ON w.cotizacion_id = q.id
                         WHERE q.id = ?8 AND q.total = ?5 AND w.operacion_id = ?2
                           AND w.estado IN ('buscando', 'asignado', 'conductor_llego', 'en_curso'))
            AND (SELECT COUNT(*) FROM paradas_viaje WHERE operacion_id = ?2
                  AND estado IN ('visitada', 'en_parada')) = ?9
            AND (SELECT COALESCE(MAX(orden), 0) FROM paradas_viaje WHERE operacion_id = ?2) = ?10`,
      )
      .bind(
        cambioId,
        v.id,
        actor.tipo,
        actor.id,
        totalActual,
        totalFinal,
        JSON.stringify(todas),
        v.cot_id,
        fijas.length,
        desde,
      ),
    db
      .prepare(
        `UPDATE paradas_viaje SET estado = 'quitada' WHERE operacion_id = ? AND estado = 'pendiente' AND ${hecho}`,
      )
      .bind(v.id, cambioId),
    ...nuevas.map((p, i) =>
      db
        .prepare(
          `INSERT INTO paradas_viaje (operacion_id, orden, lat, lng, direccion)
           SELECT ?, ?, ?, ?, ? WHERE ${hecho}`,
        )
        .bind(v.id, desde + 1 + i, p.lat, p.lng, p.direccion, cambioId),
    ),
    mantenerPrecio
      ? db
          .prepare(`UPDATE cotizaciones_viaje SET paradas_json = ? WHERE id = ? AND ${hecho}`)
          .bind(JSON.stringify(todas), v.cot_id, cambioId)
      : db
          .prepare(
            `UPDATE cotizaciones_viaje SET distancia_m = ?, duracion_s = ?, desglose_json = ?, total = ?,
               paradas_json = ?, fuente_distancia = ? WHERE id = ? AND ${hecho}`,
          )
          .bind(
            ruta.distanciaM,
            ruta.duracionS,
            JSON.stringify(desglose),
            desglose.total,
            JSON.stringify(todas),
            ruta.fuente,
            v.cot_id,
            cambioId,
          ),
  ]);
  const quedo = await db.prepare('SELECT 1 FROM cambios_viaje WHERE id = ?').bind(cambioId).first();
  if (!quedo)
    throw new ErrorDatos(
      'El viaje cambió mientras lo calculábamos. Vuelve a intentarlo.',
      undefined,
      409,
    );
  // La comisión apartada del conductor se pone al día con el precio nuevo (nunca frena el cambio).
  if (v.conductor_id && totalFinal !== totalActual) {
    const movido = await reajustarReservaViaje(db, {
      servicio: servicioFinancieroViaje(v.servicio_id),
      pais: v.pais,
      ciudad: v.zona_id,
      moneda: v.moneda,
      operacionId: v.id,
      conductorId: v.conductor_id,
      valor: totalFinal,
      cambioId,
    }).catch((e: unknown) => {
      console.error('paradas: reajuste de la comisión apartada', v.id, e);
      return null;
    });
    // El precio subió y no se pudo apartar la diferencia (no alcanzó el saldo): queda dicho.
    if (movido === 0 && totalFinal > totalActual)
      console.warn('paradas: la comisión apartada no subió con el precio', v.id);
  }
  return {
    ...resultado,
    totalNuevo: totalFinal,
    diferencia: totalFinal - totalActual,
    aplicado: true,
  };
}

async function avisarCambio(env: Env, db: D1Database, para: string, viajeId: string) {
  await notificar(env, db, para, (i) => ({
    titulo: i === 'en' ? 'The trip stops changed' : 'Cambiaron las paradas del viaje',
    cuerpo:
      i === 'en' ? 'Open the trip to see the new route.' : 'Abre el viaje para ver la ruta nueva.',
    datos: { tipo: 'viaje', viajeId },
  })).catch((e: unknown) => console.error('paradas: aviso del cambio', e));
}

// ---------------------------------------------------------------- pasajero

/** El pasajero ve cuánto costaría (confirmar = false) o aplica el cambio de sus paradas. */
paradasViaje.post('/viajes/:id/paradas', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaCambiarParadas);
  const v = await viajeParaCambiar(db, c.req.param('id'));
  if (!v || v.cliente_id !== u.id) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const cambio = await cambiarParadas(c.env, db, v, { tipo: 'cliente', id: u.id }, d.paradas, {
    confirmar: d.confirmar,
    ...(d.totalVisto != null ? { totalVisto: d.totalVisto } : {}),
  });
  if (cambio.aplicado && v.conductor_id) await avisarCambio(c.env, db, v.conductor_id, v.id);
  return c.json({
    cambio,
    paradas: await paradasDe(db, v.id),
    referencia: await referenciaLocal(db, v.pais, cambio.totalNuevo, v.moneda),
  });
});

// ---------------------------------------------------------------- conductor

async function viajeDelConductor(db: D1Database, id: string, conductorId: string) {
  const v = await viajeParaCambiar(db, id);
  if (!v || v.conductor_id !== conductorId)
    throw new ErrorDatos('Este viaje ya no está asignado a ti.', undefined, 404);
  return v;
}

function ordenDe(texto: string): number {
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1 || n > 99)
    throw new ErrorDatos('Esa parada no existe.', undefined, 404);
  return n;
}

/**
 * «Llegué a la parada», «Seguir» y «Saltar parada». Cada paso es repetible: si ya se hizo, responde
 * igual (doble toque, respuesta perdida).
 */
paradasViaje.post(
  '/conductor/operaciones/:id/paradas/:orden/:paso{llegue|seguir|saltar}',
  async (c) => {
    const u = exigir(c, 'repartidor');
    const db = base(c);
    const paso = c.req.param('paso');
    const orden = ordenDe(c.req.param('orden'));
    const v = await viajeDelConductor(db, c.req.param('id'), u.id);
    if (v.estado !== 'en_curso')
      throw new ErrorDatos('Este paso ya no corresponde. Actualiza la pantalla.', undefined, 409);
    const paradas = await paradasDe(db, v.id);
    const parada = paradas.find((p) => p.orden === orden);
    const responder = async () => c.json({ ok: true, paradas: await paradasDe(db, v.id) });
    if (paso === 'llegue') {
      if (parada?.estado === 'en_parada' || parada?.estado === 'visitada') return responder();
      const siguiente = paradas.find((p) => p.estado === 'pendiente');
      if (!parada || siguiente?.orden !== orden || paradas.some((p) => p.estado === 'en_parada'))
        throw new ErrorDatos(
          'Esa no es la parada que sigue. Actualiza la pantalla.',
          undefined,
          409,
        );
      const yo = await db
        .prepare(
          "SELECT lat, lng FROM repartidores WHERE usuario_id = ? AND lat IS NOT NULL AND ubicacion_en > datetime('now', ?)",
        )
        .bind(u.id, `-${MINUTOS_UBICACION_PARADA} minutes`)
        .first<{ lat: number; lng: number }>();
      if (!llego(yo ?? null, { lat: parada.lat, lng: parada.lng }, RADIO_LLEGADA_M))
        throw new ErrorDatos(
          'Todavía no estás en la parada. Acércate y vuelve a intentarlo.',
          undefined,
          409,
        );
      await db
        .prepare(
          "UPDATE paradas_viaje SET estado = 'en_parada', llego_en = datetime('now') WHERE operacion_id = ? AND orden = ? AND estado = 'pendiente'",
        )
        .bind(v.id, orden)
        .run();
      return responder();
    }
    if (paso === 'seguir') {
      if (parada?.estado === 'visitada') return responder();
      if (parada?.estado !== 'en_parada')
        throw new ErrorDatos('Primero marca que llegaste a la parada.', undefined, 409);
      await db
        .prepare(
          "UPDATE paradas_viaje SET estado = 'visitada', salio_en = datetime('now') WHERE operacion_id = ? AND orden = ? AND estado = 'en_parada'",
        )
        .bind(v.id, orden)
        .run();
      return responder();
    }
    // Saltar: el pasajero ya no va a parar ahí. Se quita y el precio se recalcula (solo puede bajar).
    if (!parada) return responder(); // ya se había quitado
    if (parada.estado !== 'pendiente')
      throw new ErrorDatos('Esa parada ya se hizo. Toca «Seguir».', undefined, 409);
    const quedan = paradas
      .filter((p) => p.estado === 'pendiente' && p.orden !== orden)
      .map((p) => ({ lat: p.lat, lng: p.lng, direccion: p.direccion }));
    const cambio = await cambiarParadas(c.env, db, v, { tipo: 'conductor', id: u.id }, quedan, {
      confirmar: true,
      soloSiNoSube: true,
    });
    await avisarCambio(c.env, db, v.cliente_id, v.id);
    return c.json({ ok: true, cambio, paradas: await paradasDe(db, v.id) });
  },
);
