import { entornoDeHost } from '@tumbite/compartido';
import { pasarEsperaAlAbrir } from '../lugarEspera';
import { frenarSinCelularConfirmado } from '../telefonoVuelta';
import { exigirPuntoEnElPais } from '../destinoEnElPais';
import { avisarPasoViaje } from '../avisosViaje';
import { leerLlegada, llegadaParaMostrar } from '../llegadaEstimada';
import { Hono } from 'hono';
import { resumenChatViaje } from './chatViaje';
import { UMBRALES_VIAJE_REAL } from '../viajeReal';
import { direccionDeRecogida } from './fotoPuerta';
import { esPagoACelular, metrosEntre as metrosEntrePuntos, pagaEnMano } from '@tumbite/compartido';
import { z } from 'zod';
import {
  type CotizacionViaje,
  kmMaximoDe,
  SERVICIOS_VIAJE,
  type TarifaViaje,
  VIGENCIA_COTIZACION_S,
  cargoCancelacionViaje,
  cotizarViaje,
  conRecargoNoche,
  esHoraDeNoche,
  esquemaCotizarViaje,
  direccionConReferencia,
  esquemaTarifaViaje,
  esquemaPaqueteEnvio,
  type PaqueteEnvio,
  type PedidoCotizacion,
  telefonoCanonico,
  VALOR_MAXIMO_ENVIO_POR_DEFECTO,
  tarifaDeCategoria,
  categoriasOfrecidas,
  type CategoriaViaje,
  type PuntoViaje,
  numeroEmergencia,
  perfilPasajeros,
  METODOS_PAGO_VIAJE,
  tarifaDeMercado,
  distanciaKm,
  estimarRuta,
  faseDeViaje,
  rangoPrefijo,
  sinPlusCode,
  montoEnMano,
  referenciaConTasa,
  MONEDA_SALDO_DIVOOX,
  cuentaConSaldo,
} from '@tumbite/compartido';
import { avisoEmergenciaViaje } from '../avisos';
import {
  TIPO_SMS_PANICO,
  avisarResponsableZona,
  smsDePanicoPermitido,
  textoPanico,
} from '../panicoZona';
import { smsEquipo } from '../avisosEquipo';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { cambiarEstadoViaje, hayConductorQueRecibe, repartirOperaciones } from '../operaciones';
import { apartarSaldoViaje, liberarSaldoViaje, saldoDeCliente } from '../saldoCliente';
import { DIAS_VENCE_PRONTO, detalleSaldo } from '../saldoLotes';
import { bienvenidaPendiente } from '../saldoRegalos';
import {
  comisionConductor,
  devolverReservasViaje,
  exigirComisionEnMoneda,
} from '../finanzas/conductor';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { tasaDeOperacion, tasaParaFijar } from './tasasReferencia';
import { ErrorDatos, leerCuerpo } from '../validar';
import { abrirCobroViaje, propinaViaje, soltarCobroViaje } from '../viajesCobro';
import { pinParaViajeNuevo } from './ajustesViaje';
import { ESTADOS_ACTIVOS, crearViajeDeCotizacion, pinNuevo, programarViaje } from '../viajeCrear';
import { revisarDesvio } from './seguridadViaje';
import { enviarSms } from '../sms';
import { encenderServicioEnZona, estadoServicioEnZona, exigirPuedeEncender } from './servicios';
import { leerConfigPais, MONEDA_POR_PAIS, paisIncompleto } from '../internacional/paises';
import { zonaPara } from './zonas';
import { conPrecioZona, rutaPrecioPara } from '../precioZona';
import { REUSO_RUTA_MINUTOS, REUSO_RUTA_RADIO_M, rutaParaCotizar } from '../rutaPorCalles';
import { multiplicadorVigente } from '../viajesDinamica';
import { paradasDe } from './paradasViaje';
import { SQL_TARIFA_SERVICIO, quienPagaViaje, tarifaServicioViaje } from '../finanzas/quienPaga';
import type { DesgloseViaje } from '@tumbite/compartido';
import { accesoDe, filtroAlcance, servicioOperacionSql, tienePermiso } from '../accesoInterno';
import { conductorDeConfianzaParaPedir } from './viajesFijos';
import { aparatoDe } from './regalosDivoox';
import { cortoEnvioDestinatario } from '../smsVenezuelaTextos';
import {
  COLUMNAS_REGALO_PASAJERO,
  type FilaRegaloPasajero,
  JOIN_REGALO_PASAJERO,
  apartarRegalo,
  conRegalo,
  liberarRegalo,
  regaloParaCliente,
  regaloPasajero,
} from '../regalosDivoox';

/**
 * Divoox Moto · Fase M1 (docs/PLAN-MOTO-PASAJEROS.md): la tarifa por ciudad que guarda el
 * superadmin y la cotización con PRECIO FIJO del pasajero (C-VIAJE-PRECIO-FIJO). La cotización se
 * guarda en el servidor y vence a los 5 minutos: al pedir (M2) solo viaja su id, así el precio no
 * se puede alterar desde la app. Moto existe solo en el sitio de pruebas (C-MOTO-SOLO-PRUEBAS):
 * en producción el servicio no está implementado y la cotización responde «no disponible».
 */
export const viajesPasajero = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaTarifa = {
  id: string;
  servicio_id: string;
  zona_id: string;
  moneda: string;
  base: number;
  por_km: number;
  por_minuto: number;
  minimo: number;
  espera_gratis_s: number;
  por_minuto_espera: number;
  cancelacion_gratis_s: number;
  cargo_cancelacion: number;
  cargo_no_se_presento: number;
  tope_dinamico_pb: number;
  redondeo: number;
  cargo_fijo: number;
  factor_calle_pb: number;
  velocidad_kmh: number;
  xl_pb: number | null;
  comfort_pb: number | null;
  premium_pb: number | null;
  espera_parada_gratis_s: number | null;
  valor_maximo: number | null;
  km_maximo?: number | null;
  umbral_precio_zona_pb?: number | null;
  recargo_noche_pb?: number | null;
  noche_desde_h?: number | null;
  noche_hasta_h?: number | null;
  de_prueba: number;
  activa: number;
  motivo: string;
  creada_por: string | null;
  creada_en: string;
  cerrada_en: string | null;
};

export function filaATarifa(f: FilaTarifa): TarifaViaje {
  return {
    base: f.base,
    porKm: f.por_km,
    porMinuto: f.por_minuto,
    minimo: f.minimo,
    esperaGratisS: f.espera_gratis_s,
    porMinutoEspera: f.por_minuto_espera,
    cancelacionGratisS: f.cancelacion_gratis_s,
    cargoCancelacion: f.cargo_cancelacion,
    cargoNoSePresento: f.cargo_no_se_presento,
    topeDinamicoPb: f.tope_dinamico_pb,
    redondeo: f.redondeo,
    cargoFijo: f.cargo_fijo,
    factorCallePb: f.factor_calle_pb,
    ...(f.xl_pb ? { xlPb: f.xl_pb } : {}),
    ...(f.comfort_pb ? { comfortPb: f.comfort_pb } : {}),
    ...(f.premium_pb ? { premiumPb: f.premium_pb } : {}),
    esperaParadaGratisS: f.espera_parada_gratis_s ?? 120,
    ...(f.valor_maximo != null ? { valorMaximo: f.valor_maximo } : {}),
    velocidadKmh: f.velocidad_kmh,
    ...(f.km_maximo != null ? { kmMaximo: f.km_maximo } : {}),
    ...(f.umbral_precio_zona_pb != null ? { umbralPrecioZonaPb: f.umbral_precio_zona_pb } : {}),
    // C-RECARGO-NOCHE: la tarifa nocturna de la ciudad (sin ella, sin recargo; sin horas, 21 a 6).
    ...(f.recargo_noche_pb ? { recargoNochePb: f.recargo_noche_pb } : {}),
    ...(f.noche_desde_h != null ? { nocheDesdeH: f.noche_desde_h } : {}),
    ...(f.noche_hasta_h != null ? { nocheHastaH: f.noche_hasta_h } : {}),
  };
}

function tarifaPublica(f: FilaTarifa) {
  return {
    id: f.id,
    servicio: f.servicio_id,
    zona: f.zona_id,
    moneda: f.moneda,
    ...filaATarifa(f),
    dePrueba: f.de_prueba === 1,
    activa: f.activa === 1,
    motivo: f.motivo,
    creadaPor: f.creada_por,
    creadaEn: f.creada_en,
    cerradaEn: f.cerrada_en,
  };
}

/** La tarifa activa de un servicio en una zona, o null. */
/** C-SIN-PLUS-CODE: una dirección guardada, para mostrar. */
const sinCodigo = (x: string) => sinPlusCode(x) || x;

export async function tarifaActiva(
  db: D1Database,
  servicio: string,
  zona: string,
): Promise<FilaTarifa | null> {
  return db
    .prepare('SELECT * FROM tarifas_viaje WHERE servicio_id = ? AND zona_id = ? AND activa = 1')
    .bind(servicio, zona)
    .first<FilaTarifa>();
}

/** Un viaje «típico» de Moto para estimar la comisión: 5 km por calle (aproximado, se dice así). */
export const KM_VIAJE_TIPICO = 5;

/**
 * C-SALDO-CARRERAS (13 nov 2026): la comisión de un viaje típico de Moto en la ciudad del conductor,
 * con la tarifa vigente y la política que rija. 0 si no hay tarifa o no rige el prepago. No escribe nada.
 */
export async function comisionTipicaMoto(
  db: D1Database,
  zona: { id: string; pais: string; moneda: string },
): Promise<number> {
  // C-CARRO-TARIFA-VE: en una ciudad solo de Carro, la comisión típica sale de la tarifa de Carro.
  const deMoto = await tarifaActiva(db, 'moto', zona.id);
  const fila = deMoto ?? (await tarifaActiva(db, 'carro', zona.id));
  if (!fila) return 0;
  const t = filaATarifa(fila);
  const total = cotizarViaje(t, {
    distanciaM: KM_VIAJE_TIPICO * 1000,
    duracionS: Math.round((KM_VIAJE_TIPICO / t.velocidadKmh) * 3600),
  }).total;
  const c = await comisionConductor(db, {
    servicio: deMoto ? 'ride' : 'car',
    pais: zona.pais,
    ciudad: zona.id,
    moneda: zona.moneda,
    valor: total,
  });
  return c?.monto ?? 0;
}

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------------------------------------------------------------- superadmin

viajesPasajero.get('/admin/viajes/tarifas', async (c) => {
  exigir(c, 'admin');
  const q = z
    .object({ servicio: z.enum(SERVICIOS_VIAJE).optional(), zona: z.string().max(40).optional() })
    .parse(c.req.query());
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM tarifas_viaje WHERE (? IS NULL OR servicio_id = ?) AND (? IS NULL OR zona_id = ?)
        ORDER BY servicio_id, zona_id, activa DESC, creada_en DESC LIMIT 200`,
    )
    .bind(q.servicio ?? null, q.servicio ?? null, q.zona ?? null, q.zona ?? null)
    .all<FilaTarifa>();
  return c.json({ tarifas: results.map(tarifaPublica) });
});

/**
 * Nueva versión de la tarifa: cierra la activa (si hay) y abre esta, en un solo lote. Nunca se
 * edita una tarifa: así cada cotización vieja sigue apuntando a la tarifa con que se calculó.
 */
viajesPasajero.post('/admin/viajes/tarifas', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.enum(SERVICIOS_VIAJE),
      zona: z.string().trim().min(2).max(40),
      tarifa: esquemaTarifaViaje,
      dePrueba: z.boolean().default(true),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const nueva = await guardarTarifaViaje(base(c), admin.id, d);
  return c.json({ tarifa: nueva ? tarifaPublica(nueva) : null }, 201);
});

/** Una versión nueva de la tarifa de un servicio en una ciudad (la usan el panel y «abrir ciudad»). */
export async function guardarTarifaViaje(
  db: D1Database,
  adminId: string,
  d: {
    servicio: (typeof SERVICIOS_VIAJE)[number];
    zona: string;
    tarifa: TarifaViaje;
    dePrueba: boolean;
    motivo: string;
  },
): Promise<FilaTarifa | null> {
  const zona = await db
    .prepare('SELECT id, pais, moneda FROM zonas WHERE id = ?')
    .bind(d.zona)
    .first<{ id: string; pais: string; moneda: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  // C-COMISION-MONEDA: una tarifa en una moneda sin política de comisión no se activa.
  await exigirComisionEnMoneda(db, d.servicio, zona);
  const antes = await tarifaActiva(db, d.servicio, zona.id);
  const id = nuevoId();
  const t = d.tarifa;
  await db.batch([
    db
      .prepare(
        "UPDATE tarifas_viaje SET activa = 0, cerrada_en = datetime('now') WHERE servicio_id = ? AND zona_id = ? AND activa = 1",
      )
      .bind(d.servicio, zona.id),
    db
      .prepare(
        `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
           espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion,
           cargo_no_se_presento, tope_dinamico_pb, redondeo, cargo_fijo, factor_calle_pb, velocidad_kmh,
           de_prueba, motivo, creada_por, xl_pb, valor_maximo, comfort_pb, premium_pb, espera_parada_gratis_s,
           km_maximo, umbral_precio_zona_pb, recargo_noche_pb, noche_desde_h, noche_hasta_h)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        d.servicio,
        zona.id,
        zona.moneda,
        t.base,
        t.porKm,
        t.porMinuto,
        t.minimo,
        t.esperaGratisS,
        t.porMinutoEspera,
        t.cancelacionGratisS,
        t.cargoCancelacion,
        t.cargoNoSePresento,
        t.topeDinamicoPb,
        t.redondeo,
        t.cargoFijo,
        t.factorCallePb,
        t.velocidadKmh,
        d.dePrueba ? 1 : 0,
        d.motivo,
        adminId,
        t.xlPb ?? null,
        t.valorMaximo ?? null,
        t.comfortPb ?? null,
        t.premiumPb ?? null,
        t.esperaParadaGratisS,
        t.kmMaximo ?? null,
        t.umbralPrecioZonaPb ?? null,
        t.recargoNochePb ?? null,
        t.nocheDesdeH ?? null,
        t.nocheHastaH ?? null,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        adminId,
        'viaje.tarifa',
        `tarifa:${d.servicio}:${zona.id}`,
        JSON.stringify(antes ?? null),
        JSON.stringify({ id, ...t, dePrueba: d.dePrueba, motivo: d.motivo }),
      ),
  ]);
  return db.prepare('SELECT * FROM tarifas_viaje WHERE id = ?').bind(id).first<FilaTarifa>();
}

/**
 * C-MOTO-VENEZUELA: abrir un servicio de viajes en una ciudad es UN paso del panel (no código): crea
 * o pone al día la ciudad, le pone la tarifa (la de mercado del país si no se escribe otra) y
 * enciende el servicio en esa ciudad. Comida queda «próximamente» en una ciudad nueva cuyo país
 * todavía no tiene tarifas de comida. En producción manda la compuerta del país (C-MOTO-POR-PAIS).
 */
viajesPasajero.post('/admin/viajes/ciudades', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.enum(SERVICIOS_VIAJE),
      zona: z.object({
        id: z
          .string()
          .trim()
          .regex(/^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/, {
            error: 'El código de la ciudad va como VE-CCS-CENTRO.',
          }),
        nombre: z.string().trim().min(2).max(60),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radioKm: z.number().min(1).max(100).default(25),
        zonaHoraria: z.string().trim().min(3).max(60),
        moneda: z.string().trim().length(3).toUpperCase().optional(),
      }),
      tarifa: esquemaTarifaViaje.optional(),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const pais = d.zona.id.slice(0, 2);
  const perfil = perfilPasajeros(pais);
  const moneda =
    d.zona.moneda ??
    perfil.monedaViajes ??
    new Map(Object.entries(MONEDA_POR_PAIS)).get(pais) ??
    'USD';
  // C-CARRO-TARIFA-VE: Moto y Carro en Venezuela traen la tarifa de mercado si no se escribe otra.
  const tarifa = d.tarifa ?? tarifaDeMercado(pais, d.servicio);
  if (!tarifa)
    throw new ErrorDatos('Escribe la tarifa del servicio para esta ciudad.', 'tarifa', 422);
  // Antes de tocar nada: la compuerta del servicio y la comisión en la moneda de la ciudad.
  await exigirPuedeEncender(c, d.servicio, pais);
  await exigirComisionEnMoneda(db, d.servicio, { pais, moneda });
  const existia = await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(d.zona.id).first();
  await db
    .prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, moneda = excluded.moneda, zona_horaria = excluded.zona_horaria,
         lat = excluded.lat, lng = excluded.lng, radio_km = excluded.radio_km, activa = 1`,
    )
    .bind(
      d.zona.id,
      d.zona.nombre,
      pais,
      moneda,
      d.zona.zonaHoraria,
      d.zona.lat,
      d.zona.lng,
      d.zona.radioKm,
    )
    .run();
  if (!existia && paisIncompleto(pais, await leerConfigPais(db, pais)))
    await db
      .prepare(
        `UPDATE servicios_zona SET estado = 'proximamente', motivo = 'ciudad abierta solo para viajes', actualizado_por = ?,
           actualizado_en = datetime('now') WHERE servicio_id = 'comida' AND zona_id = ?`,
      )
      .bind(admin.id, d.zona.id)
      .run();
  // C-TABULADOR-VIGIA: volver a abrir una ciudad que ya tiene su tarifa (la del tabulador de El Vigía,
  // con su tarifa nocturna, o la que puso el equipo) NO la cambia por la de mercado: solo una tarifa
  // escrita a propósito la reemplaza. Antes, un segundo «abrir» (o el guion del sitio de pruebas
  // cuando una cotización fallaba) borraba el 0,46 $/km y el +30 % de noche.
  const yaTenia = d.tarifa ? null : await tarifaActiva(db, d.servicio, d.zona.id);
  const fila =
    yaTenia ??
    (await guardarTarifaViaje(db, admin.id, {
      servicio: d.servicio,
      zona: d.zona.id,
      tarifa,
      dePrueba: true,
      motivo: d.motivo,
    }));
  const estado = await encenderServicioEnZona(c, admin.id, d.servicio, d.zona.id, d.motivo);
  // C-REGISTRO-TODO-EL-PAIS: los que esperan en esta ciudad pasan solos (nunca frena la apertura).
  await pasarEsperaAlAbrir(
    c.env,
    db,
    d.zona.id,
    entornoDeHost(new URL(c.req.url).host) === 'produccion',
  );
  return c.json(
    { zona: { id: d.zona.id, pais, moneda }, tarifa: fila ? tarifaPublica(fila) : null, estado },
    201,
  );
});

// ---------------------------------------------------------------- pasajero

/**
 * C-RUTA-POR-CALLES (revisión del 13 nov 2026): la última cotización del mismo pasajero, servicio y
 * categoría para el mismo trayecto (unos 50 m) en los últimos minutos. Lee por el índice del cliente.
 */
async function cotizacionAnteriorMismoTrayecto(
  db: D1Database,
  clienteId: string,
  servicio: string,
  categoria: string,
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number },
  paradas: readonly { lat: number; lng: number }[] = [],
): Promise<{ total: number } | null> {
  const { results } = await db
    .prepare(
      `SELECT origen_lat, origen_lng, destino_lat, destino_lng, total, servicio_id, categoria, paradas_json
         FROM cotizaciones_viaje WHERE cliente_id = ? AND creado_en >= datetime('now', ?)
        ORDER BY creado_en DESC, rowid DESC LIMIT 10`,
    )
    .bind(clienteId, `-${REUSO_RUTA_MINUTOS} minutes`)
    .all<{
      origen_lat: number;
      origen_lng: number;
      destino_lat: number;
      destino_lng: number;
      total: number;
      servicio_id: string;
      categoria: string | null;
      paradas_json: string | null;
    }>();
  const cerca = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    distanciaKm(a, b) * 1000 <= REUSO_RUTA_RADIO_M;
  const f = results.find(
    (x) =>
      x.servicio_id === servicio &&
      (x.categoria ?? 'estandar') === categoria &&
      cerca({ lat: x.origen_lat, lng: x.origen_lng }, origen) &&
      cerca({ lat: x.destino_lat, lng: x.destino_lng }, destino) &&
      mismasParadas(leerParadas(x.paradas_json), paradas),
  );
  return f ? { total: f.total } : null;
}

/** C-VIAJE-PARADAS: las paradas guardadas en una cotización (lista vacía si no hay o está dañada). */
export function leerParadas(json: string | null | undefined): PuntoViaje[] {
  try {
    const v: unknown = JSON.parse(json ?? '[]');
    return Array.isArray(v)
      ? v.flatMap((p) => {
          const o = p as Partial<PuntoViaje> | null;
          return o && typeof o.lat === 'number' && typeof o.lng === 'number'
            ? [{ lat: o.lat, lng: o.lng, direccion: String(o.direccion ?? '') }]
            : [];
        })
      : [];
  } catch {
    console.error('viajes: paradas dañadas en la cotización');
    return [];
  }
}

function mismasParadas(
  a: readonly { lat: number; lng: number }[],
  b: readonly { lat: number; lng: number }[],
): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => {
      const q = b.at(i);
      return q != null && distanciaKm(p, q) * 1000 <= REUSO_RUTA_RADIO_M;
    })
  );
}

const SIN_CATEGORIA: Record<Exclude<CategoriaViaje, 'estandar'>, string> = {
  xl: 'Carro XL todavía no está disponible en tu ciudad.',
  comfort: 'Carro Comfort todavía no está disponible en tu ciudad.',
  premium: 'Carro Premium todavía no está disponible en tu ciudad.',
};

/**
 * C-VIAJE-PARADAS: las paradas de un viaje son válidas si el servicio las admite (Moto y Carro; un
 * envío va de un punto a otro), no pasan del máximo del país y quedan en el MISMO país del viaje
 * (C-DESTINO-EN-EL-PAIS: pueden salir de la ciudad).
 */
export async function exigirParadasValidas(
  env: Env,
  db: D1Database,
  servicio: string,
  zona: { id: string; pais: string },
  paradas: readonly PuntoViaje[],
): Promise<void> {
  if (!paradas.length) return;
  if (servicio === 'envios')
    throw new ErrorDatos('Un envío va de un punto a otro, sin paradas.', 'paradas', 422);
  const maximo = perfilPasajeros(zona.pais).carro.paradasMaximas;
  if (paradas.length > maximo)
    throw new ErrorDatos(
      maximo === 1
        ? 'Un viaje puede llevar una parada como máximo.'
        : `Un viaje puede llevar hasta ${maximo} paradas.`,
      'paradas',
      422,
    );
  for (const p of paradas) await exigirPuntoEnElPais(env, db, zona, p, 'paradas');
}

viajesPasajero.post('/viajes/cotizar', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(c, esquemaCotizarViaje);
  // C-CUPON-DIVOOX: con el aparato de la app, la cotización dice el regalo que se aplicaría.
  const aparato = await aparatoDe(c);
  return c.json({ cotizacion: await cotizarParaCliente(c.env, base(c), u.id, d, aparato) }, 201);
});

/**
 * La cotización de un viaje para un cliente: precio fijo por 5 minutos. La usan la app (arriba) y el
 * reloj al hacer nacer cada salida de un viaje fijo (C-VIAJES-FIJOS), con las MISMAS reglas.
 */
export async function cotizarParaCliente(
  env: Env,
  db: D1Database,
  clienteId: string,
  d: PedidoCotizacion,
  /** C-CUPON-DIVOOX: la huella del aparato (sin ella no se calcula regalo: viajes fijos del reloj). */
  aparato: string | null = null,
) {
  const zona = await zonaPara(db, d.origen.lat, d.origen.lng);
  if (!zona) throw new ErrorDatos('Todavía no llegamos a esa dirección.', 'origen', 409);
  // C-DESTINO-EN-EL-PAIS: la recogida en una ciudad abierta; el destino, en el mismo país.
  if ((await estadoServicioEnZona(db, d.servicio, zona.id, clienteId)) !== 'disponible')
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  await exigirPuntoEnElPais(env, db, zona, d.destino, 'destino');
  const fila = await tarifaActiva(db, d.servicio, zona.id);
  if (!fila)
    throw new ErrorDatos('Este servicio todavía no tiene precio en tu ciudad.', 'servicio', 409);
  const normal = filaATarifa(fila);
  // C-CARRO-XL y C-CARRO-CATEGORIAS: cada categoría cotiza con su factor; sin factor en la ciudad,
  // esa categoría no existe. Solo Carro tiene categorías.
  const tarifa = d.servicio === 'carro' ? tarifaDeCategoria(normal, d.categoria) : normal;
  if (d.categoria !== 'estandar' && (!tarifa || d.servicio !== 'carro'))
    throw new ErrorDatos(SIN_CATEGORIA[d.categoria], 'categoria', 409);
  if (!tarifa) throw new ErrorDatos(SIN_CATEGORIA.xl, 'categoria', 409);
  // C-PRECIO-ZONA: la etiqueta de ruta (precio fijo de la zona) en la que caen la recogida y el
  // destino. Solo viajes sin paradas: con paradas el trayecto ya no es el acostumbrado.
  const rutaZona = d.paradas.length
    ? null
    : await rutaPrecioPara(db, d.servicio, zona, fila.moneda, d.origen, d.destino);
  const idaVuelta = d.idaVuelta === true;
  if (
    idaVuelta &&
    (d.servicio === 'envios' || d.categoria !== 'estandar' || rutaZona?.precio_ida_vuelta == null)
  )
    throw new ErrorDatos('Este trayecto no tiene precio de ida y vuelta.', 'idaVuelta', 422);
  // C-PRECIO-ZONA: ida y vuelta = la vuelta como una parada en el destino y el viaje termina donde
  // empezó. Usa el ciclo de paradas de siempre (C-VIAJE-PARADAS): espera en la parada y la ruta
  // completa para el conductor.
  const paradas: PuntoViaje[] = idaVuelta ? [d.destino] : d.paradas;
  const destino: PuntoViaje = idaVuelta ? d.origen : d.destino;
  // C-VIAJE-PARADAS: paradas intermedias (máximo del país, todas en el mismo país).
  await exigirParadasValidas(env, db, d.servicio, zona, paradas);
  // C-RUTA-POR-CALLES: distancia y tiempo reales por calles (Google Routes, sin tráfico); si no se
  // puede, la fórmula de siempre, sin error para el pasajero. Solo para el precio.
  const ruta = await rutaParaCotizar(env, db, clienteId, tarifa, d.origen, destino, paradas);
  if (ruta.distanciaM < 200)
    throw new ErrorDatos('El destino está demasiado cerca del punto de recogida.', 'destino', 422);
  if (ruta.distanciaM > kmMaximoDe(d.servicio, tarifa) * 1000)
    throw new ErrorDatos('El destino está demasiado lejos para este servicio.', 'destino', 422);
  // C-CARRO-DINAMICA: el multiplicador de la ciudad en este momento (10 000 = precio normal), nunca
  // por encima del tope de la tarifa ni del tope del país. Queda fijo para este viaje.
  const multiplicadorPb = await multiplicadorVigente(db, d.servicio, zona, tarifa.topeDinamicoPb);
  // C-QUIEN-PAGA-VIAJES: quién paga la comisión en esta ciudad. Solo se le suma la tarifa de
  // servicio al pasajero si su app la muestra en una línea aparte; si no, como siempre (conductor).
  // Solo viajes de personas (Moto y Carro): los envíos siguen como siempre.
  const quienPaga =
    d.tarifaServicio && d.servicio !== 'envios'
      ? await quienPagaViaje(db, zona.pais, zona.id, d.servicio)
      : 'conductor';
  const conTarifa = async (dg: DesgloseViaje): Promise<DesgloseViaje> => {
    const t = await tarifaServicioViaje(db, {
      servicioId: d.servicio,
      pais: zona.pais,
      ciudad: zona.id,
      moneda: fila.moneda,
      precio: dg.total,
      quienPaga,
    });
    return {
      ...dg,
      precioViaje: dg.total,
      tarifaServicio: t.tarifaServicio,
      quienPaga,
      total: dg.total + t.tarifaServicio,
    };
  };
  // C-PRECIO-ZONA: el precio del viaje es el MENOR entre el de la zona y el calculado (si la
  // diferencia pasa del umbral de la tarifa). Solo la categoría estándar: Comfort, Premium y XL
  // siguen calculadas. La tarifa de servicio, la comisión y el regalo salen de este precio.
  // C-RECARGO-NOCHE: la hora con que se decide la tarifa nocturna (la reservada, si es programado).
  const cuando = d.programadoPara ? new Date(d.programadoPara) : new Date();
  const precioDe = (
    t: TarifaViaje,
    categoria: CategoriaViaje,
    r: { distanciaM: number; duracionS: number } = ruta,
    vuelta = idaVuelta,
  ): DesgloseViaje => {
    const calculado = cotizarViaje(t, r, multiplicadorPb);
    const precio =
      !rutaZona || categoria !== 'estandar'
        ? null
        : vuelta
          ? rutaZona.precio_ida_vuelta
          : rutaZona.precio;
    const deDia =
      precio == null || !rutaZona
        ? calculado
        : conPrecioZona(calculado, precio, normal.umbralPrecioZonaPb, {
            id: rutaZona.id,
            idaVuelta: vuelta,
          });
    // C-RECARGO-NOCHE: primero el más bajo de los dos de día, después el recargo de la noche. Así de
    // noche el precio nunca pasa el de la zona por (1 + recargo).
    return conRecargoNoche(deDia, t, cuando, zona.zonaHoraria);
  };
  const desglose: DesgloseViaje = {
    ...(await conTarifa(precioDe(tarifa, d.categoria))),
    // C-RECARGO-NOCHE: la hora reservada que declaró la app (para comprobarla al pedir).
    ...(d.programadoPara ? { horaPrecio: d.programadoPara } : {}),
  };
  // C-PRECIO-ZONA: si la ruta tiene precio de ida y vuelta, se ofrece (la vuelta estimada como el
  // doble del trayecto, sin otra consulta de rutas). Al elegirla, la app vuelve a cotizar con
  // `idaVuelta` y ese es el precio fijo.
  const vueltaDg =
    !idaVuelta &&
    rutaZona?.precio_ida_vuelta != null &&
    d.servicio !== 'envios' &&
    d.categoria === 'estandar'
      ? precioDe(
          tarifa,
          'estandar',
          { distanciaM: ruta.distanciaM * 2, duracionS: ruta.duracionS * 2 },
          true,
        )
      : null;
  const ofertaIdaVuelta =
    vueltaDg?.precioZona != null ? { total: (await conTarifa(vueltaDg)).total } : null;
  // C-CARRO-CATEGORIAS: el precio de cada categoría que ofrece la ciudad para este mismo trayecto,
  // calculado aquí mismo (sin guardar nada): la app las muestra para elegir (con su tarifa).
  const opciones =
    d.servicio === 'carro'
      ? (
          await Promise.all(
            categoriasOfrecidas(normal).map(async (categoria) => {
              const t = tarifaDeCategoria(normal, categoria);
              if (!t) return null;
              const dg = await conTarifa(precioDe(t, categoria));
              return {
                categoria,
                total: dg.total,
                ...(dg.tarifaServicio ? { tarifaServicio: dg.tarifaServicio } : {}),
              };
            }),
          )
        ).filter((o) => o != null)
      : [];
  // C-RUTA-POR-CALLES: si el pasajero ya veía un precio para este mismo trayecto y cambió, se dice.
  const anterior = await cotizacionAnteriorMismoTrayecto(
    db,
    clienteId,
    d.servicio,
    d.categoria,
    d.origen,
    destino,
    paradas,
  );
  // C-FOTO-RECOGIDA: si la recogida cae en una dirección guardada del pasajero (solo viajes de
  // personas), queda anotada con la cotización: el conductor asignado verá la foto de esa entrada.
  const recogida =
    d.servicio === 'envios'
      ? { direccionId: null, conFotos: false }
      : await direccionDeRecogida(db, clienteId, d.origen);
  const id = nuevoId();
  const venceEn = sqlFecha(new Date(Date.now() + VIGENCIA_COTIZACION_S * 1000));
  // C-BS-EN-MANO: la tasa del día queda FIJADA con la cotización (y pasa al viaje al pedirlo).
  const tasaLocal = await tasaParaFijar(db, zona.pais, fila.moneda);
  await db
    .prepare(
      `INSERT INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id,
         origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion,
         distancia_m, duracion_s, multiplicador_pb, desglose_json, tarifa_json, total, moneda, vence_en, categoria,
         fuente_distancia, paradas_json, ref_tasa, ref_fecha, origen_direccion_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      clienteId,
      d.servicio,
      zona.id,
      fila.id,
      d.origen.lat,
      d.origen.lng,
      // C-PUNTO-EXACTO: el conductor ve el punto de encuentro con su referencia.
      direccionConReferencia(d.origen.direccion, d.origen.referencia),
      destino.lat,
      destino.lng,
      direccionConReferencia(destino.direccion, destino.referencia),
      ruta.distanciaM,
      ruta.duracionS,
      multiplicadorPb,
      JSON.stringify(desglose),
      JSON.stringify(tarifa),
      desglose.total,
      fila.moneda,
      venceEn,
      d.categoria,
      ruta.fuente,
      JSON.stringify(paradas),
      tasaLocal?.tasa ?? null,
      tasaLocal?.fecha ?? null,
      recogida.direccionId,
    )
    .run();
  const cotizacion: CotizacionViaje = {
    id,
    // C-FOTO-RECOGIDA: la app invita a agregar la foto si sale de una dirección guardada sin fotos.
    recogida: {
      guardada: recogida.direccionId != null,
      conFotos: recogida.conFotos,
      direccionId: recogida.direccionId,
    },
    servicio: d.servicio,
    categoria: d.categoria,
    paradas,
    paradasMaximas: d.servicio === 'envios' ? 0 : perfilPasajeros(zona.pais).carro.paradasMaximas,
    multiplicadorPb,
    zona: { id: zona.id, nombre: zona.nombre },
    moneda: fila.moneda,
    distanciaM: ruta.distanciaM,
    duracionS: ruta.duracionS,
    fuenteDistancia: ruta.fuente,
    desglose,
    total: desglose.total,
    // C-QUIEN-PAGA-VIAJES: la tarifa de servicio va aparte (ya sumada en el total) y a la vista.
    tarifaServicio: desglose.tarifaServicio ?? 0,
    quienPaga,
    venceEn,
    dePrueba: fila.de_prueba === 1,
    metodosPago: [...perfilPasajeros(zona.pais).metodosPago],
    // C-PRECIO-ZONA: el precio fijo de la zona (con el lugar de la ruta) y la ida y vuelta.
    precioZona: desglose.precioZona != null,
    ...(desglose.precioZona != null && rutaZona ? { lugarZona: rutaZona.hasta_nombre } : {}),
    idaVuelta,
    ofertaIdaVuelta,
    // C-RECARGO-NOCHE: la app dice «Tarifa nocturna (+30 %)» en una línea clara antes de pedir.
    recargoNoche: desglose.recargoNoche
      ? { pb: desglose.recargoNochePb ?? 0, monto: desglose.recargoNoche }
      : null,
    precioCambio: anterior != null && anterior.total !== desglose.total,
    ...(anterior != null && anterior.total !== desglose.total
      ? { totalAnterior: anterior.total }
      : {}),
  };
  // C-BS-REFERENCIA: el equivalente en bolívares, solo informativo (null sin tasa vigente).
  const referencia = referenciaConTasa(desglose.total, tasaLocal);
  // C-CUPON-DIVOOX: el regalo que pagaría Divoox si el viaje se paga en mano (se aparta al pedir).
  const regalo = aparato
    ? await regaloParaCliente(db, {
        clienteId,
        servicio: d.servicio,
        zonaId: zona.id,
        moneda: fila.moneda,
        base: desglose.total,
        aparato,
      })
    : null;
  // C-BS-EN-MANO: lo que pagaría en mano (el precio menos el regalo), en dólares y en bolívares con
  // la tasa fijada; la tasa va aparte para las categorías y la subida de tarifa (la app la usa).
  const enMano = montoEnMano(pagaEnMano(desglose.total, regalo), fila.moneda, zona.pais, tasaLocal);
  // C-SALDO-CLIENTE: el Saldo Divoox disponible, solo donde el país lo tiene encendido y el viaje es
  // en su moneda (dólares). La pantalla «Método de pago» hace la cuenta en vivo con `cuentaConSaldo`.
  const perfil = perfilPasajeros(zona.pais);
  const conSaldo = perfil.saldoDivoox && fila.moneda === MONEDA_SALDO_DIVOOX;
  // C-SALDO-BIENVENIDA: quien confirmó su celular sin ciudad recibe aquí la bienvenida de la ciudad de
  // ESTE viaje (la calcula el servidor), si la tiene encendida. Una lectura por llave si no hay nada.
  if (conSaldo) await bienvenidaPendiente(env, db, { clienteId, zonaId: zona.id, aparato });
  // C-SALDO-LOTES: lo disponible, cuánto es regalo y cuánto prepago, y el regalo que vence pronto.
  const detalle = conSaldo ? await detalleSaldo(db, clienteId) : null;
  const pronto = Date.now() + DIAS_VENCE_PRONTO * 86_400_000;
  const saldoDivoox = detalle
    ? {
        disponible: detalle.disponible,
        moneda: MONEDA_SALDO_DIVOOX,
        regalo: detalle.regalo,
        prepago: detalle.prepago,
        vencePronto:
          detalle.proximoVence &&
          Date.parse(`${detalle.proximoVence.venceEn.replace(' ', 'T')}Z`) <= pronto
            ? detalle.proximoVence
            : null,
      }
    : null;
  // C-PAGO-MOVIL-DISPONIBLE: Pago Móvil solo si en la zona hay un conductor conectado y habilitado
  // para este servicio con su Pago Móvil cargado (una lectura con LIMIT 1). Si no, la opción sale
  // apagada con «Aún no disponible para este viaje», nunca una ventana de error.
  const disponibles = Object.fromEntries(
    await Promise.all(
      perfil.metodosPago.map(async (m) => [
        m,
        m === 'pago_movil'
          ? await hayConductorQueRecibe(db, {
              servicioId: d.servicio,
              zonaId: zona.id,
              pais: zona.pais,
              metodo: m,
            })
          : true,
      ]),
    ),
  ) as CotizacionViaje['disponibles'];
  return {
    ...cotizacion,
    referencia,
    opciones,
    regalo,
    tasaLocal,
    enMano,
    saldoDivoox,
    disponibles,
  };
}

// ---------------------------------------------------------------- M2: pedir, ver y cancelar

/**
 * C-RECARGO-NOCHE: la cotización que declaró su hora (`horaPrecio`, app nueva) solo vale para un viaje
 * en la misma franja (noche o día) que esa hora. Sin hora declarada no se comprueba nada: vale el precio
 * mostrado (las apps de la tienda no la mandan y nunca quedan sin salida). Solo en ciudades con recargo.
 */
export function exigirNocheDeLaReserva(
  cot: { tarifa_json: string | null; desglose_json: string | null },
  programadoPara: string | null,
  zonaHoraria: string | null | undefined,
  ahora: Date = new Date(),
): void {
  const t = tarifaDeCopia(cot.tarifa_json);
  if (!t?.recargoNochePb) return;
  const declarada = horaDeclarada(cot.desglose_json);
  if (!declarada) return;
  const zona = zonaHoraria ?? 'UTC';
  const noche = (x: Date) => esHoraDeNoche(x, zona, t.nocheDesdeH, t.nocheHastaH);
  if (noche(new Date(declarada)) !== noche(programadoPara ? new Date(programadoPara) : ahora))
    throw new ErrorDatos(
      'El precio cambia a esa hora por la tarifa nocturna. Revisa el precio antes de reservar.',
      'cotizacionId',
      409,
    );
}

/** C-RECARGO-NOCHE: la hora reservada que declaró la cotización (null si no la declaró). */
function horaDeclarada(json: string | null): string | null {
  try {
    const h = (JSON.parse(json ?? '{}') as DesgloseViaje).horaPrecio;
    return typeof h === 'string' && !Number.isNaN(Date.parse(h)) ? h : null;
  } catch (e) {
    console.error('viajes: desglose dañado en la cotización', e);
    return null;
  }
}

function claveDe(c: Ctx, accion: string, id: string): string {
  const k = c.req.header('idempotency-key') ?? '';
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(k))
    throw new ErrorDatos('Falta la clave de la solicitud. Actualiza la app.', undefined, 400);
  return `${accion}:${id}:${k}`;
}

/**
 * Pedir el viaje con una cotización vigente. La cotización es de un solo uso: el mismo pedido
 * repetido (doble toque, respuesta perdida) devuelve el mismo viaje. Todo en un solo lote: la
 * cotización se marca usada, nacen la operación y el viaje, o no pasa nada.
 * M2: efectivo (el conductor cobra en mano). La tarjeta llega con el dinero (M7).
 */
viajesPasajero.post('/viajes', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  await frenarSinCelularConfirmado(c.env, db, u.id);
  const d = await leerCuerpo(
    c,
    z.object({
      cotizacionId: z.string().min(8).max(64),
      // C-VIAJE-TARJETA: con tarjeta se autoriza al pedir y se cobra al terminar.
      // C-PAGO-MOVIL-VIAJE: el pago móvil solo donde el perfil del país lo tiene (Venezuela).
      metodoPago: z.enum([...METODOS_PAGO_VIAJE, 'saldo']).default('efectivo'),
      // C-ENVIOS: qué se envía y quién lo recibe (solo en Envíos).
      paquete: esquemaPaqueteEnvio.optional(),
      // C-VIAJE-PROGRAMADO: la hora reservada (desde 30 minutos hasta 7 días).
      programadoPara: z.iso.datetime().optional(),
      // C-CONDUCTOR-CONFIANZA: a cuál de sus conductores de confianza se le ofrece primero
      // (sin el campo: el más cercano que está conectado; «ninguno»: a cualquiera).
      confianza: z.string().min(7).max(64).optional(),
      // C-CUPON-DIVOOX: el regalo que la persona vio en la cotización (si ya no está, se le avisa).
      regalo: z.string().trim().max(30).optional(),
      // C-SALDO-CLIENTE: usar el Saldo Divoox (primero el regalo, después el saldo hasta donde
      // alcance; el resto con `metodoPago`). Si el saldo cubre todo, el viaje queda «saldo».
      usarSaldo: z.boolean().default(false),
    }),
  );
  const cot = await db
    .prepare(
      `SELECT id, servicio_id, zona_id, usada_en, operacion_id, total, moneda, tarifa_json, desglose_json, origen_lat, origen_lng, vence_en > datetime('now') AS vigente
         FROM cotizaciones_viaje WHERE id = ? AND cliente_id = ?`,
    )
    .bind(d.cotizacionId, u.id)
    .first<{
      id: string;
      servicio_id: string;
      zona_id: string;
      usada_en: string | null;
      operacion_id: string | null;
      total: number;
      moneda: string;
      tarifa_json: string | null;
      desglose_json: string | null;
      origen_lat: number;
      origen_lng: number;
      vigente: number;
    }>();
  if (!cot) throw new ErrorDatos('Esa cotización no existe.', 'cotizacionId', 404);
  if (cot.usada_en && cot.operacion_id) return c.json({ viaje: { id: cot.operacion_id } });
  if (!cot.vigente)
    throw new ErrorDatos('El precio venció. Vuelve a cotizar el viaje.', 'cotizacionId', 409);
  const paisViaje = await db
    .prepare('SELECT pais, zona_horaria FROM zonas WHERE id = ?')
    .bind(cot.zona_id)
    .first<{ pais: string; zona_horaria: string | null }>();
  // C-RECARGO-NOCHE: si la cotización declaró su hora (app nueva) y la franja de ESA hora no es la del
  // viaje que se pide, hay que volver a cotizar. Sin hora declarada (app de antes, o un viaje para
  // ahora cotizado a las 20:59 y pedido a las 21:05), vale el precio que la persona vio.
  exigirNocheDeLaReserva(cot, d.programadoPara ?? null, paisViaje?.zona_horaria);
  const perfilViaje = perfilPasajeros(paisViaje?.pais);
  const conSaldo = d.usarSaldo || d.metodoPago === 'saldo';
  if (conSaldo && !perfilViaje.saldoDivoox)
    throw new ErrorDatos('El Saldo Divoox todavía no se usa en tu ciudad.', 'metodoPago', 422);
  if (conSaldo && d.programadoPara)
    throw new ErrorDatos(
      'El Saldo Divoox se usa en los viajes de ahora. Para reservar, elige cómo pagas en mano.',
      'metodoPago',
      422,
    );
  if (d.metodoPago !== 'saldo' && !perfilViaje.metodosPago.includes(d.metodoPago))
    throw new ErrorDatos('Ese método de pago no está disponible en tu ciudad.', 'metodoPago', 422);
  if (conSaldo && cot.moneda !== MONEDA_SALDO_DIVOOX)
    throw new ErrorDatos('El Saldo Divoox se usa en viajes en dólares.', 'metodoPago', 422);
  // C-PAGO-MOVIL-DISPONIBLE: si mientras elegía ya no queda ningún conductor con Pago Móvil, se dice
  // en palabras y la app vuelve a la selección (lo elegido no se pierde). Con todo pagado con saldo no
  // se paga nada en mano: no importa.
  if (
    d.metodoPago === 'pago_movil' &&
    !(await hayConductorQueRecibe(db, {
      servicioId: cot.servicio_id,
      zonaId: cot.zona_id,
      pais: paisViaje?.pais ?? '',
      metodo: 'pago_movil',
    }))
  )
    throw new ErrorDatos(
      'Pago Móvil ya no está disponible para este viaje: ahora no hay conductores cerca que lo reciban. Elige otra forma de pago.',
      'metodoPago',
      409,
    );
  if (
    (await estadoServicioEnZona(db, cot.servicio_id, cot.zona_id, c.get('usuario')?.id ?? null)) !==
    'disponible'
  )
    throw new ErrorDatos('Este servicio todavía no está disponible en tu ciudad.', 'servicio', 409);
  // C-ENVIOS: el paquete es obligatorio en Envíos, con su valor dentro del tope de la ciudad.
  const esEnvio = cot.servicio_id === 'envios';
  const tipo = esEnvio ? 'envio_paquete' : 'viaje_pasajero';
  if (esEnvio) {
    if (!d.paquete) throw new ErrorDatos('Cuéntanos qué envías y quién lo recibe.', 'paquete', 422);
    const tope = tarifaDeCopia(cot.tarifa_json)?.valorMaximo ?? VALOR_MAXIMO_ENVIO_POR_DEFECTO;
    if (d.paquete.valorDeclarado > tope)
      throw new ErrorDatos(
        'El valor de lo que envías pasa el máximo permitido en tu ciudad.',
        'valorDeclarado',
        422,
      );
    if (!telefonoCanonico(d.paquete.destinatario.telefono))
      throw new ErrorDatos('El celular de quien recibe no parece válido.', 'telefono', 422);
  }
  const op = nuevoId();
  // C-CUPON-DIVOOX: el regalo se aparta ANTES de crear el viaje, contra el presupuesto, en un solo
  // paso. Si la persona lo vio y ya no está (otro lo gastó, se apagó), no se pide a ciegas.
  // C-SALDO-CLIENTE: con todo pagado con saldo el regalo también vale (va primero, en su línea).
  const metodoDelRegalo = d.metodoPago === 'saldo' ? 'efectivo' : d.metodoPago;
  const regalo = conRegalo(metodoDelRegalo)
    ? await apartarRegalo(db, {
        clienteId: u.id,
        servicio: cot.servicio_id,
        zonaId: cot.zona_id,
        moneda: cot.moneda,
        base: Number(cot.total),
        aparato: await aparatoDe(c),
        operacionId: op,
        pais: paisViaje?.pais ?? 'US',
      })
    : null;
  if (d.regalo && conRegalo(metodoDelRegalo) && !regalo)
    throw new ErrorDatos(
      'Tu regalo de Divoox ya no está disponible. Revisa el precio antes de pedir.',
      'regalo',
      409,
    );
  // C-SALDO-CLIENTE: el saldo se APARTA ahora (sale del saldo en la misma sentencia que comprueba que
  // alcanza), después del regalo. Si no alcanza para todo, el resto se paga con lo elegido abajo.
  let saldoUsado = 0;
  let metodoPago: string = d.metodoPago;
  if (conSaldo) {
    const cuenta = cuentaConSaldo({
      total: Number(cot.total),
      regalo,
      saldoDisponible: await saldoDeCliente(db, u.id),
      usarSaldo: true,
    });
    const falla = async (mensaje: string, estado: 409 | 422 = 422) => {
      if (regalo) await liberarRegalo(db, op, 'saldo_no_alcanza');
      throw new ErrorDatos(mensaje, 'metodoPago', estado);
    };
    // M2: si el regalo ya cubre todo, no hay resto: «saldo» no es «no alcanza» (el regalo se queda).
    if (cuenta.resto > 0 && d.metodoPago === 'saldo')
      await falla(
        'Tu Saldo Divoox no alcanza para todo el viaje. Elige cómo pagas el resto: Pago Móvil o Efectivo.',
      );
    if (cuenta.saldoUsado > 0) {
      const apartado = await apartarSaldoViaje(db, {
        operacionId: op,
        clienteId: u.id,
        monto: cuenta.saldoUsado,
        pais: paisViaje?.pais ?? 'VE',
        aparato: await aparatoDe(c),
      });
      if (!apartado)
        await falla(
          'Tu Saldo Divoox cambió mientras pedías. Revisa cómo pagas y vuelve a pedir.',
          409,
        );
      saldoUsado = cuenta.saldoUsado;
    }
    if (cuenta.cubreTodo) metodoPago = 'saldo';
    // Sin nada que pagar ni con saldo (el regalo lo cubrió), el viaje va como en mano con cero.
    else if (d.metodoPago === 'saldo') metodoPago = 'efectivo';
  }
  const deshacerSaldo = async (motivo: string) => {
    if (saldoUsado > 0) await liberarSaldoViaje(db, op, motivo);
  };
  const conductorPreferidoId = await conductorDeConfianzaParaPedir(
    db,
    u.id,
    { servicioId: cot.servicio_id, zonaId: cot.zona_id, lat: cot.origen_lat, lng: cot.origen_lng },
    d.programadoPara && !d.confianza ? 'auto-programado' : d.confianza,
  );
  // C-VIAJE-PROGRAMADO: con hora reservada, la cotización queda apartada (precio fijo) y el viaje
  // nace a la hora de buscar conductor (el reloj); hasta entonces se cancela gratis.
  if (d.programadoPara) {
    const programado = await programarViaje(c.env, db, u, {
      op,
      cotizacionId: cot.id,
      servicioId: cot.servicio_id,
      zonaId: cot.zona_id,
      // Con saldo no se reserva (se frena arriba): aquí nunca llega «saldo».
      metodoPago: d.metodoPago === 'saldo' ? 'efectivo' : d.metodoPago,
      paquete: d.paquete ?? null,
      programadoPara: new Date(d.programadoPara),
      conductorPreferidoId,
    }).catch(async (e: unknown) => {
      if (regalo) await liberarRegalo(db, op, 'no_programado');
      throw e;
    });
    return c.json(programado, 201);
  }
  const inicial = metodoPago === 'tarjeta' ? 'pago_pendiente' : 'buscando';
  const pinEntrega = pinNuevo();
  const creado = await crearViajeDeCotizacion(db, {
    op,
    cotizacionId: cot.id,
    clienteId: u.id,
    tipo,
    estado: inicial,
    metodoPago,
    paquete: esEnvio ? (d.paquete ?? null) : null,
    pinEntrega,
    exigirSinActivo: true,
    conductorPreferidoId,
    // C-SALDO-CLIENTE: lo que cubre el saldo nace con el viaje, en el mismo lote.
    saldoDivoox: saldoUsado,
  });
  // C-MOTO-CIUDAD: el código para empezar según la ciudad y la hora (se decide al pedir).
  // C-ENVIOS: un envío no lleva código al recoger (lleva foto); el PIN es de quien recibe.
  // C-REGALO-VIAJE-REAL: un viaje con regalo de Divoox SIEMPRE pide el código, aunque la ciudad no.
  if (
    creado &&
    (esEnvio ||
      (!regalo && saldoUsado === 0 && !(await pinParaViajeNuevo(db, cot.servicio_id, cot.zona_id))))
  )
    await db.prepare('UPDATE viajes SET pin_requerido = 0 WHERE operacion_id = ?').bind(op).run();
  if (!creado) {
    if (regalo) await liberarRegalo(db, op, 'no_creado');
    await deshacerSaldo('no_creado');
    const otra = await db
      .prepare('SELECT operacion_id FROM cotizaciones_viaje WHERE id = ? AND usada_en IS NOT NULL')
      .bind(cot.id)
      .first<{ operacion_id: string }>();
    if (otra) return c.json({ viaje: { id: otra.operacion_id } });
    throw new ErrorDatos(
      esEnvio ? 'Ya tienes un envío en curso.' : 'Ya tienes un viaje en curso.',
      undefined,
      409,
    );
  }
  if (esEnvio && d.paquete)
    await avisarDestinatario(c.env, db, sitioDe(c), op, d.paquete, pinEntrega, u.nombre).catch(
      (e: unknown) => console.error('envios: aviso a quien recibe', e),
    );
  // C-VIAJE-TARJETA: con tarjeta, primero la autorización; se busca conductor cuando Stripe avisa.
  if (metodoPago === 'tarjeta') {
    const pago = await abrirCobroViaje(c.env, db, u, op, Number(cot.total), cot.moneda);
    return c.json({ viaje: { id: op }, pago }, 201);
  }
  // Se busca conductor de una vez, sin esperar la vuelta del reloj (M3 afina el despacho).
  await repartirOperaciones(c.env, db).catch((e: unknown) =>
    console.error('viajes: despacho al pedir', e),
  );
  return c.json({ viaje: { id: op } }, 201);
});

/**
 * C-ENVIOS: lo que el que envía ve de su paquete. El PIN de entrega también lo ve él, para pasárselo a
 * quien recibe si el mensaje no le llegó.
 */
async function paqueteDe(db: D1Database, operacionId: string) {
  const p = await db
    .prepare(
      'SELECT descripcion, valor_declarado, destinatario_nombre, pin_entrega, recogido_en, entregado_en, tamano, foto_entrega FROM envios_persona WHERE operacion_id = ?',
    )
    .bind(operacionId)
    .first<{
      descripcion: string;
      valor_declarado: number;
      destinatario_nombre: string;
      pin_entrega: string;
      recogido_en: string | null;
      entregado_en: string | null;
      tamano: string | null;
      foto_entrega: string | null;
    }>();
  return p
    ? {
        descripcion: p.descripcion,
        valorDeclarado: p.valor_declarado,
        destinatario: p.destinatario_nombre,
        pinEntrega: p.entregado_en ? null : p.pin_entrega,
        recogido: Boolean(p.recogido_en),
        entregado: Boolean(p.entregado_en),
        tamano: p.tamano ?? 'pequeno',
        fotoEntrega: Boolean(p.foto_entrega),
      }
    : null;
}

/** Quien recibe: un mensaje con el enlace para seguir el envío en vivo y su PIN de entrega. */
export const sitioDe = (c: Ctx) =>
  (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');

/**
 * C-ENVIO-TEXTOS (14 nov 2026): el mensaje a quien recibe va en el idioma de quien envía; fuera de
 * EE. UU. siempre en español (el país de la zona manda).
 */
export function idiomaDelEnvio(idiomaRemitente: string | null, pais: string | null): 'es' | 'en' {
  if (pais && pais !== 'US') return 'es';
  return idiomaRemitente === 'en' ? 'en' : 'es';
}

export function textoSmsDestinatario(
  idioma: 'es' | 'en',
  nombre: string,
  enlace: string,
  pin: string,
): string {
  return idioma === 'en'
    ? `Divoox: ${nombre} sent you a package. Follow it live: ${enlace} — Your delivery PIN: ${pin}. Share it only with your driver at delivery.`
    : `Divoox: ${nombre} te envió un paquete. Síguelo en vivo: ${enlace} — Tu PIN de entrega: ${pin}. Dáselo solo a tu conductor al recibirlo.`;
}

export async function avisarDestinatario(
  env: Env,
  db: D1Database,
  sitio: string,
  operacionId: string,
  paquete: PaqueteEnvio,
  pin: string,
  remitente: string,
) {
  const codigo = nuevoToken();
  const cliente = await db
    .prepare(
      `SELECT o.cliente_id, u.idioma, z.pais FROM operaciones o JOIN usuarios u ON u.id = o.cliente_id
         LEFT JOIN zonas z ON z.id = o.zona_id WHERE o.id = ?`,
    )
    .bind(operacionId)
    .first<{ cliente_id: string; idioma: string | null; pais: string | null }>();
  if (!cliente) return;
  await db
    .prepare('INSERT INTO viajes_compartidos (huella, operacion_id, creado_por) VALUES (?, ?, ?)')
    .bind(await sha256(codigo), operacionId, cliente.cliente_id)
    .run();
  const nombre = remitente.split(' ')[0] ?? '';
  const idioma = idiomaDelEnvio(cliente.idioma, cliente.pais);
  await enviarSms(env, db, {
    usuarioId: cliente.cliente_id,
    pedidoId: null,
    tipo: 'envio_destinatario',
    telefono: telefonoCanonico(paquete.destinatario.telefono),
    textoCorto: cortoEnvioDestinatario(
      idioma,
      nombre,
      `${sitio}${idioma === 'es' ? '/es' : ''}/ride/${codigo}`,
      pin,
    ),
    texto: textoSmsDestinatario(
      idioma,
      nombre,
      `${sitio}${idioma === 'es' ? '/es' : ''}/ride/${codigo}`,
      pin,
    ),
  });
}

type FilaViajeCliente = FilaRegaloPasajero & {
  recogida_guardada?: number | null;
  ref_tasa: number | null;
  ref_fecha: string | null;
  ref_monto: number | null;
  total_final_centavos: number | null;
  id: string;
  servicio_id: string;
  estado: string;
  pin_recogida: string;
  pin_requerido: number;
  metodo_pago: string;
  origen_direccion: string;
  destino_direccion: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  segundos_asignado: number | null;
  total: number | null;
  moneda: string | null;
  tarifa_json: string | null;
  conductor_nombre: string | null;
  conductor_lat: number | null;
  conductor_lng: number | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string | null;
  pm_banco: string | null;
  pm_titular: string | null;
  pm_identificador: string | null;
  /** C-PAGO-A-CELULAR: la billetera del conductor (un viaje con Plin lo recibe también un Yape). */
  pm_tipo: string | null;
  pm_estado: string | null;
  pais: string | null;
  categoria: string | null;
  multiplicador_pb: number | null;
  /** C-PRECIO-ZONA: el precio de la zona del viaje (NULL = precio calculado). */
  precio_zona?: number | null;
  /** C-QUIEN-PAGA-VIAJES: la tarifa de servicio de Divoox (ya sumada en `total`). */
  tarifa_servicio: number | null;
  vehiculo_tipo: string | null;
  plazas: number | null;
  conductor_foto: number | null;
  /** C-SALDO-CLIENTE: lo que cubre el Saldo Divoox en este viaje y lo que volvió si no se hizo. */
  saldo_divoox: number | null;
  saldo_devuelto: number | null;
};

async function viajeDelCliente(
  db: D1Database,
  clienteId: string,
  id: string | null,
  tipo: 'viaje_pasajero' | 'envio_paquete' = 'viaje_pasajero',
) {
  return db
    .prepare(
      `SELECT o.id, o.servicio_id, v.estado, v.pin_recogida, v.pin_requerido, v.metodo_pago, v.origen_direccion,
              v.destino_direccion, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng,
              CAST((julianday('now') - julianday(v.asignado_en)) * 86400 AS INTEGER) AS segundos_asignado,
              q.total, q.moneda, q.tarifa_json, q.multiplicador_pb,
              json_extract(q.desglose_json, '$.precioZona') AS precio_zona,
              ${SQL_TARIFA_SERVICIO} AS tarifa_servicio,
              u.nombre AS conductor_nombre, d.lat AS conductor_lat, d.lng AS conductor_lng,
              h.marca, h.modelo, h.color, h.placa, h.tipo AS vehiculo_tipo, h.plazas, v.categoria,
              -- C-CARRO-VIAJE-PASAJERO: la foto es la selfie verificada (como Uber), solo si está aprobada.
              (SELECT 1 FROM kyc ky WHERE ky.usuario_id = o.conductor_id AND ky.estado = 'aprobado'
                 AND ky.selfie_miniatura IS NOT NULL) AS conductor_foto,
              k.banco AS pm_banco, k.titular AS pm_titular, k.identificador AS pm_identificador, k.tipo AS pm_tipo,
              pm.estado AS pm_estado, (SELECT z.pais FROM zonas z WHERE z.id = o.zona_id) AS pais,
              v.ref_tasa, v.ref_fecha, v.ref_monto, v.total_final_centavos,
              v.origen_direccion_id IS NOT NULL AS recogida_guardada,
              COALESCE(v.saldo_divoox, 0) AS saldo_divoox,
              (SELECT us.apartado FROM usos_saldo_divoox us WHERE us.operacion_id = o.id AND us.estado = 'liberado') AS saldo_devuelto,
              ${COLUMNAS_REGALO_PASAJERO}
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         ${JOIN_REGALO_PASAJERO}
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         LEFT JOIN usuarios u ON u.id = o.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
         LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
         -- C-PAGO-MOVIL-VIAJE: los datos de pago móvil del conductor (solo si el viaje se paga así).
         LEFT JOIN cuentas_cobro k ON v.metodo_pago IN ('pago_movil', 'yape', 'plin') AND k.id = (
           SELECT c2.id FROM cuentas_cobro c2 JOIN zonas z2 ON z2.id = o.zona_id
            WHERE c2.usuario_id = o.conductor_id AND c2.pais = z2.pais
              AND (c2.tipo = v.metodo_pago OR (v.metodo_pago IN ('yape', 'plin') AND c2.tipo IN ('yape', 'plin')))
              AND c2.activa = 1 ORDER BY c2.creado_en DESC LIMIT 1)
         LEFT JOIN viajes_pago_movil pm ON pm.operacion_id = o.id
        WHERE o.cliente_id = ?1
          AND (?2 IS NULL AND o.tipo_operacion = ?3 AND o.estado_general IN ${ESTADOS_ACTIVOS} OR o.id = ?2)
        ORDER BY o.creado_en DESC LIMIT 1`,
    )
    .bind(clienteId, id, tipo)
    .first<FilaViajeCliente>();
}

function tarifaDeCopia(json: string | null) {
  try {
    return esquemaTarifaViaje.parse(JSON.parse(json ?? '{}'));
  } catch {
    return null;
  }
}

/**
 * C-CARRO-VIAJE-PASAJERO: minutos que faltan, como la hora estimada de Uber, sin consultar a Google en
 * cada refresco: distancia en línea recta desde la posición del conductor hasta la recogida (si viene
 * en camino) o hasta el destino (en curso), por el factor de calle y la velocidad de la tarifa copiada
 * en la cotización. Aproximado; la app lo dice como «unos N min».
 */
function minutosEstimados(f: FilaViajeCliente, t: ReturnType<typeof tarifaDeCopia>) {
  if (!t || f.conductor_lat == null || f.conductor_lng == null) return null;
  const hacia =
    f.estado === 'asignado'
      ? { lat: f.origen_lat, lng: f.origen_lng }
      : f.estado === 'en_curso'
        ? { lat: f.destino_lat, lng: f.destino_lng }
        : null;
  if (!hacia) return null;
  const r = estimarRuta(t, { lat: f.conductor_lat, lng: f.conductor_lng }, hacia);
  return Math.max(1, Math.round(r.duracionS / 60));
}

/**
 * C-HORA-LLEGADA: la hora de llegada que calculó el servidor con tráfico (la misma fila que ve el
 * equipo): con el conductor en camino, la de la recogida; en el viaje, la del destino. Solo con el
 * viaje en marcha; leer no calcula (una lectura por llave).
 */
async function llegadaDelViaje(db: D1Database, id: string, estado: string) {
  const fase = faseDeViaje(estado);
  return fase ? llegadaParaMostrar(await leerLlegada(db, `viaje:${id}`), fase) : null;
}

function viajePublico(f: FilaViajeCliente) {
  const t = tarifaDeCopia(f.tarifa_json);
  const cargo = t ? cargoCancelacionViaje(t, f.estado, f.segundos_asignado) : null;
  const conConductor = ['asignado', 'conductor_llego', 'en_curso'].includes(f.estado);
  return {
    id: f.id,
    servicio: f.servicio_id,
    categoria: f.categoria ?? 'estandar',
    // C-FOTO-RECOGIDA: false = salió de un punto suelto (al terminar, la app ofrece guardarlo).
    recogidaGuardada: Number(f.recogida_guardada ?? 0) === 1,
    // C-CARRO-DINAMICA: el multiplicador con que se cotizó este viaje (10 000 = precio normal).
    multiplicadorPb: Number(f.multiplicador_pb ?? 10_000),
    // C-PRECIO-ZONA: con precio de la zona no se cambian las paradas (la app no ofrece hacerlo).
    precioZona: f.precio_zona != null,
    estado: f.estado,
    // El código solo lo ve el pasajero, y solo hasta que empieza el viaje.
    pin:
      f.pin_requerido && ['buscando', 'asignado', 'conductor_llego'].includes(f.estado)
        ? f.pin_recogida
        : null,
    metodoPago: f.metodo_pago,
    // C-SIN-PLUS-CODE: también los viajes guardados antes del arreglo.
    origen: { direccion: sinCodigo(f.origen_direccion), lat: f.origen_lat, lng: f.origen_lng },
    destino: { direccion: sinCodigo(f.destino_direccion), lat: f.destino_lat, lng: f.destino_lng },
    total: f.total,
    // C-QUIEN-PAGA-VIAJES: la «Tarifa de servicio de Divoox», en su línea aparte (ya va en el total).
    tarifaServicio: Number(f.tarifa_servicio ?? 0),
    moneda: f.moneda,
    // C-CUPON-DIVOOX: lo que paga Divoox y lo que el pasajero paga en mano.
    // C-PRECIO-CON-REGALO: con su nombre, y también el de un viaje cancelado (volvió a su cuenta).
    regalo: regaloPasajero(f),
    // C-SALDO-CLIENTE: lo que paga con su Saldo Divoox; si el viaje no se hizo, lo que le volvió.
    saldoDivoox: Number(f.saldo_divoox ?? 0),
    saldoDevuelto: f.saldo_devuelto == null ? null : Number(f.saldo_devuelto),
    conductor:
      conConductor && f.conductor_nombre
        ? {
            nombre: f.conductor_nombre.split(' ')[0] ?? '',
            ubicacion:
              f.conductor_lat != null && f.conductor_lng != null
                ? { lat: f.conductor_lat, lng: f.conductor_lng }
                : null,
            vehiculo: {
              tipo: f.vehiculo_tipo,
              marca: f.marca,
              modelo: f.modelo,
              color: f.color,
              placa: f.placa,
              plazas: f.plazas,
            },
            llegadaMin: minutosEstimados(f, t),
            foto: f.conductor_foto === 1,
          }
        : null,
    // C-PAGO-MOVIL-VIAJE: a quién se le paga y si el conductor ya confirmó que le llegó.
    pagoMovil: esPagoACelular(f.metodo_pago)
      ? {
          datos:
            (conConductor || f.estado === 'terminado') && f.pm_identificador
              ? {
                  tipo: f.pm_tipo,
                  banco: f.pm_banco,
                  titular: f.pm_titular,
                  identificador: f.pm_identificador,
                }
              : null,
          confirmado: f.pm_estado,
        }
      : null,
    cancelacion:
      cargo === null
        ? null
        : {
            cargo,
            gratisPorS:
              t && cargo === 0 && f.segundos_asignado != null
                ? Math.max(0, t.cancelacionGratisS - f.segundos_asignado)
                : null,
          },
  };
}

/**
 * C-BS-EN-MANO (Venezuela): el precio del viaje y lo que el pasajero paga EN MANO al conductor (el
 * precio menos el regalo), en dólares y en bolívares con la tasa FIJADA del viaje. Terminado, el monto
 * en bolívares es el guardado al cerrar: el mismo que vio el conductor.
 */
async function enDosMonedas(
  db: D1Database,
  f: {
    pais: string | null;
    moneda: string | null;
    total: number | null;
    estado: string;
    metodo_pago: string;
    ref_tasa: number | null;
    ref_fecha: string | null;
    ref_monto: number | null;
    total_final_centavos: number | null;
    regalo_monto: number | null;
    regalo_estado: string | null;
    saldo_divoox?: number | null;
  },
) {
  const tasa = await tasaDeOperacion(db, f.pais, f.moneda, {
    tasa: f.ref_tasa,
    fecha: f.ref_fecha,
  });
  const referencia = f.total == null ? null : referenciaConTasa(f.total, tasa);
  if (f.metodo_pago === 'tarjeta' || f.total == null || !f.moneda)
    return { referencia, enMano: null };
  const total =
    f.estado === 'terminado' && f.total_final_centavos != null ? f.total_final_centavos : f.total;
  const regalo = f.regalo_estado === 'liberado' ? 0 : Number(f.regalo_monto ?? 0);
  // C-SALDO-CLIENTE: la misma cuenta de siempre (pagaEnMano): total − regalo − Saldo Divoox.
  const enMano = montoEnMano(
    pagaEnMano(total, { monto: regalo }, Number(f.saldo_divoox ?? 0)),
    f.moneda,
    f.pais,
    tasa,
  );
  if (f.estado === 'terminado' && f.ref_monto != null && enMano.local)
    enMano.local = { ...enMano.local, monto: f.ref_monto };
  return { referencia, enMano };
}

viajesPasajero.get('/viajes/actual', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  // C-ENVIOS: ?servicio=envios devuelve el envío en curso (uno de cada tipo a la vez).
  const tipo = c.req.query('servicio') === 'envios' ? 'envio_paquete' : 'viaje_pasajero';
  let f = await viajeDelCliente(db, u.id, null, tipo);
  // M3: el sitio no tiene reloj propio (el de afuera pasa cada 5 minutos). Mientras el pasajero
  // espera, su consulta mueve el despacho si la oferta anterior venció o fue rechazada.
  if (f?.estado === 'buscando') {
    const abierta = await db
      .prepare(
        "SELECT 1 FROM ofertas_operacion WHERE operacion_id = ? AND estado = 'ofrecida' AND expira_en > datetime('now')",
      )
      .bind(f.id)
      .first();
    if (!abierta) {
      await repartirOperaciones(c.env, db).catch((e: unknown) =>
        console.error('viajes: despacho al consultar', e),
      );
      f = await viajeDelCliente(db, u.id, null, tipo);
    }
  }
  const deuda = await db
    .prepare(
      "SELECT COALESCE(SUM(monto), 0) AS monto, MAX(moneda) AS moneda FROM deudas_pasajero WHERE cliente_id = ? AND estado = 'pendiente'",
    )
    .bind(u.id)
    .first<{ monto: number; moneda: string | null }>();
  const viaje = f
    ? {
        ...viajePublico(f),
        // C-VIAJE-PARADAS: las paradas del viaje y cuántas admite su ciudad.
        paradas: await paradasDe(db, f.id),
        paradasMaximas: perfilPasajeros(f.pais).carro.paradasMaximas,
        ...(await enDosMonedas(db, f)),
        llegadaEnVivo: await llegadaDelViaje(db, f.id, f.estado),
        // C-CHAT-VIAJE-LLEGA: lo que el pasajero no ha visto del chat y el último mensaje.
        ...(await resumenChatViaje(db, f.id, u.id)),
      }
    : null;
  return c.json({
    viaje,
    paquete: viaje ? await paqueteDe(db, viaje.id) : null,
    // C-VIAJE-SEGURIDAD-2 (RideCheck): si el conductor se salió de la ruta, la app pregunta.
    alerta: viaje
      ? await revisarDesvio(db, {
          id: viaje.id,
          estado: viaje.estado,
          origen: viaje.origen,
          destino: viaje.destino,
          paradas: viaje.paradas,
          conductor: viaje.conductor?.ubicacion ?? null,
        })
      : null,
    deudaPendiente: deuda?.monto ? { monto: deuda.monto, moneda: deuda.moneda } : null,
  });
});

viajesPasajero.get('/viajes/:id', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await viajeDelCliente(db, u.id, c.req.param('id'));
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  // C-VIAJE-PARADAS: las paradas del viaje, en orden, con su estado.
  const paradas = await paradasDe(db, f.id);
  const viaje = {
    ...viajePublico(f),
    paradas,
    paradasMaximas: perfilPasajeros(f.pais).carro.paradasMaximas,
    ...(await enDosMonedas(db, f)),
    llegadaEnVivo: await llegadaDelViaje(db, f.id, f.estado),
    // C-CHAT-VIAJE-LLEGA: también aquí (la pantalla del viaje abierta desde un aviso usa esta ficha).
    ...(await resumenChatViaje(db, f.id, u.id)),
  };
  return c.json({
    viaje,
    paquete: await paqueteDe(db, viaje.id),
    alerta: await revisarDesvio(db, {
      id: viaje.id,
      estado: viaje.estado,
      origen: viaje.origen,
      destino: viaje.destino,
      paradas,
      conductor: viaje.conductor?.ubicacion ?? null,
    }),
  });
});

/**
 * C-CARRO-VIAJE-PASAJERO: la foto del conductor (su selfie verificada) para el pasajero de ESE viaje,
 * solo mientras el conductor viene o lo lleva. Privada y sin caché compartida.
 */
viajesPasajero.get('/viajes/:id/conductor/foto', async (c) => {
  const u = exigir(c, 'cliente');
  const f = await base(c)
    .prepare(
      `SELECT ky.selfie_miniatura FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN kyc ky ON ky.usuario_id = o.conductor_id AND ky.estado = 'aprobado'
        WHERE o.id = ? AND o.cliente_id = ? AND v.estado IN ('asignado', 'conductor_llego', 'en_curso')`,
    )
    .bind(c.req.param('id'), u.id)
    .first<{ selfie_miniatura: string | null }>();
  // C-FOTO-CONDUCTOR-MINIATURA: solo la miniatura (200 px, WebP) que se guardó al aprobar; la
  // selfie original es evidencia de identidad y nunca sale hacia el pasajero.
  const obj =
    f?.selfie_miniatura && c.env.BUCKET ? await c.env.BUCKET.get(f.selfie_miniatura) : null;
  if (!obj) throw new ErrorDatos('No hay foto para mostrar.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});

/**
 * El pasajero cancela. Gratis mientras se busca conductor y en la ventana desde la asignación;
 * después, el cargo de la tarifa copiada en la cotización. En efectivo, el cargo queda como deuda
 * para su próximo viaje (no se cobra en el momento).
 */
/**
 * C-REGALO-VIAJE-REAL: durante un viaje con regalo de Divoox, la app del pasajero manda dónde está
 * (como mucho una lectura cada 45 segundos). El servidor solo anota si estaba junto al conductor o
 * lejos de él: no guarda el punto. Sin regalo, sin viaje en curso o con una lectura imprecisa no
 * escribe nada. Nunca frena el viaje ni le muestra nada al pasajero.
 */
/** Una lectura del pasajero con peor precisión que esta (metros) no dice nada. */
const PRECISION_PASAJERO_M = 200;

viajesPasajero.post('/viajes/:id/mi-ubicacion', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      precision: z.number().min(0).max(100_000).nullable().optional(),
    }),
  );
  if ((d.precision ?? 0) > PRECISION_PASAJERO_M) return c.json({ ok: true });
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      `SELECT r.lat, r.lng FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN repartidores r ON r.usuario_id = o.conductor_id
        WHERE o.id = ?1 AND o.cliente_id = ?2 AND v.estado = 'en_curso' AND r.lat IS NOT NULL
          AND r.ubicacion_en > datetime('now', '-2 minutes')
          AND (v.pasajero_ubicacion_en IS NULL OR v.pasajero_ubicacion_en < datetime('now', '-45 seconds'))
          AND (EXISTS (SELECT 1 FROM usos_cupon_divoox x WHERE x.operacion_id = o.id AND x.estado = 'apartado')
               -- C-SALDO-CLIENTE: el viaje pagado con saldo se mide igual que el del regalo.
               OR EXISTS (SELECT 1 FROM usos_saldo_divoox s WHERE s.operacion_id = o.id AND s.estado = 'apartado'))`,
    )
    .bind(id, u.id)
    .first<{ lat: number; lng: number }>();
  if (!r) return c.json({ ok: true });
  const cerca =
    metrosEntrePuntos({ lat: Number(r.lat), lng: Number(r.lng) }, d) <=
    UMBRALES_VIAJE_REAL.radioPasajeroM;
  await db
    .prepare(
      `UPDATE viajes SET pasajero_cerca = pasajero_cerca + ?1, pasajero_lejos = pasajero_lejos + ?2,
              pasajero_ubicacion_en = datetime('now')
        WHERE operacion_id = ?3 AND estado = 'en_curso'
          AND (pasajero_ubicacion_en IS NULL OR pasajero_ubicacion_en < datetime('now', '-45 seconds'))`,
    )
    .bind(cerca ? 1 : 0, cerca ? 0 : 1, id)
    .run();
  return c.json({ ok: true });
});

viajesPasajero.post('/viajes/:id/cancelar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const id = c.req.param('id');
  const clave = claveDe(c, 'cancelar-cliente', id);
  const f = await viajeDelCliente(db, u.id, id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  if (f.estado === 'cancelado') return c.json({ ok: true, cargo: 0 }); // reintento
  const t = tarifaDeCopia(f.tarifa_json);
  const cargo = cargoCancelacionViaje(
    t ?? { cancelacionGratisS: 0, cargoCancelacion: 0 },
    f.estado,
    f.segundos_asignado,
  );
  if (cargo === null)
    throw new ErrorDatos(
      'El viaje ya empezó: ya no se puede cancelar desde la app.',
      undefined,
      409,
    );
  const ok = await cambiarEstadoViaje(db, {
    operacionId: id,
    desde: f.estado,
    hacia: 'cancelado',
    actor: 'cliente',
    actorId: u.id,
    clave,
    motivo: 'cancelado_por_pasajero',
  });
  if (!ok) throw new ErrorDatos('El viaje cambió. Actualiza la pantalla.', undefined, 409);
  // C-AVISOS-VIAJE: si ya tenía conductor, él sabe que quedó libre (con la app cerrada también).
  // Mientras buscaba, la oferta se retira sola en su pantalla: no se le manda nada más.
  if (f.estado === 'asignado' || f.estado === 'conductor_llego')
    await avisarPasoViaje(c.env, db, id, 'cancelado_pasajero');
  await devolverReservasViaje(db, id, 'cancelado_por_pasajero');
  // C-CUPON-DIVOOX: el regalo apartado vuelve al presupuesto del cupón.
  await liberarRegalo(db, id, 'cancelado_por_pasajero');
  // C-SALDO-CLIENTE: el Saldo Divoox apartado vuelve entero a su cuenta.
  await liberarSaldoViaje(db, id, 'cancelado_por_pasajero');
  // C-VIAJE-TARJETA: con tarjeta, el cargo se cobra de la autorización (o se anula si no hay cargo).
  if (f.metodo_pago === 'tarjeta') {
    const cobrado = await soltarCobroViaje(c.env, db, id, cargo);
    return c.json({ ok: true, cargo: cobrado });
  }
  if (cargo > 0 && f.moneda)
    await db
      .prepare(
        `INSERT OR IGNORE INTO deudas_pasajero (id, cliente_id, operacion_id, motivo, monto, moneda, conductor_id)
         VALUES (?, ?, ?, 'cancelacion', ?, ?, (SELECT conductor_id FROM operaciones WHERE id = ?))`,
      )
      .bind(nuevoId(), u.id, id, cargo, f.moneda, id)
      .run();
  return c.json({ ok: true, cargo });
});

/** C-VIAJE-PROPINA: propina después del viaje, con la tarjeta guardada (como Uber y Comida). */
viajesPasajero.post('/viajes/:id/propina', async (c) => {
  const u = exigir(c, 'cliente');
  const { centavos } = await leerCuerpo(
    c,
    z.object({ centavos: z.number().int().min(100).max(10_000) }),
  );
  return c.json({
    ok: true,
    propina: await propinaViaje(c.env, base(c), u.id, c.req.param('id'), centavos),
  });
});

// ---------------------------------------------------------------- M6: seguridad del viaje

/**
 * Botón de emergencia (pasajero o conductor): queda guardado con la ubicación, le llega al equipo
 * por correo y la app llama al número de emergencias del país que devuelve esta respuesta.
 * Nunca falla por el correo: lo importante es que quede registrado y que la app llame.
 */
export async function registrarEmergencia(
  c: Ctx,
  p: {
    operacionId: string;
    actorId: string;
    rol: 'pasajero' | 'conductor';
    lat?: number;
    lng?: number;
  },
) {
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT z.pais, o.zona_id, u.nombre, u.telefono FROM operaciones o JOIN zonas z ON z.id = o.zona_id
         JOIN usuarios u ON u.id = ? WHERE o.id = ?`,
    )
    .bind(p.actorId, p.operacionId)
    .first<{ pais: string; zona_id: string; nombre: string; telefono: string | null }>();
  const panicoId = nuevoId();
  await db
    .prepare(
      'INSERT INTO emergencias_viaje (id, operacion_id, actor_id, rol, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(panicoId, p.operacionId, p.actorId, p.rol, p.lat ?? null, p.lng ?? null)
    .run();
  await avisoEmergenciaViaje(c.env, {
    operacionId: p.operacionId,
    rol: p.rol,
    nombre: f?.nombre ?? '',
    donde: p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : 'sin ubicación',
  }).catch((e: unknown) => console.error('viajes: correo de emergencia', e));
  const panico = {
    usuarioId: p.actorId,
    zonaId: f?.zona_id,
    rol: p.rol,
    nombre: f?.nombre ?? '',
    telefono: f?.telefono,
    lat: p.lat,
    lng: p.lng,
    referencia: `Viaje ${p.operacionId}`,
    panicoId,
    smsEquipoHecho: true,
  };
  // C-PANICO-CENTRAL (24 nov 2026): el pánico de un VIAJE también va por SMS al equipo (antes, solo
  // el del repartidor), como pánico: sale a cualquier país y cuenta en su tope diario. Sin montos.
  // C-PANICO-SMS-POR-PERSONA: quien toca el botón una y otra vez no gasta los SMS de todos.
  if (await smsDePanicoPermitido(db, p.actorId))
    await smsEquipo(c.env, 'sistema', textoPanico(panico, 'un viaje'), TIPO_SMS_PANICO).catch(
      (e: unknown) => console.error('viajes: SMS de pánico al equipo', e),
    );
  // C-PANICO-ZONA: SMS (y aviso al celular) a la persona responsable de la zona del viaje.
  await avisarResponsableZona(c.env, db, panico).catch((e: unknown) =>
    console.error('viajes: pánico al responsable de la zona', e),
  );
  return { numero: numeroEmergencia(f?.pais) };
}

const cuerpoEmergencia = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

viajesPasajero.post('/viajes/:id/emergencia', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  if (!(await viajeDelCliente(base(c), u.id, id)))
    throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const d = await leerCuerpo(c, cuerpoEmergencia);
  return c.json(
    await registrarEmergencia(c, { operacionId: id, actorId: u.id, rol: 'pasajero', ...d }),
  );
});

/**
 * Compartir el viaje (Grab «Share My Ride», DiDi): un enlace largo y secreto que muestra el viaje
 * en vivo a quien lo reciba, sin cuenta. Se guarda solo su huella y deja de servir al terminar.
 */
viajesPasajero.post('/viajes/:id/compartir', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  const f = await viajeDelCliente(base(c), u.id, id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  if (['terminado', 'cancelado', 'sin_conductor', 'no_show'].includes(f.estado))
    throw new ErrorDatos('Este viaje ya terminó.', undefined, 409);
  const codigo = nuevoToken();
  await base(c)
    .prepare('INSERT INTO viajes_compartidos (huella, operacion_id, creado_por) VALUES (?, ?, ?)')
    .bind(await sha256(codigo), id, u.id)
    .run();
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  return c.json({ url: `${sitio}/ride/${codigo}` }, 201);
});

/** Lo que ve quien recibió el enlace: solo mientras el viaje no termine. */
viajesPasajero.get('/publico/viaje/:codigo', async (c) => {
  const codigo = c.req.param('codigo');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(codigo))
    throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const f = await base(c)
    .prepare(
      `SELECT o.id, v.estado, v.origen_direccion, v.destino_direccion, v.destino_lat, v.destino_lng,
              o.servicio_id, u.nombre AS conductor, d.lat, d.lng, d.ubicacion_en, h.marca, h.modelo, h.color, h.placa
         FROM viajes_compartidos s JOIN operaciones o ON o.id = s.operacion_id
         JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN usuarios u ON u.id = o.conductor_id
         LEFT JOIN repartidores d ON d.usuario_id = o.conductor_id
         LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
        WHERE s.huella = ?`,
    )
    .bind(await sha256(codigo))
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const estado = String(f.estado);
  // C-ENVIO-TEXTOS: la página dice si es un viaje de Moto, de Carro o un paquete.
  const servicio = String(f.servicio_id ?? 'moto');
  if (['terminado', 'cancelado', 'sin_conductor', 'no_show'].includes(estado))
    return c.json({ viaje: { estado, servicio, terminado: true } });
  return c.json({
    viaje: {
      estado,
      servicio,
      terminado: false,
      origen: sinCodigo(String(f.origen_direccion)),
      // C-VIAJE-PARADAS: quien acompaña el viaje ve por dónde para (solo la dirección y si ya se hizo).
      paradas: (await paradasDe(base(c), String(f.id))).map((p) => ({
        direccion: p.direccion,
        hecha: p.estado === 'visitada',
      })),
      destino: sinCodigo(String(f.destino_direccion)),
      conductor: f.conductor ? String(f.conductor).split(' ')[0] : null,
      vehiculo: f.conductor
        ? { marca: f.marca, modelo: f.modelo, color: f.color, placa: f.placa }
        : null,
      ubicacion: f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
      ubicacionEn: f.ubicacion_en ?? null,
    },
  });
});

/**
 * Pieza «viajes» de /datos/salud (M7, conciliación): ningún viaje cerrado hace más de 10 minutos
 * puede seguir con comisión apartada (se cobró o se devolvió), y ninguna deuda puede quedar
 * «cobrada» sin el viaje que la cobró. Si algo queda colgado, se ve en rojo.
 */
export async function saludViajes(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT
         -- Una sola pasada por las reservas de viajes (sin cruzar todo el libro con todas las
         -- operaciones): el id del viaje sale de la referencia «reserva_viaje:<viaje>:<conductor>:…».
         (SELECT COUNT(*) FROM (
            SELECT r.op, r.cuenta_id FROM (
              SELECT substr(l.referencia, 15, instr(substr(l.referencia, 15), ':') - 1) AS op,
                     l.cuenta_id, l.monto
                FROM libro l
               -- C-LECTURAS-SALUD: rango sobre la referencia (va por el índice único que ya
               -- existe); el LIKE recorría el libro entero en cada llamada al canario.
               WHERE l.referencia >= 'reserva_viaje:' AND l.referencia < 'reserva_viaje;'
                 AND l.bolsillo = 'reservado') r
            JOIN operaciones o ON o.id = r.op
           WHERE o.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
             AND o.actualizado_en < datetime('now', '-10 minutes')
           GROUP BY r.op, r.cuenta_id HAVING SUM(r.monto) != 0)) AS colgadas,
         (SELECT COUNT(*) FROM deudas_pasajero WHERE estado = 'cobrada' AND cobrada_en IS NULL) AS huerfanas,
         -- C-COMISION-MONEDA: una tarifa activa en una moneda que la comisión del país no cubre.
         (SELECT COUNT(*) FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
           WHERE t.activa = 1 AND EXISTS (SELECT 1 FROM politicas_financieras p
                   WHERE p.servicio = CASE t.servicio_id WHEN 'carro' THEN 'car' ELSE 'ride' END
                     AND p.tipo_cuenta = 'conductor' AND p.modalidad = 'prepago' AND p.activa = 1
                     AND p.revision_legal_aprobada = 1 AND p.pais IN (z.pais, '*'))
             AND NOT EXISTS (SELECT 1 FROM politicas_financieras p
                   WHERE p.servicio = CASE t.servicio_id WHEN 'carro' THEN 'car' ELSE 'ride' END
                     AND p.tipo_cuenta = 'conductor' AND p.modalidad = 'prepago' AND p.activa = 1
                     AND p.revision_legal_aprobada = 1 AND p.pais IN (z.pais, '*')
                     AND upper(p.moneda) = upper(t.moneda))) AS sin_comision`,
    )
    .first<{ colgadas: number; huerfanas: number; sin_comision: number }>();
  return Number(f?.colgadas) === 0 && Number(f?.huerfanas) === 0 && Number(f?.sin_comision) === 0
    ? 'ok'
    : 'error';
}

// ---------------------------------------------------------------- M8: calificación

export const esquemaCalificacionViaje = z.object({
  estrellas: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(500).default(''),
});

/** Guarda la calificación de un lado (una sola: repetir responde igual sin cambiarla). */
export async function calificarViaje(
  db: D1Database,
  p: {
    operacionId: string;
    de: 'pasajero' | 'conductor';
    autorId: string;
    estrellas: number;
    comentario: string;
  },
) {
  const v = await db
    .prepare('SELECT estado FROM viajes WHERE operacion_id = ?')
    .bind(p.operacionId)
    .first<{ estado: string }>();
  if (v?.estado !== 'terminado')
    throw new ErrorDatos('Solo se califica un viaje terminado.', undefined, 409);
  await db
    .prepare(
      'INSERT OR IGNORE INTO calificaciones_viaje (operacion_id, de, autor_id, estrellas, comentario) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(p.operacionId, p.de, p.autorId, p.estrellas, p.comentario)
    .run();
}

viajesPasajero.post('/viajes/:id/calificar', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  if (!(await viajeDelCliente(base(c), u.id, id)))
    throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const d = await leerCuerpo(c, esquemaCalificacionViaje);
  await calificarViaje(base(c), { operacionId: id, de: 'pasajero', autorId: u.id, ...d });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- M9: panel del superadmin

/** Lo que el superadmin vigila de Moto: emergencias abiertas, viajes recientes y tarifas activas. */
/** C-FILTROS-GUARDADOS: los estados de un viaje para el selector Vivos · Cerrados · Todos. */
export const ESTADOS_OPERACION = {
  vivos: ['pago_pendiente', 'buscando', 'asignada', 'en_curso'],
  cerrados: ['terminada', 'cancelada', 'sin_conductor'],
} as const;

viajesPasajero.get('/admin/viajes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  // C-FILTROS-GUARDADOS (15 nov 2026): ciudad, estado y código del viaje. Cada tipo de operación
  // va por su índice (tipo_operacion, creado_en) hacia atrás y se juntan en orden; los filtros de
  // ciudad y estado no eligen índice (`+`), así la consulta para en cuanto junta 50.
  const zona = (c.req.query('zona') ?? '').slice(0, 60);
  const e = c.req.query('estado') ?? 'todos';
  const estados =
    e === 'vivos' ? ESTADOS_OPERACION.vivos : e === 'cerrados' ? ESTADOS_OPERACION.cerrados : null;
  const codigo = (c.req.query('q') ?? '').trim().replace(/^#/, '').toLowerCase();
  const porCodigo = /^[0-9a-z_-]{3,100}$/.test(codigo) ? rangoPrefijo(codigo) : null;
  const filtros: string[] = [];
  const valores: unknown[] = [];
  // C-PERMISOS-FINOS: solo los viajes de la zona de trabajo y servicios de quien mira.
  const alc = filtroAlcance(accesoDe(c), {
    zona: '+o.zona_id',
    servicio: servicioOperacionSql('o.servicio_id'),
  });
  if (alc.sql) {
    filtros.push(alc.sql.replace(/^ AND /, ''));
    valores.push(...alc.valores);
  }
  if (porCodigo) {
    filtros.push('o.id >= ? AND o.id < ?');
    valores.push(...porCodigo);
  } else {
    if (zona) {
      filtros.push('+o.zona_id = ?');
      valores.push(zona);
    }
    if (estados) {
      filtros.push(`+o.estado_general IN (${estados.map(() => '?').join(', ')})`);
      valores.push(...estados);
    }
  }
  const unaParte = (tipo: string) =>
    db
      .prepare(
        `SELECT o.id, o.servicio_id, o.zona_id, o.creado_en, o.estado_general, v.estado, v.origen_direccion,
                v.destino_direccion, v.metodo_pago, v.total_final_centavos, q.total, q.moneda,
                p.nombre AS pasajero, d.nombre AS conductor, z.nombre AS ciudad,
                COALESCE(v.saldo_divoox, 0) AS saldo_divoox,
                (SELECT rg.monto FROM usos_cupon_divoox rg WHERE rg.operacion_id = o.id AND rg.estado <> 'liberado') AS regalo_monto
           FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
           LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
           LEFT JOIN usuarios p ON p.id = o.cliente_id
           LEFT JOIN usuarios d ON d.id = o.conductor_id
           LEFT JOIN zonas z ON z.id = o.zona_id
          WHERE ${porCodigo ? '+o.tipo_operacion' : 'o.tipo_operacion'} = ?${filtros.length ? ` AND ${filtros.join(' AND ')}` : ''}
          ORDER BY ${porCodigo ? '+o.creado_en' : 'o.creado_en'} DESC LIMIT 50`,
      )
      .bind(tipo, ...valores)
      .all<Record<string, unknown>>();
  const vivo = new Set<string>(ESTADOS_OPERACION.vivos);
  // C-MONITOREO-SERVICIOS: la pantalla de emergencias y tarifas pide `lista=0` (la lista de viajes
  // vive en «Pedidos en curso», paginada por clave); así no se leen viajes que nadie mira.
  const conLista = c.req.query('lista') !== '0';
  const vacia = Promise.resolve({ results: [] as Record<string, unknown>[] });
  const [emergencias, pasajeros, paquetes, tarifas] = await Promise.all([
    db
      .prepare(
        `SELECT e.id, e.operacion_id, e.rol, e.lat, e.lng, e.creado_en, u.nombre, u.correo, u.telefono
           FROM emergencias_viaje e JOIN usuarios u ON u.id = e.actor_id
          WHERE e.atendida_en IS NULL${alc.sql ? ` AND e.operacion_id IN (SELECT o.id FROM operaciones o WHERE 1 = 1${alc.sql})` : ''}
          ORDER BY e.creado_en DESC LIMIT 50`,
      )
      .bind(...alc.valores)
      .all<Record<string, unknown>>(),
    conLista ? unaParte('viaje_pasajero') : vacia,
    conLista ? unaParte('envio_paquete') : vacia,
    db
      .prepare(
        `SELECT t.*, z.nombre AS zona_nombre FROM tarifas_viaje t JOIN zonas z ON z.id = t.zona_id
          WHERE t.activa = 1 ORDER BY t.servicio_id, z.nombre`,
      )
      .all<FilaTarifa & { zona_nombre: string }>(),
  ]);
  // Los vivos primero; dentro de cada parte, el más reciente primero.
  const viajes = [...pasajeros.results, ...paquetes.results]
    .sort(
      (a, b) =>
        Number(vivo.has(String(b.estado_general))) - Number(vivo.has(String(a.estado_general))) ||
        String(b.creado_en).localeCompare(String(a.creado_en)),
    )
    .slice(0, 50)
    // C-SALDO-CLIENTE: lo que cubrió el Saldo Divoox y lo que se paga en mano, con la misma cuenta de
    // las apps (pagaEnMano); con tarjeta no hay nada en mano.
    .map((f) => {
      const total = f.total_final_centavos ?? f.total;
      return {
        ...f,
        saldoDivoox: Number(f.saldo_divoox ?? 0),
        regaloDivoox: Number(f.regalo_monto ?? 0),
        enMano:
          total == null || f.metodo_pago === 'tarjeta'
            ? null
            : pagaEnMano(
                Number(total),
                { monto: Number(f.regalo_monto ?? 0) },
                Number(f.saldo_divoox ?? 0),
              ),
      };
    });
  // C-PERMISOS-FINOS: el punto donde estaba quien pidió ayuda es la «ubicación en vivo» del viaje
  // para el equipo: solo con `viajes.ubicacion_en_vivo` (la tiene la plantilla «Emergencias»).
  const conUbicacion = tienePermiso(c, 'viajes.ubicacion_en_vivo');
  return c.json({
    emergencias: conUbicacion
      ? emergencias.results
      : emergencias.results.map((e) => ({ ...e, lat: null, lng: null })),
    viajes,
    tarifas: tarifas.results.map((f) => ({ ...tarifaPublica(f), zonaNombre: f.zona_nombre })),
  });
});

viajesPasajero.post('/admin/viajes/emergencias/:id/atender', async (c) => {
  const admin = exigir(c, 'admin');
  const { nota } = await leerCuerpo(c, z.object({ nota: z.string().trim().min(3).max(500) }));
  const r = await base(c)
    .prepare(
      "UPDATE emergencias_viaje SET atendida_en = datetime('now'), atendida_por = ?, nota = ? WHERE id = ? AND atendida_en IS NULL",
    )
    .bind(admin.id, nota, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa emergencia ya fue atendida.', undefined, 409);
  return c.json({ ok: true });
});
